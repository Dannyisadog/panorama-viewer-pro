'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { clamp, lerp } from '@/utils/math';

export interface PanoramaViewerProps {
  imageUrl?: string;
  initialFov?: number;
  minFov?: number;
  maxFov?: number;
  className?: string;
}

const SPHERE_RADIUS = 500;

export function PanoramaViewer({
  imageUrl,
  initialFov = 75,
  minFov = 30,
  maxFov = 100,
  className,
}: PanoramaViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const sceneRef    = useRef<THREE.Scene | null>(null);
  const cameraRef   = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sphereRef   = useRef<THREE.Mesh | null>(null);

  // ── Spherical coords for camera direction ─────────────────────────────
  const longitudeRef = useRef(0);   // horizontal (radians)
  const latitudeRef  = useRef(0);   // vertical (radians)
  const fovRef       = useRef(initialFov);
  const targetFovRef = useRef(initialFov);

  // ── Drag state ─────────────────────────────────────────────────────────
  const isDraggingRef   = useRef(false);
  const lastPointerRef  = useRef<{ x: number; y: number } | null>(null);
  const velocityLonRef  = useRef(0);
  const velocityLatRef  = useRef(0);

  // ── All Three.js setup in ONE effect ─────────────────────────────────

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const w = container.clientWidth  || window.innerWidth;
    const h = container.clientHeight || window.innerHeight;

    // ── Scene ──────────────────────────────────────────────────────────
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // ── Camera ─────────────────────────────────────────────────────────
    // Camera is at sphere CENTER (0,0,0). We want it to look OUTWARD.
    // Using lookAt with a tangent vector so position≠target.
    const camera = new THREE.PerspectiveCamera(initialFov, w / h, 0.1, 2000);
    camera.position.set(0, 0, 0);
    // Initial direction: tangent along +Z so we're looking at sphere interior
    const initialTarget = new THREE.Vector3(0, 0, 1);
    camera.lookAt(initialTarget);
    cameraRef.current = camera;

    // ── Renderer ────────────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h);
    renderer.xr.enabled = false;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // ── Sphere ─────────────────────────────────────────────────────────
    // SphereGeometry default front-faces outward. Camera is at center (0,0,0).
    // BackSide renders the inner surface so we see the texture from inside.
    const geometry = new THREE.SphereGeometry(SPHERE_RADIUS, 64, 32);
    // TEMP: red so we can verify sphere renders before texture is loaded
    const material = new THREE.MeshBasicMaterial({ side: THREE.BackSide });
    const sphere = new THREE.Mesh(geometry, material);
    sphere.name = 'panorama-sphere';
    scene.add(sphere);
    sphereRef.current = sphere;

    // ── Update camera from spherical coords ───────────────────────────
    const updateCamera = () => {
      // Spherical coords: longitude (theta) = horizontal angle, latitude (phi) = vertical
      const theta = longitudeRef.current;  // left/right
      const phi   = latitudeRef.current;   // up/down
      // Direction from sphere center toward the shell surface
      const dirX = Math.cos(phi) * Math.sin(theta);
      const dirY = Math.sin(phi);
      const dirZ = Math.cos(phi) * Math.cos(theta);
      camera.lookAt(dirX, dirY, dirZ);
      camera.fov = fovRef.current;
      camera.updateProjectionMatrix();
    };

    // ── Animation loop ─────────────────────────────────────────────────
    let rafId = 0;
    const animate = () => {
      rafId = requestAnimationFrame(animate);

      // Inertia (smooth deceleration when not dragging)
      if (!isDraggingRef.current) {
        longitudeRef.current += velocityLonRef.current;
        latitudeRef.current  += velocityLatRef.current;
        velocityLonRef.current *= 0.92;
        velocityLatRef.current  *= 0.92;
        if (Math.abs(velocityLonRef.current) < 0.00001) velocityLonRef.current = 0;
        if (Math.abs(velocityLatRef.current) < 0.00001) velocityLatRef.current = 0;
      }

      // Smooth FOV interpolation
      const diff = targetFovRef.current - fovRef.current;
      if (Math.abs(diff) > 0.01) {
        fovRef.current = lerp(fovRef.current, targetFovRef.current, 0.1);
      } else {
        fovRef.current = targetFovRef.current;
      }

      updateCamera();
      renderer.render(scene, camera);
    };
    animate();

    // ── Resize handling ────────────────────────────────────────────────
    const handleResize = () => {
      const nw = container.clientWidth;
      const nh = container.clientHeight;
      camera.aspect = nw / nh;
      camera.updateProjectionMatrix();
      renderer.setSize(nw, nh);
    };
    const ro = new ResizeObserver(handleResize);
    ro.observe(container);

    // ── Pointer events ─────────────────────────────────────────────────
    const onPointerDown = (e: PointerEvent) => {
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
      const speed = 0.003;
      let newLon = longitudeRef.current - dx * speed;
      let newLat = latitudeRef.current  - dy * speed;
      newLat = clamp(newLat, -Math.PI / 2 + 0.05, Math.PI / 2 - 0.05);
      longitudeRef.current = newLon;
      latitudeRef.current  = newLat;
      velocityLonRef.current = -dx * speed;
      velocityLatRef.current = -dy * speed;
      lastPointerRef.current = { x: e.clientX, y: e.clientY };
    };

    const onPointerUp = () => {
      isDraggingRef.current = false;
      lastPointerRef.current = null;
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY || e.detail || 0;
      targetFovRef.current = clamp(targetFovRef.current + delta * 0.05, minFov, maxFov);
    };

    // Touch support
    let lastTouch: { x: number; y: number } | null = null;
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      isDraggingRef.current = true;
      lastTouch = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      velocityLonRef.current = 0;
      velocityLatRef.current = 0;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!isDraggingRef.current || e.touches.length !== 1 || !lastTouch) return;
      e.preventDefault();
      const dx = e.touches[0].clientX - lastTouch.x;
      const dy = e.touches[0].clientY - lastTouch.y;
      const speed = 0.003;
      let newLon = longitudeRef.current - dx * speed;
      let newLat = latitudeRef.current  - dy * speed;
      newLat = clamp(newLat, -Math.PI / 2 + 0.05, Math.PI / 2 - 0.05);
      longitudeRef.current = newLon;
      latitudeRef.current  = newLat;
      velocityLonRef.current = -dx * speed;
      velocityLatRef.current = -dy * speed;
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
    container.addEventListener('wheel',         onWheel,  { passive: false });
    container.addEventListener('touchstart',    onTouchStart, { passive: true });
    container.addEventListener('touchmove',     onTouchMove,  { passive: false });
    container.addEventListener('touchend',     onTouchEnd);

    // ── Load texture ─────────────────────────────────────────────────
    function loadTexture(url: string) {
      new THREE.TextureLoader().load(
        url,
        (texture) => {
          texture.colorSpace = THREE.SRGBColorSpace;
          const mat = sphere.material as THREE.MeshBasicMaterial;
          if (mat.map) mat.map.dispose();
          mat.map = texture;
          mat.color.set(0xffffff); // back to white so texture shows true colors
          mat.needsUpdate = true;
          console.log('[PanoramaViewer] Texture loaded:', url);
        },
        undefined,
        () => console.error('[PanoramaViewer] Texture load error:', url)
      );
    }
    if (imageUrl) loadTexture(imageUrl);

    // ── Cleanup ────────────────────────────────────────────────────────
    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
      container.removeEventListener('pointerdown',  onPointerDown);
      container.removeEventListener('pointermove',  onPointerMove);
      container.removeEventListener('pointerup',    onPointerUp);
      container.removeEventListener('pointercancel', onPointerUp);
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
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      scene.remove(sphere);
      scene.clear();
      sceneRef.current    = null;
      cameraRef.current  = null;
      rendererRef.current = null;
      sphereRef.current   = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Load / swap texture when URL changes ────────────────────────────────

  useEffect(() => {
    if (!imageUrl || !sphereRef.current) return;
    const mat = sphereRef.current.material as THREE.MeshBasicMaterial;
    if (mat.map) { mat.map.dispose(); mat.map = null; }
    new THREE.TextureLoader().load(
      imageUrl,
      (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        mat.map = texture;
        mat.color.set(0xffffff);
        mat.needsUpdate = true;
        console.log('[PanoramaViewer] Texture loaded:', imageUrl);
      },
      undefined,
      () => console.error('[PanoramaViewer] Failed to load:', imageUrl)
    );
  }, [imageUrl]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ width: '100%', height: '100%', overflow: 'hidden', cursor: 'grab' }}
    />
  );
}
