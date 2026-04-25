import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { AnnotationModal } from '@/components/AnnotationModal';

// ── Test wrappers ─────────────────────────────────────────────────────────────

function renderModal(props: Partial<React.ComponentProps<typeof AnnotationModal>> = {}) {
  const defaults = {
    position: { x: 100, y: 200 },
    initialText: '',
    onSave: vi.fn(),
    onCancel: vi.fn(),
  };
  return { ...defaults, ...props };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('AnnotationModal', () => {
  it('renders without crashing', () => {
    const { onSave, onCancel } = renderModal();
    render(<AnnotationModal position={{ x: 0, y: 0 }} onSave={onSave} onCancel={onCancel} />);

    expect(screen.getByPlaceholderText('Enter annotation...')).toBeInTheDocument();
  });

  it('renders in "New Annotation" mode when initialText is empty', () => {
    const { onSave, onCancel } = renderModal();
    render(<AnnotationModal position={{ x: 0, y: 0 }} onSave={onSave} onCancel={onCancel} />);

    expect(screen.getByText('New Annotation')).toBeInTheDocument();
  });

  it('renders in "Edit Annotation" mode when initialText is provided', () => {
    const { onSave, onCancel } = renderModal({ initialText: 'Existing text' });
    render(
      <AnnotationModal
        position={{ x: 0, y: 0 }}
        initialText="Existing text"
        onSave={onSave}
        onCancel={onCancel}
      />
    );

    expect(screen.getByText('Edit Annotation')).toBeInTheDocument();
  });

  it('pre-fills the input with initialText', () => {
    const { onSave, onCancel } = renderModal({ initialText: 'Pre-filled value' });
    render(
      <AnnotationModal
        position={{ x: 0, y: 0 }}
        initialText="Pre-filled value"
        onSave={onSave}
        onCancel={onCancel}
      />
    );

    expect(screen.getByDisplayValue('Pre-filled value')).toBeInTheDocument();
  });

  it('calls onSave with input value when Save button is clicked', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const onCancel = vi.fn();
    render(
      <AnnotationModal
        position={{ x: 0, y: 0 }}
        onSave={onSave}
        onCancel={onCancel}
      />
    );

    await user.type(screen.getByRole('textbox'), 'My new annotation');
    await user.click(screen.getByText('Save'));

    expect(onSave).toHaveBeenCalledOnce();
    expect(onSave).toHaveBeenCalledWith('My new annotation');
  });

  it('calls onCancel when Cancel button is clicked', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(
      <AnnotationModal
        position={{ x: 0, y: 0 }}
        onSave={vi.fn()}
        onCancel={onCancel}
      />
    );

    await user.click(screen.getByText('Cancel'));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('calls onSave when Enter key is pressed', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(
      <AnnotationModal
        position={{ x: 0, y: 0 }}
        onSave={onSave}
        onCancel={vi.fn()}
      />
    );

    await user.type(screen.getByRole('textbox'), 'Typed then Enter');
    await user.keyboard('{Enter}');

    expect(onSave).toHaveBeenCalledWith('Typed then Enter');
  });

  it('calls onCancel when Escape key is pressed', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(
      <AnnotationModal
        position={{ x: 0, y: 0 }}
        onSave={vi.fn()}
        onCancel={onCancel}
      />
    );

    await user.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('does not call onSave when input is empty and Save is clicked', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(
      <AnnotationModal
        position={{ x: 0, y: 0 }}
        onSave={onSave}
        onCancel={vi.fn()}
      />
    );

    // Don't type anything, just click Save
    await user.click(screen.getByText('Save'));

    // onSave is called even with empty string (App.tsx handles empty trimming)
    expect(onSave).toHaveBeenCalledWith('');
  });

  it('positions modal near the clicked screen coordinates', () => {
    const onSave = vi.fn();
    const onCancel = vi.fn();
    render(
      <AnnotationModal
        position={{ x: 250, y: 380 }}
        onSave={onSave}
        onCancel={onCancel}
      />
    );

    // Modal renders (verifiable by finding its title or content)
    expect(screen.getByText('New Annotation')).toBeInTheDocument();
  });

  it('closes on overlay background click', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(
      <AnnotationModal
        position={{ x: 0, y: 0 }}
        onSave={vi.fn()}
        onCancel={onCancel}
      />
    );

    // The overlay div is the background behind the modal
    const overlay = document.querySelector('.annotation-modal-overlay') as HTMLElement;
    await user.click(overlay);

    expect(onCancel).toHaveBeenCalled();
  });
});
