drop index if exists prediction_config_items_global_key_uidx;
drop index if exists prediction_config_items_account_kind_key_uidx;

alter table prediction_config_items
  drop constraint if exists prediction_config_items_account_scope_check;

alter table prediction_config_items
  add constraint prediction_config_items_account_scope_check
  check (
    (kind = 'global' and account_id is null)
    or
    (account_id is not null)
    or
    (kind <> 'global' and account_id is null and deleted_at is not null)
  );

create unique index if not exists prediction_config_items_global_key_uidx
  on prediction_config_items(kind, key)
  where kind = 'global' and account_id is null;

create unique index if not exists prediction_config_items_account_kind_key_uidx
  on prediction_config_items(account_id, kind, key)
  where account_id is not null;
