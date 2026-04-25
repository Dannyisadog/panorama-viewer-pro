import { useState, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { PanoramaViewer } from '@/components/PanoramaViewer';
import { FloatingBar } from '@/components/FloatingBar';
import { AnnotationLayer, type AnnotationData } from '@/components/AnnotationLayer';
import { AnnotationModal } from '@/components/AnnotationModal';
import { LoginModal } from '@/components/LoginModal';
import { LeftSidebar } from '@/components/LeftSidebar';
import { HamburgerButton } from '@/components/HamburgerButton';
import { ProjectModal } from '@/components/ProjectModal';
import { ProjectProvider, useProject } from '@/contexts/ProjectContext';
import { useAuth } from '@/hooks/useAuth';
import { useUpload } from '@/hooks/useUpload';
import {
  saveAnnotation,
  updateAnnotation,
  removeAnnotation,
  type Annotation,
  generateId,
} from '@/lib/annotationsService';
import { updatePanoramaImage } from '@/api/panoramas';

function Editor() {
  const { user, isLoading: authLoading, signInWithGoogle, signOut } = useAuth();
  const { upload: uploadFile, isUploading } = useUpload();

  // ── From ProjectContext ────────────────────────────────────────────────────
  const {
    currentProject,
    currentPanorama,
    annotations,
    setAnnotations,
    imageUrl,
    isBootstrapping,
    isOwner,
    isCreatingProject,
    createProjectWithPanorama,
  } = useProject();

  // ── Local UI state ─────────────────────────────────────────────────────────
  const [editMode, setEditMode] = useState(false);
  const [pendingPosition, setPendingPosition] = useState<{ x: number; y: number; z: number } | null>(null);
  const [modalScreenPos, setModalScreenPos] = useState<{ x: number; y: number } | null>(null);
  const [editingAnnotation, setEditingAnnotation] = useState<Annotation | null>(null);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);

  // Refs shared with PanoramaViewer
  const containerRef = useRef<HTMLDivElement>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rafIdRef = useRef(0);
  const prevObjectUrlRef = useRef<string | null>(null);

  // ── Edit mode (requires login) ─────────────────────────────────────────────
  const handleToggleEditMode = () => {
    if (!user) {
      setIsLoginModalOpen(true);
      return;
    }
    setEditMode((prev) => !prev);
  };

  // ── Upload panorama → update DB + local panorama state ─────────────────────
  const handleUpload = useCallback(
    async (file: File) => {
      if (!user || !currentPanorama) return;
      const url = await uploadFile(file, 'panoramas', user.id);
      if (!url) return;

      if (prevObjectUrlRef.current?.startsWith('blob:')) {
        URL.revokeObjectURL(prevObjectUrlRef.current);
      }
      prevObjectUrlRef.current = url;

      // Persist to DB
      await updatePanoramaImage(currentPanorama.id, url, user);
    },
    [user, currentPanorama, uploadFile]
  );

  // ── Create text annotation (click-to-place → modal) ────────────────────────
  const handleAnnotationCreate = useCallback(
    (position: { x: number; y: number; z: number }) => {
      if (!cameraRef.current || !containerRef.current) return;
      const projected = new THREE.Vector3(position.x, position.y, position.z).project(cameraRef.current);
      const { clientWidth: width, clientHeight: height } = containerRef.current;
      const screenX = (projected.x * 0.5 + 0.5) * width;
      const screenY = (-projected.y * 0.5 + 0.5) * height;
      setPendingPosition(position);
      setModalScreenPos({ x: screenX, y: screenY });
      setEditingAnnotation(null);
    },
    []
  );

  // ── Open edit modal for existing annotation ─────────────────────────────────
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
      setPendingPosition(null);
    },
    []
  );

  // ── Save annotation (create or edit) ───────────────────────────────────────
  const handleSave = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) {
      setPendingPosition(null);
      setEditingAnnotation(null);
      setModalScreenPos(null);
      return;
    }

    if (editingAnnotation) {
      const updated: Annotation = {
        ...editingAnnotation,
        content: { ...editingAnnotation.content, text: trimmed },
      };
      // Optimistic update
      setAnnotations((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
      if (user && currentProject) {
        await updateAnnotation(updated.id, updated.content, currentProject.id, user);
      }
    } else if (pendingPosition) {
      if (!currentProject) return;
      const newAnnotation = {
        id: generateId(),
        type: 'text' as const,
        project_id: currentProject.id,
        position: pendingPosition,
        content: { text: trimmed },
      };
      const saved = await saveAnnotation(newAnnotation, currentProject.id, user);
      if (saved) {
        setAnnotations((prev) => [...prev, saved]);
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

  // ── Delete annotation ──────────────────────────────────────────────────────
  const handleAnnotationDelete = useCallback(
    async (id: string) => {
      setAnnotations((prev) => prev.filter((a) => a.id !== id));
      if (user && currentProject) {
        await removeAnnotation(id, currentProject.id, user);
      }
    },
    [user, currentProject]
  );

  const handleGoogleSignIn = async () => {
    setIsLoginModalOpen(false);
    setIsSigningIn(true);
    await signInWithGoogle();
    setIsSigningIn(false);
  };

  void isCreatingProject;

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
        onUpload={handleUpload}
        editMode={editMode}
        onToggleEditMode={handleToggleEditMode}
        user={user}
        isOwner={isOwner}
        onLoginClick={() => setIsLoginModalOpen(true)}
        isUploading={isUploading}
      />

      <HamburgerButton
        isOpen={isSidebarOpen}
        onToggle={() => setIsSidebarOpen((prev) => !prev)}
      />

      <LeftSidebar
        user={user}
        isLoading={authLoading || isBootstrapping}
        isOpen={isSidebarOpen}
        onLoginClick={() => setIsLoginModalOpen(true)}
        onLogout={signOut}
        onNewProjectClick={() => setIsProjectModalOpen(true)}
      />

      {isLoginModalOpen && (
        <LoginModal
          onClose={() => setIsLoginModalOpen(false)}
          onGoogleSignIn={handleGoogleSignIn}
          isSigningIn={isSigningIn}
        />
      )}

      {isProjectModalOpen && (
        <ProjectModal
          onClose={() => setIsProjectModalOpen(false)}
          onSubmit={createProjectWithPanorama}
          userId={user?.id ?? ''}
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

// ── Root ───────────────────────────────────────────────────────────────────────
function App() {
  const { user } = useAuth();
  return (
    <ProjectProvider user={user}>
      <Editor />
    </ProjectProvider>
  );
}

export default App;
