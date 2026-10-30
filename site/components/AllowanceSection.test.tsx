import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AccountPage } from '../pages/AccountPage';
import { res, resetAccountPage, signIn } from '../test/support';
import { AllowanceSection } from './AllowanceSection';

vi.mock('../leaveSite', () => ({ leaveTo: vi.fn() }));

const ROUTE = '/hosted-ai/state';
const PATREON_URL = 'https://www.patreon.com/JakeJamesNSFW';

const READY = {
  tier: 'supporter_plus',
  state: 'ready',
  percentUsed: 42,
  turnsLeft: 118,
  resetAt: '2026-11-01T00:00:00.000Z',
};

/** Answer the hosted-state route with `response`; every other route gets an empty user. */
const hostedState = (response: Response | Error) => {
  vi.mocked(fetch).mockImplementation(async (url) => {
    if (!String(url).includes(ROUTE)) return res({ success: true, user: {} });
    if (response instanceof Error) throw response;
    return response;
  });
};

const ok = (data: unknown) => res({ success: true, data });

beforeEach(() => {
  resetAccountPage('/account');
  signIn({ username: 'wren_hallow' });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('the allowance section: an entitled account', () => {
  it('shows the tier, percent used, turns left and the reset date', async () => {
    hostedState(ok(READY));
    render(<AllowanceSection />);

    expect(await screen.findByText('Supporter+')).toBeTruthy();
    expect(screen.getByText('42%')).toBeTruthy();
    expect(screen.getByText('About 118')).toBeTruthy();
    expect(screen.getByText('November 1')).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Join on Patreon' })).toBeNull();
  });

  it('leaves out the turns line when the server has no estimate', async () => {
    hostedState(ok({ ...READY, state: 'warned', turnsLeft: null }));
    render(<AllowanceSection />);

    expect(await screen.findByText('42%')).toBeTruthy();
    expect(screen.queryByText('Turns left')).toBeNull();
  });

  it('keeps the percent inside 0 to 100', async () => {
    hostedState(ok({ ...READY, percentUsed: 412 }));
    render(<AllowanceSection />);

    expect(await screen.findByText('100%')).toBeTruthy();
  });

  it('shows the reset date and an upgrade link when the allowance is used up', async () => {
    hostedState(ok({ ...READY, state: 'exhausted', percentUsed: 100, turnsLeft: 0 }));
    render(<AllowanceSection />);

    expect(await screen.findByText(/It comes back on November 1/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Upgrade on Patreon' })).toHaveAttribute('href', PATREON_URL);
  });

  it('keeps the figures under the message when the day is paused by the spend ceiling', async () => {
    hostedState(ok({ ...READY, state: 'paused' }));
    render(<AllowanceSection />);

    expect(await screen.findByText('Formamorph AI is paused. Try again later.')).toBeTruthy();
    expect(screen.getByText('42%')).toBeTruthy();
  });

  it.each([
    ['paused', 'Formamorph AI is paused. Try again later.'],
    ['age-gate', 'Confirm your age to use Formamorph AI.'],
  ])('says what the %s state means', async (state, text) => {
    hostedState(ok({ tier: 'supporter', state, percentUsed: null, turnsLeft: null, resetAt: null }));
    render(<AllowanceSection />);

    expect(await screen.findByText(text)).toBeTruthy();
  });
});

describe('the allowance section: an account without access', () => {
  it('shows the Patreon line and link', async () => {
    hostedState(ok({ tier: null, state: 'locked', percentUsed: null, turnsLeft: null, resetAt: null }));
    render(<AllowanceSection />);

    expect(await screen.findByText(/Formamorph AI gives Supporters hosted AI/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Join on Patreon' })).toHaveAttribute('href', PATREON_URL);
    expect(screen.queryByText('Used')).toBeNull();
  });
});

describe('the allowance section: a failed read', () => {
  it.each([
    ['a network failure', new Error('offline')],
    ['a refusal', res({ success: false, code: 'CLIENT_UPDATE_REQUIRED', error: 'x' }, false, 426)],
    ['an unknown state', ok({ ...READY, state: 'surprise' })],
    ['an empty answer', res({ success: true })],
  ])('says so after %s, and shows no numbers', async (_name, answer) => {
    hostedState(answer);
    render(<AllowanceSection />);

    expect(await screen.findByText('Couldn’t load your Formamorph AI allowance.')).toBeTruthy();
    expect(screen.queryByText('Used')).toBeNull();
  });
});

describe('the account page', () => {
  it('reads the hosted state with the bearer and shows the allowance under Formamorph AI', async () => {
    hostedState(ok(READY));
    render(<AccountPage />);

    expect(await screen.findByRole('heading', { name: 'Formamorph AI' })).toBeTruthy();
    expect(await screen.findByText('42%')).toBeTruthy();
    const [, init] = vi.mocked(fetch).mock.calls.find(([url]) => String(url).includes(ROUTE))!;
    expect((init as RequestInit).headers).toMatchObject({ Authorization: 'Bearer tok' });
  });
});
