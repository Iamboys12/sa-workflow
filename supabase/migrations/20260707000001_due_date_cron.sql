create extension if not exists pg_cron;

-- Unschedule first for idempotency (re-running migration won't error on duplicate name)
select cron.unschedule('due-date-reminder') where exists (
  select 1 from cron.job where jobname = 'due-date-reminder'
);

select cron.schedule(
  'due-date-reminder',
  '0 8 * * *',
  $$
  INSERT INTO notifications (user_id, type, payload)
  SELECT
    t.assigned_to,
    'task_due_soon',
    jsonb_build_object(
      'task_id',    t.id,
      'task_title', t.title,
      'due_date',   t.due_date
    )
  FROM tasks t
  WHERE t.due_date = (now() AT TIME ZONE 'UTC')::date + 1
    AND t.assigned_to IS NOT NULL
    AND t.status != 'done'
  $$
);
