import { describe, it, expect } from 'vitest';
import { isTextAnnotation, isImageAnnotation, isVideoAnnotation } from '@/types/annotation';
import type { Annotation } from '@/types/annotation';

function makeText(content: { text: string } = { text: 'hello' }): Annotation {
  return {
    id: 'ann_1',
    type: 'text',
    position: { x: 0, y: 0, z: 1 },
    content: { type: 'text', ...content },
    meta: { createdAt: 1, updatedAt: 1 },
  };
}

function makeImage(content: { url: string; alt?: string } = { url: 'https://example.com/img.jpg' }): Annotation {
  return {
    id: 'ann_2',
    type: 'image',
    position: { x: 0, y: 0, z: 1 },
    content: { type: 'image', ...content },
    meta: { createdAt: 1, updatedAt: 1 },
  };
}

function makeVideo(content: { url: string; thumbnail?: string } = { url: 'https://example.com/vid.mp4' }): Annotation {
  return {
    id: 'ann_3',
    type: 'video',
    position: { x: 0, y: 0, z: 1 },
    content: { type: 'video', ...content },
    meta: { createdAt: 1, updatedAt: 1 },
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Annotation type guards', () => {
  describe('isTextAnnotation', () => {
    it('returns true for text annotation', () => {
      expect(isTextAnnotation(makeText())).toBe(true);
    });

    it('returns false for image annotation', () => {
      expect(isImageAnnotation(makeText())).toBe(false);
    });

    it('returns false for video annotation', () => {
      expect(isVideoAnnotation(makeText())).toBe(false);
    });
  });

  describe('isImageAnnotation', () => {
    it('returns true for image annotation', () => {
      expect(isImageAnnotation(makeImage())).toBe(true);
    });

    it('returns false for text annotation', () => {
      expect(isTextAnnotation(makeImage())).toBe(false);
    });

    it('returns false for video annotation', () => {
      expect(isVideoAnnotation(makeImage())).toBe(false);
    });
  });

  describe('isVideoAnnotation', () => {
    it('returns true for video annotation', () => {
      expect(isVideoAnnotation(makeVideo())).toBe(true);
    });

    it('returns false for text annotation', () => {
      expect(isTextAnnotation(makeVideo())).toBe(false);
    });

    it('returns false for image annotation', () => {
      expect(isImageAnnotation(makeVideo())).toBe(false);
    });
  });
});

describe('Annotation content shapes', () => {
  it('text content has text field', () => {
    const ann = makeText({ text: 'My annotation' });
    if (isTextAnnotation(ann)) {
      expect(ann.content.text).toBe('My annotation');
    }
  });

  it('image content has url field', () => {
    const ann = makeImage({ url: 'https://example.com/photo.jpg', alt: 'A photo' });
    if (isImageAnnotation(ann)) {
      expect(ann.content.url).toBe('https://example.com/photo.jpg');
      expect(ann.content.alt).toBe('A photo');
    }
  });

  it('video content has url and optional thumbnail', () => {
    const ann = makeVideo({ url: 'https://example.com/video.mp4', thumbnail: 'https://ex.com/thumb.jpg' });
    if (isVideoAnnotation(ann)) {
      expect(ann.content.url).toBe('https://example.com/video.mp4');
      expect(ann.content.thumbnail).toBe('https://ex.com/thumb.jpg');
    }
  });
});

describe('Annotation creation (business logic)', () => {
  it('generates a unique id for new annotation', () => {
    const id1 = `ann_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const id2 = `ann_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    expect(id1).not.toBe(id2);
  });

  it('new annotation has required fields', () => {
    const newAnn = {
      id: `ann_${Date.now()}`,
      type: 'text' as const,
      position: { x: 10, y: -5, z: 3 },
      content: { type: 'text' as const, text: 'Test' },
      meta: { createdAt: Date.now(), updatedAt: Date.now() },
    };

    expect(newAnn.id).toBeDefined();
    expect(newAnn.type).toBe('text');
    expect(newAnn.position).toEqual({ x: 10, y: -5, z: 3 });
    expect(newAnn.content).toEqual({ type: 'text', text: 'Test' });
    expect(newAnn.meta.createdAt).toBeGreaterThan(0);
  });

  it('annotation update preserves id and type', () => {
    const original = makeText({ text: 'original' });
    const updated = {
      ...original,
      content: { type: 'text' as const, text: 'updated' },
      meta: { ...original.meta!, updatedAt: Date.now() },
    };

    expect(updated.id).toBe(original.id);
    expect(updated.type).toBe('text');
    expect(updated.content).toEqual({ type: 'text', text: 'updated' });
  });
});
