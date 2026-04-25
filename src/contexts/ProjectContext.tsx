/**
 * ProjectContext — root state for the project/panorama/annotation hierarchy.
 *
 * Responsibilities:
 * - Bootstrap: ensure every logged-in user has ≥ 1 project + 1 default panorama
 * - Load annotations whenever currentProjectId changes
 * - Provide currentProject, currentPanorama, annotations to the subtree
 * - Handle login/logout transitions (clear state on logout, bootstrap on login)
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
import { bootstrapDefaultProject, fetchProjects, type Project } from '@/api/projects';
import { createDefaultPanorama, fetchDefaultPanorama, type Panorama } from '@/api/panoramas';
import { loadAnnotations, type Annotation } from '@/lib/annotationsService';

export const SAMPLE_PANORAMA_URL = 'https://pannellum.org/images/alma.jpg';

// ── Shape ─────────────────────────────────────────────────────────────────────
interface ProjectContextValue {
  projects: Project[];
  currentProject: Project | null;
  currentPanorama: Panorama | null;
  annotations: Annotation[];
  setAnnotations: React.Dispatch<React.SetStateAction<Annotation[]>>;
  isBootstrapping: boolean;
  isLoadingAnnotations: boolean;
  imageUrl: string;
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
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [currentPanorama, setCurrentPanorama] = useState<Panorama | null>(null);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [isBootstrapping, setIsBootstrapping] = useState(false);
  const [isLoadingAnnotations, setIsLoadingAnnotations] = useState(false);
  const userRef = useRef(user);

  useEffect(() => { userRef.current = user; }, [user]);

  // ── Bootstrap on user change ─────────────────────────────────────────────────
  const bootstrap = useCallback(async () => {
    if (!user) return;
    setIsBootstrapping(true);
    try {
      const project = await bootstrapDefaultProject(user);
      if (!project || !userRef.current) return;

      const allProjects = await fetchProjects(user);
      if (!userRef.current) return;

      let panorama = await fetchDefaultPanorama(project.id, user);
      if (!panorama) {
        panorama = await createDefaultPanorama(project.id, user);
      }
      if (!userRef.current) return;

      setProjects(allProjects);
      setCurrentProject(project);
      setCurrentPanorama(panorama ?? null);
    } finally {
      setIsBootstrapping(false);
    }
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { bootstrap(); }, [bootstrap]);

  // ── Clear on logout ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) {
      setProjects([]);
      setCurrentProject(null);
      setCurrentPanorama(null);
      setAnnotations([]);
    }
  }, [user]);

  // ── Load annotations when project changes ───────────────────────────────────
  useEffect(() => {
    if (!currentProject) { setAnnotations([]); return; }
    setIsLoadingAnnotations(true);
    loadAnnotations(currentProject.id, user)
      .then(setAnnotations)
      .catch(() => setAnnotations([]))
      .finally(() => setIsLoadingAnnotations(false));
  }, [currentProject?.id, user]);

  const refreshAnnotations = useCallback(async () => {
    if (!currentProject) return;
    setIsLoadingAnnotations(true);
    try {
      setAnnotations(await loadAnnotations(currentProject.id, user));
    } finally {
      setIsLoadingAnnotations(false);
    }
  }, [currentProject, user]);

  const imageUrl = currentPanorama?.image_url ?? SAMPLE_PANORAMA_URL;

  return (
    <ProjectContext.Provider value={{
      projects,
      currentProject,
      currentPanorama,
      annotations,
      setAnnotations,
      isBootstrapping,
      isLoadingAnnotations,
      imageUrl,
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
