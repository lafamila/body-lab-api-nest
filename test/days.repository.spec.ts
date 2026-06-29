import { DaysRepository } from '../src/days/days.repository';

describe('DaysRepository', () => {
  const config = { localTimeZone: 'Asia/Seoul' };

  it('inserts a new weight measurement when upserting a day weight', async () => {
    const transactionQuery = jest.fn(async (sql: string, params: readonly unknown[] = []) => {
      if (sql.includes('insert into body_weight_logs')) {
        return { rows: [{ id: 'weight-1', client_event_id: params[3] }], rowCount: 1 };
      }
      throw new Error(`Unexpected transaction query: ${sql}`);
    });
    const database = {
      transaction: jest.fn(async (work: (query: typeof transactionQuery) => Promise<void>) => work(transactionQuery)),
      query: jest.fn(async (sql: string, _params: readonly unknown[] = []) => {
        if (sql.includes('from body_weight_logs')) {
          return {
            rows: [
              {
                id: 'weight-1',
                account_id: 'account-1',
                measured_at: '2026-06-10T23:00:00.000Z',
                value_kg: '72.2',
                local_date: '2026-06-11',
                client_event_id: 'weight:2026-06-10T23:00:00.000Z:1',
              },
            ],
            rowCount: 1,
          };
        }
        return { rows: [], rowCount: 0 };
      }),
    };
    const repository = new DaysRepository(database as never, config as never);

    const day = await repository.upsertDay('account-1', '2026-06-11', {
      morningWeightKg: 72.2,
      morningWeightMeasuredAt: '2026-06-10T23:00:00.000Z',
    });

    expect(day.weight).toMatchObject({ id: 'weight-1', valueKg: 72.2 });
    expect(day.weights).toHaveLength(1);
    expect(transactionQuery).toHaveBeenCalledTimes(1);
    expect(transactionQuery.mock.calls[0][0]).toContain('insert into body_weight_logs');
    expect(transactionQuery.mock.calls[0][1]).toEqual([
      'account-1',
      '2026-06-10T23:00:00.000Z',
      72.2,
      expect.stringMatching(/^weight:2026-06-10T23:00:00\.000Z:/),
    ]);
    expect(database.query.mock.calls[0][1]).toEqual([
      'account-1',
      '2026-06-11',
      'Asia/Seoul',
    ]);
  });

  it('loads same-day weights by local date even when the stored timestamp is the previous UTC day', async () => {
    const database = {
      query: jest.fn(async (sql: string, _params: readonly unknown[] = []) => {
        if (sql.includes('from body_weight_logs')) {
          return {
            rows: [
              {
                id: 'weight-1',
                account_id: 'account-1',
                measured_at: '2026-06-10T22:00:00.000Z',
                value_kg: '72.2',
                local_date: '2026-06-11',
                client_event_id: 'weight-1',
              },
            ],
            rowCount: 1,
          };
        }
        return { rows: [], rowCount: 0 };
      }),
    };
    const repository = new DaysRepository(database as never, config as never);

    const day = await repository.getDay('account-1', '2026-06-11');

    expect(day.weight).toMatchObject({ id: 'weight-1', valueKg: 72.2 });
    expect(day.weights).toEqual([expect.objectContaining({ id: 'weight-1', valueKg: 72.2 })]);
    expect(database.query.mock.calls[0][0]).toContain('measured_at at time zone $3');
    expect(database.query.mock.calls[0][1]).toEqual([
      'account-1',
      '2026-06-11',
      'Asia/Seoul',
    ]);
  });

  it('loads surrounding context rows for prediction input', async () => {
    const database = {
      query: jest.fn(async (sql: string, _params: readonly unknown[] = []) => {
        if (sql.includes('from meal_logs')) {
          return {
            rows: [
              {
                id: 'meal-1',
                account_id: 'account-1',
                occurred_at: '2026-06-10T10:00:00.000Z',
                label: 'carbon',
                size: '1.25',
              },
            ],
            rowCount: 1,
          };
        }
        return { rows: [], rowCount: 0 };
      }),
    };
    const repository = new DaysRepository(database as never, config as never);

    const day = await repository.getDay('account-1', '2026-06-11');

    expect(day.contextDates).toEqual(['2026-06-10', '2026-06-11', '2026-06-12']);
    expect(day.meals).toEqual([
      expect.objectContaining({ id: 'meal-1', label: 'carbon', size: '1.25' }),
    ]);
    const mealQuery = database.query.mock.calls.find(([sql]) => sql.includes('from meal_logs'));
    expect(mealQuery?.[0]).toContain("between ($2::date - interval '1 day') and ($2::date + interval '1 day')");
    expect(mealQuery?.[1]).toEqual(['account-1', '2026-06-11', 'Asia/Seoul']);
  });
});
