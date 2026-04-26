import type { User } from '@supabase/supabase-js';
import { useState, useRef } from 'react';
import { useProject } from '@/contexts/ProjectContext';

interface LeftSidebarProps {
  user: User | null;
  isLoading?: boolean;
  isOpen: boolean;
  onLoginClick: () => void;
  onLogout: () => void;
  onNewProjectClick: () => void;
}

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
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

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
                const isRenaming = renamingId === project.id;
                const isDeleteConfirm = deleteConfirmId === project.id;
                return (
                  <div
                    key={project.id}
                    className={`left-sidebar__project-item ${isActive ? 'left-sidebar__project-item--active' : ''}`}
                    ref={menuRef}
                  >
                    {isRenaming ? (
                      <input
                        className="left-sidebar__rename-input"
                        autoFocus
                        defaultValue={project.name}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={async (e) => {
                          if (e.key === 'Enter') {
                            const val = renameValue.trim() || project.name;
                            await renameProject(project.id, val);
                            setRenamingId(null);
                          }
                          if (e.key === 'Escape') setRenamingId(null);
                        }}
                        onBlur={() => setRenamingId(null)}
                      />
                    ) : isDeleteConfirm ? (
                      <div className="left-sidebar__delete-confirm">
                        <span className="left-sidebar__delete-confirm-text">Delete?</span>
                        <button
                          className="sidebar-btn sidebar-btn--confirm-yes"
                          onClick={async () => {
                            await removeProject(project.id);
                            setDeleteConfirmId(null);
                          }}
                          title="Confirm delete"
                        >Yes</button>
                        <button
                          className="sidebar-btn sidebar-btn--confirm-no"
                          onClick={() => setDeleteConfirmId(null)}
                          title="Cancel"
                        >No</button>
                      </div>
                    ) : (
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
                    )}
                    {!isRenaming && !isDeleteConfirm && (
                      <div className="left-sidebar__project-actions">
                        <button
                          className="sidebar-btn sidebar-btn--action"
                          onClick={(e) => {
                            e.stopPropagation();
                            setRenamingId(project.id);
                            setRenameValue(project.name);
                            setMenuOpenId(null);
                          }}
                          title="Rename"
                        >✏️</button>
                        <button
                          className="sidebar-btn sidebar-btn--action sidebar-btn--action-danger"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteConfirmId(project.id);
                            setMenuOpenId(null);
                          }}
                          title="Delete"
                        >🗑️</button>
                      </div>
                    )}
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
    </aside>
  );
}
