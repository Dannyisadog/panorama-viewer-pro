import { useState, useRef, useCallback, useEffect } from 'react';
import * as THREE from 'three';
import { PanoramaViewer } from '@/components/PanoramaViewer';
import { FloatingBar } from '@/components/FloatingBar';
import { AnnotationLayer, type AnnotationData } from '@/components/AnnotationLayer';
import { AnnotationModal } from '@/components/AnnotationModal';
import { LoginModal } from '@/components/LoginModal';
import { LeftSidebar } from '@/components/LeftSidebar';
import { useAuth } from '@/hooks/useAuth';
import {
  loadAnnotations,
  saveAnnotation,
  updateAnnotation,
  removeAnnotation,
  type Annotation,
} from '@/lib/annotationsService';

const SAMPLE_PANORAMA = 'https://pannellum.org/images/alma.jpg';

function App() {
  const { user, isLoading: authLoading, signInWithGoogle, signOut } = useAuth();

  const [imageUrl, setImageUrl] = useState<string>(SAMPLE_PANORAMA);
  const [selectedFileName, setSelectedFileName] = useState<string | undefined>();
  const [editMode, setEditMode] = useState(false);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [pendingPosition, setPendingPosition] = useState<{ x: number; y: number; z: number } | null>(null);
  const [modalScreenPos, setModalScreenPos] = useState<{ x: number; y: number } | null>(null);
  const [editingAnnotation, setEditingAnnotation] = useState<Annotation | null>(null);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);

  // Refs shared with PanoramaViewer
  const containerRef = useRef<HTMLDivElement>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rafIdRef = useRef(0);
  const prevObjectUrlRef = useRef<string | null>(null);

  // ── Hydrate annotations whenever auth state changes ─────────────────────────
  // - Logged in  → fetch from Supabase (source of truth), cache to localStorage
  // - Not logged → load from localStorage only
  // Result is applied via setAnnotations after the async call resolves.
  useEffect(() => {
    loadAnnotations(user).then(setAnnotations).catch(() => setAnnotations([]));
  }, [user]);

  const handleImageSelect = (url: string, fileName: string) => {
    if (prevObjectUrlRef.current?.startsWith('blob:')) {
      URL.revokeObjectURL(prevObjectUrlRef.current);
    }
    prevObjectUrlRef.current = url;
    setImageUrl(url);
    setSelectedFileName(fileName);
  };

  const handleToggleEditMode = () => {
    if (!user) {
      setIsLoginModalOpen(true);
      return;
    }
    setEditMode((prev) => !prev);
  };

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
  // Authenticated → persist to Supabase (+ localStorage cache)
  // Unauthenticated → localStorage only
  const handleSave = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) {
      setPendingPosition(null);
      setEditingAnnotation(null);
      setModalScreenPos(null);
      return;
    }

    if (editingAnnotation) {
      // Edit existing — update locally, then sync
      const updated = { ...editingAnnotation, content: { ...editingAnnotation.content, text: trimmed } };
      setAnnotations((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));

      if (user) {
        updateAnnotation(updated.id, updated.content, user);
      }
    } else if (pendingPosition) {
      // Create new
      const newAnnotation = {
        id: `ann_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        type: 'text' as const,
        position: pendingPosition,
        content: { text: trimmed },
      };

      if (user) {
        const saved = await saveAnnotation(newAnnotation, user);
        if (saved) {
          setAnnotations((prev) => [...prev, saved]);
        }
      } else {
        // Unauthenticated — write to localStorage only
        const optimistic: Annotation = {
          ...newAnnotation,
          user_id: 'anonymous',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        setAnnotations((prev) => [...prev, optimistic]);
        const existing = JSON.parse(localStorage.getItem('panorama_annotations') ?? '[]');
        localStorage.setItem('panorama_annotations', JSON.stringify([...existing, optimistic]));
      }
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

  const handleAnnotationDelete = useCallback(
    async (id: string) => {
      // Optimistic local remove
      setAnnotations((prev) => prev.filter((a) => a.id !== id));

      if (user) {
        await removeAnnotation(id, user);
      } else {
        const existing: Annotation[] = JSON.parse(localStorage.getItem('panorama_annotations') ?? '[]');
        localStorage.setItem('panorama_annotations', JSON.stringify(existing.filter((a) => a.id !== id)));
      }
    },
    [user]
  );

  const handleGoogleSignIn = async () => {
    setIsLoginModalOpen(false);
    setIsSigningIn(true);
    await signInWithGoogle();
    setIsSigningIn(false);
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
        onAnnotationEdit={handleAnnotationEdit}
        onAnnotationDelete={handleAnnotationDelete}
        rafIdRef={rafIdRef}
      />

      <FloatingBar
        onImageSelect={handleImageSelect}
        selectedFileName={selectedFileName}
        editMode={editMode}
        onToggleEditMode={handleToggleEditMode}
        user={user}
      />

      <LeftSidebar
        user={user}
        isLoading={authLoading}
        editMode={editMode}
        onToggleEditMode={handleToggleEditMode}
        onLoginClick={() => setIsLoginModalOpen(true)}
        onLogout={signOut}
      />

      {isLoginModalOpen && (
        <LoginModal
          onClose={() => setIsLoginModalOpen(false)}
          onGoogleSignIn={handleGoogleSignIn}
          isSigningIn={isSigningIn}
        />
      )}

      {modalScreenPos && (
        <AnnotationModal
          position={modalScreenPos}
          initialText={
            editingAnnotation?.content && 'text' in editingAnnotation.content
              ? editingAnnotation.content.text
              : ''
          }
          onSave={handleSave}
          onCancel={handleCancel}
        />
      )}
    </div>
  );
}

export default App;
