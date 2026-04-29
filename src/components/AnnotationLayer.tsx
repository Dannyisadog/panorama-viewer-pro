import { useEffect, useRef, useCallback, useState } from 'react';
import * as THREE from 'three';
import type { Annotation, TextContent } from '@/lib/annotationsService';

type AnnotationData = Annotation;

// ── Edge auto-pan config ────────────────────────────────────────────────────────
const EDGE_THRESHOLD = 80; // px from edge to trigger auto-pan
const AUTO_PAN_SPEED = 0.0005; // radians per pixel into the edge

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
  cameraPanRef?: React.MutableRefObject<{ dLon: number; dLat: number } | null>;
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
  cameraPanRef,
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
  // Accumulated pixel delta since drag start: (currentCursor - initialCursor)
  const dragDeltaXRef = useRef(0);
  const dragDeltaYRef = useRef(0);
  // Initial cursor screen position at drag start
  const dragCursorXRef = useRef(0);
  const dragCursorYRef = useRef(0);
  // Store last valid world position during drag — used on pointerup to avoid raycaster miss
  const lastValidWorldPosRef = useRef<{ x: number; y: number; z: number } | null>(null);
  // Annotation's projected screen position at drag start — used for correct world pos on pointerup
  const dragStartProjectedRef = useRef<{ screenX: number; screenY: number } | null>(null);
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
      // Use Three.js intersectSphere — handles camera-inside-sphere correctly
      const sphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 500);
      const ray = raycaster.ray;
      const intersectPoint = new THREE.Vector3();
      const hit = ray.intersectSphere(sphere, intersectPoint);

      if (!hit) return null;

      return { x: intersectPoint.x, y: intersectPoint.y, z: intersectPoint.z };
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

        // If this annotation is being dragged, use projected position + accumulated delta
        if (isDraggingRef.current && draggingIdRef.current === ann.id) {
          const projected = projectToScreen(ann.position);
          if (!projected) return;
          screenX = projected.screenX + dragDeltaXRef.current;
          screenY = projected.screenY + dragDeltaYRef.current;
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
      const cursorX = e.clientX - rect.left;
      const cursorY = e.clientY - rect.top;
      const w = rect.width;
      const h = rect.height;

      // Accumulate delta from initial click position
      dragDeltaXRef.current = cursorX - dragCursorXRef.current;
      dragDeltaYRef.current = cursorY - dragCursorYRef.current;

      // Edge auto-pan: write camera pan delta if cursor is near an edge
      if (cameraPanRef) {
        let dLon = 0;
        let dLat = 0;
        if (cursorX < EDGE_THRESHOLD) {
          dLon = (EDGE_THRESHOLD - cursorX) * AUTO_PAN_SPEED;
        } else if (cursorX > w - EDGE_THRESHOLD) {
          dLon = -(cursorX - (w - EDGE_THRESHOLD)) * AUTO_PAN_SPEED;
        }
        if (cursorY < EDGE_THRESHOLD) {
          dLat = (EDGE_THRESHOLD - cursorY) * AUTO_PAN_SPEED;
        } else if (cursorY > h - EDGE_THRESHOLD) {
          dLat = -(cursorY - (h - EDGE_THRESHOLD)) * AUTO_PAN_SPEED;
        }
        if (dLon !== 0 || dLat !== 0) {
          cameraPanRef.current = { dLon, dLat };
        }
      }

      // Cache world position using the annotation's DRAGGED screen position
      // (startProjected + delta), so lastValidWorldPosRef stays consistent with visual position
      const start = dragStartProjectedRef.current;
      if (start) {
        const worldPos = unprojectToWorld(
          start.screenX + dragDeltaXRef.current,
          start.screenY + dragDeltaYRef.current
        );
        if (worldPos) {
          lastValidWorldPosRef.current = worldPos;
        }
      }
    },
    [containerRef, unprojectToWorld, cameraPanRef]
  );

  const handlePointerUp = useCallback(
    () => {
      if (!isDraggingRef.current || !draggingIdRef.current) return;

      const id = draggingIdRef.current;

      // Capture all ref values BEFORE clearing anything
      const start = dragStartProjectedRef.current;
      const deltaX = dragDeltaXRef.current;
      const deltaY = dragDeltaYRef.current;
      const worldPos = lastValidWorldPosRef.current;

      let finalWorldPos: { x: number; y: number; z: number } | null = null;

      if (start && worldPos) {
        const finalScreenX = start.screenX + deltaX;
        const finalScreenY = start.screenY + deltaY;
        finalWorldPos = unprojectToWorld(finalScreenX, finalScreenY);
      }

      // Now clear all refs
      isDraggingRef.current = false;
      draggingIdRef.current = null;
      setDraggingId(null);
      lastValidWorldPosRef.current = null;
      dragDeltaXRef.current = 0;
      dragDeltaYRef.current = 0;
      dragCursorXRef.current = 0;
      dragCursorYRef.current = 0;
      dragStartProjectedRef.current = null;

      // Persist the final position
      if (finalWorldPos && onAnnotationPositionUpdate) {
        onAnnotationPositionUpdate(id, finalWorldPos);
      } else if (worldPos && onAnnotationPositionUpdate) {
        onAnnotationPositionUpdate(id, worldPos);
      }
    },
    [onAnnotationPositionUpdate, unprojectToWorld]
  );

  // Attach global pointer move/up listeners when drag starts
  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;

    const onLayerPointerDown = (e: PointerEvent) => {
      // Only allow dragging from the drag handle
      const target = e.target as HTMLElement;
      const dragHandle = target.closest('[data-drag-handle="true"]') as HTMLElement | null;
      if (!dragHandle) return;

      const marker = dragHandle.closest('.annotation-marker') as HTMLElement | null;
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
        const cursorX = e.clientX - rect.left;
        const cursorY = e.clientY - rect.top;
        dragCursorXRef.current = cursorX;
        dragCursorYRef.current = cursorY;
        dragDeltaXRef.current = 0;
        dragDeltaYRef.current = 0;

        // Pre-compute and cache the world position at drag start
        const worldPos = unprojectToWorld(cursorX, cursorY);
        lastValidWorldPosRef.current = worldPos;

        // Also store the annotation's projected screen pos at drag start
        // so pointerup can compute worldPos from (startProjected + delta)
        const startProjected = projectToScreen(
          annotationsRef.current.find((a) => a.id === id)?.position ?? { x: 0, y: 0, z: 0 }
        );
        dragStartProjectedRef.current = startProjected;
      }

      // Capture pointer so we receive move/up even outside element
      marker.setPointerCapture(e.pointerId);
    };

    layer.addEventListener('pointerdown', onLayerPointerDown);
    return () => layer.removeEventListener('pointerdown', onLayerPointerDown);
  }, [editMode, containerRef, unprojectToWorld, projectToScreen]);

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
          {editMode && (
            <div className="annotation-drag-handle" data-drag-handle="true" title="Drag to move">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="9" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="19" r="1"/>
                <circle cx="15" cy="5" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="19" r="1"/>
              </svg>
            </div>
          )}
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
