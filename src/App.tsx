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
    setCurrentPanorama,
    annotations,
    setAnnotations,
    imageUrl,
    isBootstrapping,
    isLoadingProject,
    isOwner,
    isCreatingProject,
    createProjectWithPanorama,
  } = useProject();

  // ── Local UI state ─────────────────────────────────────────────────────────
  const [editMode, setEditMode] = useState(false);
  const [pendingPosition, setPendingPosition] = useState<{ x: number; y: number; z: number } | null>(null);
  const [pendingProjectId, setPendingProjectId] = useState<string | null>(null);
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

  // ── Upload panorama → update DB + viewer immediately ─────────────────────────
  const handleUpload = useCallback(
    async (file: File) => {
      if (!user || !currentPanorama) return;

      const url = await uploadFile(file, 'panoramas', user.id);
      if (!url) return;

      // Revoke stale blob URL
      if (prevObjectUrlRef.current?.startsWith('blob:')) {
        URL.revokeObjectURL(prevObjectUrlRef.current);
      }
      prevObjectUrlRef.current = url;

      // ── Step 1: Optimistic local state update (viewer reacts immediately) ──
      const updatedPanorama = { ...currentPanorama, image_url: url };
      setCurrentPanorama(updatedPanorama);

      // ── Step 2: Persist to DB ───────────────────────────────────────────────
      await updatePanoramaImage(currentPanorama.id, url, user);
    },
    [user, currentPanorama, uploadFile, setCurrentPanorama]
  );

  // ── Create text annotation (click-to-place → modal) ────────────────────────
  const handleAnnotationCreate = useCallback(
    (position: { x: number; y: number; z: number }) => {
      if (!cameraRef.current || !containerRef.current) return;
      // Capture projectId NOW, not when the modal saves — avoids race with project switch
      const projectId = currentProject?.id ?? null;
      const projected = new THREE.Vector3(position.x, position.y, position.z).project(cameraRef.current);
      const { clientWidth: width, clientHeight: height } = containerRef.current;
      const screenX = (projected.x * 0.5 + 0.5) * width;
      const screenY = (-projected.y * 0.5 + 0.5) * height;
      setPendingPosition(position);
      setPendingProjectId(projectId);
      setModalScreenPos({ x: screenX, y: screenY });
      setEditingAnnotation(null);
    },
    [currentProject]
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
      if (user && editingAnnotation.project_id) {
        await updateAnnotation(updated.id, updated.content, editingAnnotation.project_id, user);
      }
    } else if (pendingPosition && pendingProjectId) {
      const now = Date.now();
      const tempId = generateId();
      const newAnnotation: Annotation = {
        id: tempId,
        type: 'text',
        project_id: pendingProjectId,
        position: pendingPosition,
        content: { text: trimmed },
        createdAt: now,
        updatedAt: now,
      };

      // ── Step 1: Optimistic local state update (always, immediately) ──
      setAnnotations((prev) => [...prev, newAnnotation]);

      // ── Step 2: Persist to Supabase ───────────────────────────────────
      const saved = await saveAnnotation(
        { id: tempId, type: 'text', project_id: pendingProjectId, position: pendingPosition, content: { text: trimmed } },
        pendingProjectId,
        user
      );

      // ── Step 3: If DB failed, keep optimistic entry but log warning ──
      if (!saved) {
        console.warn('[App] Annotation saved locally only (DB insert failed). project_id:', pendingProjectId);
      } else if (saved.id !== tempId) {
        // Server returned different ID — update with server-confirmed entry
        setAnnotations((prev) =>
          prev.map((a) => (a.id === tempId ? saved : a))
        );
      }
    }

    setPendingPosition(null);
    setEditingAnnotation(null);
    setModalScreenPos(null);
  };

  const handleCancel = () => {
    setPendingPosition(null);
    setPendingProjectId(null);
    setEditingAnnotation(null);
    setModalScreenPos(null);
  };

  // ── Delete annotation ──────────────────────────────────────────────────────
  const handleAnnotationDelete = useCallback(
    async (annotation: Annotation) => {
      setAnnotations((prev) => prev.filter((a) => a.id !== annotation.id));
      if (user && annotation.project_id) {
        await removeAnnotation(annotation.id, annotation.project_id, user);
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

  void isCreatingProject;

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      <PanoramaViewer
        imageUrl={imageUrl}
        isLoading={isLoadingProject}
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
