import type { User } from '@supabase/supabase-js';
import { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { useProject } from '@/contexts/ProjectContext';

interface LeftSidebarProps {
  user: User | null;
  isLoading?: boolean;
  isOpen: boolean;
  onLoginClick: () => void;
  onLogout: () => void;
  onNewProjectClick: () => void;
}

type ModalState =
  | { type: 'rename'; projectId: string; projectName: string }
  | { type: 'delete'; projectId: string; projectName: string }
  | null;

// ── SVG Icons ─────────────────────────────────────────────────────────────────
function LoginIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
      <polyline points="10 17 15 12 10 7"/>
      <line x1="15" y1="12" x2="3" y2="12"/>
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      <polyline points="16 17 21 12 16 7"/>
      <line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  );
}

function PanoramaIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/>
      <path d="M2 12h20"/>
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19"/>
      <line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" strokeOpacity="0.3"/>
      <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round">
        <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.8s" repeatCount="indefinite"/>
      </path>
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  );
}

function getInitials(name: string): string {
  return name.charAt(0).toUpperCase();
}

export function LeftSidebar({ user, isLoading, isOpen, onLoginClick, onLogout, onNewProjectClick }: LeftSidebarProps) {
  const { projects, currentProject, isOwner, setCurrentProject, isCreatingProject, renameProject, removeProject } = useProject();
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const [modal, setModal] = useState<ModalState>(null);
  const [renameValue, setRenameValue] = useState('');
  const kebabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpenId) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpenId(null);
        setMenuPos(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpenId]);

  const openRenameModal = (projectId: string, projectName: string) => {
    setMenuOpenId(null);
    setMenuPos(null);
    setRenameValue(projectName);
    setModal({ type: 'rename', projectId, projectName });
  };

  const openDeleteModal = (projectId: string, projectName: string) => {
    setMenuOpenId(null);
    setMenuPos(null);
    setModal({ type: 'delete', projectId, projectName });
  };

  const handleRenameConfirm = async () => {
    if (!modal || modal.type !== 'rename') return;
    const trimmed = renameValue.trim();
    if (!trimmed) return;
    await renameProject(modal.projectId, trimmed);
    setModal(null);
  };

  const handleDeleteConfirm = async () => {
    if (!modal || modal.type !== 'delete') return;
    const deletedId = modal.projectId;
    await removeProject(deletedId);
    if (currentProject?.id === deletedId) {
      setCurrentProject(null);
    }
    setModal(null);
  };

  return (
    <aside className={`left-sidebar${isOpen ? ' left-sidebar--open' : ''}`}>
      {/* ── Branding ──────────────────────────────────────────────── */}
      <div className="left-sidebar__branding">
        <div className="left-sidebar__logo">
          <PanoramaIcon />
        </div>
        <span className="left-sidebar__brand-name">Panorama</span>
      </div>

      {/* ── Auth Section (moved below logo) ─────────────────────── */}
      <div className="left-sidebar__auth">
        {isLoading ? (
          <button className="sidebar-btn sidebar-btn--loading" disabled title="Loading...">
            <SpinnerIcon />
          </button>
        ) : user ? (
          <div className="left-sidebar__auth-logged-in">
            <div className="sidebar-account">
              {user.user_metadata?.avatar_url ? (
                <img
                  src={user.user_metadata.avatar_url}
                  alt={user.user_metadata?.full_name ?? user.email ?? 'User'}
                  className="sidebar-avatar"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="sidebar-avatar sidebar-avatar--placeholder">
                  {getInitials(user.user_metadata?.full_name ?? user.email ?? 'U')}
                </div>
              )}
              <div className="sidebar-account__info">
                <span className="sidebar-account__name">
                  {user.user_metadata?.full_name ?? user.email?.split('@')[0] ?? 'User'}
                </span>
                <span className="sidebar-account__email">{user.email}</span>
              </div>
            </div>
            <button
              className="sidebar-btn sidebar-btn--logout"
              onClick={onLogout}
              title="Sign out"
            >
              <LogoutIcon />
            </button>
          </div>
        ) : (
          <button
            className="sidebar-btn sidebar-btn--login"
            onClick={onLoginClick}
            title="Sign in"
          >
            <LoginIcon />
            <span>Login</span>
          </button>
        )}
      </div>

      <div className="left-sidebar__divider" />

      {/* ── Project List ──────────────────────────────────────────── */}
      <div className="left-sidebar__section left-sidebar__section--projects">
        <div className="left-sidebar__section-header">
          <span className="left-sidebar__section-label">Projects</span>
          {user && (
            <button
              className="left-sidebar__new-btn"
              onClick={onNewProjectClick}
              title="New Project"
              disabled={isCreatingProject}
            >
              {isCreatingProject ? <SpinnerIcon /> : <PlusIcon />}
            </button>
          )}
        </div>

        <div className="left-sidebar__project-list">
          {isLoading ? (
            <div className="left-sidebar__loading-projects">
              <SpinnerIcon />
            </div>
          ) : user ? (
            projects.length === 0 ? (
              <p className="left-sidebar__empty">No projects yet</p>
            ) : (
              projects.map((project) => {
                const isActive = currentProject?.id === project.id;
                return (
                  <div
                    key={project.id}
                    className={`left-sidebar__project-item ${isActive ? 'left-sidebar__project-item--active' : ''}`}
                  >
                    <button
                      className="left-sidebar__project-btn"
                      onClick={() => setCurrentProject(project)}
                      title={project.name}
                    >
                      <span className="left-sidebar__project-avatar">
                        {getInitials(project.name)}
                      </span>
                      <span className="left-sidebar__project-name">{project.name}</span>
                      {isActive && (
                        <span className="left-sidebar__project-active-dot">
                          <CheckIcon />
                        </span>
                      )}
                    </button>

                    <button
                      className="left-sidebar__kebab-btn"
                      ref={(el) => { kebabRefs.current[project.id] = el; }}
                      onClick={(e) => {
                        e.stopPropagation();
                        const rect = e.currentTarget.getBoundingClientRect();
                        setMenuPos({ top: rect.bottom, left: rect.left });
                        setMenuOpenId(menuOpenId === project.id ? null : project.id);
                      }}
                      title="More options"
                      aria-label="Project options"
                    >
                      <span>⋯</span>
                    </button>
                  </div>
                );
              })
            )
          ) : (
            <p className="left-sidebar__empty left-sidebar__empty--muted">Sign in to see projects</p>
          )}
        </div>
      </div>

      {/* ── Owner Badge (when viewing non-owned project) ────────────── */}
      {!isOwner && currentProject && (
        <div className="left-sidebar__viewer-badge">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
          View Only
        </div>
      )}

      {/* ── Spacer ────────────────────────────────────────────────── */}
      <div className="left-sidebar__spacer" />

      {/* ── Kebab Dropdown Portal ─────────────────────────────────── */}
      {menuOpenId && menuPos && (
        ReactDOM.createPortal(
          <div
            className="left-sidebar__kebab-menu"
            ref={menuRef}
            style={{ position: 'fixed', top: menuPos.top, left: menuPos.left }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <button
              className="left-sidebar__kebab-menu-item"
              onClick={() => {
                const project = projects.find((p) => p.id === menuOpenId);
                if (project) openRenameModal(project.id, project.name);
              }}
            >
              Rename
            </button>
            <button
              className="left-sidebar__kebab-menu-item left-sidebar__kebab-menu-item--danger"
              onClick={() => {
                const project = projects.find((p) => p.id === menuOpenId);
                if (project) openDeleteModal(project.id, project.name);
              }}
            >
              Delete
            </button>
          </div>,
          document.body,
        )
      )}

      {/* ── Rename Modal ────────────────────────────────────────────── */}
      {modal?.type === 'rename' && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal__title">Rename Project</h3>
            <input
              className="modal__input"
              autoFocus
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRenameConfirm();
                if (e.key === 'Escape') setModal(null);
              }}
              placeholder="Project name"
              maxLength={100}
            />
            <div className="modal__actions">
              <button className="modal__btn modal__btn--cancel" onClick={() => setModal(null)}>
                Cancel
              </button>
              <button
                className="modal__btn modal__btn--confirm"
                onClick={handleRenameConfirm}
                disabled={!renameValue.trim()}
              >
                Rename
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation Modal ────────────────────────────────── */}
      {modal?.type === 'delete' && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal__title">Delete Project</h3>
            <p className="modal__body">
              Are you sure you want to delete <strong>"{modal.projectName}"</strong>? This action cannot be undone.
            </p>
            <div className="modal__actions">
              <button className="modal__btn modal__btn--cancel" onClick={() => setModal(null)}>
                Cancel
              </button>
              <button className="modal__btn modal__btn--danger" onClick={handleDeleteConfirm}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
