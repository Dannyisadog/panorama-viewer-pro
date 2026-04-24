// ── Annotation Content Schemas ──────────────────────────────────────────────

export type AnnotationType = 'text' | 'image' | 'video';

// Each content interface is self-tagged so TypeScript can discriminate the union
export interface TextContent {
  type: 'text';
  text: string;
}

export interface ImageContent {
  type: 'image';
  url: string;
  alt?: string;
}

export interface VideoContent {
  type: 'video';
  url: string;
  thumbnail?: string;
}

// Discriminated union — the `type` field on each member narrows the union
export type AnnotationContent = TextContent | ImageContent | VideoContent;

// ── Position ─────────────────────────────────────────────────────────────────

export interface AnnotationPosition {
  x: number;
  y: number;
  z: number;
}

// ── Meta ─────────────────────────────────────────────────────────────────────

export interface AnnotationMeta {
  createdAt: number;
  updatedAt: number;
}

// ── Full Annotation ─────────────────────────────────────────────────────────

export interface Annotation {
  id: string;
  type: AnnotationType;
  position: AnnotationPosition;
  content: AnnotationContent;
  meta?: AnnotationMeta;
}

// ── Legacy Shape (backward compat) ──────────────────────────────────────────

/** Old flat format: { id, text, position } */
export interface LegacyAnnotation {
  id: string;
  text: string;
  position: AnnotationPosition;
}

// ── Type Guards ─────────────────────────────────────────────────────────────

export function isTextAnnotation(ann: Annotation): ann is Annotation & { content: TextContent } {
  return ann.content.type === 'text';
}

export function isImageAnnotation(ann: Annotation): ann is Annotation & { content: ImageContent } {
  return ann.content.type === 'image';
}

export function isVideoAnnotation(ann: Annotation): ann is Annotation & { content: VideoContent } {
  return ann.content.type === 'video';
}
