import type { User } from '@supabase/supabase-js';

interface LeftSidebarProps {
  user: User | null;
  isLoading?: boolean;
  isOpen: boolean;
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

// ── SVG Icons ─────────────────────────────────────────────────────────────────
function LoginIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
      <polyline points="10 17 15 12 10 7"/>
      <line x1="15" y1="12" x2="3" y2="12"/>
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      <polyline points="16 17 21 12 16 7"/>
      <line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  );
}

function PanoramaIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/>
      <path d="M2 12h20"/>
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" strokeOpacity="0.3"/>
      <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round">
        <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.8s" repeatCount="indefinite"/>
      </path>
    </svg>
  );
}

export function LeftSidebar({ user, isLoading, isOpen, onLoginClick, onLogout }: LeftSidebarProps) {
  return (
    <aside className={`left-sidebar${isOpen ? ' left-sidebar--open' : ''}`}>
      {/* ── Branding ──────────────────────────────────────────────── */}
      <div className="left-sidebar__branding">
        <div className="left-sidebar__logo">
          <PanoramaIcon />
        </div>
        <span className="left-sidebar__brand-name">Panorama</span>
      </div>

      {/* ── Divider ───────────────────────────────────────────────── */}
      <div className="left-sidebar__divider" />

      {/* ── Spacer ────────────────────────────────────────────────── */}
      <div className="left-sidebar__spacer" />

      {/* ── Auth Section ──────────────────────────────────────────── */}
      <div className="left-sidebar__auth">
        {isLoading ? (
          <button className="sidebar-btn sidebar-btn--loading" disabled title="Loading...">
            <SpinnerIcon />
          </button>
        ) : user ? (
          <div className="left-sidebar__auth-logged-in">
            <div className="sidebar-account">
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
              <div className="sidebar-account__info">
                <span className="sidebar-account__name">{getDisplayName(user)}</span>
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
    </aside>
  );
}
