import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConfirmDialog } from './ConfirmDialog';

describe('ConfirmDialog', () => {
  it('calls onConfirm when Confirm is clicked', () => {
    const onConfirm = vi.fn();
    render(<ConfirmDialog open onOpenChange={() => {}} onConfirm={onConfirm} title="Sure?" />);
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when Cancel is clicked', () => {
    const onCancel = vi.fn();
    render(<ConfirmDialog open onOpenChange={() => {}} onCancel={onCancel} title="Sure?" />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('renders the title and description', () => {
    render(
      <ConfirmDialog
        open
        onOpenChange={() => {}}
        title="Delete world?"
        description="This cannot be undone."
      />,
    );
    expect(screen.getByText('Delete world?')).toBeInTheDocument();
    expect(screen.getByText('This cannot be undone.')).toBeInTheDocument();
  });
});
