import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { Annotation, TextContent } from '@/lib/annotationsService';

type AnnotationData = Annotation;

export type { AnnotationData };

// ── Type guard ──────────────────────────────────────────────────────────────

function getText(ann: AnnotationData): string {
  if (ann.type === 'text') {
    return (ann.content as TextContent).text;
  }
  return '';
}

interface AnnotationLayerProps {
  annotations: AnnotationData[];
  cameraRef: React.MutableRefObject<THREE.PerspectiveCamera | null>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  editMode: boolean;
  onAnnotationEdit?: (annotation: AnnotationData) => void;
  onAnnotationDelete?: (annotation: AnnotationData) => void;
  rafIdRef?: React.MutableRefObject<number>;
}

export function AnnotationLayer({
  annotations,
  cameraRef,
  containerRef,
  editMode,
  onAnnotationEdit,
  onAnnotationDelete,
  rafIdRef,
}: AnnotationLayerProps) {
  const layerRef = useRef<HTMLDivElement>(null);
  // Keep a live ref to annotations so the RAF loop always has current data
  const annotationsRef = useRef(annotations);
  annotationsRef.current = annotations;

  // Track which annotation IDs have been positioned by the RAF loop.
  // An annotation is hidden until its first projected position is applied.
  // This prevents the brief (0,0) flash mount before the RAF tick runs.
  const positionedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    // RAF loop runs in BOTH edit and view mode.
    // Never do an early-return that would skip a frame when refs are already valid —
    // only skip if a ref hasn't been initialized yet (null/undefined on first call).
    const syncRafLoop = () => {
      if (!rafIdRef) {
        rafIdRef!.current = requestAnimationFrame(syncRafLoop);
        return;
      }

      const layer = layerRef.current;
      const camera = cameraRef.current;
      const container = containerRef.current;
      const width = container?.clientWidth ?? 0;
      const height = container?.clientHeight ?? 0;

      // Only run projection if camera + container + layer are all initialized.
      // This is a one-time gate — after init they stay non-null for the session.
      if (layer && camera && width > 0 && height > 0) {
        const currentAnnotations = annotationsRef.current;

        currentAnnotations.forEach((ann) => {
          const el = layer.querySelector(`[data-id="${ann.id}"]`) as HTMLElement | null;
          if (!el) return;

          const pos = new THREE.Vector3(ann.position.x, ann.position.y, ann.position.z);
          pos.project(camera);

          // Guard against NaN / invalid projection
          if (!Number.isFinite(pos.x) || !Number.isFinite(pos.y) || !Number.isFinite(pos.z)) {
            el.style.visibility = 'hidden';
            return;
          }

          // Relaxed frustum check: hide only when clearly behind camera (z > 0.95).
          // Annotations slightly behind the camera plane should remain visible —
          // they may swing back into view as the camera rotates.
          // This prevents the jarring "disappear during rotation" flicker.
          if (pos.z > 0.95) {
            el.style.visibility = 'hidden';
            return;
          }

          const screenX = (pos.x * 0.5 + 0.5) * width;
          const screenY = (-pos.y * 0.5 + 0.5) * height;

          el.style.transform = `translate(${screenX}px, ${screenY}px) translate(-50%, -50%)`;

          // First time we position this annotation — mark it visible and clear the --new flag
          // so the pop-in animation only plays on first paint, not every mount
          if (!positionedRef.current.has(ann.id)) {
            positionedRef.current.add(ann.id);
            el.style.visibility = 'visible';
            el.classList.remove('annotation-marker--new');
          }
        });
      }

      rafIdRef.current = requestAnimationFrame(syncRafLoop);
    };

    rafIdRef!.current = requestAnimationFrame(syncRafLoop);

    return () => {
      if (rafIdRef && rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, [rafIdRef, cameraRef, containerRef]);

  // Always render annotations (both view and edit mode)
  // Layer gets "edit-mode" class when editing so CSS can show controls always
  return (
    <div
      ref={layerRef}
      className={`annotation-layer${editMode ? ' edit-mode' : ''}`}
    >
      {annotations.map((ann) => (
        <div
          key={ann.id}
          data-id={ann.id}
          className={`annotation-marker${ann.createdAt > Date.now() - 2000 ? ' annotation-marker--new' : ''}`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="annotation-dot" />
          <div className="annotation-label">{getText(ann)}</div>
          {editMode && (
            <div className="annotation-actions">
              <button
                className="annotation-action-btn edit"
                title="Edit"
                onClick={(e) => {
                  e.stopPropagation();
                  onAnnotationEdit?.(ann);
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              </button>
              <button
                className="annotation-action-btn delete"
                title="Delete"
                onClick={(e) => {
                  e.stopPropagation();
                  onAnnotationDelete?.(ann);
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                  <path d="M10 11v6M14 11v6"/>
                  <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                </svg>
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
