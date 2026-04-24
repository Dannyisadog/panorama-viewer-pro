import { useRef } from 'react';

interface FloatingBarProps {
  onImageSelect: (url: string, fileName: string) => void;
  selectedFileName?: string;
  editMode: boolean;
  onToggleEditMode: () => void;
}

export function FloatingBar({
  onImageSelect,
  selectedFileName,
  editMode,
  onToggleEditMode,
}: FloatingBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const objectUrl = URL.createObjectURL(file);
    onImageSelect(objectUrl, file.name);
    e.target.value = '';
  };

  return (
    <div className="floating-bar">
      {/* Edit Mode Toggle */}
      <button
        className={`edit-mode-btn ${editMode ? 'active' : ''}`}
        onClick={onToggleEditMode}
        title={editMode ? 'Exit Edit Mode' : 'Enter Edit Mode'}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
        <span>{editMode ? 'Exit Edit' : 'Edit Mode'}</span>
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
        className="upload-btn"
        onClick={() => inputRef.current?.click()}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="17 8 12 3 7 8"/>
          <line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
        <span>{selectedFileName ?? 'Upload Panorama'}</span>
      </button>
    </div>
  );
}
