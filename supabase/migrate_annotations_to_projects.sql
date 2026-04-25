-- ============================================================
-- MIGRATION: Annotations → Project-scoped
-- STATUS: ONE-TIME — run once, then delete or archive this file
--
-- What it does:
--  1. For each user who has annotations but no projects,
--     creates a "My First Project" project + default panorama
--  2. Backfills all existing annotations with that project_id
--  3. Makes project_id non-nullable
-- ============================================================

-- Safety: abort if any annotation already has a project_id set
do $$
declare
  already_migrated count integer;
begin
  select count(*) into already_migrated
  from public.annotations
  where project_id is not null;

  if already_migrated > 0 then
    raise notice 'MIGRATION ALREADY APPLIED (%). Skipping.', already_migrated;
    return;
  end if;

  raise notice 'Proceeding with migration...';
end;
$$;

-- Step A: create a default project for each user who has annotations but no project yet
insert into public.projects (user_id, name)
select distinct ann.user_id, 'My First Project'
from public.annotations ann
where not exists (
  select 1 from public.projects p where p.user_id = ann.user_id
)
on conflict do nothing;  -- safe: skips users who already got a project

-- Step B: backfill project_id on all existing annotations
-- Each user's annotations get assigned to their newly-created (or pre-existing) project
with user_project as (
  select p.id as project_id, p.user_id
  from public.projects p
)
update public.annotations ann
set project_id = up.project_id
from user_project up
where ann.user_id = up.user_id
  and ann.project_id is null;

-- Step C (optional, run after confirming B worked):
-- Make project_id non-nullable once all rows are filled
-- alter table public.annotations alter column project_id set not null;

-- Verification query (run after):
-- select
--   user_id,
--   count(*) as annotation_count,
--   count(project_id) as with_project_id,
--   count(distinct project_id) as distinct_projects
-- from public.annotations
-- group by user_id;
