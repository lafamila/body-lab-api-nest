export type LogResource =
  | 'weights'
  | 'meals'
  | 'drinks'
  | 'health-imports'
  | 'manual-workouts'
  | 'bathroom';

export interface LogTableConfig {
  table: string;
  resource: LogResource;
  columns: Record<string, string>;
  jsonColumns?: Set<string>;
}

export const LOG_TABLES: Record<LogResource, LogTableConfig> = {
  weights: {
    resource: 'weights',
    table: 'body_weight_logs',
    columns: {
      measuredAt: 'measured_at',
      valueKg: 'value_kg',
      source: 'source',
      note: 'note',
      clientEventId: 'client_event_id',
    },
  },
  meals: {
    resource: 'meals',
    table: 'meal_logs',
    columns: {
      occurredAt: 'occurred_at',
      mealCategoryId: 'meal_category_id',
      label: 'label',
      size: 'size',
      notes: 'notes',
      metadata: 'metadata',
      clientEventId: 'client_event_id',
    },
    jsonColumns: new Set(['metadata']),
  },
  drinks: {
    resource: 'drinks',
    table: 'drink_logs',
    columns: {
      occurredAt: 'occurred_at',
      drinkType: 'drink_type',
      amountMl: 'amount_ml',
      caffeineMg: 'caffeine_mg',
      notes: 'notes',
      metadata: 'metadata',
      clientEventId: 'client_event_id',
    },
    jsonColumns: new Set(['metadata']),
  },
  'health-imports': {
    resource: 'health-imports',
    table: 'health_import_summaries',
    columns: {
      sourceType: 'source_type',
      periodStart: 'period_start',
      periodEnd: 'period_end',
      externalId: 'external_id',
      metric: 'metric',
      metadata: 'metadata',
      clientEventId: 'client_event_id',
    },
    jsonColumns: new Set(['metric', 'metadata']),
  },
  'manual-workouts': {
    resource: 'manual-workouts',
    table: 'manual_workout_logs',
    columns: {
      occurredAt: 'occurred_at',
      exerciseCategoryId: 'exercise_category_id',
      durationMinutes: 'duration_minutes',
      intensity: 'intensity',
      calories: 'calories',
      notes: 'notes',
      metadata: 'metadata',
      clientEventId: 'client_event_id',
    },
    jsonColumns: new Set(['metadata']),
  },
  bathroom: {
    resource: 'bathroom',
    table: 'bathroom_logs',
    columns: {
      occurredAt: 'occurred_at',
      bathroomType: 'bathroom_type',
      notes: 'notes',
      metadata: 'metadata',
      clientEventId: 'client_event_id',
    },
    jsonColumns: new Set(['metadata']),
  },
};
