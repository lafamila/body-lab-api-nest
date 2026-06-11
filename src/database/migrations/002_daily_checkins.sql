create table if not exists daily_checkins (
  id uuid primary key default gen_random_uuid(),
  account_id text not null,
  local_date date not null,
  no_meals boolean not null default false,
  last_meal_at timestamptz,
  note text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, local_date)
);

create index if not exists daily_checkins_account_date_idx on daily_checkins(account_id, local_date);
