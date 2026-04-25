/**
 * projects API — Supabase-backed project CRUD
 *
 * Security: user_id is ALWAYS enforced by RLS server-side.
 * Client-side .eq('user_id', user.id) is an extra guard, not a substitute.
 */

import { supabase } from '@/lib/supabaseClient';
import type { User } from '@supabase/supabase-js';

// ── Types ──────────────────────────────────────────────────────────────────────
export interface Project {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface NewProjectInput {
  name: string;
  user_id: string;
}

const DEFAULT_PROJECT_NAME = 'My First Project';

// ── Fetch all projects for a user ──────────────────────────────────────────────
export async function fetchProjects(user: User): Promise<Project[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[Projects] fetch error:', error.message);
    return [];
  }

  return (data as Project[]) ?? [];
}

// ── Create a project ────────────────────────────────────────────────────────────
export async function createProject(name: string, user: User): Promise<Project | null> {
  const { data, error } = await supabase
    .from('projects')
    .insert({ name, user_id: user.id } satisfies NewProjectInput)
    .select()
    .single();

  if (error) {
    console.error('[Projects] create error:', error.message);
    return null;
  }

  return data as Project;
}

// ── Update a project name ───────────────────────────────────────────────────────
export async function updateProject(
  projectId: string,
  name: string,
  user: User
): Promise<boolean> {
  const { error } = await supabase
    .from('projects')
    .update({ name })
    .eq('id', projectId)
    .eq('user_id', user.id); // extra guard

  if (error) {
    console.error('[Projects] update error:', error.message);
    return false;
  }
  return true;
}

// ── Delete a project (and cascades to panoramas + annotations) ─────────────────
export async function deleteProject(projectId: string, user: User): Promise<boolean> {
  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', projectId)
    .eq('user_id', user.id); // extra guard

  if (error) {
    console.error('[Projects] delete error:', error.message);
    return false;
  }
  return true;
}

// ── Bootstrap: ensure user has at least one project ─────────────────────────────
/**
 * If user has no projects, creates a default project and returns it.
 * If user already has projects, returns the first one (most recent by created_at asc).
 */
export async function bootstrapDefaultProject(user: User): Promise<Project | null> {
  const existing = await fetchProjects(user);
  if (existing.length > 0) {
    return existing[0];
  }
  return createProject(DEFAULT_PROJECT_NAME, user);
}
