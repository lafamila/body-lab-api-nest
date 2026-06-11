import { PredictionsService } from '../src/predictions/predictions.service';

describe('PredictionsService', () => {
  it('stores prediction snapshots and publishes sync notifications', async () => {
    const row = {
      id: 'prediction-1',
      targetDate: '2026-06-12',
      predictedWeightKg: 71.8,
      updatedAt: '2026-06-11T12:00:00.000Z',
    };
    const repository = {
      create: jest.fn(async () => row),
    };
    const sync = { publish: jest.fn(async () => undefined) };
    const service = new PredictionsService(repository as never, sync as never);

    await expect(
      service.create('account-1', {
        targetDate: '2026-06-12',
        generatedAt: '2026-06-11T12:00:00.000Z',
        modelVersion: 'swift-v1',
        predictedWeightKg: 71.8,
      }),
    ).resolves.toBe(row);

    expect(sync.publish).toHaveBeenCalledWith('account-1', 'predictions', 'created', row);
  });
});
