-- ============================================================
-- MIGRATION: Annotations → Project-scoped
-- ONE-TIME — run once, then archive
-- ============================================================

-- Safety check
do $$
declare
  already_migrated integer;
begin
  select count(*) into already_migrated
  from public.annotations
  where project_id is not null;

  if already_migrated > 0 then
    raise notice 'Already migrated (%). Skipping.', already_migrated;
    return;
  end if;
end;
$$;

-- Step A: create default project for each user with annotations but no project
insert into public.projects (user_id, name)
select distinct ann.user_id, 'My First Project'
from public.annotations ann
where not exists (
  select 1 from public.projects p where p.user_id = ann.user_id
)
on conflict do nothing;

-- Step B: backfill project_id
with user_project as (
  select p.id as project_id, p.user_id
  from public.projects p
)
update public.annotations ann
set project_id = up.project_id
from user_project up
where ann.user_id = up.user_id
  and ann.project_id is null;

-- Verify:
-- select user_id, count(*) as total, count(project_id) as filled from public.annotations group by user_id;
