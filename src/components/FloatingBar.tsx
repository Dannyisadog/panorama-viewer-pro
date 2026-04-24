import { useRef } from 'react';

interface FloatingBarProps {
  onImageSelect: (url: string, fileName: string) => void;
  selectedFileName?: string;
}

export function FloatingBar({ onImageSelect, selectedFileName }: FloatingBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const objectUrl = URL.createObjectURL(file);
    onImageSelect(objectUrl, file.name);
    // Reset so the same file can be re-selected
    e.target.value = '';
  };

  return (
    <div className="floating-bar">
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
