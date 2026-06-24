import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { UnsavedChangesDialog } from './UnsavedChangesDialog';

describe('UnsavedChangesDialog', () => {
  it('calls onSave when "Save & Exit" is clicked', () => {
    const onSave = vi.fn();
    render(<UnsavedChangesDialog open onOpenChange={() => {}} onSave={onSave} onExit={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Save & Exit' }));
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('calls onExit when "Exit Without Saving" is clicked', () => {
    const onExit = vi.fn();
    render(<UnsavedChangesDialog open onOpenChange={() => {}} onSave={() => {}} onExit={onExit} />);
    fireEvent.click(screen.getByRole('button', { name: 'Exit Without Saving' }));
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it('renders nothing when closed', () => {
    render(<UnsavedChangesDialog open={false} onOpenChange={() => {}} onSave={() => {}} onExit={() => {}} />);
    expect(screen.queryByText('Unsaved changes')).not.toBeInTheDocument();
  });
});
