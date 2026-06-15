update prediction_config_items
set mass_kg = 16.0000,
    metadata = '{"description":"Hours without meals before fasting weight-loss logic starts and before fasting time is shown as ready.","setupText":"Set the fasting threshold used by both forecast adjustment and red/green fasting status.","inputHint":"Use hours. Example: 16 means fasting adjustment starts after 16 hours.","unit":"hours","requiredInSetup":true}'::jsonb,
    updated_at = now()
where kind = 'global'
  and key = 'fasting_threshold_hours'
  and account_id is null
  and deleted_at is null;

update prediction_config_items
set deleted_at = now(),
    updated_at = now()
where kind = 'global'
  and key in ('fasting_max_hours', 'delta_min_kg', 'delta_max_kg')
  and deleted_at is null;
