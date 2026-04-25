import type { User } from '@supabase/supabase-js';

interface LoginButtonProps {
  user: User | null;
  isLoading?: boolean;
  onLoginClick: () => void;
  onLogout: () => void;
}

// Derive display name from user metadata
function getDisplayName(user: User): string {
  return (
    user.user_metadata?.full_name ??
    user.user_metadata?.name ??
    user.email ??
    'User'
  );
}

// Derive avatar URL from user metadata
function getAvatarUrl(user: User): string | null {
  return user.user_metadata?.avatar_url ?? null;
}

export function LoginButton({ user, isLoading, onLoginClick, onLogout }: LoginButtonProps) {
  if (isLoading) {
    return (
      <button className="login-btn login-btn--loading" disabled>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" strokeOpacity="0.3"/>
          <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round">
            <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.8s" repeatCount="indefinite"/>
          </path>
        </svg>
      </button>
    );
  }

  if (user) {
    const avatarUrl = getAvatarUrl(user);
    const name = getDisplayName(user);

    return (
      <div className="login-btn login-btn--user">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={name}
            className="login-btn__avatar"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="login-btn__avatar login-btn__avatar--placeholder">
            {name.charAt(0).toUpperCase()}
          </div>
        )}
        <span className="login-btn__name">{name}</span>
        <button
          className="login-btn__logout"
          onClick={(e) => { e.stopPropagation(); onLogout(); }}
          title="Sign out"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
        </button>
      </div>
    );
  }

  return (
    <button className="login-btn" onClick={onLoginClick} title="Sign in">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      <span>Login</span>
    </button>
  );
}
