import { BadRequestException } from '@nestjs/common';
import { ExportImportService } from '../src/export-import/export-import.service';

describe('ExportImportService', () => {
  it('exports and imports account-scoped data without payload account ownership', async () => {
    const logs = {
      list: jest.fn(async (resource: string) => [{ clientEventId: `${resource}-1` }]),
      replaceAll: jest.fn(async (_resource: string, _accountId: string, rows: unknown[]) => rows),
    };
    const predictions = {
      list: jest.fn(async () => [{ clientSnapshotId: 'prediction-1' }]),
      replaceAll: jest.fn(async (_accountId: string, rows: unknown[]) => rows),
    };
    const sync = { publish: jest.fn(async () => undefined) };
    const service = new ExportImportService(logs as never, predictions as never, sync as never);

    const exported = await service.export('account-1');
    const imported = await service.import('account-2', exported);

    expect(exported.schemaVersion).toBe(1);
    expect(logs.list).toHaveBeenCalledWith('weights', 'account-1');
    expect(logs.replaceAll).toHaveBeenCalledWith('weights', 'account-2', [{ clientEventId: 'weights-1' }]);
    expect(imported.imported.predictions).toBe(1);
    expect(exported.data['daily-checkins']).toBeUndefined();
    expect(sync.publish).toHaveBeenCalledWith('account-2', 'export-import', 'imported', expect.any(Object));
  });

  it('rejects import rows that carry account ownership fields', async () => {
    const service = new ExportImportService({} as never, {} as never, {} as never);

    await expect(
      service.import('account-1', {
        schemaVersion: 1,
        data: { weights: [{ accountId: 'other', measuredAt: '2026-06-10T00:00:00.000Z', valueKg: 72 }] },
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
