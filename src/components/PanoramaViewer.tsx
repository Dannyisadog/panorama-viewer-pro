'use client';

import { useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { clamp, lerp } from '@/utils/math';

export interface PanoramaViewerProps {
  imageUrl?: string;
  isLoading?: boolean;
  initialFov?: number;
  minFov?: number;
  maxFov?: number;
  className?: string;
  editMode?: boolean;
  onAnnotationCreate?: (position: { x: number; y: number; z: number }) => void;
  cameraRef?: React.MutableRefObject<THREE.PerspectiveCamera | null>;
  containerRef?: React.RefObject<HTMLDivElement | null>;
  rafIdRef?: React.MutableRefObject<number>;
}

const SPHERE_RADIUS = 500;

export function PanoramaViewer({
  imageUrl,
  isLoading = false,
  initialFov = 75,
  minFov = 30,
  maxFov = 100,
  className,
  editMode = false,
  onAnnotationCreate,
  cameraRef: externalCameraRef,
  containerRef: externalContainerRef,
  rafIdRef: externalRafIdRef,
}: PanoramaViewerProps) {
  // External containerRef (from App) for screen position calculations
  // Internal ref as fallback
  const internalContainerRef = useRef<HTMLDivElement>(null);

  const sceneRef     = useRef<THREE.Scene | null>(null);
  const cameraRef    = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef  = useRef<THREE.WebGLRenderer | null>(null);
  const sphereRef    = useRef<THREE.Mesh | null>(null);
  // Keep material ref so the useEffect can control sphere visibility
  const materialRef  = useRef<THREE.MeshBasicMaterial | null>(null);
  const rafIdRef     = useRef(0);
  // Request version counter — discards stale texture load callbacks
  const loadIdRef   = useRef(0);

  const longitudeRef = useRef(0);
  const latitudeRef  = useRef(0);
  const fovRef       = useRef(initialFov);
  const targetFovRef = useRef(initialFov);

  const isDraggingRef   = useRef(false);
  const lastPointerRef  = useRef<{ x: number; y: number } | null>(null);
  const velocityLonRef  = useRef(0);
  const velocityLatRef  = useRef(0);

  // Keep editMode ref current so click handler always reads latest value
  const editModeRef = useRef(editMode);
  editModeRef.current = editMode;

  const initializedRef = useRef(false);

  const setContainerRef = useCallback((node: HTMLDivElement | null) => {
    // When external ref is provided, write to it. Also maintain internal for self-use.
    if (externalContainerRef) {
      (externalContainerRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
    }
    internalContainerRef.current = node;
    if (node && !initializedRef.current) {
      initializedRef.current = true;
      initThree(node);
    }
  }, [externalContainerRef]);

  function initThree(container: HTMLDivElement) {
    const w = container.clientWidth  || window.innerWidth;
    const h = container.clientHeight || window.innerHeight;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(initialFov, w / h, 0.1, 2000);
    camera.position.set(0, 0, 0);
    camera.lookAt(0, 0, 1);
    cameraRef.current = camera;
    if (externalCameraRef) externalCameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h);
    renderer.xr.enabled = false;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const geometry = new THREE.SphereGeometry(SPHERE_RADIUS, 64, 32);
    const material = new THREE.MeshBasicMaterial({ side: THREE.BackSide });
    // Sphere starts HIDDEN — only visible after texture loads successfully
    material.visible = false;
    const sphere = new THREE.Mesh(geometry, material);
    sphere.name = 'panorama-sphere';
    scene.add(sphere);
    sphereRef.current = sphere;
    materialRef.current = material;

    const raycaster = new THREE.Raycaster();

    const updateCamera = () => {
      const theta = longitudeRef.current;
      const phi   = latitudeRef.current;
      const dirX = Math.cos(phi) * Math.sin(theta);
      const dirY = Math.sin(phi);
      const dirZ = Math.cos(phi) * Math.cos(theta);
      camera.lookAt(dirX, dirY, dirZ);
      camera.fov = fovRef.current;
      camera.updateProjectionMatrix();
    };

    let rafId = 0;
    const animate = () => {
      rafId = requestAnimationFrame(animate);
      rafIdRef.current = rafId;
      if (externalRafIdRef) externalRafIdRef.current = rafId;

      if (!isDraggingRef.current && !editModeRef.current) {
        longitudeRef.current += velocityLonRef.current;
        latitudeRef.current  += velocityLatRef.current;
        velocityLonRef.current *= 0.92;
        velocityLatRef.current  *= 0.92;
        if (Math.abs(velocityLonRef.current) < 0.00001) velocityLonRef.current = 0;
        if (Math.abs(velocityLatRef.current) < 0.00001) velocityLatRef.current = 0;
      }

      const diff = targetFovRef.current - fovRef.current;
      fovRef.current = Math.abs(diff) > 0.01
        ? lerp(fovRef.current, targetFovRef.current, 0.1)
        : targetFovRef.current;

      updateCamera();
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      const nw = container.clientWidth;
      const nh = container.clientHeight;
      camera.aspect = nw / nh;
      camera.updateProjectionMatrix();
      renderer.setSize(nw, nh);
    };
    const ro = new ResizeObserver(handleResize);
    ro.observe(container);

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      if (editModeRef.current) return; // Disable rotation in edit mode
      isDraggingRef.current = true;
      lastPointerRef.current = { x: e.clientX, y: e.clientY };
      velocityLonRef.current = 0;
      velocityLatRef.current = 0;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!isDraggingRef.current || !lastPointerRef.current) return;
      if (editModeRef.current) return; // Disable rotation in edit mode
      const dx = e.clientX - lastPointerRef.current.x;
      const dy = e.clientY - lastPointerRef.current.y;
      const speed = 0.003;
      // Invert: positive drag moves the world in the same direction (grab-world feel)
      let newLon = longitudeRef.current + dx * speed;
      let newLat = clamp(latitudeRef.current + dy * speed, -Math.PI / 2 + 0.05, Math.PI / 2 - 0.05);
      longitudeRef.current = newLon;
      latitudeRef.current  = newLat;
      velocityLonRef.current = dx * speed;
      velocityLatRef.current = dy * speed;
      lastPointerRef.current = { x: e.clientX, y: e.clientY };
    };

    const onPointerUp = () => {
      if (editModeRef.current) return; // Disable rotation in edit mode
      isDraggingRef.current = false;
      lastPointerRef.current = null;
    };

    const onClick = (e: MouseEvent) => {
      // Read editMode from ref to always get current value (not stale closure)
      if (!editModeRef.current || !onAnnotationCreate) return;
      const dx = e.clientX - (lastPointerRef.current?.x ?? e.clientX);
      const dy = e.clientY - (lastPointerRef.current?.y ?? e.clientY);
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) return;

      const rect = container.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );
      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObject(sphere);
      if (hits.length > 0) {
        const p = hits[0].point;
        onAnnotationCreate({ x: p.x, y: p.y, z: p.z });
      }
    };

    const onWheel = (e: WheelEvent) => {
      if (editModeRef.current) return; // Disable zoom in edit mode
      e.preventDefault();
      const delta = e.deltaY || e.detail || 0;
      targetFovRef.current = clamp(targetFovRef.current + delta * 0.05, minFov, maxFov);
    };

    let lastTouch: { x: number; y: number } | null = null;
    const onTouchStart = (e: TouchEvent) => {
      if (editModeRef.current) return; // Disable rotation in edit mode
      if (e.touches.length !== 1) return;
      isDraggingRef.current = true;
      lastTouch = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      velocityLonRef.current = 0;
      velocityLatRef.current = 0;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!isDraggingRef.current || e.touches.length !== 1 || !lastTouch) return;
      if (editModeRef.current) return; // Disable rotation in edit mode
      e.preventDefault();
      const dx = e.touches[0].clientX - lastTouch.x;
      const dy = e.touches[0].clientY - lastTouch.y;
      const speed = 0.003;
      // Invert: positive drag moves the world in the same direction (grab-world feel)
      let newLon = longitudeRef.current + dx * speed;
      let newLat = clamp(latitudeRef.current + dy * speed, -Math.PI / 2 + 0.05, Math.PI / 2 - 0.05);
      longitudeRef.current = newLon;
      latitudeRef.current  = newLat;
      velocityLonRef.current = dx * speed;
      velocityLatRef.current = dy * speed;
      lastTouch = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    };
    const onTouchEnd = () => {
      isDraggingRef.current = false;
      lastTouch = null;
    };

    container.addEventListener('pointerdown',  onPointerDown);
    container.addEventListener('pointermove',  onPointerMove);
    container.addEventListener('pointerup',    onPointerUp);
    container.addEventListener('pointercancel', onPointerUp);
    container.addEventListener('click',        onClick);
    container.addEventListener('wheel',         onWheel,  { passive: false });
    container.addEventListener('touchstart',    onTouchStart, { passive: true });
    container.addEventListener('touchmove',     onTouchMove,  { passive: false });
    container.addEventListener('touchend',     onTouchEnd);

    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
      container.removeEventListener('pointerdown',  onPointerDown);
      container.removeEventListener('pointermove',  onPointerMove);
      container.removeEventListener('pointerup',    onPointerUp);
      container.removeEventListener('pointercancel', onPointerUp);
      container.removeEventListener('click',        onClick);
      container.removeEventListener('wheel',         onWheel);
      container.removeEventListener('touchstart',    onTouchStart);
      container.removeEventListener('touchmove',     onTouchMove);
      container.removeEventListener('touchend',     onTouchEnd);
      if (sphere.material) {
        const mat = sphere.material as THREE.MeshBasicMaterial;
        if (mat.map) mat.map.dispose();
        mat.dispose();
      }
      geometry.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
      scene.remove(sphere);
      scene.clear();
      sceneRef.current    = null;
      cameraRef.current  = null;
      rendererRef.current = null;
      sphereRef.current   = null;
      materialRef.current = null;
      initializedRef.current = false;
    };
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Cleanup handled by initThree's return
    };
  }, []);

  // Texture swap effect — loadIdRef ensures only the latest load applies.
  // On imageUrl = undefined (logout), immediately hide sphere and clear texture.
  useEffect(() => {
    if (!sphereRef.current || !materialRef.current) return;

    const mat = sphereRef.current.material as THREE.MeshBasicMaterial;

    // Logout / no panorama — hide sphere and clear any stale texture immediately
    if (!imageUrl) {
      if (mat.map) { mat.map.dispose(); mat.map = null; }
      mat.needsUpdate = true;
      mat.visible = false;
      return;
    }

    // Increment and capture — stale loads will see a different version and self-cancel
    loadIdRef.current += 1;
    const thisLoadId = loadIdRef.current;

    // Hide sphere while loading — prevents white/default flash
    materialRef.current.visible = false;

    if (mat.map) { mat.map.dispose(); mat.map = null; }

    new THREE.TextureLoader().load(
      imageUrl,
      (texture) => {
        // Discard result if a newer request has since been issued
        if (thisLoadId !== loadIdRef.current) { texture.dispose(); return; }
        texture.colorSpace = THREE.SRGBColorSpace;
        mat.map = texture;
        mat.color.set(0xffffff);
        mat.needsUpdate = true;
        // Only show sphere AFTER texture is ready
        mat.visible = true;
      },
      undefined,
      () => {
        if (thisLoadId !== loadIdRef.current) return;
        console.error('[PanoramaViewer] Failed to load:', imageUrl);
      }
    );
  }, [imageUrl]);

  return (
    <div
      ref={setContainerRef}
      className={className}
      style={{
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        cursor: editMode ? 'crosshair' : 'grab',
      }}
    >
      {isLoading && (
        <div className="viewer-loading-overlay">
          <div className="viewer-loading-overlay__spinner" />
          <span className="viewer-loading-overlay__text">Loading project…</span>
        </div>
      )}
    </div>
  );
}
