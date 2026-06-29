create table if not exists prediction_config_items (
  id uuid primary key default gen_random_uuid(),
  account_id text,
  kind text not null check (kind in ('global', 'meal', 'drink', 'bathroom', 'workout')),
  key text not null,
  label text not null,
  mass_kg numeric(8, 4),
  stool_ratio numeric(8, 4),
  minute_factor numeric(8, 5),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (
    (kind = 'global' and account_id is null)
    or
    (kind <> 'global' and account_id is not null)
  )
);

create index if not exists prediction_config_items_kind_sort_idx
  on prediction_config_items(account_id, kind, sort_order, key)
  where deleted_at is null;

create unique index if not exists prediction_config_items_global_key_uidx
  on prediction_config_items(kind, key)
  where kind = 'global';

create unique index if not exists prediction_config_items_account_kind_key_uidx
  on prediction_config_items(account_id, kind, key)
  where kind <> 'global';

insert into prediction_config_items (kind, key, label, mass_kg, stool_ratio, minute_factor, sort_order) values
  ('global', 'fasting_threshold_hours', 'Fasting threshold hours', 16.0000, null, null, 10),
  ('global', 'fasting_hour_kg', 'Fasting kg per hour', -0.0200, null, null, 20),
  ('global', 'steps_10000_kg', 'Steps kg per 10000', -0.0800, null, null, 30),
  ('global', 'daily_base_delta_kg', 'Daily base delta kg', -0.2000, null, null, 40),
  ('global', 'next_day_fasted_weight_hour', 'Next-day fasted weight hour', 7.0000, null, null, 50)
on conflict (kind, key) where kind = 'global' do update set
  label = excluded.label,
  mass_kg = excluded.mass_kg,
  stool_ratio = excluded.stool_ratio,
  minute_factor = excluded.minute_factor,
  sort_order = excluded.sort_order,
  is_active = true,
  updated_at = now();
