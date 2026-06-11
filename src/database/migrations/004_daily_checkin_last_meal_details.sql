alter table daily_checkins
  add column if not exists last_meal_category text,
  add column if not exists last_meal_portion numeric(8, 4);
