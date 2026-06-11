import { UpsertPredictionConfigItemDto } from '../src/prediction-config/dto';
import { PredictionConfigRepository } from '../src/prediction-config/prediction-config.repository';
import { PredictionConfigService } from '../src/prediction-config/prediction-config.service';

const baseRow = {
  id: '11111111-1111-1111-1111-111111111111',
  kind: 'global',
  key: 'fasting_threshold_hours',
  label: 'Fasting threshold hours',
  mass_kg: '10.0000',
  stool_ratio: null,
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
        rows: [{ ...baseRow, metadata: JSON.parse(String(params[8])) }],
        rowCount: 1,
      })),
    };
    const repository = new PredictionConfigRepository(database as never);

    const item = await repository.upsert({
      kind: 'global',
      key: 'fasting_threshold_hours',
      label: 'Fasting threshold hours',
      massKg: 10,
      metadata: { description: 'Fasting starts after this many hours.', unit: 'hours', requiredInSetup: true },
    });

    expect(database.query.mock.calls[0][1][8]).toBe(
      JSON.stringify({ description: 'Fasting starts after this many hours.', unit: 'hours', requiredInSetup: true }),
    );
    expect(item.metadata).toEqual({
      description: 'Fasting starts after this many hours.',
      unit: 'hours',
      requiredInSetup: true,
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

    const status = await service.status();

    expect(status.isReady).toBe(false);
    expect(status.requiresSetup).toBe(true);
    expect(status.missingGlobalKeys).toEqual([
      'fasting_max_hours',
      'fasting_hour_kg',
      'steps_10000_kg',
      'delta_min_kg',
      'delta_max_kg',
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

    await service.upsert({
      kind: 'meal',
      key: 'balanced',
      label: 'Balanced',
      massKg: 0.6,
      metadata: { description: 'Meal' },
    });

    expect(sync.publishPredictionConfig).toHaveBeenCalledWith([
      expect.objectContaining({ metadata: { description: 'Meal' } }),
    ]);
  });
});
