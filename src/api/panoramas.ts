/**
 * panoramas API — Supabase-backed panorama CRUD
 *
 * All access is project-scoped: a panorama can only be accessed
 * if the user owns the parent project (enforced by RLS).
 */

import { supabase } from '@/lib/supabaseClient';
import type { User } from '@supabase/supabase-js';

// ── Types ──────────────────────────────────────────────────────────────────────
export interface Panorama {
  id: string;
  project_id: string;
  image_url: string | null;
  is_default: boolean;
  created_at: string;
}

export interface NewPanoramaInput {
  project_id: string;
  image_url?: string | null;
  is_default?: boolean;
}

const SAMPLE_PANORAMA_URL = 'https://pannellum.org/images/alma.jpg';

// ── Fetch all panoramas for a project ──────────────────────────────────────────
export async function fetchPanoramas(projectId: string, _user: User): Promise<Panorama[]> {
  const { data, error } = await supabase
    .from('panoramas')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[Panoramas] fetch error:', error.message);
    return [];
  }

  return (data as Panorama[]) ?? [];
}

// ── Fetch the default panorama for a project ──────────────────────────────────
export async function fetchDefaultPanorama(
  projectId: string,
  _user: User
): Promise<Panorama | null> {
  const { data, error } = await supabase
    .from('panoramas')
    .select('*')
    .eq('project_id', projectId)
    .eq('is_default', true)
    .maybeSingle();

  if (error) {
    console.error('[Panoramas] fetch default error:', error.message);
    return null;
  }

  return data as Panorama | null;
}

// ── Create a panorama ──────────────────────────────────────────────────────────
export async function createPanorama(
  input: NewPanoramaInput,
  _user: User
): Promise<Panorama | null> {
  const { data, error } = await supabase
    .from('panoramas')
    .insert(input satisfies NewPanoramaInput)
    .select()
    .single();

  if (error) {
    console.error('[Panoramas] create error:', error.message);
    return null;
  }

  return data as Panorama;
}

// ── Create the bootstrap default panorama for a newly-created project ───────────
export async function createDefaultPanorama(
  projectId: string,
  user: User
): Promise<Panorama | null> {
  // If a default panorama somehow already exists (edge case), use it
  const existing = await fetchDefaultPanorama(projectId, user);
  if (existing) return existing;

  return createPanorama(
    { project_id: projectId, image_url: SAMPLE_PANORAMA_URL, is_default: true },
    user
  );
}

// ── Update a panorama's image URL ───────────────────────────────────────────────
export async function updatePanoramaImage(
  panoramaId: string,
  imageUrl: string,
  _user: User
): Promise<boolean> {
  const { error } = await supabase
    .from('panoramas')
    .update({ image_url: imageUrl })
    .eq('id', panoramaId);

  if (error) {
    console.error('[Panoramas] update image error:', error.message);
    return false;
  }
  return true;
}

// ── Delete a panorama ──────────────────────────────────────────────────────────
export async function deletePanorama(
  panoramaId: string,
  _user: User,
): Promise<boolean> {
  const { error } = await supabase
    .from('panoramas')
    .delete()
    .eq('id', panoramaId);

  if (error) {
    console.error('[Panoramas] delete error:', error.message);
    return false;
  }
  return true;
}
