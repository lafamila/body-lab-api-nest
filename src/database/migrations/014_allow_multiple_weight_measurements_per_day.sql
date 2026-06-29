drop index if exists body_weight_logs_account_utc_date_active_uidx;
drop index if exists body_weight_logs_account_kst_date_active_uidx;

create index if not exists body_weight_logs_account_measured_at_idx
  on body_weight_logs(account_id, measured_at)
  where deleted_at is null;
