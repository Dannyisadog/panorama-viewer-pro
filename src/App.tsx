import { useState, useRef, useCallback, useEffect } from 'react';
import * as THREE from 'three';
import { PanoramaViewer } from '@/components/PanoramaViewer';
import { FloatingBar } from '@/components/FloatingBar';
import { AnnotationLayer } from '@/components/AnnotationLayer';
import { AnnotationModal } from '@/components/AnnotationModal';

const SAMPLE_PANORAMA = 'https://pannellum.org/images/alma.jpg';
const STORAGE_KEY = 'panorama_annotations';

export interface Annotation {
  id: string;
  text: string;
  position: { x: number; y: number; z: number };
}

function loadFromStorage(): Annotation[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function App() {
  const [imageUrl, setImageUrl] = useState<string>(SAMPLE_PANORAMA);
  const [selectedFileName, setSelectedFileName] = useState<string | undefined>();
  const [editMode, setEditMode] = useState(false);
  const [annotations, setAnnotations] = useState<Annotation[]>(loadFromStorage);
  const [pendingPosition, setPendingPosition] = useState<{ x: number; y: number; z: number } | null>(null);
  const [modalScreenPos, setModalScreenPos] = useState<{ x: number; y: number } | null>(null);

  // This ref is shared with PanoramaViewer so we can compute screen positions
  const containerRef = useRef<HTMLDivElement>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rafIdRef = useRef(0);
  const prevObjectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(annotations));
  }, [annotations]);

  const handleImageSelect = (url: string, fileName: string) => {
    if (prevObjectUrlRef.current?.startsWith('blob:')) {
      URL.revokeObjectURL(prevObjectUrlRef.current);
    }
    prevObjectUrlRef.current = url;
    setImageUrl(url);
    setSelectedFileName(fileName);
  };

  const handleToggleEditMode = () => setEditMode((prev) => !prev);

  const handleAnnotationCreate = useCallback(
    (position: { x: number; y: number; z: number }) => {
      if (!cameraRef.current || !containerRef.current) return;
      const projected = new THREE.Vector3(position.x, position.y, position.z).project(cameraRef.current);
      const { clientWidth: width, clientHeight: height } = containerRef.current;
      const screenX = (projected.x * 0.5 + 0.5) * width;
      const screenY = (-projected.y * 0.5 + 0.5) * height;
      setPendingPosition(position);
      setModalScreenPos({ x: screenX, y: screenY });
    },
    []
  );

  const handleSave = (text: string) => {
    if (!pendingPosition || !text.trim()) {
      setPendingPosition(null);
      setModalScreenPos(null);
      return;
    }
    const newAnnotation: Annotation = {
      id: `ann_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      text: text.trim(),
      position: pendingPosition,
    };
    setAnnotations((prev) => [...prev, newAnnotation]);
    setPendingPosition(null);
    setModalScreenPos(null);
  };

  const handleCancel = () => {
    setPendingPosition(null);
    setModalScreenPos(null);
  };

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      <PanoramaViewer
        imageUrl={imageUrl}
        editMode={editMode}
        onAnnotationCreate={handleAnnotationCreate}
        cameraRef={cameraRef}
        containerRef={containerRef}
        rafIdRef={rafIdRef}
      />

      <AnnotationLayer
        annotations={annotations}
        cameraRef={cameraRef}
        containerRef={containerRef}
        editMode={editMode}
        rafIdRef={rafIdRef}
      />

      <FloatingBar
        onImageSelect={handleImageSelect}
        selectedFileName={selectedFileName}
        editMode={editMode}
        onToggleEditMode={handleToggleEditMode}
      />

      {modalScreenPos && pendingPosition && (
        <AnnotationModal
          position={modalScreenPos}
          onSave={handleSave}
          onCancel={handleCancel}
        />
      )}
    </div>
  );
}

export default App;
