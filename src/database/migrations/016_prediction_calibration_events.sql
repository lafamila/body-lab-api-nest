create table if not exists prediction_calibration_events (
  id uuid primary key default gen_random_uuid(),
  account_id text not null,
  previous_weight_id uuid references body_weight_logs(id),
  new_weight_id uuid not null references body_weight_logs(id),
  predicted_weight_kg numeric(6, 3) not null,
  actual_weight_kg numeric(6, 3) not null,
  residual_kg numeric(6, 3) not null,
  proposed_patches jsonb not null default '[]'::jsonb,
  applied_patches jsonb not null default '[]'::jsonb,
  status text not null check (status in ('applied', 'skipped')),
  reason text,
  created_at timestamptz not null default now(),
  unique (account_id, new_weight_id)
);

create index if not exists prediction_calibration_events_account_created_idx
  on prediction_calibration_events(account_id, created_at desc);
