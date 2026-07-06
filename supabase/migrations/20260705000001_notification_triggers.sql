-- Trigger: insert notification when a task is assigned
create or replace function notify_task_assigned()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.assigned_to is distinct from new.assigned_to and new.assigned_to is not null then
    insert into notifications (user_id, type, payload)
    values (
      new.assigned_to,
      'task_assigned',
      jsonb_build_object(
        'task_id',    new.id,
        'task_title', new.title,
        'step_id',    new.project_step_id,
        'project_id', (select project_id from project_steps where id = new.project_step_id)
      )
    );
  end if;
  return new;
end;
$$;

create trigger on_task_assigned
  after update on tasks
  for each row execute function notify_task_assigned();

-- Trigger: insert notification when a project step status changes
create or replace function notify_step_status_changed()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_step_title text;
  v_updater_id uuid;
  v_member      record;
begin
  if old.status is distinct from new.status then
    select coalesce(wts.title, 'Step ' || new.order)
      into v_step_title
      from workflow_template_steps wts
     where wts.id = new.template_step_id;

    if v_step_title is null then
      v_step_title := 'Step ' || new.order;
    end if;

    v_updater_id := auth.uid();

    for v_member in
      select user_id
        from project_members
       where project_id = new.project_id
         and user_id is distinct from v_updater_id
    loop
      insert into notifications (user_id, type, payload)
      values (
        v_member.user_id,
        'step_status_changed',
        jsonb_build_object(
          'step_id',    new.id,
          'step_title', v_step_title,
          'project_id', new.project_id,
          'new_status', new.status
        )
      );
    end loop;
  end if;
  return new;
end;
$$;

create trigger on_step_status_changed
  after update on project_steps
  for each row execute function notify_step_status_changed();
