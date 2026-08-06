import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import EditorModalShell from './EditorModalShell';

const TABS = [{ value: 'a', label: 'Alpha' }, { value: 'b', label: 'Beta' }];

const baseProps = {
  open: true,
  title: 'My Record',
  contentClassName: 'x',
  loading: false,
  tabs: TABS,
  tab: 'a',
  onTabChange: () => {},
  hasUnsavedChanges: false,
  onSave: async () => true,
  onClose: () => {},
  onExport: () => {},
};

describe('EditorModalShell', () => {
  it('shows only Loading… while loading — no tabs, no footer', () => {
    render(<EditorModalShell {...baseProps} loading><div>body</div></EditorModalShell>);
    expect(screen.getByText('Loading…')).toBeTruthy();
    expect(screen.queryByText('Alpha')).toBeNull();
    expect(screen.queryByText('Save')).toBeNull();
    expect(screen.queryByText('body')).toBeNull();
  });

  it('renders title, tabs, body and footer once loaded', () => {
    render(<EditorModalShell {...baseProps}><div>body</div></EditorModalShell>);
    expect(screen.getByText('My Record')).toBeTruthy();
    expect(screen.getByText('Alpha')).toBeTruthy();
    expect(screen.getByText('body')).toBeTruthy();
    expect(screen.getByText('Export')).toBeTruthy();
    expect(screen.getByText('Save')).toBeTruthy();
  });

  it('disables Save unless there are unsaved changes', () => {
    const { rerender } = render(<EditorModalShell {...baseProps}><div /></EditorModalShell>);
    expect(screen.getByText('Save').closest('button')!.disabled).toBe(true);
    rerender(<EditorModalShell {...baseProps} hasUnsavedChanges><div /></EditorModalShell>);
    expect(screen.getByText('Save').closest('button')!.disabled).toBe(false);
  });

  it('shows Publish only when onPublish is provided, and wires it', () => {
    const onPublish = vi.fn();
    const { rerender } = render(<EditorModalShell {...baseProps}><div /></EditorModalShell>);
    expect(screen.queryByText('Publish')).toBeNull();
    rerender(<EditorModalShell {...baseProps} onPublish={onPublish}><div /></EditorModalShell>);
    fireEvent.click(screen.getByText('Publish'));
    expect(onPublish).toHaveBeenCalledTimes(1);
  });

  it('save-and-exit closes only when the save succeeds', async () => {
    // Failing save: Escape opens the unsaved prompt; its Save must NOT close.
    const onClose = vi.fn();
    const failSave = vi.fn(async () => false);
    const { rerender } = render(
      <EditorModalShell {...baseProps} hasUnsavedChanges onSave={failSave} onClose={onClose}><div /></EditorModalShell>,
    );
    fireEvent.keyDown(document.activeElement || document.body, { key: 'Escape' });
    const saveExit = await screen.findByText('Save & Exit');
    fireEvent.click(saveExit);
    await waitFor(() => expect(failSave).toHaveBeenCalled());
    expect(onClose).not.toHaveBeenCalled();

    // Succeeding save closes.
    const okSave = vi.fn(async () => true);
    rerender(<EditorModalShell {...baseProps} hasUnsavedChanges onSave={okSave} onClose={onClose}><div /></EditorModalShell>);
    fireEvent.keyDown(document.activeElement || document.body, { key: 'Escape' });
    fireEvent.click(await screen.findByText('Save & Exit'));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });
});
