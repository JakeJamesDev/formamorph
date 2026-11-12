import { render, screen, cleanup, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { UsagePanel } from './UsageTab';
import type { HostedUsageReport } from '@/services/HostedAiAdminService';
import { toastTexts } from '@/test/toastText';
import { seedSampleTierNames } from '@/test/tierNames';

const toastErrorMock = vi.fn();
vi.mock('react-toastify', () => ({ toast: { error: (...args: unknown[]) => toastErrorMock(...args) } }));

const downloads = vi.hoisted(() => [] as { blob: Blob; name: string }[]);
vi.mock('@/lib/downloadBlob', () => ({ downloadBlob: (blob: Blob, name: string) => { downloads.push({ blob, name }); } }));

const promptType = (promptTypeName: string | null, costMicros: number, calls: number) => ({
  promptType: promptTypeName, calls, costMicros, avgPromptTokens: 4000, avgOutputTokens: 100, cachedShare: 0.5,
  firstTokenP50Ms: 1500, tokensPerSecondP50: 50, maxGapP90Ms: 2000, failed: 0,
});

const report = (patch: Partial<HostedUsageReport> = {}): HostedUsageReport => ({
  since: '2026-01-01T00:00:00.000Z',
  week: { since: '2025-12-29T00:00:00.000Z', resetAt: '2026-01-05T00:00:00.000Z' },
  activeUsers: {
    installs: { today: 120, yesterday: 300, month: 400, averageDay: 300 },
    accounts: { today: 1, yesterday: 2, month: 3, averageDay: null },
    builds: [
      { platform: 'web', version: '3.6.2', today: 90, yesterday: 200, month: 250 },
      { platform: 'windows', version: '3.6.2', today: 20, yesterday: 60, month: 100 },
      { platform: 'web', version: '3.6.1', today: 10, yesterday: 40, month: 50 },
    ],
  },
  totals: { calls: 40, turns: 8, accounts: 3, costMicros: 2_000_000, failed: 2, providerMicros: 2_100_000, cachedShare: 0.5 },
  days: [
    { day: '2026-01-01', calls: 30, turns: 6, accounts: 2, costMicros: 1_500_000, providerMicros: 1_600_000, installs: 300 },
    { day: '2026-01-02', calls: 10, turns: 2, accounts: 1, costMicros: 500_000, providerMicros: null, installs: 120 },
  ],
  promptTypes: [promptType('narration', 1_500_000, 10), promptType('choices', 500_000, 30)],
  endings: [{ status: 'ok', calls: 38 }, { status: 'error', calls: 2 }],
  failures: [{ failure: 'status_503', calls: 2 }],
  tiers: [{ tier: 'supporter', entitled: 4, active: 3, turns: 8, costMicros: 2_000_000, topBudgetShare: 0.74 }],
  slowest: [{ startedAt: '2026-01-01T18:44:00.000Z', promptType: 'narration', firstTokenMs: 38_000, maxGapMs: 31_000, tokensPerSecond: 9, status: 'ok', failure: null }],
  heaviest: [{ tier: 'supporter', turns: 5, costMicros: 1_000_000, budgetShare: 0.74 }],
  offer: [{ step: 'offer_shown', count: 100 }, { step: 'see_levels', count: 40 }, { step: 'patreon_click', count: 0 }, { step: 'checklist_finished', count: 0 }],
  reservations: {
    overall: { calls: 3, reserveMicros: 3_000_000, costMicros: 900_000, ratio: 0.3 },
    promptTypes: [{ promptType: 'narration', calls: 3, reserveMicros: 3_000_000, costMicros: 900_000, ratio: 0.3 }],
  },
  clients: [
    { clientVersion: '3.6.2', calls: 30, turns: 6, costMicros: 1_500_000, turnsWithoutNarration: 1 },
    { clientVersion: null, calls: 2, turns: 2, costMicros: 10_000, turnsWithoutNarration: 2 },
  ],
  refusals: {
    days: [],
    tiers: [
      { tier: 'supporter', code: 'budget_exhausted', count: 2, accounts: 1 },
      { tier: null, code: 'not_entitled', count: 5, accounts: 4 },
      { tier: 'supporter_plus', code: 'budget_exhausted', count: 4, accounts: 1 },
    ],
    budgetExhaustedAccounts: 2,
  },
  ...patch,
});

const mount = async (value = report()) => {
  const api = { fetchUsageReport: vi.fn(async () => value) };
  render(<UsagePanel active api={api} />);
  await screen.findByRole('table', { name: 'Per Day' });
  return api;
};

const rowsOf = (name: string) => {
  const table = screen.getByRole('table', { name });
  return within(table).getAllByRole('row').slice(1).map((row) => within(row).getAllByRole('cell', { hidden: false }).map((cell) => cell.textContent));
};
const open = (user: ReturnType<typeof userEvent.setup>, section: string) => user.click(screen.getByRole('tab', { name: section }));
const rowHeaders = (name: string) => within(screen.getByRole('table', { name })).getAllByRole('rowheader').map((cell) => cell.textContent);

beforeEach(() => {
  seedSampleTierNames();
  toastErrorMock.mockClear();
  downloads.length = 0;
});

afterEach(cleanup);

describe('the figures', () => {
  it('leads with the range totals', async () => {
    await mount();

    // The tiles come first; a table further down can share a label.
    const tile = (label: string) => screen.getAllByText(label)[0].parentElement?.textContent;
    expect(tile('Spend')).toContain('$2.00');
    expect(tile('Spend')).toContain('$2.10 Provider');
    expect(tile('Cost Per Turn')).toContain('$0.2500');
    expect(tile('Cost Per Turn')).toContain('5.0 Calls Per Turn');
    expect(tile('Failed Calls')).toContain('5%');
    expect(tile('AI Users')).toContain('4 Entitled');
  });

  it('lists each day newest first, with a dash where the provider has not been read', async () => {
    await mount();

    expect(rowHeaders('Per Day')).toEqual(['2026-01-02 (So Far)', '2026-01-01']);
    expect(rowsOf('Per Day')).toEqual([
      ['10', '2', '1', '120', '<1%', '$0.5000', '—'],
      ['30', '6', '2', '300', '<1%', '$1.50', '$1.60'],
    ]);
  });

  it('shows a dash, not a zero, for the installs of a day before counting began', async () => {
    const user = userEvent.setup();
    const [first, second] = report().days;
    await mount(report({ days: [{ ...first, installs: null }, { ...second, accounts: 30 }] }));

    expect(rowsOf('Per Day').map((row) => [row[3], row[4]])).toEqual([['120', '25%'], ['—', '—']]);

    await user.click(screen.getByRole('radio', { name: 'Active Installs' }));
    fireEvent.pointerEnter(document.querySelector('[data-day="2026-01-01"]') as HTMLElement);
    expect(screen.getByText('Jan 1: Not Counted')).toBeTruthy();
  });

  it('draws the day still in progress fainter than a full day, and no other day', async () => {
    await mount();

    const column = (day: string) => document.querySelector(`[data-day="${day}"]`) as HTMLElement;
    expect(column('2026-01-02').dataset.partial).toBe('true');
    expect(column('2026-01-02').firstElementChild?.classList.contains('opacity-40')).toBe(true);
    expect(column('2026-01-01').dataset.partial).toBeUndefined();
    expect(column('2026-01-01').firstElementChild?.classList.contains('opacity-40')).toBe(false);
  });

  it('says a charted day under the pointer, and the latest day otherwise', async () => {
    await mount();

    expect(screen.getByText('Jan 2 So Far: $0.5000 Recorded, Provider Not Read Yet')).toBeTruthy();

    const column = document.querySelector('[data-day="2026-01-01"]') as HTMLElement;
    fireEvent.pointerEnter(column);
    expect(screen.getByText('Jan 1: $1.50 Recorded, $1.60 Provider')).toBeTruthy();

    fireEvent.pointerLeave(column.parentElement as HTMLElement);
    expect(screen.getByText('Jan 2 So Far: $0.5000 Recorded, Provider Not Read Yet')).toBeTruthy();
  });

  it('draws the Provider tick only where the provider has a figure', async () => {
    await mount();

    const ticks = (day: string) => document.querySelector(`[data-day="${day}"]`)?.querySelectorAll('.bg-muted-foreground').length;
    expect(ticks('2026-01-01')).toBe(1);
    expect(ticks('2026-01-02')).toBe(0);
  });

  it('shows daily and monthly active installs and accounts, with the daily share of the month', async () => {
    await mount();

    expect(rowHeaders('Active Users')).toEqual(['Active Installs', 'Formamorph AI Users', 'AI Share Of Installs']);
    expect(rowsOf('Active Users')).toEqual([
      ['120', '300', '400', '300.0', '75%'],
      ['1', '2', '3', '—', '—'],
      ['<1%', '<1%', '<1%', '—', '—'],
    ]);
  });

  it('gives Formamorph AI users as a share of active installs, with a dash where no install is counted', async () => {
    const { builds } = report().activeUsers;
    await mount(report({ activeUsers: {
      installs: { today: 0, yesterday: 200, month: 400, averageDay: 200 },
      accounts: { today: 3, yesterday: 50, month: 60, averageDay: 40 },
      builds,
    } }));

    expect(rowsOf('Active Users')[2]).toEqual(['—', '25%', '15%', '—', '—']);
  });

  it('breaks active installs down by platform and by build', async () => {
    const user = userEvent.setup();
    await mount();
    await open(user, 'Clients And Offer');

    const platforms = screen.getByRole('group', { name: 'Active Installs This Month' });
    expect(within(platforms).getAllByText(/^(Web|Windows)$/).map((node) => node.textContent)).toEqual(['Web', 'Windows']);
    expect(within(platforms).getByText('300 (75%)')).toBeTruthy();
    expect(within(platforms).getByText('100 (25%)')).toBeTruthy();
    expect(rowsOf('Active Installs By Build')).toEqual([
      ['3.6.2', '90', '200', '250'],
      ['3.6.2', '20', '60', '100'],
      ['3.6.1', '10', '40', '50'],
    ]);
  });

  it('says so when no install is counted this month', async () => {
    const user = userEvent.setup();
    await mount(report({ activeUsers: { ...report().activeUsers, builds: [] } }));
    await open(user, 'Clients And Offer');

    expect(screen.getByText('No active installs counted this month')).toBeTruthy();
    expect(screen.queryByRole('table', { name: 'Active Installs By Build' })).toBeNull();
  });

  it('charts the figure the reader picks', async () => {
    const user = userEvent.setup();
    await mount();

    await user.click(screen.getByRole('radio', { name: 'Active Installs' }));

    expect(screen.getByText('Jan 2 So Far: 120 Active Installs')).toBeTruthy();
  });

  it('shows one offer row per source, each count with its rate to the step before', async () => {
    const user = userEvent.setup();
    await mount(report({
      offer: [
        { step: 'setup_offer_shown', count: 200 }, { step: 'setup_see_levels', count: 20 }, { step: 'setup_patreon_click', count: 5 },
        { step: 'engine_offer_shown', count: 30 }, { step: 'notice_see_levels', count: 8 }, { step: 'notice_patreon_click', count: 2 },
        { step: 'locked_see_levels', count: 4 }, { step: 'locked_patreon_click', count: 1 }, { step: 'locked_checklist_finished', count: 1 },
      ],
    }));
    await open(user, 'Clients And Offer');

    expect(rowHeaders('Offer Steps')).toEqual(['AI Setup', 'Demo AI Card', 'Built-In Engine Card', 'Demo AI Notice', 'Locked Preset Panel', 'Older Builds']);
    expect(rowsOf('Offer Steps')).toEqual([
      ['200', '20 (10%)', '5 (25%)', '0 (0%)'],
      ['0', '0 (—)', '0 (—)', '0 (—)'],
      ['30', '0 (0%)', '0 (—)', '0 (—)'],
      ['—', '8', '2 (25%)', '0 (0%)'],
      ['—', '4', '1 (25%)', '1 (100%)'],
      ['0', '0 (—)', '0 (—)', '0 (—)'],
    ]);
  });

  it('reads the source-less step names into the Older Builds row', async () => {
    const user = userEvent.setup();
    await mount();
    await open(user, 'Clients And Offer');

    expect(rowsOf('Offer Steps')[5]).toEqual(['100', '40 (40%)', '0 (0%)', '0 (—)']);
  });

  it('names a failure cause and a tier, and never an account', async () => {
    const user = userEvent.setup();
    await mount();

    await open(user, 'Performance');
    expect(screen.getByText('Provider Error 503')).toBeTruthy();

    await open(user, 'Accounts');
    expect(rowsOf('Heaviest Accounts')[0]).toEqual([expect.any(String), '5', '$1.00', '74%']);
    expect(rowHeaders('Heaviest Accounts')).toEqual(['1']);
  });
});

describe('the sections', () => {
  it('shows the budget week in place of the range on Accounts, and brings the range back after', async () => {
    const user = userEvent.setup();
    await mount();

    await open(user, 'Accounts');
    expect(screen.getByText('Budget Week Dec 29 To Jan 5')).toBeTruthy();
    expect(screen.queryByRole('radiogroup', { name: 'Range' })).toBeNull();

    await open(user, 'Overview');
    expect(screen.getByRole('radiogroup', { name: 'Range' })).toBeTruthy();
  });

  it('sums refusals per code across tiers, most first, with the accounts that used up their budget', async () => {
    const user = userEvent.setup();
    await mount();
    await open(user, 'Performance');

    const refusals = screen.getByRole('group', { name: 'Refusals' });
    expect(within(refusals).getAllByText(/Budget Used Up|Not Entitled/).map((node) => node.textContent)).toEqual(['Budget Used Up', 'Not Entitled']);
    expect(within(refusals).getByText('6')).toBeTruthy();
    expect(within(refusals).getByText('2 Accounts Used Up Their Budget')).toBeTruthy();
  });

  it('lists reservations per type with a row for all types', async () => {
    const user = userEvent.setup();
    await mount();
    await open(user, 'Performance');

    expect(rowHeaders('Reservations')).toEqual(['Narration', 'All Types']);
    expect(rowsOf('Reservations')[1]).toEqual(['3', '$3.00', '$0.9000', '30%']);
  });

  it('lists each client version, and a call with no header under its own name', async () => {
    const user = userEvent.setup();
    await mount();
    await open(user, 'Clients And Offer');

    expect(rowHeaders('Client Versions')).toEqual(['3.6.2', 'No Header']);
    expect(rowsOf('Client Versions')[1]).toEqual(['2', '2', '$0.0100', '2']);
  });
});

describe('the prompt type table', () => {
  it('opens costliest first, and sorts by the column the reader picks', async () => {
    const user = userEvent.setup();
    await mount();
    await open(user, 'Performance');

    expect(rowHeaders('Prompt Types')).toEqual(['Narration', 'Choices']);

    await user.click(screen.getByRole('button', { name: 'Sort by Calls' }));
    expect(rowHeaders('Prompt Types')).toEqual(['Choices', 'Narration']);

    await user.click(screen.getByRole('button', { name: 'Sort by Calls' }));
    expect(rowHeaders('Prompt Types')).toEqual(['Narration', 'Choices']);

    await user.click(screen.getByRole('button', { name: 'Sort by Type' }));
    expect(rowHeaders('Prompt Types')).toEqual(['Choices', 'Narration']);
  });
});

describe('the range', () => {
  it('reads 14 days first and reads again when the range changes', async () => {
    const user = userEvent.setup();
    const api = await mount();

    expect(api.fetchUsageReport).toHaveBeenCalledWith(14);

    await user.click(screen.getAllByRole('radio', { name: '30 Days' })[0]);
    await waitFor(() => expect(api.fetchUsageReport).toHaveBeenCalledWith(30));
  });

  it('ignores a slower answer for a range the reader has left', async () => {
    const user = userEvent.setup();
    let finishSlow: (value: HostedUsageReport) => void = () => {};
    const fetchUsageReport = vi.fn((days: number) => (days === 14
      ? new Promise<HostedUsageReport>((resolve) => { finishSlow = resolve; })
      : Promise.resolve(report({ totals: { ...report().totals, costMicros: 7_000_000 } }))));
    render(<UsagePanel active api={{ fetchUsageReport }} />);

    await user.click(screen.getAllByRole('radio', { name: '30 Days' })[0]);
    await screen.findByText('$7.00');

    finishSlow(report({ totals: { ...report().totals, costMicros: 9_000_000 } }));
    await new Promise((resolve) => { setTimeout(resolve, 0); });

    expect(screen.queryByText('$9.00')).toBeNull();
    expect(screen.getByText('$7.00')).toBeTruthy();
  });

  it('reads nothing while the tab is not on screen', () => {
    const fetchUsageReport = vi.fn(async () => report());
    render(<UsagePanel active={false} api={{ fetchUsageReport }} />);

    expect(fetchUsageReport).not.toHaveBeenCalled();
  });
});

describe('the exports', () => {
  it('saves each table as its own file, named for the range', async () => {
    const user = userEvent.setup();
    await mount();

    await user.click(screen.getByRole('button', { name: 'Export Per Day As CSV' }));
    await open(user, 'Performance');
    await user.click(screen.getByRole('button', { name: 'Export Prompt Types As CSV' }));

    expect(downloads.map((entry) => entry.name)).toEqual(['usage-days-14.csv', 'usage-prompt-types-14.csv']);
    expect(await downloads[0].blob.text()).toContain('2026-01-01,30,6,2,300,1.5,1.6');
    expect(await downloads[1].blob.text()).toContain('Narration,10,1.5,');
  });
});

describe('an empty or failed read', () => {
  it('says so in each section rather than drawing empty tables', async () => {
    const user = userEvent.setup();
    await mount(report({
      totals: { calls: 0, turns: 0, accounts: 0, costMicros: 0, failed: 0, providerMicros: 0, cachedShare: null },
      promptTypes: [], endings: [], failures: [], slowest: [], heaviest: [],
      offer: [{ step: 'offer_shown', count: 0 }],
      reservations: { overall: { calls: 0, reserveMicros: 0, costMicros: 0, ratio: null }, promptTypes: [] },
      clients: [],
      refusals: { days: [], tiers: [], budgetExhaustedAccounts: 0 },
    }));

    await open(user, 'Performance');
    expect(screen.getByText('No failures in this range')).toBeTruthy();
    expect(screen.getByText('No timed calls in this range')).toBeTruthy();
    expect(screen.getByText('No settled calls in this range')).toBeTruthy();
    expect(screen.getByText('No refusals in this range')).toBeTruthy();
    expect(screen.queryByRole('table', { name: 'Prompt Types' })).toBeNull();

    await open(user, 'Accounts');
    expect(screen.getByText('No calls this week')).toBeTruthy();

    await open(user, 'Clients And Offer');
    expect(screen.getByText('No offer steps in this range')).toBeTruthy();
    expect(screen.getByText('No versioned calls in this range')).toBeTruthy();
  });

  it('reports a read that fails', async () => {
    const fetchUsageReport = vi.fn(async () => { throw new Error('refused'); });
    render(<UsagePanel active api={{ fetchUsageReport }} />);

    expect(await screen.findByText('The usage report could not be read')).toBeTruthy();
    expect(toastTexts(toastErrorMock).join(' ')).toContain('refused');
  });
});
