import type { User } from '@supabase/supabase-js';

interface LeftSidebarProps {
  user: User | null;
  isLoading?: boolean;
  editMode: boolean;
  isOpen: boolean;
  onToggleEditMode: () => void;
  onLoginClick: () => void;
  onLogout: () => void;
}

function getDisplayName(user: User): string {
  return (
    user.user_metadata?.full_name ??
    user.user_metadata?.name ??
    user.email ??
    'User'
  );
}

function getAvatarUrl(user: User): string | null {
  return user.user_metadata?.avatar_url ?? null;
}

function getInitials(user: User): string {
  const name = getDisplayName(user);
  return name.charAt(0).toUpperCase();
}

export function LeftSidebar({
  user,
  isLoading,
  editMode,
  isOpen,
  onToggleEditMode,
  onLoginClick,
  onLogout,
}: LeftSidebarProps) {
  const handleEditClick = () => {
    if (!user) {
      onLoginClick();
      return;
    }
    onToggleEditMode();
  };

  const handleLoginClick = () => {
    onLoginClick();
  };

  return (
    <aside className={`left-sidebar${isOpen ? ' left-sidebar--open' : ''}`}>
      {/* ── Login / Account ─────────────────────────── */}
      <div className="left-sidebar__section">
        {isLoading ? (
          <button className="sidebar-btn sidebar-btn--loading" disabled title="Loading...">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" strokeOpacity="0.3"/>
              <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round">
                <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.8s" repeatCount="indefinite"/>
              </path>
            </svg>
          </button>
        ) : user ? (
          <div className="sidebar-account">
            <button
              className="sidebar-btn sidebar-btn--avatar"
              title={`${getDisplayName(user)} — click to sign out`}
              onClick={onLogout}
            >
              {getAvatarUrl(user) ? (
                <img
                  src={getAvatarUrl(user)!}
                  alt={getDisplayName(user)}
                  className="sidebar-avatar"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="sidebar-avatar sidebar-avatar--placeholder">
                  {getInitials(user)}
                </div>
              )}
            </button>
          </div>
        ) : (
          <button
            className="sidebar-btn"
            onClick={handleLoginClick}
            title="Sign in"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
          </button>
        )}
      </div>

      {/* ── Divider ────────────────────────────────── */}
      <div className="left-sidebar__divider" />

      {/* ── Edit Mode Toggle ───────────────────────── */}
      <div className="left-sidebar__section">
        <button
          className={`sidebar-btn ${editMode ? 'active' : ''} ${!user ? 'locked' : ''}`}
          onClick={handleEditClick}
          title={
            !user
              ? 'Login to edit'
              : editMode
                ? 'Exit Edit Mode'
                : 'Enter Edit Mode'
          }
        >
          {editMode ? (
            // Active edit mode — X icon to exit
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          ) : !user ? (
            // Locked — not logged in
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          ) : (
            // Edit icon — logged in
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          )}
        </button>
      </div>

      {/* ── Spacer (for future tools) ──────────────── */}
      <div className="left-sidebar__spacer" />
    </aside>
  );
}
