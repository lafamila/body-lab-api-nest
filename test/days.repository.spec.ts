import { DaysRepository } from '../src/days/days.repository';

describe('DaysRepository', () => {
  it('updates an existing daily weight by client_event_id before trying to insert', async () => {
    const transactionQuery = jest.fn(async (sql: string, _params: readonly unknown[] = []) => {
      if (sql.includes('where account_id = $1') && sql.includes('and client_event_id = $4')) {
        return { rows: [{ id: 'weight-1' }], rowCount: 1 };
      }
      throw new Error(`Unexpected transaction query: ${sql}`);
    });
    const database = {
      transaction: jest.fn(async (work: (query: typeof transactionQuery) => Promise<void>) => work(transactionQuery)),
      query: jest.fn(async (sql: string) => {
        if (sql.includes('from body_weight_logs')) {
          return {
            rows: [
              {
                id: 'weight-1',
                account_id: 'account-1',
                measured_at: '2026-06-10T23:00:00.000Z',
                value_kg: '72.2',
                client_event_id: 'daily-weight:2026-06-11',
              },
            ],
            rowCount: 1,
          };
        }
        return { rows: [], rowCount: 0 };
      }),
    };
    const repository = new DaysRepository(database as never);

    const day = await repository.upsertDay('account-1', '2026-06-11', {
      morningWeightKg: 72.2,
      morningWeightMeasuredAt: '2026-06-10T23:00:00.000Z',
    });

    expect(day.weight).toMatchObject({ id: 'weight-1', valueKg: 72.2 });
    expect(transactionQuery).toHaveBeenCalledTimes(1);
    expect(transactionQuery.mock.calls[0][0]).toContain('and client_event_id = $4');
    expect(transactionQuery.mock.calls[0][1]).toEqual([
      'account-1',
      '2026-06-10T23:00:00.000Z',
      72.2,
      'daily-weight:2026-06-11',
    ]);
  });
});
