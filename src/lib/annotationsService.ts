/**
 * annotationsService — Supabase-backed annotation CRUD
 *
 * Architecture:
 * - Authenticated → Supabase is source of truth, localStorage is write-through cache
 * - Unauthenticated → localStorage only (anonymous mode)
 * - RLS enforced server-side; user_id attached client-side via service
 *
 * Security: user_id is ALWAYS enforced by RLS server-side. Client-side .eq() calls
 * are an extra guard — they do NOT substitute for RLS.
 */

import { supabase } from '@/lib/supabaseClient';
import type { User } from '@supabase/supabase-js';

// ── Types (canonical — must match App.tsx Annotation type) ──────────────────

export type AnnotationType = 'text' | 'image' | 'video';
export type TextContent = { text: string };
export type ImageContent = { imageUrl: string; caption?: string };
export type VideoContent = { videoUrl: string; caption?: string };

export interface Annotation {
  id: string;
  type: AnnotationType;
  position: { x: number; y: number; z: number };
  content: TextContent | ImageContent | VideoContent;
  createdAt: number;
  updatedAt: number;
  // user_id is stored but omitted from the canonical Annotation type used in App.
  // It is added at the service boundary before DB operations.
  user_id?: string;
}

export interface DbAnnotationRow {
  id: string;
  user_id: string;
  type: AnnotationType;
  content: TextContent | ImageContent | VideoContent;
  position: { x: number; y: number; z: number };
  created_at: string;
  updated_at: string;
}

// ── localStorage key ────────────────────────────────────────────────────────

const STORAGE_KEY = 'panorama_annotations';

// ── Storage helpers ─────────────────────────────────────────────────────────

function loadFromStorage(): Annotation[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function saveToStorage(annotations: Annotation[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(annotations));
}

// ── DB ↔ App type conversion ────────────────────────────────────────────────

function fromDbRow(row: DbAnnotationRow): Annotation {
  return {
    id: row.id,
    user_id: row.user_id,
    type: row.type,
    position: row.position,
    content: row.content,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
  };
}

// ── CRUD Operations ──────────────────────────────────────────────────────────

/**
 * Fetch annotations for a specific user from Supabase.
 * RLS: SELECT policy enforces auth.uid() = user_id server-side.
 * The .eq('user_id', user.id) here is a client-side refinement — RLS is the real guard.
 */
export async function fetchAnnotations(user: User): Promise<Annotation[]> {
  const { data, error } = await supabase
    .from('annotations')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[Annotations] fetch error:', error.message);
    return [];
  }

  return (data as unknown as DbAnnotationRow[]).map(fromDbRow);
}

/**
 * Insert a new annotation.
 * RLS: INSERT policy's WITH CHECK (auth.uid() = user_id) enforces ownership server-side.
 * The .eq('user_id', user.id) in the payload is redundant but documents intent.
 */
export async function createAnnotation(
  annotation: Omit<Annotation, 'createdAt' | 'updatedAt' | 'user_id'>,
  user: User
): Promise<Annotation | null> {
  const payload = {
    id: annotation.id,
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
 * RLS: UPDATE policy USING clause (auth.uid() = user_id) enforces ownership server-side.
 * .eq('user_id', user.id) is an additional client guard — does NOT substitute for RLS.
 */
export async function updateAnnotation(
  id: string,
  content: Annotation['content'],
  user: User
): Promise<boolean> {
  const { error } = await supabase
    .from('annotations')
    .update({ content, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) {
    console.error('[Annotations] update error:', error.message);
    return false;
  }

  return true;
}

/**
 * Delete an annotation.
 * RLS: DELETE policy USING clause (auth.uid() = user_id) enforces ownership server-side.
 * .eq('user_id', user.id) is an additional client guard — does NOT substitute for RLS.
 */
export async function deleteAnnotation(id: string, user: User): Promise<boolean> {
  const { error } = await supabase
    .from('annotations')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) {
    console.error('[Annotations] delete error:', error.message);
    return false;
  }

  return true;
}

// ── Hybrid load: Supabase (auth) + localStorage (anonymous fallback) ─────────

/**
 * Load annotations:
 * - Authenticated → fetch from Supabase (authoritative), hydrate localStorage cache
 * - Not authenticated → load from localStorage (anonymous mode)
 */
export async function loadAnnotations(user: User | null): Promise<Annotation[]> {
  if (!user) {
    return loadFromStorage();
  }

  const annotations = await fetchAnnotations(user);
  saveToStorage(annotations); // keep cache in sync
  return annotations;
}

/**
 * Save a new annotation:
 * - Optimistically writes to localStorage immediately
 * - Inserts to Supabase in background; rolls back localStorage on failure
 */
export async function saveAnnotation(
  annotation: Omit<Annotation, 'createdAt' | 'updatedAt' | 'user_id'>,
  user: User
): Promise<Annotation | null> {
  // Optimistic write to localStorage
  const cached = loadFromStorage();
  const optimistic: Annotation = {
    ...annotation,
    user_id: user.id,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  saveToStorage([...cached, optimistic]);

  // Persist to Supabase
  const created = await createAnnotation(annotation, user);
  if (!created) {
    saveToStorage(cached); // rollback
    return null;
  }

  // Replace optimistic entry with server-confirmed data (has accurate timestamps)
  saveToStorage(cached.map((a) => (a.id === optimistic.id ? created : a)));
  return created;
}

/**
 * Remove an annotation:
 * - Optimistically removes from localStorage immediately
 * - Deletes from Supabase in background; rolls back localStorage on failure
 */
export async function removeAnnotation(id: string, user: User): Promise<boolean> {
  const cached = loadFromStorage();
  saveToStorage(cached.filter((a) => a.id !== id));

  const deleted = await deleteAnnotation(id, user);
  if (!deleted) {
    saveToStorage(cached); // rollback
    return false;
  }

  return true;
}
