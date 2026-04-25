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

  useEffect(() => {
    // RAF loop runs in BOTH edit and view mode — no early return
    const syncRafLoop = () => {
      if (!rafIdRef) return;

      const layer = layerRef.current;
      const camera = cameraRef.current;
      const container = containerRef.current;
      if (!layer || !camera || !container) {
        rafIdRef.current = requestAnimationFrame(syncRafLoop);
        return;
      }

      const { clientWidth: width, clientHeight: height } = container;
      const currentAnnotations = annotationsRef.current;

      currentAnnotations.forEach((ann) => {
        const el = layer.querySelector(`[data-id="${ann.id}"]`) as HTMLElement | null;
        if (!el) return;

        const pos = new THREE.Vector3(ann.position.x, ann.position.y, ann.position.z);
        pos.project(camera);

        // Guard against NaN / invalid projection
        if (!Number.isFinite(pos.x) || !Number.isFinite(pos.y) || !Number.isFinite(pos.z)) {
          el.style.opacity = '0';
          return;
        }

        // Hide when behind camera
        if (pos.z > 1 || pos.z < -1) {
          el.style.opacity = '0';
          return;
        }

        const screenX = (pos.x * 0.5 + 0.5) * width;
        const screenY = (-pos.y * 0.5 + 0.5) * height;

        el.style.transform = `translate(${screenX}px, ${screenY}px) translate(-50%, -50%)`;
        el.style.opacity = '1';
      });

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
  console.log('[AnnotationLayer] rendering, annotations count:', annotations.length, 'editMode:', editMode);
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
