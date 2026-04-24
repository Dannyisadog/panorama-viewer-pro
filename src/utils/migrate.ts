import type { Annotation, LegacyAnnotation } from '@/types/annotation';

/**
 * Detect whether an array is the old flat { id, text, position } format.
 * The new format has `type` and `content` fields.
 */
function isLegacyAnnotation(val: unknown): val is LegacyAnnotation {
  if (!val || typeof val !== 'object') return false;
  const a = val as Record<string, unknown>;
  return (
    typeof a.id === 'string' &&
    typeof a.text === 'string' &&
    typeof a.position === 'object' &&
    a.position !== null
  );
}

/**
 * Migrate a single legacy annotation to the new format.
 */
function migrateOne(raw: LegacyAnnotation): Annotation {
  const now = Date.now();
  return {
    id: raw.id,
    type: 'text',
    position: raw.position,
    content: { type: 'text', text: raw.text },
    meta: { createdAt: now, updatedAt: now },
  };
}

/**
 * Migrate raw localStorage data to the new Annotation format.
 *
 * Strategy:
 * - If already new format (has `type` + `content`) → pass through unchanged
 * - If legacy format (has `text` field directly) → convert each entry
 * - Mixed arrays: migrate only legacy entries, leave new-format ones alone
 */
export function migrateAnnotations(raw: unknown): Annotation[] {
  // Null / empty → empty array
  if (raw == null) return [];

  // Already valid new-format array → return as-is
  if (Array.isArray(raw) && raw.length > 0 && 'type' in raw[0] && 'content' in raw[0]) {
    return raw as Annotation[];
  }

  // Legacy or malformed → treat as legacy array
  if (!Array.isArray(raw)) return [];

  return raw.map((item): Annotation => {
    if (isLegacyAnnotation(item)) {
      return migrateOne(item);
    }
    // Already in new format but lacked the top-level check above — cast through
    return item as Annotation;
  });
}
