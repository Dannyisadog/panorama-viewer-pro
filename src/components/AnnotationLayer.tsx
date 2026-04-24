import { useEffect, useRef } from 'react';
import * as THREE from 'three';

export interface AnnotationData {
  id: string;
  text: string;
  position: { x: number; y: number; z: number };
}

interface AnnotationLayerProps {
  annotations: AnnotationData[];
  cameraRef: React.MutableRefObject<THREE.PerspectiveCamera | null>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  editMode: boolean;
  onTick?: (timestamp: number) => void;
  rafIdRef?: React.MutableRefObject<number>;
}

export function AnnotationLayer({
  annotations,
  cameraRef,
  containerRef,
  editMode,
  onTick,
  rafIdRef,
}: AnnotationLayerProps) {
  const layerRef = useRef<HTMLDivElement>(null);
  // Keep a live ref to annotations so the RAF loop always has current data
  const annotationsRef = useRef(annotations);
  annotationsRef.current = annotations;

  useEffect(() => {
    if (editMode) return;

    // Register our tick function into PanoramaViewer's RAF loop
    if (onTick) {
      onTick(0);
    }

    // Sync rafIdRef from PanoramaViewer's animate loop
    // so we don't run a second independent loop
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
  }, [editMode, onTick, rafIdRef, cameraRef, containerRef]);

  if (editMode) return null;

  return (
    <div ref={layerRef} className="annotation-layer">
      {annotations.map((ann) => (
        <div key={ann.id} data-id={ann.id} className="annotation-marker">
          <div className="annotation-dot" />
          <div className="annotation-label">{ann.text}</div>
        </div>
      ))}
    </div>
  );
}
