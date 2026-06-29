update prediction_config_items
set mass_kg = -0.0200,
    updated_at = now()
where kind = 'global'
  and key = 'fasting_hour_kg'
  and deleted_at is null;

update prediction_config_items
set mass_kg = -0.2000,
    updated_at = now()
where kind = 'global'
  and key = 'daily_base_delta_kg'
  and deleted_at is null;
