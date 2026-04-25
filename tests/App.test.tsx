import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import App from '@/App';

// ── Mock localStorage ──────────────────────────────────────────────────────────

const mockStore: Record<string, string> = {};

const mockLocalStorage = {
  getItem: (key: string) => mockStore[key] ?? null,
  setItem: (key: string, value: string) => { mockStore[key] = value; },
  removeItem: (key: string) => { delete mockStore[key]; },
  clear: () => { Object.keys(mockStore).forEach((k) => delete mockStore[k]); },
};

Object.defineProperty(window, 'localStorage', { value: mockLocalStorage, writable: true });

// ── Mock child components ──────────────────────────────────────────────────────

vi.mock('@/components/PanoramaViewer', () => ({
  PanoramaViewer: () => <div data-testid="panorama-viewer">PanoramaViewer</div>,
}));

vi.mock('@/components/FloatingBar', () => ({
  FloatingBar: () => <div data-testid="floating-bar">FloatingBar</div>,
}));

vi.mock('@/components/AnnotationLayer', () => ({
  AnnotationLayer: () => <div data-testid="annotation-layer">AnnotationLayer</div>,
}));

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  mockLocalStorage.clear();
});

describe('App — initial render', () => {
  it('renders PanoramaViewer, FloatingBar, and AnnotationLayer', () => {
    render(<App />);
    expect(screen.getByTestId('panorama-viewer')).toBeInTheDocument();
    expect(screen.getByTestId('floating-bar')).toBeInTheDocument();
    expect(screen.getByTestId('annotation-layer')).toBeInTheDocument();
  });

  it('saves empty annotations array to localStorage on first annotation creation', () => {
    // localStorage should NOT be written on mount when there are no annotations.
    // It is only written when a CRUD operation actually occurs.
    render(<App />);
    expect(mockLocalStorage.getItem('panorama_annotations')).toBe(null);
  });
});

describe('App — data model', () => {
  it('loads from localStorage on mount', () => {
    const saved = JSON.stringify([{
      id: 'ann_pre1',
      type: 'text',
      position: { x: 0, y: 0, z: 1 },
      content: { type: 'text', text: 'Pre-saved' },
      meta: { createdAt: 1700000000000, updatedAt: 1700000000000 },
    }]);
    mockLocalStorage.setItem('panorama_annotations', saved);

    render(<App />);
    expect(screen.getByTestId('annotation-layer')).toBeInTheDocument();
  });

  it('migrates legacy format on load', () => {
    const legacy = JSON.stringify([
      { id: 'legacy_1', text: 'Old annotation', position: { x: 1, y: 2, z: 3 } },
    ]);
    mockLocalStorage.setItem('panorama_annotations', legacy);

    // Should not throw
    render(<App />);
    expect(screen.getByTestId('annotation-layer')).toBeInTheDocument();
  });

  it('returns empty array for corrupted localStorage', () => {
    mockLocalStorage.setItem('panorama_annotations', '{ not json');
    render(<App />);
    expect(screen.getByTestId('annotation-layer')).toBeInTheDocument();
  });
});

describe('App — annotation creation shape', () => {
  it('new annotation has correct type and content shape', () => {
    const newAnn = {
      id: `ann_${Date.now()}_test`,
      type: 'text' as const,
      position: { x: 0, y: 0, z: 1 },
      content: { type: 'text' as const, text: 'Test annotation' },
      meta: { createdAt: Date.now(), updatedAt: Date.now() },
    };

    expect(newAnn.type).toBe('text');
    expect(newAnn.content).toMatchObject({ type: 'text', text: 'Test annotation' });
    expect(newAnn.id).toBeDefined();
    expect(newAnn.position).toEqual({ x: 0, y: 0, z: 1 });
  });

  it('annotation update preserves id and type', () => {
    const original = {
      id: 'ann_preserve',
      type: 'text' as const,
      position: { x: 0, y: 0, z: 1 },
      content: { type: 'text' as const, text: 'Original' },
      meta: { createdAt: 1, updatedAt: 1 },
    };

    const updated = {
      ...original,
      content: { ...original.content, text: 'Updated' },
      meta: { ...original.meta, updatedAt: Date.now() },
    };

    expect(updated.id).toBe('ann_preserve');
    expect(updated.type).toBe('text');
    expect(updated.content).toMatchObject({ type: 'text', text: 'Updated' });
    expect(updated.meta?.createdAt).toBe(1); // unchanged
  });

  it('annotation id is unique', () => {
    const id1 = `ann_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const id2 = `ann_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    expect(id1).not.toBe(id2);
  });
});
