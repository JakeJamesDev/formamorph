import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AdminPanelDialog } from './AdminPanelDialog';

vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));

// The panels have their own coverage; stubbing them keeps this file about the dialog's own shell.
vi.mock('./ManageUsersTab', () => ({ ManageUsersTab: () => <div data-testid="users" /> }));
vi.mock('./BroadcastsTab', () => ({ BroadcastsTab: () => <div data-testid="broadcasts" /> }));
vi.mock('./PoliciesTab', () => ({ PoliciesTab: () => <div data-testid="policies" /> }));
vi.mock('./AuditLogTab', () => ({ AuditLogTab: () => <div data-testid="log" /> }));
vi.mock('./FeedbackQueueTab', () => ({
  FeedbackQueueTab: ({ type }: { type: string }) => <div data-testid={`queue-${type}`} />,
}));

const activeTab = () =>
  screen.getAllByRole('tab').find((t) => t.getAttribute('data-state') === 'active')?.textContent?.trim();

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('the tab strip', () => {
  it('carries a queue for each branch of the feedback tree', () => {
    render(<AdminPanelDialog open onOpenChange={() => {}} />);

    expect(screen.getByRole('tab', { name: 'Bugs' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Suggestions' })).toBeTruthy();
  });

  it('points each queue at its own branch', () => {
    render(<AdminPanelDialog open onOpenChange={() => {}} initialTab="suggestions" />);

    expect(screen.getByTestId('queue-suggestion')).toBeTruthy();
  });

  it('carries the record of what was done', () => {
    render(<AdminPanelDialog open onOpenChange={() => {}} initialTab="log" />);

    expect(screen.getByRole('tab', { name: 'Log' })).toBeTruthy();
    expect(screen.getByTestId('log')).toBeTruthy();
  });

  it('opens on Users by default', () => {
    render(<AdminPanelDialog open onOpenChange={() => {}} />);

    expect(activeTab()).toBe('Users');
  });

  it('opens where the caller asks', () => {
    render(<AdminPanelDialog open onOpenChange={() => {}} initialTab="bugs" />);

    expect(activeTab()).toBe('Bugs');
  });
});

describe('landing on a tab while already open', () => {
  it('follows a second request rather than ignoring it', () => {
    // The dev-router points at a tab by changing this prop. Applying it only on open meant a `goto` at
    // an already-open panel silently left you wherever you were.
    const { rerender } = render(<AdminPanelDialog open onOpenChange={() => {}} initialTab="policies" />);
    expect(activeTab()).toBe('Policies');

    rerender(<AdminPanelDialog open onOpenChange={() => {}} initialTab="suggestions" />);

    expect(activeTab()).toBe('Suggestions');
  });

  it('leaves a hand-picked tab alone when nothing asks otherwise', () => {
    // Re-applying on every render would drag the reader back the moment the parent re-rendered.
    const { rerender } = render(<AdminPanelDialog open onOpenChange={() => {}} initialTab="bugs" />);
    screen.getByRole('tab', { name: 'Users' }).click();

    rerender(<AdminPanelDialog open onOpenChange={() => {}} initialTab="bugs" />);

    expect(activeTab()).not.toBe('Suggestions');
  });
});
