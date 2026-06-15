insert into prediction_config_items
  (kind, key, label, mass_kg, stool_ratio, minute_factor, sort_order, is_active, metadata)
values
  (
    'global',
    'daily_base_delta_kg',
    'Daily base delta kg',
    0.0000,
    null,
    null,
    45,
    true,
    '{"description":"Weight delta applied once per day between the baseline fasted weight time and the prediction target time.","setupText":"Set the automatic daily prediction offset.","inputHint":"Use kg per day. Example: -0.2 reduces the next-day forecast by 0.2.","unit":"kg/day","requiredInSetup":true}'::jsonb
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
