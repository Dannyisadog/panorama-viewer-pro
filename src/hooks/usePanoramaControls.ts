import { useCallback, useEffect, useRef } from 'react';
import type { PerspectiveCamera } from 'three';
import { clamp, lerp } from '@/utils/math';

export interface PanoramaControlsOptions {
  /** Initial field of view in degrees */
  initialFov?: number;
  minFov?: number;
  maxFov?: number;
  /** Rotation speed (pixels → radians factor) */
  rotateSpeed?: number;
  /** Scroll zoom speed */
  zoomSpeed?: number;
  /** FOV lerp factor per frame (0 = no smoothing) */
  fovSmoothing?: number;
  /** Inertia decay factor (0 = no inertia, 1 = infinite) */
  inertiaDecay?: number;
  /** Minimum latitude in radians (prevent flipping) */
  minLatitude?: number;
  maxLatitude?: number;
}

export interface PanoramaControlsRef {
  /** Update the camera's rotation to match current spherical coords */
  updateCamera: () => void;
}

/**
 * Custom panorama controls hook.
 *
 * Implements:
 * - Click + drag rotation via spherical coordinates (longitude/latitude)
 * - Mouse wheel zoom via camera FOV
 * - Inertia (momentum after drag release)
 * - Smooth FOV interpolation
 *
 * Does NOT use Three.js OrbitControls — all logic is manual.
 */
export function usePanoramaControls(
  camera: PerspectiveCamera | null,
  domElement: HTMLElement | null,
  options: PanoramaControlsOptions = {}
) {
  const {
    initialFov = 75,
    minFov = 30,
    maxFov = 100,
    rotateSpeed = 0.003,
    zoomSpeed = 0.05,
    fovSmoothing = 0.1,
    inertiaDecay = 0.92,
    minLatitude = -Math.PI / 2 + 0.05,
    maxLatitude = Math.PI / 2 - 0.05,
  } = options;

  // ── Mutable state (not React state — updated every frame) ────────────────

  // Current spherical coordinates (radians)
  const longitudeRef = useRef(0);       // horizontal rotation
  const latitudeRef = useRef(0);        // vertical rotation

  // Current FOV (lerped target)
  const fovRef = useRef(initialFov);

  // Drag tracking
  const isDraggingRef = useRef(false);
  const lastPointerRef = useRef<{ x: number; y: number } | null>(null);

  // Velocity for inertia
  const velocityLonRef = useRef(0);
  const velocityLatRef = useRef(0);

  // Pending FOV target (set by wheel, lerped each frame)
  const targetFovRef = useRef(initialFov);

  // Animation frame ID for cleanup
  const animFrameRef = useRef<number>(0);

  // ── Update camera from spherical coords ──────────────────────────────────

  const updateCamera = useCallback(() => {
    if (!camera) return;

    // Convert spherical → Cartesian direction
    const phi = latitudeRef.current;    // -π/2 to π/2 (vertical)
    const theta = longitudeRef.current; // -π to π (horizontal)

    const x = Math.cos(phi) * Math.sin(theta);
    const y = Math.sin(phi);
    const z = -Math.cos(phi) * Math.cos(theta);

    // Place camera just inside the sphere center, looking in direction (x,y,z)
    camera.position.set(x * 0.1, y * 0.1, z * 0.1);
    camera.lookAt(x, y, z);

    // Apply smoothed FOV
    camera.fov = fovRef.current;
    camera.updateProjectionMatrix();
  }, [camera]);

  // ── Animation loop ───────────────────────────────────────────────────────

  useEffect(() => {
    if (!camera || !domElement) return;

    const tick = () => {
      animFrameRef.current = requestAnimationFrame(tick);

      // Apply inertia (only when not dragging)
      if (!isDraggingRef.current) {
        longitudeRef.current += velocityLonRef.current;
        latitudeRef.current += velocityLatRef.current;
        velocityLonRef.current *= inertiaDecay;
        velocityLatRef.current *= inertiaDecay;

        // Stop tiny velocities to prevent infinite drift
        if (Math.abs(velocityLonRef.current) < 0.00001) velocityLonRef.current = 0;
        if (Math.abs(velocityLatRef.current) < 0.00001) velocityLatRef.current = 0;
      }

      // Smooth FOV interpolation
      const currentFov = camera.fov;
      if (Math.abs(currentFov - targetFovRef.current) > 0.01) {
        fovRef.current = lerp(currentFov, targetFovRef.current, fovSmoothing);
      } else {
        fovRef.current = targetFovRef.current;
      }

      updateCamera();
    };

    tick();

    return () => {
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [camera, domElement, inertiaDecay, fovSmoothing, updateCamera]);

  // ── Pointer event handlers ──────────────────────────────────────────────

  useEffect(() => {
    if (!domElement) return;

    // ── Mouse drag ────────────────────────────────────────────────────────

    const onPointerDown = (e: PointerEvent) => {
      // Ignore secondary buttons
      if (e.button !== 0) return;
      isDraggingRef.current = true;
      lastPointerRef.current = { x: e.clientX, y: e.clientY };
      velocityLonRef.current = 0;
      velocityLatRef.current = 0;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!isDraggingRef.current || !lastPointerRef.current) return;

      const dx = e.clientX - lastPointerRef.current.x;
      const dy = e.clientY - lastPointerRef.current.y;

      // Update longitude/latitude
      // Invert Y because dragging up = looking down (positive latitude)
      const newLon = longitudeRef.current - dx * rotateSpeed;
      let newLat = latitudeRef.current - dy * rotateSpeed;

      // Clamp latitude to prevent camera flip
      newLat = clamp(newLat, minLatitude, maxLatitude);

      longitudeRef.current = newLon;
      latitudeRef.current = newLat;

      // Store velocity for inertia
      velocityLonRef.current = -dx * rotateSpeed;
      velocityLatRef.current = -dy * rotateSpeed;

      lastPointerRef.current = { x: e.clientX, y: e.clientY };
    };

    const onPointerUp = () => {
      isDraggingRef.current = false;
      lastPointerRef.current = null;
    };

    // ── Wheel zoom ─────────────────────────────────────────────────────────

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();

      // Firefox uses detail, others use deltaY
      const delta = e.deltaY || e.detail || 0;
      const newFov = clamp(targetFovRef.current + delta * zoomSpeed, minFov, maxFov);
      targetFovRef.current = newFov;
    };

    // ── Touch support ──────────────────────────────────────────────────────

    // Track single-finger touch for drag
    let lastTouch: { x: number; y: number } | null = null;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        isDraggingRef.current = true;
        lastTouch = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        velocityLonRef.current = 0;
        velocityLatRef.current = 0;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!isDraggingRef.current || e.touches.length !== 1 || !lastTouch) return;
      e.preventDefault();

      const dx = e.touches[0].clientX - lastTouch.x;
      const dy = e.touches[0].clientY - lastTouch.y;

      let newLon = longitudeRef.current - dx * rotateSpeed;
      let newLat = latitudeRef.current - dy * rotateSpeed;
      newLat = clamp(newLat, minLatitude, maxLatitude);

      longitudeRef.current = newLon;
      latitudeRef.current = newLat;

      velocityLonRef.current = -dx * rotateSpeed;
      velocityLatRef.current = -dy * rotateSpeed;

      lastTouch = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    };

    const onTouchEnd = () => {
      isDraggingRef.current = false;
      lastTouch = null;
    };

    domElement.addEventListener('pointerdown', onPointerDown);
    domElement.addEventListener('pointermove', onPointerMove);
    domElement.addEventListener('pointerup', onPointerUp);
    domElement.addEventListener('pointercancel', onPointerUp);
    domElement.addEventListener('wheel', onWheel, { passive: false });
    domElement.addEventListener('touchstart', onTouchStart, { passive: true });
    domElement.addEventListener('touchmove', onTouchMove, { passive: false });
    domElement.addEventListener('touchend', onTouchEnd);

    return () => {
      domElement.removeEventListener('pointerdown', onPointerDown);
      domElement.removeEventListener('pointermove', onPointerMove);
      domElement.removeEventListener('pointerup', onPointerUp);
      domElement.removeEventListener('pointercancel', onPointerUp);
      domElement.removeEventListener('wheel', onWheel);
      domElement.removeEventListener('touchstart', onTouchStart);
      domElement.removeEventListener('touchmove', onTouchMove);
      domElement.removeEventListener('touchend', onTouchEnd);
    };
  }, [domElement, rotateSpeed, zoomSpeed, minFov, maxFov, minLatitude, maxLatitude]);

  return { updateCamera };
}
