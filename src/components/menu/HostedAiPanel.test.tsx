import { render, screen, cleanup, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { HostedAiPanel } from './HostedAiPanel';
import type { HostedAiAdminApi, HostedAiSettings, HostedGrant } from '@/services/HostedAiAdminService';
import { toastTexts } from '@/test/toastText';

const toastErrorMock = vi.fn();
vi.mock('react-toastify', () => ({ toast: { error: (...args: unknown[]) => toastErrorMock(...args) } }));

const settings = (): HostedAiSettings => ({
  models: [
    { id: 'alpha', model: 'vendor/alpha', prices: { prompt: 1, completion: 2 }, capabilities: { tools: true, reasoning: 'openai' } },
    { id: 'beta', model: 'vendor/beta', prices: { prompt: 1, completion: 2 }, capabilities: { tools: false, reasoning: null } },
  ],
  activeModel: 'alpha',
  tiers: { supporter: { window: 1000, budget: 1, turnCost: 0.5 } },
  maxTokensCap: 100, idleLimitSeconds: 30, tokenRatio: 3, tokenMargin: 10, turnLimitSeconds: 600, turnCallCap: 20,
  retentionDays: 30, warnThresholds: [75, 90], turnSample: { recent: 20, min: 3 }, parallelLimit: 4, perMinuteLimit: 20,
  dailyCeiling: 10, balanceThreshold: 5,
});

const grant = (over: Partial<HostedGrant> = {}): HostedGrant => ({
  id: 7, userId: 'u7', username: 'tester', tier: 'supporter', endsAt: '2099-01-01T23:59:59.000Z',
  createdAt: '2026-01-01T00:00:00.000Z', revokedAt: null, subject: 'grant:7', ...over,
});

let api: { [K in keyof HostedAiAdminApi]: ReturnType<typeof vi.fn> };

beforeEach(() => {
  toastErrorMock.mockClear();
  api = {
    fetchSettings: vi.fn(async () => settings()),
    saveSettings: vi.fn(async (value: HostedAiSettings) => value),
    listGrants: vi.fn(async () => [grant()]),
    createGrant: vi.fn(async (input) => grant({ id: 8, userId: input.userId, username: input.userId, tier: input.tier, endsAt: input.endsAt })),
    revokeGrant: vi.fn(async () => grant({ revokedAt: '2026-02-01T00:00:00.000Z' })),
    fetchPause: vi.fn(async () => ({ paused: true, pausedAt: '2026-01-01T09:30:00.000Z', liftedAt: null, until: '2026-01-02T00:00:00.000Z' })),
    liftPause: vi.fn(async () => ({ paused: false, pausedAt: '2026-01-01T09:30:00.000Z', liftedAt: '2026-01-01T10:00:00.000Z', until: '2026-01-02T00:00:00.000Z' })),
    fetchSpendReport: vi.fn(async () => [
      { day: '2026-01-01', calls: 12, costMicros: 1_500_000, providerMicros: 1_600_000 },
      { day: '2026-01-02', calls: 3, costMicros: 250_000, providerMicros: null },
    ]),
  };
});

afterEach(cleanup);

const mount = async () => {
  render(<HostedAiPanel active api={api as unknown as HostedAiAdminApi} />);
  await screen.findByRole('button', { name: 'Save Settings' });
};

/** The value the last save sent. */
const saved = () => api.saveSettings.mock.calls.at(-1)![0] as HostedAiSettings;

describe('reading', () => {
  it('asks for nothing while the tab is not on screen', () => {
    render(<HostedAiPanel active={false} api={api as unknown as HostedAiAdminApi} />);

    expect(api.fetchSettings).not.toHaveBeenCalled();
    expect(api.listGrants).not.toHaveBeenCalled();
  });

  it('shows no form when the settings cannot be read', async () => {
    api.fetchSettings.mockRejectedValueOnce(new Error('Only an admin can read this setting'));

    render(<HostedAiPanel active api={api as unknown as HostedAiAdminApi} />);

    await waitFor(() => expect(toastTexts(toastErrorMock)).toContain('Only an admin can read this settingView Details →'));
    expect(screen.queryByRole('button', { name: 'Save Settings' })).toBeNull();
  });
});

describe('tier and limit settings', () => {
  it('keeps Save off until something changes', async () => {
    await mount();

    expect((screen.getByRole('button', { name: 'Save Settings' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('saves an edited tier window and a global limit through the settings route', async () => {
    await mount();

    fireEvent.change(screen.getByLabelText('Supporter Window'), { target: { value: '2000' } });
    fireEvent.change(screen.getByLabelText('Daily Ceiling'), { target: { value: '12.5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Settings' }));

    await waitFor(() => expect(api.saveSettings).toHaveBeenCalledTimes(1));
    expect(saved().tiers.supporter?.window).toBe(2000);
    expect(saved().dailyCeiling).toBe(12.5);
    expect(saved().tiers.supporter?.budget).toBe(1);
  });

  it('refuses a tier with a budget and no window instead of sending a window of zero', async () => {
    await mount();

    fireEvent.change(screen.getByLabelText('Supporter+ Budget'), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Settings' }));

    expect((await screen.findByRole('alert')).textContent).toBe('Set a window for Supporter+');
    expect(api.saveSettings).not.toHaveBeenCalled();
  });

  it('shows the server’s refusal and keeps the edit', async () => {
    api.saveSettings.mockRejectedValueOnce(new Error('dailyCeiling must be above zero'));
    await mount();

    fireEvent.change(screen.getByLabelText('Daily Ceiling'), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Settings' }));

    expect((await screen.findByRole('alert')).textContent).toContain('dailyCeiling must be above zero');
    expect((screen.getByLabelText('Daily Ceiling') as HTMLInputElement).value).toBe('0');
  });
});

describe('approved models', () => {
  it('disables Remove on the active entry only', async () => {
    await mount();

    expect((screen.getByRole('button', { name: 'Remove alpha' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Remove beta' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('removes an entry that is not active', async () => {
    await mount();

    fireEvent.click(screen.getByRole('button', { name: 'Remove beta' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save Settings' }));

    await waitFor(() => expect(api.saveSettings).toHaveBeenCalled());
    expect(saved().models.map((entry) => entry.id)).toEqual(['alpha']);
  });

  it('adds a model with its prices and capability record in the client’s shape', async () => {
    await mount();

    fireEvent.click(screen.getByRole('button', { name: 'Add Model' }));
    fireEvent.change(screen.getByLabelText('Model Id'), { target: { value: 'gamma' } });
    fireEvent.change(screen.getByLabelText('Upstream Model'), { target: { value: 'vendor/gamma' } });
    fireEvent.change(screen.getByLabelText('Prompt Price'), { target: { value: '3' } });
    fireEvent.change(screen.getByLabelText('Completion Price'), { target: { value: '4' } });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Tools' }));
    fireEvent.change(screen.getByLabelText('Efforts'), { target: { value: 'low, high' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Model' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save Settings' }));

    await waitFor(() => expect(api.saveSettings).toHaveBeenCalled());
    const added = saved().models.find((entry) => entry.id === 'gamma');
    expect(added).toEqual({
      id: 'gamma', model: 'vendor/gamma', routing: null, reasoning: null,
      prices: { prompt: 3, completion: 4 },
      capabilities: { tools: true, reasoning: null, efforts: ['low', 'high'] },
    });
    expect(saved().activeModel).toBe('alpha');
  });

  it('edits an entry in place', async () => {
    await mount();

    fireEvent.click(screen.getByRole('button', { name: 'Edit beta' }));
    fireEvent.change(screen.getByLabelText('Upstream Model'), { target: { value: 'vendor/beta-2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Model' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save Settings' }));

    await waitFor(() => expect(api.saveSettings).toHaveBeenCalled());
    expect(saved().models.map((entry) => entry.model)).toEqual(['vendor/alpha', 'vendor/beta-2']);
  });

  it('refuses routing text that is not a JSON object, and says so', async () => {
    await mount();

    fireEvent.click(screen.getByRole('button', { name: 'Add Model' }));
    fireEvent.change(screen.getByLabelText('Model Id'), { target: { value: 'gamma' } });
    fireEvent.change(screen.getByLabelText('Upstream Model'), { target: { value: 'vendor/gamma' } });
    fireEvent.change(screen.getByLabelText('Routing'), { target: { value: '[1]' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Model' }));

    expect((await screen.findByRole('alert')).textContent).toContain('Routing');
    expect((screen.getByRole('button', { name: 'Save Settings' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('refuses a duplicate id', async () => {
    await mount();

    fireEvent.click(screen.getByRole('button', { name: 'Add Model' }));
    fireEvent.change(screen.getByLabelText('Model Id'), { target: { value: 'beta' } });
    fireEvent.change(screen.getByLabelText('Upstream Model'), { target: { value: 'vendor/x' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Model' }));

    expect((await screen.findByRole('alert')).textContent).toContain('unique');
  });

  it('sets the active model from the picker, then allows removing the old one', async () => {
    const user = userEvent.setup();
    await mount();

    await user.click(screen.getByRole('combobox', { name: 'Active Model' }));
    await user.click(await screen.findByRole('option', { name: 'beta' }));

    expect((screen.getByRole('button', { name: 'Remove alpha' }) as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByRole('button', { name: 'Remove beta' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Save Settings' }));
    await waitFor(() => expect(api.saveSettings).toHaveBeenCalled());
    expect(saved().activeModel).toBe('beta');
  });

  it('offers only the client’s reasoning dialects, not free text', async () => {
    const user = userEvent.setup();
    await mount();

    fireEvent.click(screen.getByRole('button', { name: 'Add Model' }));
    await user.click(screen.getByRole('combobox', { name: 'Reasoning' }));

    const names = (await screen.findAllByRole('option')).map((option) => option.textContent);
    expect(names).toContain('openai');
    expect(names).toContain('None');
    expect(names).not.toContain('unknown');
  });
});

describe('grants', () => {
  it('lists grants and creates one with a tier and an end date', async () => {
    await mount();
    expect(await screen.findByText(/tester · Supporter · Ends 2099-01-01/)).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Account Id'), { target: { value: 'u9' } });
    fireEvent.change(screen.getByLabelText('Ends On'), { target: { value: '2099-06-30' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Grant' }));

    await waitFor(() => expect(api.createGrant).toHaveBeenCalledWith({ userId: 'u9', tier: 'supporter', endsAt: '2099-06-30T23:59:59.000Z' }));
    expect(await screen.findByText(/u9 · Supporter · Ends 2099-06-30/)).toBeTruthy();
  });

  it('keeps Create Grant off until the account and date are given', async () => {
    await mount();

    expect((screen.getByRole('button', { name: 'Create Grant' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('revokes a live grant and then offers no second revoke', async () => {
    await mount();

    fireEvent.click(await screen.findByRole('button', { name: 'Revoke grant for tester' }));

    await waitFor(() => expect(api.revokeGrant).toHaveBeenCalledWith(7));
    expect(await screen.findByText(/tester · Supporter · Revoked/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Revoke grant for tester' })).toBeNull();
  });

  it('reports a refused grant', async () => {
    api.createGrant.mockRejectedValueOnce(new Error('userId must name an account'));
    await mount();

    fireEvent.change(screen.getByLabelText('Account Id'), { target: { value: 'nobody' } });
    fireEvent.change(screen.getByLabelText('Ends On'), { target: { value: '2099-06-30' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Grant' }));

    await waitFor(() => expect(toastTexts(toastErrorMock)).toContain('userId must name an accountView Details →'));
  });
});

describe('the pause', () => {
  it('shows a pause and lifts it', async () => {
    await mount();
    expect(await screen.findByText(/Paused since 09:30 UTC/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Lift Pause' }));

    await waitFor(() => expect(api.liftPause).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('Lifted for today')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Lift Pause' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('offers no lift when nothing is paused', async () => {
    api.fetchPause.mockResolvedValueOnce({ paused: false, pausedAt: null, liftedAt: null, until: null });
    await mount();

    expect(await screen.findByText('Running')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Lift Pause' }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('the spend report', () => {
  it('shows recorded and provider spend per day, and a dash where the provider has none', async () => {
    await mount();

    const table = await screen.findByRole('table');
    const rows = within(table).getAllByRole('row').slice(1).map((row) => within(row).getAllByRole('cell').map((cell) => cell.textContent));
    expect(rows).toEqual([
      ['2026-01-01', '12', '$1.50', '$1.60'],
      ['2026-01-02', '3', '$0.25', '—'],
    ]);
  });
});
