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
}

export function AnnotationLayer({
  annotations,
  cameraRef,
  containerRef,
  editMode,
}: AnnotationLayerProps) {
  const layerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editMode) return;

    let rafId: number;
    const updatePositions = () => {
      rafId = requestAnimationFrame(updatePositions);
      const camera = cameraRef.current;
      const container = containerRef.current;
      const layer = layerRef.current;
      if (!camera || !container || !layer) return;

      const { clientWidth: width, clientHeight: height } = container;

      annotations.forEach((ann) => {
        const el = layer.querySelector(`[data-id="${ann.id}"]`) as HTMLElement | null;
        if (!el) return;

        const pos = new THREE.Vector3(ann.position.x, ann.position.y, ann.position.z);
        pos.project(camera);

        if (pos.z > 1 || pos.z < -1) {
          el.style.opacity = '0';
          return;
        }

        const screenX = (pos.x * 0.5 + 0.5) * width;
        const screenY = (-pos.y * 0.5 + 0.5) * height;

        el.style.transform = `translate(${screenX}px, ${screenY}px)`;
        el.style.opacity = '1';
      });
    };

    updatePositions();
    return () => cancelAnimationFrame(rafId);
  }, [annotations, cameraRef, containerRef, editMode]);

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
