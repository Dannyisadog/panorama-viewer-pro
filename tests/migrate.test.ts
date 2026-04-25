import { describe, it, expect } from 'vitest';
import {
  migrateAnnotations,
} from '@/utils/migrate';
import type { Annotation, LegacyAnnotation } from '@/types/annotation';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeTextAnnotation(overrides = {}): Annotation {
  return {
    id: 'ann_1',
    type: 'text',
    position: { x: 0, y: 0, z: 1 },
    content: { type: 'text', text: 'Hello world' },
    meta: { createdAt: 1700000000000, updatedAt: 1700000000000 },
    ...overrides,
  };
}

function makeLegacy(id: string, text: string): LegacyAnnotation {
  return { id, text, position: { x: 0, y: 0, z: 1 } };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('migrateAnnotations', () => {
  describe('new-format input (passthrough)', () => {
    it('returns new-format annotations unchanged', () => {
      const ann = makeTextAnnotation();
      const result = migrateAnnotations([ann]);
      expect(result).toEqual([ann]);
    });

    it('returns empty array for empty input', () => {
      expect(migrateAnnotations([])).toEqual([]);
      expect(migrateAnnotations(null)).toEqual([]);
      expect(migrateAnnotations(undefined)).toEqual([]);
    });

    it('returns empty array for non-array input', () => {
      expect(migrateAnnotations('not an array')).toEqual([]);
      expect(migrateAnnotations(42)).toEqual([]);
      expect(migrateAnnotations({})).toEqual([]);
    });

    it('handles mixed new-format array (first element has type+content)', () => {
      const ann = makeTextAnnotation({ id: 'new_1' });
      const result = migrateAnnotations([ann]);
      expect(result[0].type).toBe('text');
      expect(result[0].content).toEqual({ type: 'text', text: 'Hello world' });
    });
  });

  describe('legacy format migration', () => {
    it('migrates a single legacy annotation to new format', () => {
      const legacy = makeLegacy('old_1', 'Old text');
      const result = migrateAnnotations([legacy]);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'old_1',
        type: 'text',
        position: { x: 0, y: 0, z: 1 },
        content: { type: 'text', text: 'Old text' },
      });
      expect(result[0].meta).toBeDefined();
      expect(result[0].meta?.createdAt).toBeGreaterThan(0);
    });

    it('migrates multiple legacy annotations', () => {
      const legacy = [
        makeLegacy('old_1', 'First'),
        makeLegacy('old_2', 'Second'),
      ];
      const result = migrateAnnotations(legacy);

      expect(result).toHaveLength(2);
      expect(result[0].content).toMatchObject({ type: 'text', text: 'First' });
      expect(result[1].content).toMatchObject({ type: 'text', text: 'Second' });
    });

    it('preserves id and position during migration', () => {
      const legacy = { id: 'keep_id', text: 'keep text', position: { x: 10, y: -5, z: 3 } };
      const result = migrateAnnotations([legacy]);

      expect(result[0].id).toBe('keep_id');
      expect(result[0].position).toEqual({ x: 10, y: -5, z: 3 });
    });

    it('handles legacy annotation with empty text', () => {
      const legacy = makeLegacy('no_text', '');
      const result = migrateAnnotations([legacy]);

      expect(result[0].content).toEqual({ type: 'text', text: '' });
    });

    it('assigns createdAt and updatedAt during migration', () => {
      const before = Date.now();
      const legacy = makeLegacy('t_1', 'Test');
      const result = migrateAnnotations([legacy]);
      const after = Date.now();

      expect(result[0].meta?.createdAt).toBeGreaterThanOrEqual(before);
      expect(result[0].meta?.createdAt).toBeLessThanOrEqual(after);
      expect(result[0].meta?.updatedAt).toBeGreaterThanOrEqual(before);
      expect(result[0].meta?.updatedAt).toBeLessThanOrEqual(after);
    });

    it('handles mixed array — legacy + already-new-format items', () => {
      const legacy = makeLegacy('legacy_1', 'Migrated');
      const alreadyNew = makeTextAnnotation({ id: 'new_2' });
      const result = migrateAnnotations([legacy, alreadyNew]);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('legacy_1');
      expect(result[1].id).toBe('new_2');
    });
  });
});
