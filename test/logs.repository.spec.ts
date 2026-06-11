import { LogsRepository } from '../src/logs/logs.repository';

describe('LogsRepository account scoping', () => {
  it('lists logs with account_id filtering first', async () => {
    const calls: { sql: string; params: readonly unknown[] }[] = [];
    const database = {
      query: jest.fn(async (sql: string, params: readonly unknown[]) => {
        calls.push({ sql, params });
        return { rows: [], rowCount: 0 };
      }),
    };
    const repository = new LogsRepository(database as never);

    await repository.list('weights', 'account-1');

    expect(calls[0].sql).toContain('account_id = $1');
    expect(calls[0].params[0]).toBe('account-1');
  });

  it('updates logs only when both id and account_id match', async () => {
    const database = {
      query: jest.fn(async (sql: string, params: readonly unknown[]) => ({
        rows: [
          {
            id: 'row-1',
            account_id: params[0],
            measured_at: '2026-06-10T00:00:00.000Z',
            value_kg: '72.1',
            created_at: '2026-06-10T00:00:00.000Z',
            updated_at: '2026-06-10T00:00:00.000Z',
          },
        ],
        rowCount: 1,
      })),
    };
    const repository = new LogsRepository(database as never);

    await repository.update('weights', 'account-1', 'row-1', { valueKg: 72.1 });

    expect(database.query.mock.calls[0][0]).toContain('where account_id = $1 and id = $2');
    expect(database.query.mock.calls[0][1][0]).toBe('account-1');
    expect(database.query.mock.calls[0][1][1]).toBe('row-1');
  });
});
