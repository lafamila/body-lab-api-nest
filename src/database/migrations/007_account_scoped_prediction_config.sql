alter table prediction_config_items
  add column if not exists account_id text;

update prediction_config_items
set deleted_at = now(),
    is_active = false,
    updated_at = now()
where kind <> 'global'
  and account_id is null
  and deleted_at is null;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'prediction_config_items_kind_key_key'
  ) then
    alter table prediction_config_items
      drop constraint prediction_config_items_kind_key_key;
  end if;
end $$;

alter table prediction_config_items
  drop constraint if exists prediction_config_items_account_scope_check;

alter table prediction_config_items
  add constraint prediction_config_items_account_scope_check
  check (
    (kind = 'global' and account_id is null)
    or
    (kind <> 'global' and account_id is not null)
    or
    (kind <> 'global' and account_id is null and deleted_at is not null)
  );

drop index if exists prediction_config_items_kind_sort_idx;

create index if not exists prediction_config_items_kind_sort_idx
  on prediction_config_items(account_id, kind, sort_order, key)
  where deleted_at is null;

create unique index if not exists prediction_config_items_global_key_uidx
  on prediction_config_items(kind, key)
  where kind = 'global';

create unique index if not exists prediction_config_items_account_kind_key_uidx
  on prediction_config_items(account_id, kind, key)
  where kind <> 'global';
