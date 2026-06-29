import { UpsertPredictionConfigItemDto } from '../src/prediction-config/dto';
import { PredictionConfigRepository } from '../src/prediction-config/prediction-config.repository';
import { PredictionConfigService } from '../src/prediction-config/prediction-config.service';

const baseRow = {
  id: '11111111-1111-1111-1111-111111111111',
  kind: 'meal',
  key: 'balanced',
  label: 'Balanced',
  mass_kg: '0.6000',
  stool_ratio: '0.1800',
  minute_factor: null,
  sort_order: 10,
  is_active: true,
  metadata: { description: 'Fasting starts after this many hours.', unit: 'hours', requiredInSetup: true },
  updated_at: '2026-06-10T00:00:00.000Z',
};

describe('PredictionConfigRepository', () => {
  it('round-trips metadata on upsert', async () => {
    const database = {
      query: jest.fn(async (_sql: string, params: readonly unknown[]) => ({
        rows: [{ ...baseRow, metadata: JSON.parse(String(params[9])) }],
        rowCount: 1,
      })),
    };
    const repository = new PredictionConfigRepository(database as never);

    const item = await repository.upsert('account-1', {
      kind: 'meal',
      key: 'balanced',
      label: 'Balanced',
      massKg: 0.6,
      stoolRatio: 0.18,
      metadata: {
        description: 'Meal mass contribution.',
        unit: 'kg',
        requiredInSetup: false,
        iconKey: 'meal_balance',
        inputMode: 'portion_size',
        shortcutKey: 'balance',
      },
    });

    expect(database.query.mock.calls[0][1][9]).toBe(
      JSON.stringify({
        description: 'Meal mass contribution.',
        unit: 'kg',
        requiredInSetup: false,
        iconKey: 'meal_balance',
        inputMode: 'portion_size',
        shortcutKey: 'balance',
      }),
    );
    expect(database.query.mock.calls[0][0]).toContain(
      'on conflict (account_id, kind, key) where account_id is not null',
    );
    expect(item.metadata).toEqual({
      description: 'Meal mass contribution.',
      unit: 'kg',
      requiredInSetup: false,
      iconKey: 'meal_balance',
      inputMode: 'portion_size',
      shortcutKey: 'balance',
    });
  });
});

describe('PredictionConfigService', () => {
  it('reports missing required globals and inactive kinds', async () => {
    const repository = {
      list: jest.fn(async () => [
        {
          id: 'global-1',
          kind: 'global',
          key: 'fasting_threshold_hours',
          label: 'Fasting threshold hours',
          massKg: 10,
          stoolRatio: null,
          minuteFactor: null,
          sortOrder: 10,
          isActive: true,
          metadata: {},
          updatedAt: '2026-06-10T00:00:00.000Z',
        },
        {
          id: 'meal-1',
          kind: 'meal',
          key: 'balanced',
          label: 'Balanced',
          massKg: 0.6,
          stoolRatio: 0.18,
          minuteFactor: null,
          sortOrder: 10,
          isActive: true,
          metadata: {},
          updatedAt: '2026-06-10T00:00:00.000Z',
        },
      ]),
    };
    const service = new PredictionConfigService(repository as never, {} as never);

    const status = await service.status('account-1');

    expect(status.isReady).toBe(false);
    expect(status.requiresSetup).toBe(true);
    expect(repository.list).toHaveBeenCalledWith('account-1', false);
    expect(status.missingGlobalKeys).toEqual([
      'fasting_hour_kg',
      'steps_10000_kg',
      'daily_base_delta_kg',
    ]);
    expect(status.missingKinds).toEqual(['drink', 'bathroom', 'workout']);
    expect(status.requiredGlobals[0]).toMatchObject({
      key: 'fasting_threshold_hours',
      present: true,
      item: expect.objectContaining({ key: 'fasting_threshold_hours' }),
    });
  });

  it('publishes active config metadata after mutations', async () => {
    const repository = {
      upsert: jest.fn(async (payload: UpsertPredictionConfigItemDto) => ({
        id: 'item-1',
        ...payload,
        metadata: payload.metadata ?? {},
        updatedAt: 'now',
      })),
      list: jest.fn(async () => [{ id: 'item-1', kind: 'meal', key: 'balanced', metadata: { description: 'Meal' } }]),
    };
    const sync = { publishPredictionConfig: jest.fn(async () => undefined) };
    const service = new PredictionConfigService(repository as never, sync as never);

    await service.upsert('account-1', {
      kind: 'meal',
      key: 'balanced',
      label: 'Balanced',
      massKg: 0.6,
      metadata: { description: 'Meal' },
    });

    expect(repository.upsert).toHaveBeenCalledWith(
      'account-1',
      expect.objectContaining({
        kind: 'meal',
        key: 'balanced',
        metadata: expect.objectContaining({
          description: 'Meal',
          iconKey: 'meal_default',
          inputMode: 'portion_size',
        }),
      }),
    );
    expect(sync.publishPredictionConfig).toHaveBeenCalledWith('account-1', [
      expect.objectContaining({
        metadata: expect.objectContaining({
          description: 'Meal',
          iconKey: 'meal_default',
          inputMode: 'portion_size',
        }),
      }),
    ]);
  });

  it('fills shortcut metadata defaults for shortcut-backed items', async () => {
    const repository = {
      upsert: jest.fn(async (payload: UpsertPredictionConfigItemDto) => ({
        id: 'drink-1',
        ...payload,
        metadata: payload.metadata ?? {},
        updatedAt: 'now',
      })),
      list: jest.fn(async () => []),
    };
    const sync = { publishPredictionConfig: jest.fn(async () => undefined) };
    const service = new PredictionConfigService(repository as never, sync as never);

    await service.upsert('account-1', {
      kind: 'drink',
      key: 'coffee',
      label: 'Coffee',
      massKg: 0.5,
      metadata: { shortcutKey: 'coffee' },
    });

    expect(repository.upsert).toHaveBeenCalledWith(
      'account-1',
      expect.objectContaining({
        metadata: {
          shortcutKey: 'coffee',
          iconKey: 'drink_coffee',
          inputMode: 'ml',
          defaultAmount: 500,
          defaultUnit: 'ml',
        },
      }),
    );
  });

  it('rejects global creation because global keys are seeded and fixed', async () => {
    const service = new PredictionConfigService({} as never, {} as never);

    await expect(
      service.upsert('account-1', {
        kind: 'global',
        key: 'new_global',
        label: 'New global',
        massKg: 1,
      }),
    ).rejects.toThrow('Global prediction config keys cannot be created');
  });
});
