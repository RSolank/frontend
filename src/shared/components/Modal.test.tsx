import { render, screen, fireEvent } from '@testing-library/react';
import { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';

import { Modal } from './Modal';

describe('Modal', () => {
  it('renders title, children, and footer when open', () => {
    render(
      <Modal open onClose={() => {}} title="Test" footer={<span>FOOT</span>}>
        <p>body content</p>
      </Modal>
    );
    expect(screen.getByText('Test')).toBeInTheDocument();
    expect(screen.getByText('body content')).toBeInTheDocument();
    expect(screen.getByText('FOOT')).toBeInTheDocument();
  });

  it('does not render content when closed', () => {
    render(
      <Modal open={false} onClose={() => {}} title="Closed">
        <p>hidden body</p>
      </Modal>
    );
    expect(screen.queryByText('hidden body')).not.toBeInTheDocument();
  });

  it('calls onClose when the close button is clicked', () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="Closeable">
        <p>body</p>
      </Modal>
    );
    fireEvent.click(screen.getByLabelText('Close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('hides the close button when not dismissible', () => {
    render(
      <Modal open onClose={() => {}} title="Locked" dismissible={false}>
        <p>must acknowledge</p>
      </Modal>
    );
    expect(screen.getByText('must acknowledge')).toBeInTheDocument();
    expect(screen.queryByLabelText('Close')).not.toBeInTheDocument();
  });

  it('raises the in-modal discard confirm (not window.confirm) when dirty, and only closes on Discard', () => {
    const onClose = vi.fn();
    function Harness() {
      const [open, setOpen] = useState(true);
      return (
        <Modal
          open={open}
          onClose={() => {
            onClose();
            setOpen(false);
          }}
          title="Dirty"
          confirmOnDirty
          isDirty
        >
          <p>body</p>
        </Modal>
      );
    }
    render(<Harness />);

    // Dismissing a dirty form via the X raises the custom confirm, NOT a close.
    fireEvent.click(screen.getByLabelText('Close'));
    expect(screen.getByText('Discard unsaved changes?')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();

    // "Keep editing" dismisses the confirm and leaves the modal open.
    fireEvent.click(screen.getByText('Keep editing'));
    expect(
      screen.queryByText('Discard unsaved changes?')
    ).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();

    // "Discard" actually closes.
    fireEvent.click(screen.getByLabelText('Close'));
    fireEvent.click(screen.getByText('Discard'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
