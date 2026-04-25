import { useState, useRef, useCallback, useEffect } from 'react';
import * as THREE from 'three';
import { PanoramaViewer } from '@/components/PanoramaViewer';
import { FloatingBar } from '@/components/FloatingBar';
import { AnnotationLayer, type AnnotationData } from '@/components/AnnotationLayer';
import { AnnotationModal } from '@/components/AnnotationModal';

const SAMPLE_PANORAMA = 'https://pannellum.org/images/alma.jpg';
const STORAGE_KEY = 'panorama_annotations';

// ── New extensible annotation types ─────────────────────────────────────────

type TextContent = { text: string };
type ImageContent = { imageUrl: string; caption?: string };
type VideoContent = { videoUrl: string; caption?: string };

export interface Annotation {
  id: string;
  type: 'text' | 'image' | 'video';
  position: { x: number; y: number; z: number };
  content: TextContent | ImageContent | VideoContent;
  createdAt: number;
}

// Backward compatibility: migrate old-format annotations to new format
function migrateAnnotation(ann: any): Annotation {
  // Already new format
  if (ann.type && ann.content) {
    return ann;
  }
  // Old format: { id, text, position } → new: { id, type:'text', position, content:{ text }, createdAt }
  return {
    id: ann.id,
    type: 'text',
    position: ann.position,
    content: { text: ann.text ?? '' } as TextContent,
    createdAt: ann.createdAt ?? Date.now(),
  };
}

function loadFromStorage(): Annotation[] {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    return raw.map(migrateAnnotation);
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
  // Editing state — annotation being edited (for the modal)
  const [editingAnnotation, setEditingAnnotation] = useState<Annotation | null>(null);

  // Refs shared with PanoramaViewer
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

  // Opens modal for a new annotation at the clicked 3D position
  const handleAnnotationCreate = useCallback(
    (position: { x: number; y: number; z: number }) => {
      if (!cameraRef.current || !containerRef.current) return;
      const projected = new THREE.Vector3(position.x, position.y, position.z).project(cameraRef.current);
      const { clientWidth: width, clientHeight: height } = containerRef.current;
      const screenX = (projected.x * 0.5 + 0.5) * width;
      const screenY = (-projected.y * 0.5 + 0.5) * height;
      setPendingPosition(position);
      setModalScreenPos({ x: screenX, y: screenY });
      setEditingAnnotation(null); // fresh create
    },
    []
  );

  // Opens modal pre-filled with existing annotation text (for edit)
  const handleAnnotationEdit = useCallback(
    (annotation: AnnotationData) => {
      if (!cameraRef.current || !containerRef.current) return;
      const projected = new THREE.Vector3(
        annotation.position.x,
        annotation.position.y,
        annotation.position.z
      ).project(cameraRef.current);
      const { clientWidth: width, clientHeight: height } = containerRef.current;
      const screenX = (projected.x * 0.5 + 0.5) * width;
      const screenY = (-projected.y * 0.5 + 0.5) * height;
      setEditingAnnotation(annotation as Annotation);
      setModalScreenPos({ x: screenX, y: screenY });
      setPendingPosition(null); // not a fresh create
    },
    []
  );

  // Saves — handles both create and edit (text only for now)
  const handleSave = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) {
      setPendingPosition(null);
      setEditingAnnotation(null);
      setModalScreenPos(null);
      return;
    }

    if (editingAnnotation) {
      // Update existing — update content.text
      setAnnotations((prev) =>
        prev.map((a) =>
          a.id === editingAnnotation.id
            ? { ...a, content: { ...a.content, text: trimmed } }
            : a
        )
      );
    } else if (pendingPosition) {
      // Create new
      const newAnnotation: Annotation = {
        id: `ann_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        type: 'text',
        position: pendingPosition,
        content: { text: trimmed },
        createdAt: Date.now(),
      };
      setAnnotations((prev) => [...prev, newAnnotation]);
    }

    setPendingPosition(null);
    setEditingAnnotation(null);
    setModalScreenPos(null);
  };

  const handleCancel = () => {
    setPendingPosition(null);
    setEditingAnnotation(null);
    setModalScreenPos(null);
  };

  const handleAnnotationDelete = useCallback((id: string) => {
    setAnnotations((prev) => prev.filter((a) => a.id !== id));
  }, []);

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
        onAnnotationEdit={handleAnnotationEdit}
        onAnnotationDelete={handleAnnotationDelete}
        rafIdRef={rafIdRef}
      />

      <FloatingBar
        onImageSelect={handleImageSelect}
        selectedFileName={selectedFileName}
        editMode={editMode}
        onToggleEditMode={handleToggleEditMode}
      />

      {modalScreenPos && (
        <AnnotationModal
          position={modalScreenPos}
          initialText={editingAnnotation?.content && 'text' in editingAnnotation.content ? editingAnnotation.content.text : ''}
          onSave={handleSave}
          onCancel={handleCancel}
        />
      )}
    </div>
  );
}

export default App;
