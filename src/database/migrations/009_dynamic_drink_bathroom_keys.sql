alter table drink_logs
  drop constraint if exists drink_logs_drink_type_check;

alter table bathroom_logs
  drop constraint if exists bathroom_logs_bathroom_type_check;

update bathroom_logs
set bathroom_type = 'stool',
    updated_at = now()
where bathroom_type = 'bowel';
