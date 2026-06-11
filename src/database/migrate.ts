import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Pool } from 'pg';
import { loadAppConfig } from '../config/app-config';

async function main(): Promise<void> {
  const config = loadAppConfig();
  const pool = new Pool({
    connectionString: config.databaseUrl,
    ssl: config.databaseSsl ? { rejectUnauthorized: false } : undefined,
  });

  try {
    await pool.query(`
      create table if not exists schema_migrations (
        version text primary key,
        applied_at timestamptz not null default now()
      )
    `);

    const migrationDir = join(__dirname, 'migrations');
    const files = (await readdir(migrationDir)).filter((file) => file.endsWith('.sql')).sort();

    for (const file of files) {
      const version = file.replace(/\.sql$/, '');
      const existing = await pool.query('select 1 from schema_migrations where version = $1', [version]);
      if (existing.rowCount) {
        continue;
      }

      const sql = await readFile(join(migrationDir, file), 'utf8');
      await pool.query('begin');
      try {
        await pool.query(sql);
        await pool.query('insert into schema_migrations (version) values ($1)', [version]);
        await pool.query('commit');
        console.log(`applied ${file}`);
      } catch (error) {
        await pool.query('rollback');
        throw error;
      }
    }
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
