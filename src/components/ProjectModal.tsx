import { useState, useRef } from 'react';
import { type Project } from '@/api/projects';
import { useUpload } from '@/hooks/useUpload';

interface ProjectModalProps {
  onClose: () => void;
  onSubmit: (name: string, imageUrl: string) => Promise<Project | null>;
  userId: string;
}

export function ProjectModal({ onClose, onSubmit, userId }: ProjectModalProps) {
  const [name, setName] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { upload } = useUpload();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setError(null);
    const url = URL.createObjectURL(file);
    setPreview(url);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) { setError('Project name is required.'); return; }
    if (!selectedFile) { setError('Please select a panorama image.'); return; }

    setIsLoading(true);
    setError(null);
    try {
      const url = await upload(selectedFile, 'panoramas', userId);
      if (!url) throw new Error('Upload failed');
      await onSubmit(trimmedName, url);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose();
  };

  return (
    <div className="modal-overlay" ref={overlayRef} onClick={handleBackdropClick}>
      <div className="project-modal">
        <div className="project-modal__header">
          <h2 className="project-modal__title">New Project</h2>
          <button className="project-modal__close" onClick={onClose} aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="project-modal__form">
          <div className="project-modal__field">
            <label className="project-modal__label" htmlFor="project-name">Project Name</label>
            <input
              id="project-name"
              className="project-modal__input"
              type="text"
              placeholder="My Awesome Project"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              autoFocus
              disabled={isLoading}
            />
          </div>

          <div className="project-modal__field">
            <label className="project-modal__label">Panorama Image</label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              style={{ display: 'none' }}
              disabled={isLoading}
            />
            <button
              type="button"
              className={`project-modal__upload-btn ${preview ? 'project-modal__upload-btn--has-preview' : ''}`}
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
            >
              {preview ? (
                <img src={preview} alt="Preview" className="project-modal__preview-img" />
              ) : (
                <div className="project-modal__upload-placeholder">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="3" y="3" width="18" height="18" rx="2"/>
                    <circle cx="8.5" cy="8.5" r="1.5"/>
                    <path d="M21 15l-5-5L5 21"/>
                  </svg>
                  <span>Click to select image</span>
                </div>
              )}
            </button>
            {selectedFile && (
              <span className="project-modal__filename">{selectedFile.name}</span>
            )}
          </div>

          {error && <p className="project-modal__error">{error}</p>}

          <div className="project-modal__actions">
            <button type="button" className="project-modal__cancel" onClick={onClose} disabled={isLoading}>
              Cancel
            </button>
            <button
              type="submit"
              className="project-modal__submit"
              disabled={isLoading || !name.trim() || !selectedFile}
            >
              {isLoading ? (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" strokeOpacity="0.3"/>
                    <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round">
                      <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.8s" repeatCount="indefinite"/>
                    </path>
                  </svg>
                  Creating...
                </>
              ) : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
