import { useEffect, useRef } from 'react';

interface AnnotationModalProps {
  position: { x: number; y: number };
  onSave: (text: string) => void;
  onCancel: () => void;
}

export function AnnotationModal({ position, onSave, onCancel }: AnnotationModalProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') onSave(inputRef.current?.value ?? '');
    if (e.key === 'Escape') onCancel();
  };

  return (
    <div
      className="annotation-modal-overlay"
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div
        className="annotation-modal"
        style={{
          left: position.x,
          top: position.y + 16,
        }}
      >
        <input
          ref={inputRef}
          type="text"
          className="annotation-input"
          placeholder="Enter annotation..."
          onKeyDown={handleKeyDown}
        />
        <div className="annotation-modal-actions">
          <button className="annotation-btn cancel" onClick={onCancel}>Cancel</button>
          <button
            className="annotation-btn save"
            onClick={() => onSave(inputRef.current?.value ?? '')}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
