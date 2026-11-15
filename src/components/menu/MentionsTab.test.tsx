import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { AdminPanelDialog } from './AdminPanelDialog';
import ReportService from '@/services/ReportService';
import ReviewService from '@/services/ReviewService';
import type { CorefContribution } from '@/services/CorefContributionService';

vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));
vi.mock('./ReportsTab', () => ({ ReportsTab: () => <div data-testid="reports" /> }));
vi.mock('./ReviewTab', () => ({ ReviewTab: () => <div data-testid="review" /> }));
vi.mock('./AutoApprovedTab', () => ({ AutoApprovedTab: () => <div data-testid="auto-approved" /> }));
vi.mock('./ManageUsersTab', () => ({ ManageUsersTab: () => <div data-testid="users" /> }));
vi.mock('./EventsTab', () => ({ EventsTab: () => <div data-testid="events" /> }));
vi.mock('./AuditLogTab', () => ({ AuditLogTab: () => <div data-testid="log" /> }));
vi.mock('./FeedbackTab', () => ({ FeedbackTab: () => <div data-testid="feedback" /> }));
vi.mock('./ServerSettingsTab', () => ({ ServerSettingsTab: () => <div data-testid="server-settings" /> }));
vi.mock('@/lib/useListingReviewMeta', () => ({ useListingReviewMeta: () => ({ supported: true, enabled: true }) }));
vi.mock('@/services/AuthService', () => ({
  default: { token: 't', API_URL: 'http://api.test', getCurrentUser: () => ({ id: 'm1', username: 'mod', accountType: 'moderator' }) },
}));

// A synthetic passage written for these guards.
const passage = 'Mira met the courier. She nodded.';
const at = (piece: string): [number, number] => [passage.indexOf(piece), passage.indexOf(piece) + piece.length];

const item = (id: string): CorefContribution => ({
  id,
  contributorUsername: 'player-one',
  state: 'pending',
  createdAt: '2026-11-15T10:00:00.000Z',
  worldId: 'world-1',
  passage,
  modelId: 'small',
  modelVersion: 2,
  clusters: [[at('Mira'), at('She')]],
  clusterEntities: ['mira'],
  corrections: [{ kind: 'mention', start: at('She')[0], end: at('She')[1], entityId: 'kessa' }],
});

/** The server's queue: decisions take items out, and the count reads what is left. */
let queue: CorefContribution[];
let fetchSpy: MockInstance<typeof fetch>;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

beforeEach(() => {
  vi.spyOn(ReportService, 'fetchOpenCount').mockResolvedValue(0);
  vi.spyOn(ReviewService, 'fetchCount').mockResolvedValue(0);
  queue = [item('c1'), item('c2')];
  fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = String(input);
    const decided = /\/coref-contributions\/([^/]+)\/(accept|reject)$/.exec(url);
    if (decided && init?.method === 'POST') {
      queue = queue.filter((c) => c.id !== decided[1]);
      return json({ success: true });
    }
    if (url.endsWith('/coref-contributions/count')) return json({ success: true, pending: queue.length });
    if (url.endsWith('/coref-contributions')) return json({ success: true, data: queue });
    return json({}, 404);
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const Panel = () => <AdminPanelDialog open onOpenChange={() => {}} initialTab="moderation" initialModerationTab="mentions" />;

/** The queue's items, not the correction rows nested in each. */
const items = (list: HTMLElement) => Array.from(list.children) as HTMLElement[];
const decisions = (action: string) => fetchSpy.mock.calls.filter(([url, init]) => String(url).endsWith(`/${action}`) && init?.method === 'POST');

describe('the Mentions review tab', () => {
  it('shows the passage with each original and corrected link', async () => {
    render(<Panel />);
    const list = await screen.findByRole('list', { name: 'Mentions' });
    const first = items(list)[0];
    expect(first.textContent).toContain(passage);
    expect(within(first).getByText('She', { selector: 'mark' })).toBeTruthy();
    const correction = within(within(first).getByRole('list', { name: 'Corrections' })).getByRole('listitem');
    expect(correction.textContent).toMatch(/Mention.*“She”.*mira.*kessa/);
  });

  it('accepts an item, takes it off the list, and the count updates', async () => {
    render(<Panel />);
    expect(await screen.findByRole('tab', { name: 'Mentions (2)' })).toBeTruthy();
    const list = await screen.findByRole('list', { name: 'Mentions' });
    fireEvent.click(within(items(list)[0]).getByRole('button', { name: 'Accept' }));

    await waitFor(() => expect(screen.getByRole('tab', { name: 'Mentions (1)' })).toBeTruthy());
    expect(decisions('accept').map(([url]) => String(url))).toEqual([expect.stringMatching(/\/c1\/accept$/)]);
    expect(items(screen.getByRole('list', { name: 'Mentions' }))).toHaveLength(1);
  });

  it('rejects an item, and the count updates', async () => {
    render(<Panel />);
    const list = await screen.findByRole('list', { name: 'Mentions' });
    fireEvent.click(within(items(list)[1]).getByRole('button', { name: 'Reject' }));

    await waitFor(() => expect(screen.getByRole('tab', { name: 'Mentions (1)' })).toBeTruthy());
    expect(decisions('reject').map(([url]) => String(url))).toEqual([expect.stringMatching(/\/c2\/reject$/)]);
    expect(decisions('accept')).toHaveLength(0);
  });

  it('says so when the queue is empty', async () => {
    queue = [];
    render(<Panel />);
    expect(await screen.findByText('No contributions waiting')).toBeTruthy();
  });
});
