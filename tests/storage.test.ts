import { describe, it, expect, beforeEach } from 'vitest';
import type { Annotation } from '@/types/annotation';

const STORAGE_KEY = 'panorama_annotations';

function makeTextAnnotation(id: string, text: string): Annotation {
  return {
    id,
    type: 'text',
    position: { x: 0, y: 0, z: 1 },
    content: { type: 'text', text },
    meta: { createdAt: 1700000000000, updatedAt: 1700000000000 },
  };
}

// ── Mock localStorage helper ───────────────────────────────────────────────────

const store: Record<string, string> = {};

const mockLocalStorage = {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => { store[key] = value; },
  removeItem: (key: string) => { delete store[key]; },
  clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
};

// Re-export for use in tests
export { mockLocalStorage };

// ── Storage logic (mirrors App.tsx) ───────────────────────────────────────────

function loadFromStorage(): Annotation[] {
  try {
    const raw = mockLocalStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    // Apply migration logic
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item: any) => {
      if (item.type && item.content) return item;
      // Legacy
      return {
        id: item.id,
        type: 'text',
        position: item.position,
        content: { type: 'text', text: item.text ?? '' },
        meta: { createdAt: item.createdAt ?? Date.now(), updatedAt: item.createdAt ?? Date.now() },
      };
    });
  } catch {
    return [];
  }
}

function saveToStorage(annotations: Annotation[]) {
  mockLocalStorage.setItem(STORAGE_KEY, JSON.stringify(annotations));
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('localStorage persistence', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
  });

  describe('save and load round-trip', () => {
    it('saves a newly created annotation to localStorage', () => {
      const ann = makeTextAnnotation('ann_1', 'Hello');
      saveToStorage([ann]);

      expect(mockLocalStorage.getItem(STORAGE_KEY)).toBeTruthy();
    });

    it('loads saved annotations from localStorage', () => {
      const ann = makeTextAnnotation('ann_1', 'Saved annotation');
      saveToStorage([ann]);

      const loaded = loadFromStorage();
      expect(loaded).toHaveLength(1);
      expect(loaded[0].id).toBe('ann_1');
    });

    it('preserves all annotation fields through save/load', () => {
      const ann = makeTextAnnotation('full_test', 'Full test');
      saveToStorage([ann]);

      const loaded = loadFromStorage();
      expect(loaded[0]).toMatchObject({
        id: 'full_test',
        type: 'text',
        content: { type: 'text', text: 'Full test' },
      });
    });

    it('persists multiple annotations', () => {
      const anns = [
        makeTextAnnotation('a', 'First'),
        makeTextAnnotation('b', 'Second'),
        makeTextAnnotation('c', 'Third'),
      ];
      saveToStorage(anns);

      const loaded = loadFromStorage();
      expect(loaded).toHaveLength(3);
    });
  });

  describe('update annotation', () => {
    it('updates text content and persists', () => {
      const original = makeTextAnnotation('upd_1', 'Original');
      saveToStorage([original]);

      const loaded = loadFromStorage();
      const updated = loaded.map((a) =>
        a.id === 'upd_1'
          ? { ...a, content: { ...a.content, text: 'Updated' }, meta: { ...a.meta!, updatedAt: Date.now() } }
          : a
      );
      saveToStorage(updated);

      const reloaded = loadFromStorage();
      expect(reloaded[0].content).toMatchObject({ type: 'text', text: 'Updated' });
    });

    it('deleting an annotation removes it from storage', () => {
      const anns = [makeTextAnnotation('del_1', 'Delete me')];
      saveToStorage(anns);

      const loaded = loadFromStorage();
      const filtered = loaded.filter((a) => a.id !== 'del_1');
      saveToStorage(filtered);

      const reloaded = loadFromStorage();
      expect(reloaded).toHaveLength(0);
    });
  });

  describe('empty / invalid data', () => {
    it('returns empty array when localStorage is empty', () => {
      expect(loadFromStorage()).toEqual([]);
    });

    it('returns empty array for corrupted JSON', () => {
      mockLocalStorage.setItem(STORAGE_KEY, '{ not valid json');
      expect(loadFromStorage()).toEqual([]);
    });

    it('returns empty array for non-JSON string', () => {
      mockLocalStorage.setItem(STORAGE_KEY, 'just a string');
      expect(loadFromStorage()).toEqual([]);
    });

    it('returns empty array for null', () => {
      mockLocalStorage.setItem(STORAGE_KEY, 'null');
      expect(loadFromStorage()).toEqual([]);
    });

    it('handles legacy format gracefully', () => {
      // Old format: { id, text, position }
      mockLocalStorage.setItem(STORAGE_KEY, JSON.stringify([
        { id: 'legacy_1', text: 'Old text', position: { x: 1, y: 2, z: 3 } },
      ]));

      const loaded = loadFromStorage();
      expect(loaded).toHaveLength(1);
      expect(loaded[0].type).toBe('text');
      expect(loaded[0].content).toMatchObject({ type: 'text', text: 'Old text' });
    });

    it('handles partial legacy data', () => {
      mockLocalStorage.setItem(STORAGE_KEY, JSON.stringify([
        { id: 'partial', position: { x: 0, y: 0, z: 1 } }, // missing text
      ]));

      const loaded = loadFromStorage();
      expect(loaded).toHaveLength(1);
      expect(loaded[0].content).toEqual({ type: 'text', text: '' });
    });
  });
});
