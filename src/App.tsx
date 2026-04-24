import { useState, useRef, useCallback, useEffect } from 'react';
import * as THREE from 'three';
import { PanoramaViewer } from '@/components/PanoramaViewer';
import { FloatingBar } from '@/components/FloatingBar';
import {
  AnnotationLayer,
  type AnnotationData,
} from '@/components/AnnotationLayer';
import { AnnotationModal } from '@/components/AnnotationModal';
import type {
  Annotation,
  AnnotationContent,
  TextContent,
} from '@/types/annotation';
import { migrateAnnotations } from '@/utils/migrate';

const SAMPLE_PANORAMA = 'https://pannuseum.org/images/alma.jpg';
const STORAGE_KEY = 'panorama_annotations';

// ── Persistence ─────────────────────────────────────────────────────────────

function loadFromStorage(): Annotation[] {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    return migrateAnnotations(raw);
  } catch {
    return [];
  }
}

// ── App ──────────────────────────────────────────────────────────────────────

function App() {
  const [imageUrl, setImageUrl] = useState<string>(SAMPLE_PANORAMA);
  const [selectedFileName, setSelectedFileName] = useState<string | undefined>();
  const [editMode, setEditMode] = useState(false);
  const [annotations, setAnnotations] = useState<Annotation[]>(loadFromStorage);
  const [pendingPosition, setPendingPosition] = useState<{ x: number; y: number; z: number } | null>(null);
  const [modalScreenPos, setModalScreenPos] = useState<{ x: number; y: number } | null>(null);
  const [editingAnnotation, setEditingAnnotation] = useState<Annotation | null>(null);

  // Refs shared with PanoramaViewer
  const containerRef = useRef<HTMLDivElement>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rafIdRef = useRef(0);
  const prevObjectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(annotations));
  }, [annotations]);

  // ── Image selection ──────────────────────────────────────────────────────

  const handleImageSelect = (url: string, fileName: string) => {
    if (prevObjectUrlRef.current?.startsWith('blob:')) {
      URL.revokeObjectURL(prevObjectUrlRef.current);
    }
    prevObjectUrlRef.current = url;
    setImageUrl(url);
    setSelectedFileName(fileName);
  };

  const handleToggleEditMode = () => setEditMode((prev) => !prev);

  // ── Annotation create ───────────────────────────────────────────────────

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

  // ── Annotation edit ─────────────────────────────────────────────────────

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

  // ── Save ────────────────────────────────────────────────────────────────

  const handleSave = (content: AnnotationContent) => {
    // Empty guard — cancel if no meaningful content
    if (content.type === 'text' && !content.text.trim()) {
      setPendingPosition(null);
      setEditingAnnotation(null);
      setModalScreenPos(null);
      return;
    }

    const now = Date.now();

    if (editingAnnotation) {
      // Update existing — preserve original createdAt
      setAnnotations((prev) =>
        prev.map((a) =>
          a.id === editingAnnotation.id
            ? { ...a, content, meta: { ...a.meta, updatedAt: now } }
            : a
        )
      );
    } else if (pendingPosition) {
      // Create new
      const newAnnotation: Annotation = {
        id: `ann_${now}_${Math.random().toString(36).slice(2, 7)}`,
        type: content.type,
        position: pendingPosition,
        content,
        meta: { createdAt: now, updatedAt: now },
      };
      setAnnotations((prev) => [...prev, newAnnotation]);
    }

    setPendingPosition(null);
    setEditingAnnotation(null);
    setModalScreenPos(null);
  };

  // ── Cancel / delete ─────────────────────────────────────────────────────

  const handleCancel = () => {
    setPendingPosition(null);
    setEditingAnnotation(null);
    setModalScreenPos(null);
  };

  const handleAnnotationDelete = useCallback((id: string) => {
    setAnnotations((prev) => prev.filter((a) => a.id !== id));
  }, []);

  // ── Derive current content for modal ────────────────────────────────────

  const modalContent: AnnotationContent | null =
    editingAnnotation?.content ?? (pendingPosition ? { type: 'text', text: '' } : null);

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

      {modalScreenPos && modalContent && (
        <AnnotationModal
          position={modalScreenPos}
          content={modalContent}
          onSave={handleSave}
          onCancel={handleCancel}
        />
      )}
    </div>
  );
}

export default App;
