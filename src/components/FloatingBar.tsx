import { useRef } from 'react';

interface FloatingBarProps {
  onUpload: (file: File) => void;
  editMode: boolean;
  onToggleEditMode: () => void;
  user?: import('@supabase/supabase-js').User | null;
  isOwner: boolean;
  onLoginClick: () => void;
  isUploading?: boolean;
  isBootstrapping?: boolean;
}

export function FloatingBar({
  onUpload,
  editMode,
  onToggleEditMode,
  user,
  isOwner,
  onLoginClick,
  isUploading = false,
  isBootstrapping = false,
}: FloatingBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleUploadClick = () => {
    if (!user) {
      onLoginClick();
      return;
    }
    if (!isOwner) return;
    inputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    onUpload(file);
    e.target.value = '';
  };

  return (
    <div className="floating-bar">
      <div className="floating-bar__group">
        {/* Edit Mode Toggle */}
        <button
          className={`edit-mode-btn bar-btn ${editMode ? 'active' : ''} ${!user || !isOwner || isBootstrapping ? 'locked' : ''}`}
          onClick={onToggleEditMode}
          disabled={isBootstrapping}
          title={
            !user
              ? 'Login to edit'
              : isBootstrapping
                ? 'Loading project...'
                : !isOwner
                  ? 'You do not own this project'
                  : editMode
                    ? 'Exit Edit Mode'
                    : 'Enter Edit Mode'
          }
        >
          {editMode ? (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          ) : !user ? (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          ) : (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          )}
          <span>{editMode ? 'Exit Edit' : !user ? 'Edit Mode' : 'Edit Mode'}</span>
        </button>

        {/* Unified Upload button */}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />
        <button
          className={`upload-btn bar-btn ${isUploading ? 'bar-btn--loading' : ''} ${!user || !isOwner ? 'locked' : ''}`}
          onClick={handleUploadClick}
          disabled={isUploading || !isOwner}
          title={!user ? 'Login to upload' : isUploading ? 'Uploading...' : 'Upload Panorama'}
        >
          {isUploading ? (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" strokeOpacity="0.3"/>
              <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round">
                <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.8s" repeatCount="indefinite"/>
              </path>
            </svg>
          ) : (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
          )}
          <span>{isUploading ? 'Uploading...' : 'Upload'}</span>
        </button>
      </div>

      <div className="floating-bar__spacer" />
    </div>
  );
}
