import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AdminPanelDialog } from './AdminPanelDialog';

vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));

// Which tabs exist depends on the viewer's role: Broadcasts and Policies are an administrator's.
vi.mock('@/services/AuthService', () => ({
  default: { token: 't', getCurrentUser: () => ({ id: 'a1', username: 'root-admin', accountType: 'admin' }) },
}));

// The panels have their own coverage; stubbing them keeps this file about the dialog's own shell.
// `FeedbackTab` is left real: its sub-tabs are part of the strip this file is about.
vi.mock('./ManageUsersTab', () => ({ ManageUsersTab: () => <div data-testid="users" /> }));
vi.mock('./BroadcastsTab', () => ({ BroadcastsTab: () => <div data-testid="broadcasts" /> }));
vi.mock('./PoliciesTab', () => ({ PoliciesTab: () => <div data-testid="policies" /> }));
vi.mock('./AuditLogTab', () => ({ AuditLogTab: () => <div data-testid="log" /> }));
vi.mock('./EventsTab', () => ({ EventsTab: () => <div data-testid="events" /> }));
vi.mock('./FeedbackQueueTab', () => ({
  FeedbackQueueTab: ({ type }: { type: string }) => <div data-testid={`queue-${type}`} />,
}));

/** The top strip's active tab. Its triggers come first in the DOM, ahead of any sub-strip's. */
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
  it('carries one tab for the whole feedback tree, not one per branch', () => {
    // Both branches used to sit on the top strip and cost it two of six slots.
    render(<AdminPanelDialog open onOpenChange={() => {}} />);

    expect(screen.getByRole('tab', { name: 'Feedback' })).toBeTruthy();
    expect(screen.queryByRole('tab', { name: 'Bugs' })).toBeNull();
    expect(screen.queryByRole('tab', { name: 'Suggestions' })).toBeNull();
  });

  it('puts both branches under it', () => {
    render(<AdminPanelDialog open onOpenChange={() => {}} initialTab="feedback" />);

    expect(screen.getByRole('tab', { name: 'Bugs' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Suggestions' })).toBeTruthy();
  });

  it('lands on the branch the caller names', () => {
    render(<AdminPanelDialog open onOpenChange={() => {}} initialTab="feedback" initialFeedbackTab="suggestions" />);

    expect(screen.getByTestId('queue-suggestion')).toBeTruthy();
  });

  it('opens on bugs when no branch is named', () => {
    render(<AdminPanelDialog open onOpenChange={() => {}} initialTab="feedback" />);

    expect(screen.getByTestId('queue-bug')).toBeTruthy();
  });

  it('carries the events calendar', () => {
    render(<AdminPanelDialog open onOpenChange={() => {}} initialTab="events" />);

    expect(screen.getByRole('tab', { name: 'Events' })).toBeTruthy();
    expect(screen.getByTestId('events')).toBeTruthy();
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
    render(<AdminPanelDialog open onOpenChange={() => {}} initialTab="feedback" />);

    expect(activeTab()).toBe('Feedback');
  });
});

describe('what a moderator sees', () => {
  it('is the everyday work, without the two an administrator owns', async () => {
    // Speaking to everyone at once and writing what the site requires are not moderation.
    const AuthService = (await import('@/services/AuthService')).default;
    vi.spyOn(AuthService, 'getCurrentUser').mockReturnValue({ id: 'm1', username: 'a-mod', accountType: 'mod' });

    render(<AdminPanelDialog open onOpenChange={() => {}} />);

    expect(screen.getByRole('tab', { name: 'Users' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Feedback' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Log' })).toBeTruthy();
    expect(screen.queryByRole('tab', { name: 'Broadcasts' })).toBeNull();
    expect(screen.queryByRole('tab', { name: 'Policies' })).toBeNull();
  });

  it('keeps the events calendar, which is worth reading whether or not a viewer may act on it', async () => {
    const AuthService = (await import('@/services/AuthService')).default;
    vi.spyOn(AuthService, 'getCurrentUser').mockReturnValue({ id: 'm1', username: 'a-mod', accountType: 'mod' });

    render(<AdminPanelDialog open onOpenChange={() => {}} initialTab="events" />);

    expect(screen.getByRole('tab', { name: 'Events' })).toBeTruthy();
    expect(activeTab()).toBe('Events');
  });

  it('lands on Users when pointed at a tab they cannot see', async () => {
    // The dev-router, or a panel left open through a demotion, would otherwise show an empty dialog.
    const AuthService = (await import('@/services/AuthService')).default;
    vi.spyOn(AuthService, 'getCurrentUser').mockReturnValue({ id: 'm1', username: 'a-mod', accountType: 'mod' });

    render(<AdminPanelDialog open onOpenChange={() => {}} initialTab="policies" />);

    expect(activeTab()).toBe('Users');
  });
});

describe('landing on a tab while already open', () => {
  it('follows a second request rather than ignoring it', () => {
    // The dev-router points at a tab by changing this prop. Applying it only on open meant a `goto` at
    // an already-open panel silently left you wherever you were.
    const { rerender } = render(<AdminPanelDialog open onOpenChange={() => {}} initialTab="policies" />);
    expect(activeTab()).toBe('Policies');

    rerender(<AdminPanelDialog open onOpenChange={() => {}} initialTab="feedback" />);

    expect(activeTab()).toBe('Feedback');
  });

  it('leaves a hand-picked tab alone when nothing asks otherwise', () => {
    // Re-applying on every render would drag the reader back the moment the parent re-rendered.
    const { rerender } = render(<AdminPanelDialog open onOpenChange={() => {}} initialTab="feedback" />);
    // Radix tab triggers act on mousedown, not click.
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Users' }));
    expect(activeTab()).toBe('Users');

    rerender(<AdminPanelDialog open onOpenChange={() => {}} initialTab="feedback" />);

    expect(activeTab()).toBe('Users');
  });
});
