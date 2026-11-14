-- Upgrade an existing Nextplay database without deleting its data.
begin;

create table if not exists public.labels (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (length(name) between 1 and 32 and name = btrim(name)),
  color text not null default '#718bb4' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  created_at timestamptz not null default now(),
  unique (user_id, name)
);
create unique index if not exists labels_owner_name_ci_idx on public.labels(user_id, lower(name));
alter table public.labels enable row level security;
drop policy if exists labels_owner_read on public.labels;
create policy labels_owner_read on public.labels for select to authenticated
  using ((select auth.uid()) = user_id);
drop policy if exists labels_owner_create on public.labels;
create policy labels_owner_create on public.labels for insert to authenticated
  with check ((select auth.uid()) = user_id);
revoke all on public.labels from anon, authenticated;
grant select, insert on public.labels to authenticated;

-- Preserve all existing task labels and seed the five original label colors.
insert into public.labels(user_id, name, color)
select owners.user_id, defaults.name, defaults.color
from (select user_id from public.tasks union select user_id from public.team_members) owners
cross join (values ('Design','#9c71a4'), ('Engineering','#718bb4'), ('Research','#a19060'), ('Marketing','#789981'), ('Bug','#b77e7e')) defaults(name,color)
on conflict do nothing;
insert into public.labels(user_id, name, color)
select distinct tasks.user_id, assigned.name, '#718bb4'
from public.tasks cross join lateral unnest(tasks.labels) assigned(name)
on conflict do nothing;

-- Tasks retain their text[] API while allowing owner-created labels.
alter table public.tasks drop constraint if exists tasks_labels_check;
alter table public.tasks add constraint tasks_labels_check check (cardinality(labels) <= 20);

create or replace function public.nextplay_validate_task_labels()
returns trigger language plpgsql set search_path = '' as $$
begin
  if cardinality(new.labels) <> (select count(distinct name) from unnest(new.labels) assigned(name)) then
    raise exception 'Task labels must be unique and non-null' using errcode = '23514';
  end if;
  if exists (
    select 1 from unnest(new.labels) assigned(name)
    where not exists (select 1 from public.labels where labels.user_id = new.user_id and labels.name = assigned.name)
  ) then
    raise exception 'Every task label must belong to your workspace' using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function public.nextplay_record_task_activity()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  changes text[] := '{}';
  event_message text;
  old_label text;
  new_label text;
  old_member text;
  new_member text;
  label_name text;
begin
  if tg_op = 'INSERT' then
    changes := array['Created this task'];
  else
    if new.title is distinct from old.title then
      changes := array_append(changes, 'Renamed task from “' || old.title || '” to “' || new.title || '”');
    end if;
    if new.description is distinct from old.description then
      changes := array_append(changes, 'Updated the description');
    end if;
    if new.status is distinct from old.status then
      old_label := case old.status when 'todo' then 'To Do' when 'in_progress' then 'In Progress' when 'in_review' then 'In Review' else 'Done' end;
      new_label := case new.status when 'todo' then 'To Do' when 'in_progress' then 'In Progress' when 'in_review' then 'In Review' else 'Done' end;
      changes := array_append(changes, 'Moved from ' || old_label || ' → ' || new_label);
    end if;
    if new.priority is distinct from old.priority then
      old_label := case old.priority when 'normal' then 'Medium' else initcap(old.priority) end;
      new_label := case new.priority when 'normal' then 'Medium' else initcap(new.priority) end;
      changes := array_append(changes, 'Changed priority from ' || old_label || ' → ' || new_label);
    end if;
    if new.due_date is distinct from old.due_date then
      changes := array_append(changes, case when new.due_date is null then 'Cleared the due date' else 'Set due date to ' || to_char(new.due_date, 'YYYY-MM-DD') end);
    end if;
    if new.assignee_id is distinct from old.assignee_id then
      select name into old_member from public.team_members where id = old.assignee_id and user_id = old.user_id;
      select name into new_member from public.team_members where id = new.assignee_id and user_id = new.user_id;
      changes := array_append(changes, case
        when new.assignee_id is null then 'Unassigned ' || coalesce(old_member, 'teammate')
        when old.assignee_id is null then 'Assigned to ' || coalesce(new_member, 'teammate')
        else 'Reassigned from ' || coalesce(old_member, 'teammate') || ' → ' || coalesce(new_member, 'teammate') end);
    end if;
    for label_name in select name from unnest(new.labels) assigned(name) where not (name = any(old.labels)) loop
      changes := array_append(changes, 'Added label “' || label_name || '”');
    end loop;
    for label_name in select name from unnest(old.labels) assigned(name) where not (name = any(new.labels)) loop
      changes := array_append(changes, 'Removed label “' || label_name || '”');
    end loop;
  end if;
  foreach event_message in array changes loop
    insert into public.task_activities(user_id, task_id, message) values (new.user_id, new.id, event_message);
  end loop;
  return new;
end;
$$;

revoke all on function public.nextplay_touch_task() from public, anon, authenticated;
revoke all on function public.nextplay_validate_task_labels() from public, anon, authenticated;
revoke all on function public.nextplay_record_task_activity() from public, anon, authenticated;
drop trigger if exists nextplay_tasks_touch on public.tasks;
create trigger nextplay_tasks_touch before update on public.tasks for each row execute function public.nextplay_touch_task();
drop trigger if exists nextplay_tasks_labels on public.tasks;
create trigger nextplay_tasks_labels before insert or update on public.tasks for each row execute function public.nextplay_validate_task_labels();
drop trigger if exists nextplay_tasks_activity on public.tasks;
create trigger nextplay_tasks_activity after insert or update on public.tasks for each row execute function public.nextplay_record_task_activity();

commit;
