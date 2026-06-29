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
        predictionConfig: [{ kind: 'drink', key: 'coffee', label: 'Coffee', metadata: { shortcutKey: 'coffee' } }],
      },
      data: {
        weights: [{ measuredAt: '2026-06-11T00:00:00.000Z', valueKg: '104.9' }],
      },
    });

    expect(result.imported.predictionConfig).toBe(1);
    expect(config.replaceAll).toHaveBeenCalledWith('account-1', [
      expect.objectContaining({
        kind: 'drink',
        key: 'coffee',
        label: 'Coffee',
        isActive: true,
        metadata: expect.objectContaining({
          shortcutKey: 'coffee',
          iconKey: 'drink_coffee',
          inputMode: 'ml',
          defaultAmount: 500,
          defaultUnit: 'ml',
        }),
      }),
    ]);
    expect(exportImport.import).toHaveBeenCalledWith('account-1', {
      schemaVersion: 1,
      data: { weights: [{ measuredAt: '2026-06-11T00:00:00.000Z', valueKg: '104.9' }] },
    });
  });

  it('renders the hosted login entry button as 로그인', () => {
    const controller = new PredictionConfigController({} as never, {} as never, {} as never);
    const response = {
      type: jest.fn().mockReturnThis(),
      send: jest.fn(),
    };

    controller.adminLogin(response as never);

    expect(response.type).toHaveBeenCalledWith('html');
    expect(response.send).toHaveBeenCalledWith(expect.stringContaining('>로그인<'));
    expect(response.send).not.toHaveBeenCalledWith(expect.stringContaining('Login with Teddy Auth'));
  });

  it('renders kind-specific admin controls without a global creation picker', () => {
    const controller = new PredictionConfigController({} as never, {} as never, {} as never);
    const response = {
      type: jest.fn().mockReturnThis(),
      send: jest.fn(),
    };

    controller.admin(response as never);

    expect(response.type).toHaveBeenCalledWith('html');
    expect(response.send).toHaveBeenCalledWith(expect.stringContaining('global create disabled'));
    expect(response.send).toHaveBeenCalledWith(expect.stringContaining('kindTab-workout'));
    expect(response.send).not.toHaveBeenCalledWith(expect.stringContaining('<option value="global" disabled>global</option>'));
  });
});
