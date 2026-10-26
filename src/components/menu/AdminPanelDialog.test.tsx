import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AdminPanelDialog } from './AdminPanelDialog';
import ReportService from '@/services/ReportService';
import ReviewService from '@/services/ReviewService';

// Whether the server has listing review; each test sets it.
const reviewMeta = vi.hoisted(() => ({ supported: false, enabled: false }));
vi.mock('@/lib/useListingReviewMeta', () => ({ useListingReviewMeta: () => reviewMeta }));

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
vi.mock('./ReportsTab', () => ({ ReportsTab: () => <div data-testid="reports" /> }));
vi.mock('./ReviewTab', () => ({ ReviewTab: () => <div data-testid="review" /> }));
vi.mock('./AutoApprovedTab', () => ({ AutoApprovedTab: () => <div data-testid="auto-approved" /> }));
vi.mock('./EventsTab', () => ({ EventsTab: () => <div data-testid="events" /> }));
vi.mock('./ServerSettingsTab', () => ({ ServerSettingsTab: () => <div data-testid="server-settings" /> }));
vi.mock('./FeedbackQueueTab', () => ({
  FeedbackQueueTab: ({ type, active }: { type: string; active: boolean }) => (
    <div data-testid={`queue-${type}`} data-active={String(active)} />
  ),
}));

/** The top strip's active tab. Its triggers come first in the DOM, ahead of any sub-strip's. */
const activeTab = () =>
  screen.getAllByRole('tab').find((t) => t.getAttribute('data-state') === 'active')?.textContent?.trim();

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  reviewMeta.supported = false;
  vi.spyOn(ReportService, 'fetchOpenCount').mockResolvedValue(0);
  vi.spyOn(ReviewService, 'fetchCount').mockResolvedValue(0);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('the tab strip', () => {
  it('carries one tab for the whole feedback tree, not one per branch', () => {
    // Both branches used to sit on the top strip and cost it two of six slots.
    render(<AdminPanelDialog open onOpenChange={() => {}} />);
    // The first strip is the top one; the Feedback panel's own strip stays mounted below it.
    const strip = within(screen.getAllByRole('tablist')[0]);

    expect(strip.getByRole('tab', { name: 'Feedback' })).toBeTruthy();
    expect(strip.queryByRole('tab', { name: 'Bugs' })).toBeNull();
    expect(strip.queryByRole('tab', { name: 'Suggestions' })).toBeNull();
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

  it('carries the server settings, which only an administrator reaches', () => {
    render(<AdminPanelDialog open onOpenChange={() => {}} initialTab="serverSettings" />);

    // "Server", not "Server Settings": eight triggers share one fixed grid, and the panel's own heading
    // carries the full name.
    expect(screen.getByRole('tab', { name: 'Server' })).toBeTruthy();
    expect(screen.getByTestId('server-settings')).toBeTruthy();
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
    expect(screen.queryByRole('tab', { name: 'Server' })).toBeNull();
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

describe('leaving the Feedback tab', () => {
  it('keeps the queue mounted, and fetching only while it shows', () => {
    render(<AdminPanelDialog open onOpenChange={() => {}} initialTab="feedback" />);
    const queue = screen.getByTestId('queue-bug');
    expect(queue.getAttribute('data-active')).toBe('true');

    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Events' }));
    expect(activeTab()).toBe('Events');
    expect(screen.getByTestId('queue-bug').getAttribute('data-active')).toBe('false');

    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Feedback' }));
    // The same node: its search, filters, and page were never reset.
    expect(screen.getByTestId('queue-bug')).toBe(queue);
    expect(queue.getAttribute('data-active')).toBe('true');
  });

  it('starts the queue over when the panel closes', () => {
    const { rerender } = render(<AdminPanelDialog open onOpenChange={() => {}} initialTab="feedback" />);
    const queue = screen.getByTestId('queue-bug');

    rerender(<AdminPanelDialog open={false} onOpenChange={() => {}} initialTab="feedback" />);
    rerender(<AdminPanelDialog open onOpenChange={() => {}} initialTab="feedback" />);

    expect(screen.getByTestId('queue-bug')).not.toBe(queue);
  });
});

describe('the Moderation tab', () => {
  it('carries each queue’s count on its own segment, and none on the strip', async () => {
    reviewMeta.supported = true;
    vi.mocked(ReportService.fetchOpenCount).mockResolvedValue(2);
    vi.mocked(ReviewService.fetchCount).mockResolvedValue(3);

    render(<AdminPanelDialog open onOpenChange={() => {}} initialTab="moderation" />);

    expect(await screen.findByRole('tab', { name: 'Reports (2)' })).toBeTruthy();
    expect(await screen.findByRole('tab', { name: 'Review (3)' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Moderation' })).toBeTruthy();
  });

  it('opens the review queue when the caller names it', () => {
    reviewMeta.supported = true;

    render(<AdminPanelDialog open onOpenChange={() => {}} initialTab="moderation" initialModerationTab="review" />);

    expect(screen.getByTestId('review')).toBeTruthy();
  });

  it('follows a second request for a sub-tab while already open', () => {
    reviewMeta.supported = true;
    const { rerender } = render(<AdminPanelDialog open onOpenChange={() => {}} initialTab="moderation" />);
    expect(screen.getByTestId('reports')).toBeTruthy();

    rerender(<AdminPanelDialog open onOpenChange={() => {}} initialTab="moderation" initialModerationTab="review" />);

    expect(screen.getByTestId('review')).toBeTruthy();
  });

  it('is the report queue alone against a server without review', async () => {
    vi.mocked(ReportService.fetchOpenCount).mockResolvedValue(2);

    render(<AdminPanelDialog open onOpenChange={() => {}} initialTab="moderation" />);

    expect(screen.getByRole('tab', { name: 'Moderation' })).toBeTruthy();
    expect(screen.getByTestId('reports')).toBeTruthy();
    expect(screen.queryByRole('tab', { name: /^Review/ })).toBeNull();
    expect(ReviewService.fetchCount).not.toHaveBeenCalled();
  });

  it('adds Auto-Approved as a third segment with no count', async () => {
    reviewMeta.supported = true;
    vi.mocked(ReviewService.fetchCount).mockResolvedValue(3);

    render(<AdminPanelDialog open onOpenChange={() => {}} initialTab="moderation" />);

    // The Feedback panel stays mounted with its own strip, so find the strip by its first segment.
    const strip = screen.getByRole('tab', { name: /^Reports/ }).closest('[role="tablist"]') as HTMLElement;
    const segments = within(strip).getAllByRole('tab').map((t) => t.textContent);
    expect(segments).toEqual(['Reports', 'Review', 'Auto-Approved']);
    expect(await screen.findByRole('tab', { name: 'Review (3)' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Auto-Approved' })).toBeTruthy();
  });

  it('opens the auto-approvals when the caller names them', () => {
    reviewMeta.supported = true;

    render(<AdminPanelDialog open onOpenChange={() => {}} initialTab="moderation" initialModerationTab="auto" />);

    expect(screen.getByTestId('auto-approved')).toBeTruthy();
  });

  it('has no Auto-Approved segment against a server without review', () => {
    render(<AdminPanelDialog open onOpenChange={() => {}} initialTab="moderation" />);

    expect(screen.queryByRole('tab', { name: 'Auto-Approved' })).toBeNull();
  });

  it('shows for a moderator too', async () => {
    const AuthService = (await import('@/services/AuthService')).default;
    vi.spyOn(AuthService, 'getCurrentUser').mockReturnValue({ id: 'm1', username: 'a-mod', accountType: 'mod' });
    reviewMeta.supported = true;

    render(<AdminPanelDialog open onOpenChange={() => {}} initialTab="moderation" />);

    expect(screen.getByRole('tab', { name: /^Moderation/ })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /^Review/ })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Auto-Approved' })).toBeTruthy();
  });
});
