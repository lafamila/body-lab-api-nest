create table if not exists prediction_config_items (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('global', 'meal', 'drink', 'bathroom', 'workout')),
  key text not null,
  label text not null,
  mass_kg numeric(8, 4),
  stool_ratio numeric(8, 4),
  minute_factor numeric(8, 5),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (kind, key)
);

create index if not exists prediction_config_items_kind_sort_idx
  on prediction_config_items(kind, sort_order, key)
  where deleted_at is null;

insert into prediction_config_items (kind, key, label, mass_kg, stool_ratio, minute_factor, sort_order) values
  ('global', 'fasting_threshold_hours', 'Fasting threshold hours', 10.0000, null, null, 10),
  ('global', 'fasting_max_hours', 'Fasting max hours', 18.0000, null, null, 20),
  ('global', 'fasting_hour_kg', 'Fasting kg per hour', -0.0150, null, null, 30),
  ('global', 'steps_10000_kg', 'Steps kg per 10000', -0.0800, null, null, 40),
  ('global', 'delta_min_kg', 'Delta min kg', -1.2000, null, null, 50),
  ('global', 'delta_max_kg', 'Delta max kg', 1.2000, null, null, 60),
  ('meal', 'balanced', 'Balanced', 0.6000, 0.1800, null, 10),
  ('meal', 'protein', 'Protein', 0.3500, 0.1000, null, 20),
  ('meal', 'carb', 'Carb', 0.6000, 0.1400, null, 30),
  ('meal', 'vegetable', 'Vegetable', 0.4500, 0.2500, null, 40),
  ('meal', 'fried', 'Fried', 0.5000, 0.0800, null, 50),
  ('meal', 'sugar', 'Sugar', 0.2000, 0.0500, null, 60),
  ('meal', 'salt', 'Salt', 0.6000, 0.1400, null, 70),
  ('drink', 'water', 'Water', 1.0000, null, null, 10),
  ('drink', 'coffee', 'Coffee', 1.0000, null, null, 20),
  ('bathroom', 'urine', 'Urine', -0.6000, null, null, 10),
  ('bathroom', 'stool', 'Stool', null, null, null, 20),
  ('workout', 'walk', 'Walk', null, null, 0.00200, 10),
  ('workout', 'run', 'Run', null, null, 0.00200, 20),
  ('workout', 'strength', 'Strength', null, null, 0.00200, 30),
  ('workout', 'stairs', 'Stairs', null, null, 0.00200, 40),
  ('workout', 'pushup', 'Pushup', null, null, 0.00200, 50),
  ('workout', 'squat', 'Squat', null, null, 0.00200, 60),
  ('workout', 'lat_pulldown', 'Lat pulldown', null, null, 0.00200, 70)
on conflict (kind, key) do update set
  label = excluded.label,
  mass_kg = excluded.mass_kg,
  stool_ratio = excluded.stool_ratio,
  minute_factor = excluded.minute_factor,
  sort_order = excluded.sort_order,
  is_active = true,
  updated_at = now();
