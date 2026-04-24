import { useEffect, useRef } from 'react';

interface AnnotationModalProps {
  position: { x: number; y: number };
  initialText?: string;
  onSave: (text: string) => void;
  onCancel: () => void;
}

export function AnnotationModal({
  position,
  initialText = '',
  onSave,
  onCancel,
}: AnnotationModalProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current!.value = initialText;
    inputRef.current!.setSelectionRange(initialText.length, initialText.length);
  }, [initialText]);

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
        <div className="annotation-modal-title">
          {initialText ? 'Edit Annotation' : 'New Annotation'}
        </div>
        <input
          ref={inputRef}
          type="text"
          className="annotation-input"
          placeholder="Enter annotation..."
          onKeyDown={handleKeyDown}
        />
        <div className="annotation-modal-actions">
          <button className="annotation-btn cancel" onClick={onCancel}>
            Cancel
          </button>
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
