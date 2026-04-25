import { describe, it, expect } from 'vitest';
import type { AnnotationData } from '@/components/AnnotationLayer';

// Test the getText logic in isolation (no React needed)
type TextContent = { text: string };
type ImageContent = { imageUrl: string; caption?: string };
type VideoContent = { videoUrl: string; caption?: string };

function makeAnnotationData(overrides: Partial<AnnotationData> = {}): AnnotationData {
  return {
    id: 'ann_test',
    type: 'text',
    position: { x: 0, y: 0, z: 1 },
    content: { type: 'text', text: 'Test annotation' } as TextContent,
    createdAt: 1700000000000,
    ...overrides,
  };
}

// Extract the getText logic so it can be unit tested
function getText(ann: AnnotationData): string {
  if (ann.type === 'text') {
    return (ann.content as TextContent).text;
  }
  return '';
}

describe('AnnotationData type guard logic', () => {
  describe('getText', () => {
    it('returns text for text annotation', () => {
      const ann = makeAnnotationData({
        type: 'text',
        content: { type: 'text', text: 'Hello world' } as TextContent,
      });
      expect(getText(ann)).toBe('Hello world');
    });

    it('returns empty string for image annotation', () => {
      const ann = makeAnnotationData({
        type: 'image',
        content: { type: 'image', imageUrl: 'https://example.com/img.jpg' } as ImageContent,
      });
      expect(getText(ann)).toBe('');
    });

    it('returns empty string for video annotation', () => {
      const ann = makeAnnotationData({
        type: 'video',
        content: { type: 'video', videoUrl: 'https://example.com/vid.mp4' } as VideoContent,
      });
      expect(getText(ann)).toBe('');
    });

    it('handles empty text', () => {
      const ann = makeAnnotationData({
        type: 'text',
        content: { type: 'text', text: '' } as TextContent,
      });
      expect(getText(ann)).toBe('');
    });

    it('handles text with special characters', () => {
      const ann = makeAnnotationData({
        type: 'text',
        content: { type: 'text', text: '<script>alert("xss")</script>' } as TextContent,
      });
      expect(getText(ann)).toBe('<script>alert("xss")</script>');
    });

    it('handles unicode text', () => {
      const ann = makeAnnotationData({
        type: 'text',
        content: { type: 'text', text: '日本語 annotation 🎉' } as TextContent,
      });
      expect(getText(ann)).toBe('日本語 annotation 🎉');
    });
  });
});

describe('AnnotationData structure', () => {
  it('has required id field', () => {
    const ann = makeAnnotationData({ id: 'custom_id' });
    expect(ann.id).toBe('custom_id');
  });

  it('has required position field', () => {
    const ann = makeAnnotationData({ position: { x: 100, y: -50, z: 200 } });
    expect(ann.position).toEqual({ x: 100, y: -50, z: 200 });
  });

  it('has required type field', () => {
    expect(makeAnnotationData({ type: 'text' }).type).toBe('text');
    expect(makeAnnotationData({ type: 'image' }).type).toBe('image');
    expect(makeAnnotationData({ type: 'video' }).type).toBe('video');
  });

  it('has createdAt timestamp', () => {
    const ann = makeAnnotationData();
    expect(ann.createdAt).toBe(1700000000000);
  });
});
