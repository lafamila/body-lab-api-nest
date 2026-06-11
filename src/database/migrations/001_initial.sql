create extension if not exists pgcrypto;

create table if not exists taxonomy_categories (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('meal', 'exercise')),
  code text not null,
  label text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (kind, code)
);

create table if not exists body_weight_logs (
  id uuid primary key default gen_random_uuid(),
  account_id text not null,
  measured_at timestamptz not null,
  value_kg numeric(6, 3) not null,
  source text not null default 'manual',
  note text,
  client_event_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (account_id, client_event_id)
);

create table if not exists meal_logs (
  id uuid primary key default gen_random_uuid(),
  account_id text not null,
  occurred_at timestamptz not null,
  meal_category_id uuid references taxonomy_categories(id),
  label text,
  size text,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  client_event_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (account_id, client_event_id)
);

create table if not exists drink_logs (
  id uuid primary key default gen_random_uuid(),
  account_id text not null,
  occurred_at timestamptz not null,
  drink_type text not null check (drink_type in ('water', 'coffee', 'other')),
  amount_ml integer,
  caffeine_mg integer,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  client_event_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (account_id, client_event_id)
);

create table if not exists health_import_summaries (
  id uuid primary key default gen_random_uuid(),
  account_id text not null,
  source_type text not null check (source_type in ('body_mass', 'steps', 'workout')),
  period_start timestamptz not null,
  period_end timestamptz not null,
  external_id text,
  metric jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  client_event_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (account_id, client_event_id)
);

create table if not exists manual_workout_logs (
  id uuid primary key default gen_random_uuid(),
  account_id text not null,
  occurred_at timestamptz not null,
  exercise_category_id uuid references taxonomy_categories(id),
  duration_minutes integer,
  intensity text,
  calories integer,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  client_event_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (account_id, client_event_id)
);

create table if not exists bathroom_logs (
  id uuid primary key default gen_random_uuid(),
  account_id text not null,
  occurred_at timestamptz not null,
  bathroom_type text not null check (bathroom_type in ('urine', 'bowel')),
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  client_event_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (account_id, client_event_id)
);

create table if not exists prediction_snapshots (
  id uuid primary key default gen_random_uuid(),
  account_id text not null,
  target_date date not null,
  generated_at timestamptz not null,
  model_version text not null,
  predicted_weight_kg numeric(6, 3) not null,
  actual_weight_kg numeric(6, 3),
  explanation jsonb not null default '{}'::jsonb,
  input_summary jsonb not null default '{}'::jsonb,
  client_snapshot_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (account_id, client_snapshot_id)
);

create table if not exists sync_cursors (
  account_id text not null,
  client_id text not null,
  cursor text not null,
  last_seen_at timestamptz not null default now(),
  primary key (account_id, client_id)
);

create index if not exists body_weight_logs_account_updated_idx on body_weight_logs(account_id, updated_at);
create index if not exists meal_logs_account_updated_idx on meal_logs(account_id, updated_at);
create index if not exists drink_logs_account_updated_idx on drink_logs(account_id, updated_at);
create index if not exists health_import_summaries_account_updated_idx on health_import_summaries(account_id, updated_at);
create index if not exists manual_workout_logs_account_updated_idx on manual_workout_logs(account_id, updated_at);
create index if not exists bathroom_logs_account_updated_idx on bathroom_logs(account_id, updated_at);
create index if not exists prediction_snapshots_account_updated_idx on prediction_snapshots(account_id, updated_at);

insert into taxonomy_categories (kind, code, label, sort_order) values
  ('meal', 'breakfast', 'Breakfast', 10),
  ('meal', 'lunch', 'Lunch', 20),
  ('meal', 'dinner', 'Dinner', 30),
  ('meal', 'snack', 'Snack', 40),
  ('meal', 'high_sodium', 'High sodium', 50),
  ('meal', 'high_carb', 'High carb', 60),
  ('exercise', 'walk', 'Walk', 10),
  ('exercise', 'run', 'Run', 20),
  ('exercise', 'strength', 'Strength', 30),
  ('exercise', 'cycling', 'Cycling', 40),
  ('exercise', 'swim', 'Swim', 50),
  ('exercise', 'other', 'Other', 60)
on conflict (kind, code) do update set
  label = excluded.label,
  sort_order = excluded.sort_order,
  is_active = true,
  updated_at = now();
