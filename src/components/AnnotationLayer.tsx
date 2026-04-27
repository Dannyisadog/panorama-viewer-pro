import { useEffect, useRef, useCallback, useState } from 'react';
import * as THREE from 'three';
import type { Annotation, TextContent } from '@/lib/annotationsService';

type AnnotationData = Annotation;

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
  onAnnotationPositionUpdate?: (
    id: string,
    position: { x: number; y: number; z: number }
  ) => void;
}

export type { AnnotationData };

export function AnnotationLayer({
  annotations,
  cameraRef,
  containerRef,
  editMode,
  onAnnotationEdit,
  onAnnotationDelete,
  onAnnotationPositionUpdate,
}: AnnotationLayerProps) {
  const layerRef = useRef<HTMLDivElement>(null);
  // Keep a live ref to annotations so the RAF loop always has current data
  const annotationsRef = useRef(annotations);
  annotationsRef.current = annotations;

  // ── Drag state ───────────────────────────────────────────────────────────────
  const isDraggingRef = useRef(false);
  const draggingIdRef = useRef<string | null>(null);
  const dragScreenXRef = useRef(0);
  const dragScreenYRef = useRef(0);
  // State drives re-render for CSS class; ref drives RAF loop for position updates
  const [draggingId, setDraggingId] = useState<string | null>(null);

  // ── Project 3D world position → 2D screen ───────────────────────────────────
  const projectToScreen = useCallback(
    (pos: { x: number; y: number; z: number }) => {
      const camera = cameraRef.current;
      const container = containerRef.current;
      if (!camera || !container) return null;
      const width = container.clientWidth;
      const height = container.clientHeight;
      if (width === 0 || height === 0) return null;
      const projected = new THREE.Vector3(pos.x, pos.y, pos.z).project(camera);
      return {
        screenX: (projected.x * 0.5 + 0.5) * width,
        screenY: (-projected.y * 0.5 + 0.5) * height,
      };
    },
    [cameraRef, containerRef]
  );

  // ── Unproject 2D screen → 3D world position on sphere ────────────────────────
  const unprojectToWorld = useCallback(
    (screenX: number, screenY: number): { x: number; y: number; z: number } | null => {
      const camera = cameraRef.current;
      const container = containerRef.current;
      if (!camera || !container) return null;
      const rect = container.getBoundingClientRect
        ? container.getBoundingClientRect()
        : { left: 0, top: 0, width: container.clientWidth, height: container.clientHeight };

      // Normalize to [-1, +1]
      const nx = (screenX / rect.width) * 2 - 1;
      const ny = -((screenY / rect.height) * 2 - 1);

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(new THREE.Vector2(nx, ny), camera);

      // Find intersection with the panorama sphere (radius 500, centered at origin)
      const radius = 500;

      const dir = raycaster.ray.direction.clone();
      const oc = raycaster.ray.origin.clone();

      const a = dir.dot(dir);
      const b = 2 * oc.dot(dir);
      const c = oc.dot(oc) - radius * radius;
      const discriminant = b * b - 4 * a * c;

      if (discriminant < 0) return null;

      const t = (-b - Math.sqrt(discriminant)) / (2 * a);
      if (t < 0) return null;

      const point = raycaster.ray.at(t, new THREE.Vector3());
      return { x: point.x, y: point.y, z: point.z };
    },
    [cameraRef, containerRef]
  );

  // ── RAF loop: sync annotation positions ──────────────────────────────────────
  useEffect(() => {
    let rafId = 0;

    const syncRafLoop = () => {
      rafId = requestAnimationFrame(syncRafLoop);

      const layer = layerRef.current;
      const camera = cameraRef.current;
      const container = containerRef.current;
      const width = container?.clientWidth ?? 0;
      const height = container?.clientHeight ?? 0;

      if (!layer || !camera || width === 0 || height === 0) return;

      const currentAnnotations = annotationsRef.current;

      currentAnnotations.forEach((ann) => {
        const el = layer.querySelector(`[data-id="${ann.id}"]`) as HTMLElement | null;
        if (!el) return;

        let screenX: number;
        let screenY: number;

        // If this annotation is being dragged, use stored screen position
        if (isDraggingRef.current && draggingIdRef.current === ann.id) {
          screenX = dragScreenXRef.current;
          screenY = dragScreenYRef.current;
        } else {
          const projected = projectToScreen(ann.position);
          if (!projected) {
            el.style.display = 'none';
            return;
          }
          screenX = projected.screenX;
          screenY = projected.screenY;
        }

        el.style.display = '';
        el.style.transform = `translate(${screenX}px, ${screenY}px) translate(-50%, -50%)`;
        el.style.visibility = 'visible';
        el.classList.remove('annotation-marker--new');
      });
    };

    rafId = requestAnimationFrame(syncRafLoop);
    return () => cancelAnimationFrame(rafId);
  }, [cameraRef, containerRef, projectToScreen]);

  // ── Drag handlers ────────────────────────────────────────────────────────────
  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      if (!isDraggingRef.current || !draggingIdRef.current) return;
      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      dragScreenXRef.current = e.clientX - rect.left;
      dragScreenYRef.current = e.clientY - rect.top;
    },
    [containerRef]
  );

  const handlePointerUp = useCallback(
    (e: PointerEvent) => {
      if (!isDraggingRef.current || !draggingIdRef.current) return;

      const container = containerRef.current;
      const id = draggingIdRef.current;

      // Unproject final screen position to world
      const rect = container?.getBoundingClientRect();
      if (rect) {
        dragScreenXRef.current = e.clientX - rect.left;
        dragScreenYRef.current = e.clientY - rect.top;
      }

      const worldPos = unprojectToWorld(dragScreenXRef.current, dragScreenYRef.current);

      isDraggingRef.current = false;
      draggingIdRef.current = null;
      setDraggingId(null);

      if (worldPos && onAnnotationPositionUpdate) {
        onAnnotationPositionUpdate(id, worldPos);
      }
    },
    [containerRef, unprojectToWorld, onAnnotationPositionUpdate]
  );

  // Attach global pointer move/up listeners when drag starts
  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;

    const onLayerPointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement;
      // Find the closest annotation-marker ancestor
      const marker = target.closest('.annotation-marker') as HTMLElement | null;
      if (!marker) return;

      const id = marker.dataset.id;
      if (!id) return;

      // Only allow dragging in edit mode
      if (!editMode) return;

      e.stopPropagation();
      isDraggingRef.current = true;
      draggingIdRef.current = id;
      setDraggingId(id);

      const container = containerRef.current;
      if (container) {
        const rect = container.getBoundingClientRect();
        dragScreenXRef.current = e.clientX - rect.left;
        dragScreenYRef.current = e.clientY - rect.top;
      }

      // Capture pointer so we receive move/up even outside element
      marker.setPointerCapture(e.pointerId);
    };

    layer.addEventListener('pointerdown', onLayerPointerDown);
    return () => layer.removeEventListener('pointerdown', onLayerPointerDown);
  }, [editMode, containerRef]);

  // Global move/up listeners (added when editMode is true, removed when false)
  useEffect(() => {
    if (!editMode) return;

    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);

    return () => {
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
    };
  }, [editMode, handlePointerMove, handlePointerUp]);

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
          className={`annotation-marker${ann.createdAt > Date.now() - 2000 ? ' annotation-marker--new' : ''}${draggingId === ann.id ? ' annotation-marker--dragging' : ''}`}
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
