import { useState, useRef, useCallback, useEffect } from 'react';
import * as THREE from 'three';
import { PanoramaViewer } from '@/components/PanoramaViewer';
import { FloatingBar } from '@/components/FloatingBar';
import { AnnotationLayer, type AnnotationData } from '@/components/AnnotationLayer';
import { AnnotationModal } from '@/components/AnnotationModal';
import { ClickMenu, type ClickMenuType } from '@/components/ClickMenu';
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
  updateAnnotationPosition,
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
    projects,
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
  const [clickMenuData, setClickMenuData] = useState<{
    screenX: number;
    screenY: number;
    worldPosition: { x: number; y: number; z: number };
  } | null>(null);

  // Refs shared with PanoramaViewer
  const containerRef = useRef<HTMLDivElement>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rafIdRef = useRef(0);
  const cameraPanRef = useRef<{ dLon: number; dLat: number } | null>(null);
  const prevObjectUrlRef = useRef<string | null>(null);

  // ── Stable refs — always read latest state inside async callbacks ────────────
  const currentProjectRef = useRef(currentProject);
  const projectsRef = useRef(projects);
  const currentPanoramaRef = useRef(currentPanorama);
  const userRef = useRef(user);
  const annotationsRef = useRef(annotations);
  useEffect(() => { currentProjectRef.current = currentProject; }, [currentProject]);
  useEffect(() => { projectsRef.current = projects; }, [projects]);
  useEffect(() => { currentPanoramaRef.current = currentPanorama; }, [currentPanorama]);
  useEffect(() => { userRef.current = user; }, [user]);
  useEffect(() => { annotationsRef.current = annotations; }, [annotations]);

  // ── Auto-close sidebar when project loading completes ────────────────────────
  // Detects true → false transition on isBootstrapping OR isLoadingProject.
  // Runs after every render; ref tracks previous-frame loading state.
  const wasLoadingRef = useRef(false);
  useEffect(() => {
    const isLoading = isBootstrapping || isLoadingProject;
    if (isLoading) {
      wasLoadingRef.current = true; // remember that a load started
      return;
    }
    // isLoading just became false — close sidebar exactly once per load cycle
    if (wasLoadingRef.current) {
      wasLoadingRef.current = false;
      setIsSidebarOpen(false);
    }
  }, [isBootstrapping, isLoadingProject]);

  // ── Reset edit mode on logout ───────────────────────────────────────────────
  useEffect(() => {
    if (!user) {
      setEditMode(false);
      wasLoadingRef.current = false;
    }
  }, [user]);

  // ── Edit mode (requires login + loaded project) ──────────────────────────────
  const handleToggleEditMode = () => {
    if (!userRef.current) {
      setIsLoginModalOpen(true);
      return;
    }
    if (!currentProjectRef.current) {
      console.warn('[App] handleToggleEditMode: currentProject not loaded yet');
      return;
    }
    setEditMode((prev) => !prev);
  };

  // ── Upload panorama → update DB + viewer immediately ─────────────────────────
  const handleUpload = useCallback(
    async (file: File) => {
      if (!userRef.current || !currentPanoramaRef.current) return;

      const url = await uploadFile(file, 'panoramas', userRef.current.id);
      if (!url) return;

      // Revoke stale blob URL
      if (prevObjectUrlRef.current?.startsWith('blob:')) {
        URL.revokeObjectURL(prevObjectUrlRef.current);
      }
      prevObjectUrlRef.current = url;

      // ── Step 1: Optimistic local state update (viewer reacts immediately) ──
      const updatedPanorama = { ...currentPanoramaRef.current, image_url: url };
      setCurrentPanorama(updatedPanorama);

      // ── Step 2: Persist to DB ───────────────────────────────────────────────
      await updatePanoramaImage(currentPanoramaRef.current.id, url, userRef.current);
    },
    [uploadFile, setCurrentPanorama]
  );

  // ── Edit mode click → show floating menu ────────────────────────────────────
  const handlePanoramaClick = useCallback(
    (data: {
      screenX: number;
      screenY: number;
      worldPosition: { x: number; y: number; z: number };
    }) => {
      if (!currentProjectRef.current) {
        console.warn('[App] handlePanoramaClick: currentProjectRef not ready');
        return;
      }
      setClickMenuData(data);
      setPendingPosition(data.worldPosition);
      setPendingProjectId(currentProjectRef.current.id);
    },
    []
  );

  // ── Menu selection: Text → open modal; Image/Video → just close ─────────────
  const handleClickMenuSelect = useCallback(
    (type: ClickMenuType) => {
      if (type === 'text') {
        // Open text annotation modal at click position
        if (clickMenuData && cameraRef.current && containerRef.current) {
          const projected = new THREE.Vector3(
            clickMenuData.worldPosition.x,
            clickMenuData.worldPosition.y,
            clickMenuData.worldPosition.z
          ).project(cameraRef.current);
          const { clientWidth: width, clientHeight: height } = containerRef.current;
          setModalScreenPos({
            x: (projected.x * 0.5 + 0.5) * width,
            y: (-projected.y * 0.5 + 0.5) * height,
          });
          setEditingAnnotation(null);
        }
      }
      // Image/Video: do nothing for now, just close the menu
      setClickMenuData(null);
    },
    [clickMenuData]
  );

  const handleClickMenuClose = useCallback(() => {
    setClickMenuData(null);
  }, []);

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
    const currentUser = userRef.current;
    const currentProjectVal = currentProjectRef.current;
    console.log('[App] handleSave called, text:', text, 'trimmed:', text.trim(), 'pendingPosition:', pendingPosition, 'pendingProjectId:', pendingProjectId, 'editingAnnotation:', editingAnnotation, 'user:', currentUser?.id);
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
      console.log('[App] handleSave editing:', editingAnnotation.id, 'project_id:', editingAnnotation.project_id);
      if (currentUser && editingAnnotation.project_id) {
        await updateAnnotation(updated.id, updated.content, editingAnnotation.project_id, currentUser);
      }
    } else if (pendingPosition) {
      // effectiveProjectId: capture at click time (pendingProjectId) → current at save time
      const effectiveProjectId = pendingProjectId ?? currentProjectVal?.id ?? null;
      if (!effectiveProjectId) {
        console.error('[App] handleSave: no projectId available, cannot save annotation');
        setPendingPosition(null);
        setModalScreenPos(null);
        return;
      }
      const now = Date.now();
      const tempId = generateId();
      const newAnnotation: Annotation = {
        id: tempId,
        type: 'text',
        project_id: effectiveProjectId,
        position: pendingPosition,
        content: { text: trimmed },
        createdAt: now,
        updatedAt: now,
      };

      console.log('[App] handleSave creating:', tempId, 'project_id:', effectiveProjectId, 'annotations count before:', annotations.length);

      // ── Step 1: Optimistic local state update (always, immediately) ──
      setAnnotations((prev) => {
        console.log('[App] setAnnotations callback, prev count:', prev.length, '→ new count:', prev.length + 1);
        return [...prev, newAnnotation];
      });

      // ── Step 2: Persist to Supabase ───────────────────────────────────
      const saved = await saveAnnotation(
        { id: tempId, type: 'text', project_id: effectiveProjectId, position: pendingPosition, content: { text: trimmed } },
        effectiveProjectId,
        currentUser
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
      if (userRef.current && annotation.project_id) {
        await removeAnnotation(annotation.id, annotation.project_id, userRef.current);
      }
    },
    [] // user accessed via ref
  );

  // ── Drag annotation: update position on release ──────────────────────────────
  // NOTE: do NOT add 'annotations' to deps — we read it from the ref to avoid stale closures.
  // The caller (AnnotationLayer) passes (id, position); we look up the annotation
  // from the live ref so we always have the current data even across re-renders.
  const handleAnnotationPositionUpdate = useCallback(
    async (id: string, position: { x: number; y: number; z: number }) => {
      const ann = annotationsRef.current.find((a) => a.id === id);
      if (!ann) return;

      // Optimistic local update
      setAnnotations((prev) =>
        prev.map((a) => (a.id === id ? { ...a, position } : a))
      );

      // Persist to Supabase
      if (ann.project_id) {
        await updateAnnotationPosition(id, position, ann.project_id, userRef.current);
      }
    },
    [] // no deps — intentionally stable across re-renders; reads annotationsRef.current
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
        isLoading={isLoadingProject || isBootstrapping}
        isBootstrapping={isBootstrapping}
        editMode={editMode}
        onPanoramaClick={handlePanoramaClick}
        cameraRef={cameraRef}
        containerRef={containerRef}
        rafIdRef={rafIdRef}
        cameraPanRef={cameraPanRef}
      />

      <AnnotationLayer
        annotations={annotations}
        cameraRef={cameraRef}
        containerRef={containerRef}
        cameraPanRef={cameraPanRef}
        editMode={editMode}
        onAnnotationEdit={handleAnnotationEdit}
        onAnnotationDelete={handleAnnotationDelete}
        onAnnotationPositionUpdate={handleAnnotationPositionUpdate}
      />

      <FloatingBar
        onUpload={handleUpload}
        editMode={editMode}
        onToggleEditMode={handleToggleEditMode}
        user={user}
        isOwner={isOwner}
        onLoginClick={() => setIsLoginModalOpen(true)}
        isUploading={isUploading}
        isBootstrapping={isBootstrapping}
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

      {clickMenuData && (
        <ClickMenu
          screenX={clickMenuData.screenX}
          screenY={clickMenuData.screenY}
          onSelect={handleClickMenuSelect}
          onClose={handleClickMenuClose}
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
