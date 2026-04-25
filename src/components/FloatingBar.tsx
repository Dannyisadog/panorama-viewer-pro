import { useRef } from 'react';

interface FloatingBarProps {
  onImageSelect: (url: string, fileName: string) => void;
  selectedFileName?: string;
  editMode: boolean;
  onToggleEditMode: () => void;
  user?: import('@supabase/supabase-js').User | null;
  // Image annotation upload (edit mode)
  onImageUpload?: (file: File) => void;
  isUploading?: boolean;
}

export function FloatingBar({
  onImageSelect,
  selectedFileName,
  editMode,
  onToggleEditMode,
  user,
  onImageUpload,
  isUploading = false,
}: FloatingBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const objectUrl = URL.createObjectURL(file);
    onImageSelect(objectUrl, file.name);
    e.target.value = '';
  };

  // For image annotations in edit mode (when onImageUpload is provided)
  const handleImageAnnotationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onImageUpload) return;
    onImageUpload(file);
    e.target.value = '';
  };

  return (
    <div className="floating-bar">
      <div className="floating-bar__group">
        {/* Edit Mode Toggle */}
        <button
          className={`edit-mode-btn bar-btn ${editMode ? 'active' : ''} ${!user ? 'locked' : ''}`}
          onClick={onToggleEditMode}
          title={!user ? 'Login to edit' : editMode ? 'Exit Edit Mode' : 'Enter Edit Mode'}
        >
          {editMode ? (
            // Exit edit icon
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          ) : !user ? (
            // Lock icon — not logged in
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          ) : (
            // Edit icon — logged in
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          )}
          <span>{editMode ? 'Exit Edit' : !user ? 'Edit Mode' : 'Edit Mode'}</span>
        </button>

        {/* Upload Button */}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />
        <button
          className="upload-btn bar-btn"
          onClick={() => inputRef.current?.click()}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          <span>{selectedFileName ?? 'Upload Panorama'}</span>
        </button>

        {/* Image Annotation Button — only in edit mode */}
        {editMode && (
          <>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageAnnotationChange}
              style={{ display: 'none' }}
            />
            <button
              className={`upload-btn bar-btn ${isUploading ? 'bar-btn--loading' : ''}`}
              onClick={() => imageInputRef.current?.click()}
              disabled={isUploading}
              title={isUploading ? 'Uploading...' : 'Add Image Annotation'}
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
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                  <circle cx="8.5" cy="8.5" r="1.5"/>
                  <polyline points="21 15 16 10 5 21"/>
                </svg>
              )}
              <span>{isUploading ? 'Uploading...' : 'Add Image'}</span>
            </button>
          </>
        )}
      </div>

      {/* Right spacer — balanced layout, ready for future tools */}
      <div className="floating-bar__spacer" />
    </div>
  );
}
