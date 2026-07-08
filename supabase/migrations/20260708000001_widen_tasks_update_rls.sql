-- Widen tasks_update RLS to allow Tech Leads in the task's project
-- and the task's assignee to update (field-level restrictions remain in app layer)
drop policy if exists "tasks_update" on tasks;

create policy "tasks_update" on tasks for update
  using (
    -- SA can update any task in any project they're a member of
    (
      (select role from profiles where id = auth.uid()) = 'sa'
      and is_project_member(
        (select project_id from project_steps where id = project_step_id)
      )
    )
    -- Tech Lead can update tasks in their projects
    or exists (
      select 1 from project_members pm
      join project_steps ps on ps.project_id = pm.project_id
      where ps.id = tasks.project_step_id
        and pm.user_id = auth.uid()
        and pm.role = 'tech_lead'
    )
    -- Assignee can update their own task (status-only restriction is in app layer)
    or assigned_to = auth.uid()
  )
  with check (
    (
      (select role from profiles where id = auth.uid()) = 'sa'
      and is_project_member(
        (select project_id from project_steps where id = project_step_id)
      )
    )
    or exists (
      select 1 from project_members pm
      join project_steps ps on ps.project_id = pm.project_id
      where ps.id = tasks.project_step_id
        and pm.user_id = auth.uid()
        and pm.role = 'tech_lead'
    )
    or assigned_to = auth.uid()
  );
