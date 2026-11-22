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
  entityNames: {},
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
    if (url.endsWith('/coref-contributions/reject-no-change') && init?.method === 'POST') {
      const gone = queue.filter((c) => c.changesLabels === false);
      queue = queue.filter((c) => c.changesLabels !== false);
      return json({ success: true, rejected: gone.length });
    }
    if (url.endsWith('/coref-contributions/count')) {
      return json({ success: true, pending: queue.length, noChange: queue.filter((c) => c.changesLabels === false).length });
    }
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

  it('shows a non-mention as "Not a Character", and a null mention as "Not Listed"', async () => {
    const [start, end] = at('She');
    queue = [
      { ...item('c1'), corrections: [{ kind: 'nonMention', start, end, entityId: null }] },
      { ...item('c2'), corrections: [{ kind: 'mention', start, end, entityId: null }] },
    ];
    render(<Panel />);
    const list = await screen.findByRole('list', { name: 'Mentions' });
    const row = (i: number) => within(within(items(list)[i]).getByRole('list', { name: 'Corrections' })).getByRole('listitem').textContent;
    expect(row(0)).toMatch(/“She”mira.*Not a Character$/);
    expect(row(1)).toMatch(/“She”mira.*Not Listed$/);
  });

  it('shows the names the contribution sent, and the id where it sent none (Q71)', async () => {
    queue = [{ ...item('c1'), entityNames: { kessa: 'Kessa Dorne' } }];
    render(<Panel />);
    const list = await screen.findByRole('list', { name: 'Mentions' });
    const correction = within(within(items(list)[0]).getByRole('list', { name: 'Corrections' })).getByRole('listitem');
    expect(correction.textContent).toMatch(/“She”mira.*Kessa Dorne$/);
    expect(correction.textContent).not.toContain('kessa');
  });

  it('reads an entity id that names an object member as the id', async () => {
    queue = [{ ...item('c1'), clusterEntities: ['constructor'], entityNames: { kessa: 'Kessa' } }];
    render(<Panel />);
    const list = await screen.findByRole('list', { name: 'Mentions' });
    expect(within(items(list)[0]).getByText('constructor')).toBeTruthy();
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

  const quoteRow = (id: string, extra: Partial<CorefContribution>): CorefContribution => ({
    ...item(id),
    passage: 'Mira met the courier. “Nod,” she said.',
    ...extra,
  });

  describe('rows from the quote-speaker server', () => {
    // The row passage differs from `passage`, so spans come from it.
    const text = 'Mira met the courier. “Nod,” she said.';
    const span = (piece: string) => ({ start: text.indexOf(piece), end: text.indexOf(piece) + piece.length });
    const fixed = (id: string, extra: Partial<CorefContribution>) => quoteRow(id, {
      clusters: [[[0, 4], [text.indexOf('she'), text.indexOf('she') + 3]]],
      clusterEntities: [null],
      entityNames: { mira: 'Mira Vell' },
      corrections: [{ kind: 'quote', ...span('“Nod,”'), entityId: 'mira' }],
      ...extra,
    });

    it('marks a row that changes no label, and not a row that does', async () => {
      queue = [
        fixed('quiet', { changesLabels: false, derivedLabels: [] }),
        fixed('busy', { changesLabels: true, derivedLabels: [] }),
        { ...item('plain'), changesLabels: true },
      ];
      render(<Panel />);
      const list = await screen.findByRole('list', { name: 'Mentions' });
      const [quiet, busy, plain] = items(list);
      expect(within(quiet).getByText('No label change')).toBeTruthy();
      expect(within(busy).queryByText('No label change')).toBeNull();
      expect(within(plain).queryByText('No label change')).toBeNull();
    });

    it('shows a row without the new fields as before: no mark, no derived list, no shown speaker', async () => {
      queue = [fixed('old', {})];
      render(<Panel />);
      const row = items(await screen.findByRole('list', { name: 'Mentions' }))[0];
      expect(within(row).queryByText('No label change')).toBeNull();
      expect(within(row).queryByRole('list', { name: 'Derived labels' })).toBeNull();
      const correction = within(within(row).getByRole('list', { name: 'Corrections' })).getByRole('listitem');
      expect(correction.textContent).not.toContain('Speech tag');
    });

    it('lists derived labels apart from the corrections', async () => {
      queue = [fixed('d', { changesLabels: true, derivedLabels: [{ ...span('she'), entityId: 'mira', wholeCluster: true }] })];
      render(<Panel />);
      const row = items(await screen.findByRole('list', { name: 'Mentions' }))[0];
      const derived = within(within(row).getByRole('list', { name: 'Derived labels' })).getByRole('listitem');
      expect(derived.textContent).toMatch(/“she”.*Mira Vell.*and its whole cluster/);
      expect(within(within(row).getByRole('list', { name: 'Corrections' })).getAllByRole('listitem')).toHaveLength(1);
    });

    it('shows no whole-cluster note for a span that moved alone', async () => {
      queue = [fixed('d', { changesLabels: true, derivedLabels: [{ ...span('she'), entityId: 'mira', wholeCluster: false }] })];
      render(<Panel />);
      const row = items(await screen.findByRole('list', { name: 'Mentions' }))[0];
      expect(within(row).queryByText('and its whole cluster')).toBeNull();
    });

    it('shows each quote fix with the speaker the player saw and the rule', async () => {
      queue = [fixed('q', {
        changesLabels: true,
        quotes: [{ ...span('“Nod,”'), speakerId: null, rule: 'after-subject-verb', mention: span('she'), firstPerson: [] }],
      })];
      render(<Panel />);
      const row = items(await screen.findByRole('list', { name: 'Mentions' }))[0];
      const correction = within(within(row).getByRole('list', { name: 'Corrections' })).getByRole('listitem');
      expect(correction.textContent).toMatch(/No speaker · Speech tag, name then verb.*Mira Vell$/);
    });

    it('asks with the count first, and rejects only the no-change rows once confirmed', async () => {
      queue = [
        fixed('q1', { changesLabels: false }),
        fixed('q2', { changesLabels: false }),
        fixed('keep', { changesLabels: true }),
      ];
      render(<Panel />);
      await screen.findByRole('list', { name: 'Mentions' });
      fireEvent.click(await screen.findByRole('button', { name: 'Reject 2 With No Label Change' }));

      const dialog = await screen.findByRole('alertdialog');
      expect(within(dialog).getByText('Reject 2 contributions?')).toBeTruthy();
      expect(screen.queryByText('Reject 1 contribution?')).toBeNull();
      expect(decisions('reject-no-change')).toHaveLength(0);

      fireEvent.click(within(dialog).getByRole('button', { name: 'Reject 2' }));
      await waitFor(() => expect(items(screen.getByRole('list', { name: 'Mentions' }))).toHaveLength(1));
      expect(decisions('reject-no-change')).toHaveLength(1);
      expect(screen.queryByRole('button', { name: /With No Label Change/ })).toBeNull();
    });

    it('rejects nothing when the confirmation is canceled', async () => {
      queue = [fixed('q1', { changesLabels: false })];
      render(<Panel />);
      fireEvent.click(await screen.findByRole('button', { name: 'Reject 1 With No Label Change' }));
      fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Keep Them' }));
      await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
      expect(decisions('reject-no-change')).toHaveLength(0);
      expect(items(screen.getByRole('list', { name: 'Mentions' }))).toHaveLength(1);
    });
  });

  it('says so when the queue is empty', async () => {
    queue = [];
    render(<Panel />);
    expect(await screen.findByText('No contributions waiting')).toBeTruthy();
  });
});
