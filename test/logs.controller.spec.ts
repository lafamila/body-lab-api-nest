import { LogsController } from '../src/logs/logs.controller';

describe('LogsController delete contract', () => {
  it('exposes delete routes for every non-weight record resource', async () => {
    const service = {
      delete: jest.fn(async (resource: string) => ({ id: `${resource}-1`, deletedAt: 'now' })),
    };
    const controller = new LogsController(service as never);
    const account = {
      accountId: 'account-1',
      subject: 'subject-1',
      serviceKey: 'body-lab',
      permission: 'owner',
      claims: {},
    };

    await controller.deleteMeal(account, 'meal-1');
    await controller.deleteDrink(account, 'drink-1');
    await controller.deleteHealthImport(account, 'health-1');
    await controller.deleteManualWorkout(account, 'workout-1');
    await controller.deleteBathroom(account, 'bathroom-1');

    expect(service.delete.mock.calls).toEqual([
      ['meals', 'account-1', 'meal-1'],
      ['drinks', 'account-1', 'drink-1'],
      ['health-imports', 'account-1', 'health-1'],
      ['manual-workouts', 'account-1', 'workout-1'],
      ['bathroom', 'account-1', 'bathroom-1'],
    ]);
  });
});
