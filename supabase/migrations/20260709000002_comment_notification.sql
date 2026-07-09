DROP TRIGGER IF EXISTS on_comment_added ON task_events;

create or replace function notify_comment_added()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_task_title     text;
  v_assigned_to    uuid;
  v_project_id     uuid;
  v_commenter_name text;
  v_payload        jsonb;
  v_recipient      uuid;
begin
  if new.type <> 'comment' then
    return new;
  end if;

  select t.title, t.assigned_to, ps.project_id
    into v_task_title, v_assigned_to, v_project_id
    from tasks t
    join project_steps ps on ps.id = t.project_step_id
   where t.id = new.task_id;

  select coalesce(full_name, 'Someone')
    into v_commenter_name
    from profiles
   where id = new.user_id;

  v_payload := jsonb_build_object(
    'task_id',        new.task_id,
    'task_title',     v_task_title,
    'project_id',     v_project_id,
    'commenter_name', v_commenter_name
  );

  for v_recipient in
    select distinct user_id
      from (
        select v_assigned_to as user_id
        union
        select pm.user_id
          from project_members pm
         where pm.project_id = v_project_id
      ) r
     where user_id is not null
       and user_id is distinct from new.user_id
  loop
    insert into notifications (user_id, type, payload)
    values (v_recipient, 'comment_added', v_payload);
  end loop;

  return new;
end;
$$;

create trigger on_comment_added
  after insert on task_events
  for each row execute function notify_comment_added();
