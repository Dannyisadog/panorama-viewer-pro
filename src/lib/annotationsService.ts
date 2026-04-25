/**
 * annotationsService — Project-scoped annotation CRUD
 *
 * Architecture:
 * - Authenticated → Supabase is source of truth, localStorage is write-through cache
 * - Unauthenticated → localStorage only (anonymous mode)
 * - project_id is required on all DB operations (enforced by RLS)
 *
 * Security: project_id ownership is ALWAYS enforced by RLS server-side.
 * Client-side .eq() calls are extra guards — they do NOT substitute for RLS.
 */

import { supabase } from '@/lib/supabaseClient';
import type { User } from '@supabase/supabase-js';

// ── Types (canonical — must match App.tsx Annotation type) ──────────────────────

export type AnnotationType = 'text' | 'image' | 'video';
export type TextContent = { text: string };
export type ImageContent = { type: 'image'; url: string; alt?: string };
export type VideoContent = { videoUrl: string; caption?: string };

export interface Annotation {
  id: string;
  project_id: string;
  type: AnnotationType;
  position: { x: number; y: number; z: number };
  content: TextContent | ImageContent | VideoContent;
  createdAt: number;
  updatedAt: number;
  user_id?: string; // attached client-side before DB ops
}

export interface DbAnnotationRow {
  id: string;
  project_id: string;
  user_id: string;
  type: AnnotationType;
  content: TextContent | ImageContent | VideoContent;
  position: { x: number; y: number; z: number };
  created_at: string;
  updated_at: string;
}

// ── localStorage helpers ───────────────────────────────────────────────────────

/**
 * Storage key is project-scoped so anonymous sessions don't collide
 * across different projects.
 */
function storageKey(projectId: string): string {
  return `panorama_annotations_${projectId}`;
}

function loadFromStorage(projectId: string): Annotation[] {
  try {
    return JSON.parse(localStorage.getItem(storageKey(projectId)) ?? '[]');
  } catch {
    return [];
  }
}

function saveToStorage(projectId: string, annotations: Annotation[]): void {
  localStorage.setItem(storageKey(projectId), JSON.stringify(annotations));
}

// ── DB ↔ App type conversion ────────────────────────────────────────────────────

function fromDbRow(row: DbAnnotationRow): Annotation {
  return {
    id: row.id,
    project_id: row.project_id,
    type: row.type,
    position: row.position,
    content: row.content,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
    user_id: row.user_id,
  };
}

// ── CRUD Operations ─────────────────────────────────────────────────────────────

/**
 * Fetch annotations for a specific project.
 * RLS: SELECT policy enforces auth.uid() owns the project server-side.
 */
export async function fetchAnnotations(
  projectId: string,
  _user: User
): Promise<Annotation[]> {
  const { data, error } = await supabase
    .from('annotations')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[Annotations] fetch error:', error.message);
    return [];
  }

  return (data as unknown as DbAnnotationRow[]).map(fromDbRow);
}

/**
 * Insert a new annotation.
 * RLS: INSERT policy's WITH CHECK enforces project ownership server-side.
 */
export async function createAnnotation(
  annotation: Omit<Annotation, 'createdAt' | 'updatedAt' | 'user_id'>,
  projectId: string,
  user: User
): Promise<Annotation | null> {
  const payload = {
    id: annotation.id,
    project_id: projectId,
    user_id: user.id,
    type: annotation.type,
    content: annotation.content,
    position: annotation.position,
  };

  const { data, error } = await supabase
    .from('annotations')
    .insert(payload)
    .select()
    .single();

  if (error) {
    console.error('[Annotations] create error:', error.message);
    return null;
  }

  return fromDbRow(data as unknown as DbAnnotationRow);
}

/**
 * Update annotation content.
 * RLS: UPDATE policy USING clause enforces project ownership server-side.
 */
export async function updateAnnotation(
  id: string,
  content: Annotation['content'],
  projectId: string,
  _user: User
): Promise<boolean> {
  const { error } = await supabase
    .from('annotations')
    .update({ content, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('project_id', projectId);

  if (error) {
    console.error('[Annotations] update error:', error.message);
    return false;
  }
  return true;
}

/**
 * Delete an annotation.
 * RLS: DELETE policy USING clause enforces project ownership server-side.
 */
export async function deleteAnnotation(
  id: string,
  projectId: string,
  _user: User
): Promise<boolean> {
  const { error } = await supabase
    .from('annotations')
    .delete()
    .eq('id', id)
    .eq('project_id', projectId);

  if (error) {
    console.error('[Annotations] delete error:', error.message);
    return false;
  }
  return true;
}

// ── Hybrid load: Supabase (auth) + localStorage (anonymous) ────────────────────

/**
 * Load annotations:
 * - Authenticated → fetch from Supabase, hydrate localStorage cache
 * - Not authenticated → load from localStorage (project-scoped key)
 */
export async function loadAnnotations(
  projectId: string,
  user: User | null
): Promise<Annotation[]> {
  if (!user) {
    return loadFromStorage(projectId);
  }

  const annotations = await fetchAnnotations(projectId, user);
  saveToStorage(projectId, annotations);
  return annotations;
}

/**
 * Generate a valid v4 UUID.
 */
export function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Save a new annotation (optimistic write):
 * - Authenticated → Supabase + localStorage cache
 * - Anonymous → localStorage only
 */
export async function saveAnnotation(
  annotation: Omit<Annotation, 'createdAt' | 'updatedAt' | 'user_id'>,
  projectId: string,
  user: User | null
): Promise<Annotation | null> {
  const id = generateId();

  const optimistic: Annotation = {
    ...annotation,
    id,
    project_id: projectId,
    user_id: user?.id ?? 'anonymous',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  if (user) {
    // Authenticated: optimistic localStorage write + Supabase persist
    const cached = loadFromStorage(projectId);
    saveToStorage(projectId, [...cached, optimistic]);

    const created = await createAnnotation({ ...annotation, id }, projectId, user);
    if (!created) {
      saveToStorage(projectId, cached); // rollback
      return null;
    }
    // Replace optimistic entry with server-confirmed data
    saveToStorage(
      projectId,
      cached.map((a) => (a.id === optimistic.id ? created : a))
    );
    return created;
  } else {
    // Anonymous: localStorage only
    const cached = loadFromStorage(projectId);
    saveToStorage(projectId, [...cached, optimistic]);
    return optimistic;
  }
}

/**
 * Remove an annotation (optimistic delete).
 */
export async function removeAnnotation(
  id: string,
  projectId: string,
  user: User | null
): Promise<boolean> {
  if (user) {
    const cached = loadFromStorage(projectId);
    saveToStorage(projectId, cached.filter((a) => a.id !== id));

    const deleted = await deleteAnnotation(id, projectId, user);
    if (!deleted) {
      saveToStorage(projectId, cached); // rollback
      return false;
    }
    return true;
  } else {
    const cached = loadFromStorage(projectId);
    saveToStorage(projectId, cached.filter((a) => a.id !== id));
    return true;
  }
}
