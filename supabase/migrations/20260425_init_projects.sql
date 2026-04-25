-- ============================================================
-- PROJECTS ARCHITECTURE SCHEMA
-- Run in Supabase Dashboard → SQL Editor
-- ============================================================

-- ── 1. Projects ──────────────────────────────────────────────────────────────────
create table if not exists public.projects (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- Auto-update updated_at
create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger projects_updated_at
  before update on public.projects
  for each row execute function public.handle_updated_at();

-- ── 2. Panoramas ─────────────────────────────────────────────────────────────────
create table if not exists public.panoramas (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects(id) on delete cascade,
  image_url   text,
  is_default  boolean default false not null,
  created_at  timestamptz default now()
);

-- Each project must have at most one default panorama
create unique index if not exists panoramas_project_default_idx
  on public.panoramas(project_id)
  where is_default = true;

-- ── 3. Annotations — add project_id ────────────────────────────────────────────
-- (Only add the column if it doesn't already exist from a partial migration)
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'annotations'
      and column_name  = 'project_id'
  ) then
    alter table public.annotations
      add column project_id uuid references public.projects(id) on delete cascade;
  end if;
end
$$;

-- Make project_id non-nullable after migration is confirmed
-- alter table public.annotations alter column project_id set not null;

-- ── 4. RLS ─────────────────────────────────────────────────────────────────────
alter table public.projects   enable row level security;
alter table public.panoramas  enable row level security;
alter table public.annotations enable row level security;

-- ── Projects policies ───────────────────────────────────────────────────────────
drop policy if exists "users_select_own_projects"   on public.projects;
drop policy if exists "users_insert_own_projects"  on public.projects;
drop policy if exists "users_update_own_projects"  on public.projects;
drop policy if exists "users_delete_own_projects"  on public.projects;

create policy "users_select_own_projects"
  on public.projects for select
  using (auth.uid() = user_id);

create policy "users_insert_own_projects"
  on public.projects for insert
  with check (auth.uid() = user_id);

create policy "users_update_own_projects"
  on public.projects for update
  using (auth.uid() = user_id);

create policy "users_delete_own_projects"
  on public.projects for delete
  using (auth.uid() = user_id);

-- ── Panoramas policies ──────────────────────────────────────────────────────────
drop policy if exists "users_select_panoramas_via_project" on public.panoramas;
drop policy if exists "users_insert_panoramas_via_project" on public.panoramas;
drop policy if exists "users_update_panoramas_via_project" on public.panoramas;
drop policy if exists "users_delete_panoramas_via_project" on public.panoramas;

create policy "users_select_panoramas_via_project"
  on public.panoramas for select
  using (
    exists (
      select 1 from public.projects
      where projects.id = panoramas.project_id
        and projects.user_id = auth.uid()
    )
  );

create policy "users_insert_panoramas_via_project"
  on public.panoramas for insert
  with check (
    exists (
      select 1 from public.projects
      where projects.id = panoramas.project_id
        and projects.user_id = auth.uid()
    )
  );

create policy "users_update_panoramas_via_project"
  on public.panoramas for update
  using (
    exists (
      select 1 from public.projects
      where projects.id = panoramas.project_id
        and projects.user_id = auth.uid()
    )
  );

create policy "users_delete_panoramas_via_project"
  on public.panoramas for delete
  using (
    exists (
      select 1 from public.projects
      where projects.id = panoramas.project_id
        and projects.user_id = auth.uid()
    )
  );

-- ── Annotations policies ────────────────────────────────────────────────────────
-- Replace user-scoped policies with project-scoped ones
drop policy if exists "users_select_own_annotations" on public.annotations;
drop policy if exists "users_insert_own_annotations" on public.annotations;
drop policy if exists "users_update_own_annotations" on public.annotations;
drop policy if exists "users_delete_own_annotations" on public.annotations;

create policy "users_select_annotations_via_project"
  on public.annotations for select
  using (
    exists (
      select 1 from public.projects
      where projects.id = annotations.project_id
        and projects.user_id = auth.uid()
    )
  );

create policy "users_insert_annotations_via_project"
  on public.annotations for insert
  with check (
    exists (
      select 1 from public.projects
      where projects.id = annotations.project_id
        and projects.user_id = auth.uid()
    )
  );

create policy "users_update_annotations_via_project"
  on public.annotations for update
  using (
    exists (
      select 1 from public.projects
      where projects.id = annotations.project_id
        and projects.user_id = auth.uid()
    )
  );

create policy "users_delete_annotations_via_project"
  on public.annotations for delete
  using (
    exists (
      select 1 from public.projects
      where projects.id = annotations.project_id
        and projects.user_id = auth.uid()
    )
  );

-- ── 5. Verify ──────────────────────────────────────────────────────────────────
-- Run this to confirm tables exist with correct columns:
-- select table_name, column_name, data_type, is_nullable
-- from information_schema.columns
-- where table_schema = 'public'
--   and table_name in ('projects', 'panoramas', 'annotations')
-- order by table_name, ordinal_position;
