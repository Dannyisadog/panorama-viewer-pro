import { useEffect, useRef } from 'react';
import type {
  AnnotationContent,
  TextContent,
  ImageContent,
  VideoContent,
} from '@/types/annotation';

// ── Per-type input components ────────────────────────────────────────────────

function TextInput({
  content,
  onChange,
}: {
  content: TextContent;
  onChange: (c: TextContent) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.focus();
    el.value = content.text;
    el.setSelectionRange(content.text.length, content.text.length);
  }, [content.text]);

  return (
    <input
      ref={inputRef}
      type="text"
      className="annotation-input"
      placeholder="Enter annotation text..."
      onChange={(e) => onChange({ text: e.target.value })}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onChange({ text: e.target.value });
      }}
    />
  );
}

function ImageStubInput({
  content,
  onChange,
}: {
  content: ImageContent;
  onChange: (c: ImageContent) => void;
}) {
  return (
    <div className="annotation-stub-input annotation-stub-input--image">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
        <circle cx="8.5" cy="8.5" r="1.5"/>
        <polyline points="21 15 16 10 5 21"/>
      </svg>
      <input
        type="url"
        className="annotation-input"
        placeholder="Image URL..."
        value={content.url}
        onChange={(e) => onChange({ url: e.target.value, alt: content.alt })}
      />
      <input
        type="text"
        className="annotation-input annotation-input--alt"
        placeholder="Alt text (optional)"
        value={content.alt ?? ''}
        onChange={(e) => onChange({ url: content.url, alt: e.target.value })}
      />
    </div>
  );
}

function VideoStubInput({
  content,
  onChange,
}: {
  content: VideoContent;
  onChange: (c: VideoContent) => void;
}) {
  return (
    <div className="annotation-stub-input annotation-stub-input--video">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="23 7 16 12 23 17 23 7"/>
        <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
      </svg>
      <input
        type="url"
        className="annotation-input"
        placeholder="Video URL..."
        value={content.url}
        onChange={(e) => onChange({ url: e.target.value, thumbnail: content.thumbnail })}
      />
    </div>
  );
}

// ── Modal ────────────────────────────────────────────────────────────────────

interface AnnotationModalProps {
  position: { x: number; y: number };
  /** Current content for the modal — drives which input renders */
  content: AnnotationContent;
  onSave: (content: AnnotationContent) => void;
  onCancel: () => void;
}

/** Returns true when the content has been filled in meaningfully for its type */
function hasContent(content: AnnotationContent): boolean {
  switch (content.type) {
    case 'text':
      return content.text.trim().length > 0;
    case 'image':
      return content.url.trim().length > 0;
    case 'video':
      return content.url.trim().length > 0;
    default:
      return false;
  }
}

export function AnnotationModal({
  position,
  content,
  onSave,
  onCancel,
}: AnnotationModalProps) {
  const isEdit = content.type === 'text' && content.text.length > 0;

  return (
    <div
      className="annotation-modal-overlay"
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div
        className="annotation-modal"
        style={{ left: position.x, top: position.y + 16 }}
      >
        <div className="annotation-modal-title">
          {isEdit ? 'Edit Annotation' : 'New Annotation'}
        </div>

        {/* ── Type-specific content input ──────────────────────────────── */}
        <div className="annotation-modal-body">
          {content.type === 'text' && (
            <TextInput
              content={content as TextContent}
              onChange={(c) => onSave(c)}
            />
          )}
          {content.type === 'image' && (
            <ImageStubInput
              content={content as ImageContent}
              onChange={(c) => onSave(c)}
            />
          )}
          {content.type === 'video' && (
            <VideoStubInput
              content={content as VideoContent}
              onChange={(c) => onSave(c)}
            />
          )}
        </div>

        {/* ── Actions ─────────────────────────────────────────────────── */}
        <div className="annotation-modal-actions">
          <button className="annotation-btn cancel" onClick={onCancel}>
            Cancel
          </button>
          <button
            className="annotation-btn save"
            disabled={!hasContent(content)}
            onClick={() => onSave(content)}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
