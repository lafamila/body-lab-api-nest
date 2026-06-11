import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool, QueryResult, QueryResultRow } from 'pg';
import { BodyLabConfigService } from '../config/config.service';

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly pool: Pool;

  constructor(private readonly config: BodyLabConfigService) {
    this.pool = new Pool({
      connectionString: this.config.databaseUrl,
      ssl: this.config.databaseSsl ? { rejectUnauthorized: false } : undefined,
    });
  }

  query<T extends QueryResultRow = QueryResultRow>(
    sql: string,
    params: readonly unknown[] = [],
  ): Promise<QueryResult<T>> {
    return this.pool.query<T>(sql, [...params]);
  }

  async transaction<T>(work: (query: DatabaseService['query']) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    const query: DatabaseService['query'] = (sql, params = []) => client.query(sql, [...params]);
    try {
      await client.query('begin');
      const result = await work(query);
      await client.query('commit');
      return result;
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
