// ── Annotation Content Schemas ──────────────────────────────────────────────

export type AnnotationType = 'text' | 'image' | 'video';

// Unified content object — one field is populated based on `type`
export interface TextContent {
  text: string;
}

export interface ImageContent {
  url: string;
  alt?: string;
}

export interface VideoContent {
  url: string;
  thumbnail?: string;
}

// Discriminated union — `type` field narrows the content shape
export type AnnotationContent = TextContent | ImageContent | VideoContent;

// ── Position ─────────────────────────────────────────────────────────────────

export interface AnnotationPosition {
  x: number;
  y: number;
  z: number;
}

// ── Meta ────────────────────────────────────────────────────────────────────

export interface AnnotationMeta {
  createdAt: number;
  updatedAt: number;
}

// ── Full Annotation ──────────────────────────────────────────────────────────

export interface Annotation {
  id: string;
  type: AnnotationType;
  position: AnnotationPosition;
  content: AnnotationContent;
  meta?: AnnotationMeta;
}

// ── Legacy Shape (backward compat) ──────────────────────────────────────────

/** Old format: flat { id, text, position } */
export interface LegacyAnnotation {
  id: string;
  text: string;
  position: AnnotationPosition;
}

// ── Type Guards ─────────────────────────────────────────────────────────────

export function isTextAnnotation(ann: Annotation): ann is Annotation & { content: TextContent } {
  return ann.type === 'text';
}

export function isImageAnnotation(ann: Annotation): ann is Annotation & { content: ImageContent } {
  return ann.type === 'image';
}

export function isVideoAnnotation(ann: Annotation): ann is Annotation & { content: VideoContent } {
  return ann.type === 'video';
}

/** Confirms an unknown value is a valid Annotation[] */
export function isAnnotationArray(val: unknown): val is Annotation[] {
  return Array.isArray(val) && val.every(isAnnotation);
}

/** Confirms an unknown value is a valid Annotation */
export function isAnnotation(val: unknown): val is Annotation {
  if (!val || typeof val !== 'object') return false;
  const a = val as Record<string, unknown>;
  return (
    typeof a.id === 'string' &&
    typeof a.position === 'object' &&
    a.position !== null &&
    typeof (a.position as Record<string, unknown>).x === 'number' &&
    typeof (a.position as Record<string, unknown>).y === 'number' &&
    typeof (a.position as Record<string, unknown>).z === 'number' &&
    ['text', 'image', 'video'].includes(a.type as string)
  );
}
