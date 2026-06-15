drop index if exists body_weight_logs_account_utc_date_active_uidx;

create unique index if not exists body_weight_logs_account_kst_date_active_uidx
  on body_weight_logs(account_id, ((measured_at at time zone 'Asia/Seoul')::date))
  where deleted_at is null;
