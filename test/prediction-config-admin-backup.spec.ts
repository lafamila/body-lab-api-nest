import { PredictionConfigController } from '../src/prediction-config/prediction-config.controller';

describe('PredictionConfigController admin backup', () => {
  const account = {
    accountId: 'account-1',
    subject: 'lafamila',
    serviceKey: 'body-lab',
    permission: 'owner',
    claims: {},
  };

  it('exports personal data and prediction config together', async () => {
    const exportImport = {
      export: jest.fn(async () => ({
        schemaVersion: 1,
        exportedAt: '2026-06-11T00:00:00.000Z',
        data: { weights: [{ valueKg: '104.9' }] },
      })),
    };
    const config = {
      list: jest.fn(async () => [{ kind: 'global', key: 'fasting_hour_kg', label: 'Fasting kg per hour' }]),
    };
    const controller = new PredictionConfigController(config as never, exportImport as never, {} as never);

    const backup = await controller.exportAdminBackup(account);

    expect(backup.schemaVersion).toBe(1);
    expect(backup.config.predictionConfig).toEqual([{ kind: 'global', key: 'fasting_hour_kg', label: 'Fasting kg per hour' }]);
    expect(backup.data).toEqual({ weights: [{ valueKg: '104.9' }] });
    expect(exportImport.export).toHaveBeenCalledWith('account-1');
    expect(config.list).toHaveBeenCalledWith('account-1', true);
  });

  it('imports config and personal data from one backup payload', async () => {
    const exportImport = {
      import: jest.fn(async () => ({ imported: { weights: 1 } })),
    };
    const config = {
      replaceAll: jest.fn(async () => [{ kind: 'meal', key: 'protein', label: 'Protein' }]),
    };
    const controller = new PredictionConfigController(config as never, exportImport as never, {} as never);

    const result = await controller.importAdminBackup(account, {
      schemaVersion: 1,
      config: {
        predictionConfig: [{ kind: 'meal', key: 'protein', label: 'Protein' }],
      },
      data: {
        weights: [{ measuredAt: '2026-06-11T00:00:00.000Z', valueKg: '104.9' }],
      },
    });

    expect(result.imported.predictionConfig).toBe(1);
    expect(config.replaceAll).toHaveBeenCalledWith('account-1', [
      expect.objectContaining({ kind: 'meal', key: 'protein', label: 'Protein', isActive: true }),
    ]);
    expect(exportImport.import).toHaveBeenCalledWith('account-1', {
      schemaVersion: 1,
      data: { weights: [{ measuredAt: '2026-06-11T00:00:00.000Z', valueKg: '104.9' }] },
    });
  });
});
