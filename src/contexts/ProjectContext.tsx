/**
 * ProjectContext — root state for the project/panorama/annotation hierarchy.
 *
 * Responsibilities:
 * - Bootstrap: ensure every logged-in user has ≥ 1 project + 1 default panorama
 * - Load annotations whenever currentProjectId changes
 * - Provide currentProject, currentPanorama, annotations to the subtree
 * - Handle login/logout transitions (clear state on logout, bootstrap on login)
 * - Project creation with immediate panorama upload
 *
 * Does NOT touch Three.js or rendering logic.
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import type { User } from '@supabase/supabase-js';
import {
  bootstrapDefaultProject,
  fetchProjects,
  createProject,
  type Project,
} from '@/api/projects';
import {
  createPanorama,
  fetchDefaultPanorama,
  fetchPanoramas,
  type Panorama,
} from '@/api/panoramas';
import { loadAnnotations, type Annotation } from '@/lib/annotationsService';

export const SAMPLE_PANORAMA_URL = 'https://pannellum.org/images/alma.jpg';

// ── Shape ─────────────────────────────────────────────────────────────────────
interface ProjectContextValue {
  // Entities
  projects: Project[];
  currentProject: Project | null;
  currentPanorama: Panorama | null;
  panoramas: Panorama[]; // all panoramas for current project
  annotations: Annotation[];
  setAnnotations: React.Dispatch<React.SetStateAction<Annotation[]>>;

  // Permission
  isOwner: boolean; // current user owns currentProject

  // Loading states
  isBootstrapping: boolean;
  isLoadingProject: boolean; // fetching panoramas + annotations for a project switch
  isLoadingAnnotations: boolean;
  isCreatingProject: boolean;

  // Derived
  imageUrl: string;

  // Actions
  setCurrentProject: (project: Project) => Promise<void>;
  setCurrentPanorama: (panorama: Panorama) => void;
  createProjectWithPanorama: (name: string, imageUrl: string) => Promise<Project | null>;
  refreshAnnotations: () => Promise<void>;
}

const ProjectContext = createContext<ProjectContextValue | null>(null);

// ── Provider ───────────────────────────────────────────────────────────────────
interface ProjectProviderProps {
  user: User | null;
  children: React.ReactNode;
}

export function ProjectProvider({ user, children }: ProjectProviderProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProject, setCurrentProjectState] = useState<Project | null>(null);
  const [currentPanorama, setCurrentPanorama] = useState<Panorama | null>(null);
  const [panoramas, setPanoramas] = useState<Panorama[]>([]);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [isBootstrapping, setIsBootstrapping] = useState(false);
  const [isLoadingProject, setIsLoadingProject] = useState(false);
  const [isLoadingAnnotations, setIsLoadingAnnotations] = useState(false);
  const [isCreatingProject, setIsCreatingProject] = useState(false);

  const userRef = useRef(user);
  useEffect(() => { userRef.current = user; }, [user]);

  // ── Switch to a different project ─────────────────────────────────────────────
  const setCurrentProject = useCallback(
    async (project: Project) => {
      if (!userRef.current) return;

      // Immediately show "no panorama" state so the viewer clears stale texture
      setCurrentProjectState(project);
      setCurrentPanorama(null);
      setPanoramas([]);
      setAnnotations([]);
      setIsLoadingProject(true);
      setIsLoadingAnnotations(true);

      console.log('[ProjectContext] Switching to project:', project.id, project.name);
      console.log('[ProjectContext] userRef.current:', userRef.current?.id ?? 'NULL');

      try {
        // Load all panoramas + default panorama in parallel
        const [allPanoramas, defaultPanorama] = await Promise.all([
          fetchPanoramas(project.id, userRef.current),
          fetchDefaultPanorama(project.id, userRef.current),
        ]);

        // Guard: user might have logged out during the async gap
        if (!userRef.current) return;

        const panorama = defaultPanorama ?? null;
        console.debug('[ProjectContext] Loaded panoramas:', allPanoramas.length, 'default:', panorama?.id ?? 'null');

        setPanoramas(allPanoramas);
        setCurrentPanorama(panorama);

        // Load annotations for this project (null user = localStorage only)
        const anns = await loadAnnotations(project.id, userRef.current);
        if (userRef.current) {
          setAnnotations(anns);
          console.debug('[ProjectContext] Loaded annotations:', anns.length);
        }
        setIsLoadingProject(false);
        setIsLoadingAnnotations(false);
      } catch (err) {
        console.error('[ProjectContext] setCurrentProject failed:', err);
        setIsLoadingProject(false);
        setIsLoadingAnnotations(false);
      }
    },
    [] // eslint-disable-line react-hooks/exhaustive-deps — uses userRef
  );

  // ── Bootstrap on user change ─────────────────────────────────────────────────
  const bootstrap = useCallback(async () => {
    if (!user) return;
    setIsBootstrapping(true);
    console.log('[ProjectContext] bootstrap started, user:', user.id);
    try {
      console.log('[ProjectContext] calling bootstrapDefaultProject...');
      const project = await bootstrapDefaultProject(user);
      console.log('[ProjectContext] bootstrapDefaultProject returned:', project?.id ?? 'NULL');
      if (!project || !userRef.current) return;

      console.log('[ProjectContext] calling fetchProjects...');
      const allProjects = await fetchProjects(user);
      console.log('[ProjectContext] fetchProjects returned:', allProjects.length, 'projects');
      if (!userRef.current) return;

      const [allPanoramas, panorama] = await Promise.all([
        fetchPanoramas(project.id, userRef.current),
        fetchDefaultPanorama(project.id, userRef.current),
      ]);
      console.log('[ProjectContext] panoramas:', allPanoramas.length, 'default:', panorama?.id ?? 'NULL');

      if (!userRef.current) return;

      const finalPanorama = panorama ?? (await createPanorama(
        { project_id: project.id, image_url: SAMPLE_PANORAMA_URL, is_default: true },
        userRef.current
      ));

      if (!userRef.current) return;

      console.log('[ProjectContext] setting state: projects, currentProject, panoramas, currentPanorama');
      setProjects(allProjects);
      setCurrentProjectState(project);
      setPanoramas(allPanoramas);
      setCurrentPanorama(finalPanorama ?? null);

      const anns = await loadAnnotations(project.id, userRef.current);
      console.log('[ProjectContext] loadAnnotations returned:', anns.length, 'annotations');
      if (userRef.current) setAnnotations(anns);
    } catch (err) {
      console.error('[ProjectContext] bootstrap error:', err);
    } finally {
      setIsBootstrapping(false);
      console.log('[ProjectContext] bootstrap done, isBootstrapping:', false);
    }
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { bootstrap(); }, [bootstrap]);

  // ── Clear on logout ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) {
      setProjects([]);
      setCurrentProjectState(null);
      setCurrentPanorama(null);
      setPanoramas([]);
      setAnnotations([]);
    }
  }, [user]);

  // ── Actions ──────────────────────────────────────────────────────────────────
  const refreshAnnotations = useCallback(async () => {
    if (!currentProject || !userRef.current) return;
    setIsLoadingAnnotations(true);
    try {
      setAnnotations(await loadAnnotations(currentProject.id, userRef.current));
    } finally {
      setIsLoadingAnnotations(false);
    }
  }, [currentProject]);

  /**
   * Create a new project + immediately set its first panorama.
   * Called by ProjectModal after user submits name + uploads image.
   */
  const createProjectWithPanorama = useCallback(
    async (name: string, imageUrl: string): Promise<Project | null> => {
      if (!userRef.current) return null;
      setIsCreatingProject(true);
      try {
        const project = await createProject(name, userRef.current);
        if (!project) return null;

        const panorama = await createPanorama(
          { project_id: project.id, image_url: imageUrl, is_default: true },
          userRef.current
        );
        if (!userRef.current) return null;

        // Refresh project list and switch to new project
        const allProjects = await fetchProjects(userRef.current);
        setProjects(allProjects);

        await setCurrentProject(project);

        // Update the new project's panorama list
        if (panorama) {
          setPanoramas([panorama]);
          setCurrentPanorama(panorama);
        }

        return project;
      } finally {
        setIsCreatingProject(false);
      }
    },
    [setCurrentProject] // eslint-disable-line react-hooks/exhaustive-deps
  );

  // ── Derived ──────────────────────────────────────────────────────────────────
  /**
   * Permission: user can edit this project IF they own it.
   * Ownership is the ONLY gating factor — not "default project" status.
   */
  const isOwner = currentProject?.user_id === user?.id;
  const imageUrl = currentPanorama?.image_url ?? SAMPLE_PANORAMA_URL;

  return (
    <ProjectContext.Provider value={{
      projects,
      currentProject,
      currentPanorama,
      panoramas,
      annotations,
      setAnnotations,
      isOwner,
      isBootstrapping,
      isLoadingProject,
      isLoadingAnnotations,
      isCreatingProject,
      imageUrl,
      setCurrentProject,
      setCurrentPanorama,
      createProjectWithPanorama,
      refreshAnnotations,
    }}>
      {children}
    </ProjectContext.Provider>
  );
}

// ── Hook ───────────────────────────────────────────────────────────────────────
export function useProject(): ProjectContextValue {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error('useProject must be used inside <ProjectProvider>');
  return ctx;
}
