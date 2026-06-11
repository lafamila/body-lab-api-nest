import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

export interface TaxonomyCategory {
  id: string;
  kind: 'meal' | 'exercise';
  code: string;
  label: string;
  sortOrder: number;
  isActive: boolean;
}

interface TaxonomyRow {
  id: string;
  kind: 'meal' | 'exercise';
  code: string;
  label: string;
  sort_order: number;
  is_active: boolean;
}

@Injectable()
export class TaxonomyRepository {
  constructor(private readonly database: DatabaseService) {}

  async list(kind?: 'meal' | 'exercise'): Promise<TaxonomyCategory[]> {
    const params: unknown[] = [];
    const where = ['is_active = true'];
    if (kind) {
      params.push(kind);
      where.push(`kind = $${params.length}`);
    }
    const result = await this.database.query<TaxonomyRow>(
      `
        select id, kind, code, label, sort_order, is_active
        from taxonomy_categories
        where ${where.join(' and ')}
        order by kind asc, sort_order asc, label asc
      `,
      params,
    );
    return result.rows.map((row) => ({
      id: row.id,
      kind: row.kind,
      code: row.code,
      label: row.label,
      sortOrder: row.sort_order,
      isActive: row.is_active,
    }));
  }
}
