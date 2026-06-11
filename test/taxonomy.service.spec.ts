import { TaxonomyService } from '../src/taxonomy/taxonomy.service';

describe('TaxonomyService', () => {
  it('reads server-managed categories by kind', async () => {
    const repository = {
      list: jest.fn(async () => [{ kind: 'meal', code: 'breakfast', label: 'Breakfast' }]),
    };
    const service = new TaxonomyService(repository as never);

    await expect(service.list('meal')).resolves.toEqual([{ kind: 'meal', code: 'breakfast', label: 'Breakfast' }]);
    expect(repository.list).toHaveBeenCalledWith('meal');
  });
});
