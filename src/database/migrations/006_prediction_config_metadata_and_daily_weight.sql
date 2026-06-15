alter table prediction_config_items
  add column if not exists metadata jsonb not null default '{}'::jsonb;

with metadata_seed(kind, key, metadata) as (
  values
    ('global', 'fasting_threshold_hours', '{"description":"Hours without meals before fasting weight-loss logic starts and before fasting time is shown as ready.","setupText":"Set the fasting threshold used by both forecast adjustment and red/green fasting status.","inputHint":"Use hours. Example: 16 means fasting adjustment starts after 16 hours.","unit":"hours","requiredInSetup":true}'::jsonb),
    ('global', 'fasting_hour_kg', '{"description":"Weight delta applied for each fasting hour after the threshold.","setupText":"Set the per-hour fasting weight effect.","inputHint":"Use kg per hour. Negative values reduce predicted weight.","unit":"kg/hour","requiredInSetup":true}'::jsonb),
    ('global', 'steps_10000_kg', '{"description":"Weight delta applied for each 10,000 steps.","setupText":"Set the activity effect from steps.","inputHint":"Use kg per 10,000 steps. Negative values reduce predicted weight.","unit":"kg/10000 steps","requiredInSetup":true}'::jsonb),
    ('meal', 'balanced', '{"description":"Default mixed meal weight contribution.","setupText":"Balanced meals can be used as the default meal item.","inputHint":"massKg is added per serving; stoolRatio estimates later bowel output.","unit":"kg","requiredInSetup":false}'::jsonb),
    ('meal', 'protein', '{"description":"Protein-focused meal weight contribution.","setupText":"Protein meals are available as an active meal option.","inputHint":"massKg is added per serving; stoolRatio estimates later bowel output.","unit":"kg","requiredInSetup":false}'::jsonb),
    ('meal', 'carb', '{"description":"Carbohydrate-focused meal weight contribution.","setupText":"Carb meals are available as an active meal option.","inputHint":"massKg is added per serving; stoolRatio estimates later bowel output.","unit":"kg","requiredInSetup":false}'::jsonb),
    ('meal', 'vegetable', '{"description":"Vegetable-focused meal weight contribution.","setupText":"Vegetable meals are available as an active meal option.","inputHint":"massKg is added per serving; stoolRatio estimates later bowel output.","unit":"kg","requiredInSetup":false}'::jsonb),
    ('meal', 'fried', '{"description":"Fried meal weight contribution.","setupText":"Fried meals are available as an active meal option.","inputHint":"massKg is added per serving; stoolRatio estimates later bowel output.","unit":"kg","requiredInSetup":false}'::jsonb),
    ('meal', 'sugar', '{"description":"Sweet snack or sugar-heavy meal contribution.","setupText":"Sugar items are available as an active meal option.","inputHint":"massKg is added per serving; stoolRatio estimates later bowel output.","unit":"kg","requiredInSetup":false}'::jsonb),
    ('meal', 'salt', '{"description":"High-sodium meal contribution.","setupText":"Salt-heavy meals are available as an active meal option.","inputHint":"massKg is added per serving; stoolRatio estimates later bowel output.","unit":"kg","requiredInSetup":false}'::jsonb),
    ('drink', 'water', '{"description":"Water mass contribution per milliliter unit used by the client.","setupText":"Water is available as an active drink option.","inputHint":"massKg maps the client amount unit into prediction mass.","unit":"kg/unit","requiredInSetup":false}'::jsonb),
    ('drink', 'coffee', '{"description":"Coffee mass contribution per milliliter unit used by the client.","setupText":"Coffee is available as an active drink option.","inputHint":"massKg maps the client amount unit into prediction mass.","unit":"kg/unit","requiredInSetup":false}'::jsonb),
    ('bathroom', 'urine', '{"description":"Estimated weight reduction for a urine event.","setupText":"Urine is available as an active bathroom option.","inputHint":"Use a negative massKg because this removes body mass.","unit":"kg/event","requiredInSetup":false}'::jsonb),
    ('bathroom', 'stool', '{"description":"Bowel event marker used with meal stool ratios.","setupText":"Stool is available as an active bathroom option.","inputHint":"Meal stoolRatio values estimate the mass effect for bowel output.","unit":"ratio","requiredInSetup":false}'::jsonb),
    ('workout', 'walk', '{"description":"Walking weight effect per workout minute.","setupText":"Walking is available as an active workout option.","inputHint":"minuteFactor is applied per minute; higher values increase weight reduction.","unit":"kg/min","requiredInSetup":false}'::jsonb),
    ('workout', 'run', '{"description":"Running weight effect per workout minute.","setupText":"Running is available as an active workout option.","inputHint":"minuteFactor is applied per minute; higher values increase weight reduction.","unit":"kg/min","requiredInSetup":false}'::jsonb),
    ('workout', 'strength', '{"description":"Strength training weight effect per workout minute.","setupText":"Strength training is available as an active workout option.","inputHint":"minuteFactor is applied per minute; higher values increase weight reduction.","unit":"kg/min","requiredInSetup":false}'::jsonb),
    ('workout', 'stairs', '{"description":"Stair workout weight effect per workout minute.","setupText":"Stairs are available as an active workout option.","inputHint":"minuteFactor is applied per minute; higher values increase weight reduction.","unit":"kg/min","requiredInSetup":false}'::jsonb),
    ('workout', 'pushup', '{"description":"Push-up workout weight effect per workout minute.","setupText":"Push-ups are available as an active workout option.","inputHint":"minuteFactor is applied per minute; higher values increase weight reduction.","unit":"kg/min","requiredInSetup":false}'::jsonb),
    ('workout', 'squat', '{"description":"Squat workout weight effect per workout minute.","setupText":"Squats are available as an active workout option.","inputHint":"minuteFactor is applied per minute; higher values increase weight reduction.","unit":"kg/min","requiredInSetup":false}'::jsonb),
    ('workout', 'lat_pulldown', '{"description":"Lat pulldown workout weight effect per workout minute.","setupText":"Lat pulldown is available as an active workout option.","inputHint":"minuteFactor is applied per minute; higher values increase weight reduction.","unit":"kg/min","requiredInSetup":false}'::jsonb)
)
update prediction_config_items item
set metadata = metadata_seed.metadata,
    updated_at = now()
from metadata_seed
where item.kind = metadata_seed.kind
  and item.key = metadata_seed.key
  and item.deleted_at is null;

with ranked_weights as (
  select
    id,
    row_number() over (
      partition by account_id, ((measured_at at time zone 'UTC')::date)
      order by updated_at desc, created_at desc, id desc
    ) as row_rank
  from body_weight_logs
  where deleted_at is null
)
update body_weight_logs
set deleted_at = now(),
    updated_at = now()
where id in (
  select id
  from ranked_weights
  where row_rank > 1
);

create unique index if not exists body_weight_logs_account_utc_date_active_uidx
  on body_weight_logs(account_id, ((measured_at at time zone 'UTC')::date))
  where deleted_at is null;
