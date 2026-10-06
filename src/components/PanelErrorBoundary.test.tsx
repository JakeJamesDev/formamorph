// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { closeErrorDetails, getErrorDetailsState } from '@/lib/errorDetails';
import { PanelErrorBoundary } from './PanelErrorBoundary';

let fault: Error | null = null;

function Panel({ name = 'Panel body' }: { name?: string }) {
  if (fault) throw fault;
  return <p>{name}</p>;
}

beforeEach(() => {
  fault = new Error('Panel blew up');
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  closeErrorDetails();
  vi.restoreAllMocks();
});

describe('PanelErrorBoundary', () => {
  it('shows the card in the panel and leaves the siblings alone', () => {
    render(<div><p>Sibling</p><PanelErrorBoundary><Panel /></PanelErrorBoundary></div>);

    expect(screen.getByRole('heading', { name: 'This Panel Stopped Working' })).toBeInTheDocument();
    expect(screen.getByText('Your unsaved edits are kept. Try again, or view the details to report the problem.')).toBeInTheDocument();
    expect(screen.getByText('Sibling')).toBeInTheDocument();
  });

  it('remounts the panel on Try Again, and renders it once the fault is gone', async () => {
    render(<PanelErrorBoundary><Panel /></PanelErrorBoundary>);
    fault = null;

    await userEvent.click(screen.getByRole('button', { name: 'Try Again' }));

    expect(screen.getByText('Panel body')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'This Panel Stopped Working' })).not.toBeInTheDocument();
  });

  it('shows the card again when Try Again meets the same fault', async () => {
    render(<PanelErrorBoundary><Panel /></PanelErrorBoundary>);

    await userEvent.click(screen.getByRole('button', { name: 'Try Again' }));

    expect(screen.getByRole('heading', { name: 'This Panel Stopped Working' })).toBeInTheDocument();
  });

  it("opens the Error Details dialog's state on the panel's error with its component stack", async () => {
    render(<PanelErrorBoundary><Panel /></PanelErrorBoundary>);

    await userEvent.click(screen.getByRole('button', { name: 'View Details' }));

    const { open, entry } = getErrorDetailsState();
    expect(open).toBe(true);
    expect(entry?.message).toBe('Panel blew up');
    expect(entry?.details).toContain('Component stack:');
    expect(entry?.details).toContain('at Panel');
  });

  it('clears the card when the reset key changes', () => {
    const { rerender } = render(<PanelErrorBoundary resetKey="a"><Panel /></PanelErrorBoundary>);
    fault = null;

    rerender(<PanelErrorBoundary resetKey="b"><Panel /></PanelErrorBoundary>);

    expect(screen.getByText('Panel body')).toBeInTheDocument();
  });

  it('keeps the card while the reset key stays the same', () => {
    const { rerender } = render(<PanelErrorBoundary resetKey="a"><Panel /></PanelErrorBoundary>);
    fault = null;

    rerender(<PanelErrorBoundary resetKey="a"><Panel /></PanelErrorBoundary>);

    expect(screen.getByRole('heading', { name: 'This Panel Stopped Working' })).toBeInTheDocument();
  });
});
