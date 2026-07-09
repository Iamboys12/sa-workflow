create table task_events (
  id         uuid primary key default gen_random_uuid(),
  task_id    uuid not null references tasks(id) on delete cascade,
  user_id    uuid not null references profiles(id) on delete restrict,
  type       text not null,
  body       text,
  meta       jsonb,
  created_at timestamptz not null default now()
);

create index on task_events(task_id, created_at);

alter table task_events enable row level security;

-- Project members and SA can read events
create policy "task_events_select" on task_events for select
  using (
    (select role from profiles where id = auth.uid()) = 'sa'
    or exists (
      select 1 from project_members pm
      join tasks t on t.id = task_events.task_id
      join project_steps ps on ps.id = t.project_step_id
      where pm.project_id = ps.project_id
        and pm.user_id = auth.uid()
    )
  );

-- Project members and SA can insert (all mutations go through API routes using caller's JWT)
create policy "task_events_insert" on task_events for insert
  with check (
    (select role from profiles where id = auth.uid()) = 'sa'
    or exists (
      select 1 from project_members pm
      join tasks t on t.id = task_events.task_id
      join project_steps ps on ps.id = t.project_step_id
      where pm.project_id = ps.project_id
        and pm.user_id = auth.uid()
    )
  );

-- Enable Realtime: full replica identity so DELETE payloads include the old row id
alter table task_events replica identity full;
alter publication supabase_realtime add table task_events;

-- Only the comment author or SA can delete; activity events cannot be deleted
create policy "task_events_delete" on task_events for delete
  using (
    type = 'comment'
    and (
      user_id = auth.uid()
      or (select role from profiles where id = auth.uid()) = 'sa'
    )
  );
