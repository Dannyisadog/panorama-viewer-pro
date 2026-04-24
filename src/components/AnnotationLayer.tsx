import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type {
  Annotation,
  AnnotationContent,
  TextContent,
  ImageContent,
  VideoContent,
} from '@/types/annotation';

/** Subset of Annotation needed by AnnotationLayer — excludes meta */
export type AnnotationData = Omit<Annotation, 'meta'>;

interface AnnotationLayerProps {
  annotations: Annotation[];
  cameraRef: React.MutableRefObject<THREE.PerspectiveCamera | null>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  editMode: boolean;
  onAnnotationEdit?: (annotation: AnnotationData) => void;
  onAnnotationDelete?: (id: string) => void;
  rafIdRef?: React.MutableRefObject<number>;
}

// ── Content Renderers ─────────────────────────────────────────────────────────

function TextRenderer({ content }: { content: TextContent }) {
  return <div className="annotation-label">{content.text}</div>;
}

function ImageStub({ content }: { content: ImageContent }) {
  return (
    <div className="annotation-stub">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
        <circle cx="8.5" cy="8.5" r="1.5"/>
        <polyline points="21 15 16 10 5 21"/>
      </svg>
      {content.alt ?? 'Image'}
    </div>
  );
}

function VideoStub({ content }: { content: VideoContent }) {
  return (
    <div className="annotation-stub">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="23 7 16 12 23 17 23 7"/>
        <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
      </svg>
      Video
    </div>
  );
}

/** Renders annotation content based on type. Extensible — add new cases here. */
function AnnotationContentRenderer({ annotation }: { annotation: Annotation }) {
  switch (annotation.type) {
    case 'text':
      return <TextRenderer content={annotation.content} />;
    case 'image':
      return <ImageStub content={annotation.content as ImageContent} />;
    case 'video':
      return <VideoStub content={annotation.content as VideoContent} />;
    default:
      // Exhaustiveness guard — new types not yet handled
      return null;
  }
}

// ── AnnotationLayer ───────────────────────────────────────────────────────────

export function AnnotationLayer({
  annotations,
  cameraRef,
  containerRef,
  editMode,
  onAnnotationEdit,
  onAnnotationDelete,
  rafIdRef,
}: AnnotationLayerProps) {
  const layerRef = useRef<HTMLDivElement>(null);
  // Keep a live ref so the RAF loop always reads current data without re-subscribing
  const annotationsRef = useRef(annotations);
  annotationsRef.current = annotations;

  useEffect(() => {
    if (!rafIdRef) return;

    const syncRafLoop = () => {
      const layer = layerRef.current;
      const camera = cameraRef.current;
      const container = containerRef.current;
      if (!layer || !camera || !container) {
        rafIdRef.current = requestAnimationFrame(syncRafLoop);
        return;
      }

      const { clientWidth: width, clientHeight: height } = container;
      const currentAnnotations = annotationsRef.current;

      currentAnnotations.forEach((ann) => {
        const el = layer.querySelector(`[data-id="${ann.id}"]`) as HTMLElement | null;
        if (!el) return;

        const pos = new THREE.Vector3(ann.position.x, ann.position.y, ann.position.z);
        pos.project(camera);

        if (!Number.isFinite(pos.x) || !Number.isFinite(pos.y) || !Number.isFinite(pos.z)) {
          el.style.opacity = '0';
          return;
        }

        if (pos.z > 1 || pos.z < -1) {
          el.style.opacity = '0';
          return;
        }

        const screenX = (pos.x * 0.5 + 0.5) * width;
        const screenY = (-pos.y * 0.5 + 0.5) * height;

        el.style.transform = `translate(${screenX}px, ${screenY}px) translate(-50%, -50%)`;
        el.style.opacity = '1';
      });

      rafIdRef.current = requestAnimationFrame(syncRafLoop);
    };

    rafIdRef.current = requestAnimationFrame(syncRafLoop);

    return () => {
      if (rafIdRef?.current) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, [rafIdRef, cameraRef, containerRef]);

  return (
    <div
      ref={layerRef}
      className={`annotation-layer${editMode ? ' edit-mode' : ''}`}
    >
      {annotations.map((ann) => (
        <div
          key={ann.id}
          data-id={ann.id}
          className={`annotation-marker annotation-marker--${ann.type}`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="annotation-dot" />

          {/* Content rendered by type — extensible via AnnotationContentRenderer */}
          <AnnotationContentRenderer annotation={ann} />

          {editMode && (
            <div className="annotation-actions">
              <button
                className="annotation-action-btn edit"
                title="Edit"
                onClick={(e) => {
                  e.stopPropagation();
                  onAnnotationEdit?.(ann);
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              </button>
              <button
                className="annotation-action-btn delete"
                title="Delete"
                onClick={(e) => {
                  e.stopPropagation();
                  onAnnotationDelete?.(ann.id);
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                  <path d="M10 11v6M14 11v6"/>
                  <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                </svg>
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
