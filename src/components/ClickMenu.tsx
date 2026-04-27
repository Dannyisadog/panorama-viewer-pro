export type ClickMenuType = 'text' | 'image' | 'video';

interface ClickMenuProps {
  screenX: number;
  screenY: number;
  onSelect: (type: ClickMenuType) => void;
  onClose: () => void;
}

export function ClickMenu({ screenX, screenY, onSelect, onClose }: ClickMenuProps) {
  return (
    <div
      className="click-menu-overlay"
      onClick={onClose}
    >
      <div
        className="click-menu"
        style={{
          left: screenX,
          top: screenY + 12,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="click-menu__item"
          onClick={() => onSelect('text')}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 6.1H3M21 12.1H3M15.1 18H3"/>
          </svg>
          Text
        </button>
        <button
          className="click-menu__item"
          onClick={() => onSelect('image')}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21 15 16 10 5 21"/>
          </svg>
          Image
        </button>
        <button
          className="click-menu__item"
          onClick={() => onSelect('video')}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="23 7 16 12 23 17 23 7"/>
            <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
          </svg>
          Video
        </button>
      </div>
    </div>
  );
}
