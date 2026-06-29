insert into prediction_config_items
  (kind, key, label, mass_kg, stool_ratio, minute_factor, sort_order, is_active, metadata)
values
  (
    'global',
    'next_day_fasted_weight_hour',
    'Next-day fasted weight hour',
    7.0000,
    null,
    null,
    50,
    true,
    '{"description":"Local hour used for the next-day fasted weight target.","setupText":"Set the local hour for next-day fasted weight prediction.","inputHint":"Use local hour, 0-23. Example: 7 means 07:00.","unit":"hour","requiredInSetup":true}'::jsonb
  )
on conflict (kind, key) where kind = 'global' and account_id is null do update set
  label = excluded.label,
  mass_kg = excluded.mass_kg,
  stool_ratio = excluded.stool_ratio,
  minute_factor = excluded.minute_factor,
  sort_order = excluded.sort_order,
  is_active = true,
  metadata = excluded.metadata,
  updated_at = now();
