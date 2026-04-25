interface HamburgerButtonProps {
  isOpen: boolean;
  onToggle: () => void;
}

export function HamburgerButton({ isOpen, onToggle }: HamburgerButtonProps) {
  return (
    <button
      className={`hamburger ${isOpen ? 'hamburger--open' : ''}`}
      onClick={onToggle}
      title={isOpen ? 'Close menu' : 'Open menu'}
      aria-label={isOpen ? 'Close sidebar' : 'Open sidebar'}
    >
      <span className="hamburger__line" />
      <span className="hamburger__line" />
      <span className="hamburger__line" />
    </button>
  );
}
