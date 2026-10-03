import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
import { PatreonSection } from '@/components/PatreonSection';
import { AccountPage } from './AccountPage';
import { leaveTo } from '../leaveSite';
import { at, res, resetAccountPage, signIn } from '../test/support';

vi.mock('../leaveSite', () => ({ leaveTo: vi.fn() }));

const ROUTE = '/users/me/patreon';

const NOT_LINKED = { linked: false };
const NO_TIER = { linked: true, tier: null, since: null, showFlair: true };
const SUPPORTER = { linked: true, tier: 'supporter_plus', since: '2025-06-01T00:00:00Z', showFlair: true };

/** Answer each Patreon call on its own. `routes` keys are `METHOD path-after-/users/me/patreon`. */
const patreon = (routes: Record<string, Response>) => {
  vi.mocked(fetch).mockImplementation(async (url, init) => {
    const path = String(url).split(ROUTE)[1];
    const key = `${(init as RequestInit | undefined)?.method ?? 'GET'} ${path ?? ''}`;
    if (path === undefined) return res({ success: true, user: {} });
    if (!(key in routes)) throw new Error(`No stub for ${key}`);
    return routes[key];
  });
};

const ok = (data: unknown) => res({ success: true, data });
const refused = (status: number, code: string, error: string) => res({ success: false, code, error }, false, status);

/** Every Patreon request that went out, as `[method, path, body]`. */
const calls = () => vi.mocked(fetch).mock.calls
  .filter(([url]) => String(url).includes(ROUTE))
  .map(([url, init]) => [
    (init as RequestInit | undefined)?.method ?? 'GET',
    String(url).split(ROUTE)[1],
    (init as RequestInit | undefined)?.body ? JSON.parse(String((init as RequestInit).body)) : undefined,
  ]);

beforeEach(() => {
  resetAccountPage('/account');
  signIn({ username: 'wren_hallow' });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.mocked(leaveTo).mockClear();
});

describe('the Patreon section: not linked', () => {
  it('offers Link Patreon and the Patreon page', async () => {
    patreon({ 'GET ': ok(NOT_LINKED) });
    render(<AccountPage />);

    expect(await screen.findByRole('button', { name: 'Link Patreon' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Become a Supporter' }))
      .toHaveAttribute('href', 'https://www.patreon.com/JakeJamesNSFW');
    expect(screen.queryByRole('button', { name: 'Unlink' })).toBeNull();
  });

  it('asks the server for the approval URL and sends the browser there', async () => {
    patreon({ 'GET ': ok(NOT_LINKED), 'POST /link': ok({ url: 'https://www.patreon.com/oauth2/authorize?x=1' }) });
    render(<AccountPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Link Patreon' }));

    await waitFor(() => expect(leaveTo).toHaveBeenCalledWith('https://www.patreon.com/oauth2/authorize?x=1'));
  });

  it('says so when the link cannot start, and offers it again', async () => {
    patreon({ 'GET ': ok(NOT_LINKED), 'POST /link': refused(503, 'X', 'Patreon linking is not set up on this server') });
    render(<AccountPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Link Patreon' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Patreon linking is not set up on this server');
    expect(leaveTo).not.toHaveBeenCalled();
    expect((screen.getByRole('button', { name: 'Link Patreon' }) as HTMLButtonElement).disabled).toBe(false);
  });
});

describe('the Patreon section: the Supporters wall link', () => {
  it.each([
    ['not linked', NOT_LINKED],
    ['linked with no tier', NO_TIER],
    ['linked with a tier', SUPPORTER],
  ])('points to the wall when %s', async (_state, status) => {
    patreon({ 'GET ': ok(status) });
    render(<AccountPage />);

    expect(await screen.findByRole('link', { name: 'See the Supporters wall' }))
      .toHaveAttribute('href', 'https://formamorph.ai/supporters');
  });
});

describe('the Patreon section: linked with no tier', () => {
  it('says there is no active membership, and offers Unlink and the Patreon page', async () => {
    patreon({ 'GET ': ok(NO_TIER) });
    render(<AccountPage />);

    expect(await screen.findByText('No active membership')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Unlink' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Become a Supporter' })).toBeTruthy();
    expect(screen.queryByRole('checkbox', { name: 'Show Supporter Flair' })).toBeNull();
  });
});

describe('the Patreon section: linked with a tier', () => {
  it('shows the tier, the tenure, and the flair toggle', async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-10-02T12:00:00Z') });
    patreon({ 'GET ': ok(SUPPORTER) });
    render(<AccountPage />);

    expect(await screen.findByText('Supporter+')).toBeTruthy();
    expect(screen.getByText(/Supporting for 1 year, 4 months/)).toBeTruthy();
    expect((screen.getByRole('checkbox', { name: 'Show Supporter Flair' })).getAttribute('aria-checked')).toBe('true');
    expect(screen.queryByRole('link', { name: 'Become a Supporter' })).toBeNull();
    vi.useRealTimers();
  });

  it('shows no tenure when the pledge start is unknown', async () => {
    patreon({ 'GET ': ok({ ...SUPPORTER, since: null }) });
    render(<AccountPage />);

    expect(await screen.findByText('Supporter+')).toBeTruthy();
    expect(screen.queryByText(/Supporting for/)).toBeNull();
  });

  it('saves the toggle through the server and shows the saved state', async () => {
    patreon({ 'GET ': ok(SUPPORTER), 'PATCH ': ok({ ...SUPPORTER, showFlair: false }) });
    render(<AccountPage />);

    fireEvent.click(await screen.findByRole('checkbox', { name: 'Show Supporter Flair' }));

    await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Show Supporter Flair' }).getAttribute('aria-checked')).toBe('false'));
    expect(calls().find(([method]) => method === 'PATCH')).toEqual(['PATCH', '', { showFlair: false }]);
  });

  it('keeps the saved state and says so when the toggle fails', async () => {
    patreon({ 'GET ': ok(SUPPORTER), 'PATCH ': refused(409, 'PATREON_NOT_LINKED', 'Link a Patreon account first.') });
    render(<AccountPage />);

    fireEvent.click(await screen.findByRole('checkbox', { name: 'Show Supporter Flair' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Link a Patreon account first.');
    expect(screen.getByRole('checkbox', { name: 'Show Supporter Flair' }).getAttribute('aria-checked')).toBe('true');
  });

  it('asks before it unlinks, then returns to not linked', async () => {
    patreon({ 'GET ': ok(SUPPORTER), 'DELETE ': ok(NOT_LINKED) });
    render(<AccountPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Unlink' }));
    // Nothing is sent until the dialog confirms.
    expect(calls().some(([method]) => method === 'DELETE')).toBe(false);

    const dialog = await screen.findByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Unlink' }));

    expect(await screen.findByRole('button', { name: 'Link Patreon' })).toBeTruthy();
    expect(screen.queryByText('Supporter+')).toBeNull();
  });

  it('keeps the link when the reader cancels the unlink', async () => {
    patreon({ 'GET ': ok(SUPPORTER) });
    render(<AccountPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Unlink' }));
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Cancel' }));

    expect(calls().some(([method]) => method === 'DELETE')).toBe(false);
    expect(screen.getByText('Supporter+')).toBeTruthy();
  });
});

describe('returning from Patreon', () => {
  it('confirms with the token and the bearer, shows the status, and clears the query', async () => {
    at('/account?patreon=confirm&token=abc123');
    patreon({ 'POST /confirm': ok(SUPPORTER) });
    render(<AccountPage />);

    expect(await screen.findByText('Supporter+')).toBeTruthy();
    expect(calls()).toEqual([['POST', '/confirm', { token: 'abc123' }]]);
    const [, init] = vi.mocked(fetch).mock.calls.find(([url]) => String(url).includes('/confirm'))!;
    expect((init as RequestInit).headers).toMatchObject({ Authorization: 'Bearer tok' });
    expect(window.location.search).toBe('');
    expect(screen.getByRole('status').textContent).toBe('Patreon is linked. You can return to the app.');
  });

  it('keeps the token through sign-in for a signed-out reader', async () => {
    // Resetting signs the reader out.
    resetAccountPage('/account?patreon=confirm&token=abc123');
    render(<AccountPage />);

    await waitFor(() => expect(leaveTo).toHaveBeenCalledWith(
      `/login?next=${encodeURIComponent('/account?patreon=confirm&token=abc123')}`,
    ));
    expect(calls()).toEqual([]);
  });

  it.each([
    ['a refused token', refused(400, 'PATREON_CONFIRM_REFUSED', 'x'), /link request expired/],
    ['a Patreon account held elsewhere', refused(409, 'PATREON_TAKEN', 'x'), /linked to another Formamorph account/],
  ])('says so for %s', async (_name, answer, message) => {
    at('/account?patreon=confirm&token=abc123');
    patreon({ 'POST /confirm': answer });
    render(<AccountPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent(message);
  });

  it('offers Link Patreon again after a refused confirm, because the token is spent', async () => {
    at('/account?patreon=confirm&token=abc123');
    patreon({ 'POST /confirm': refused(400, 'PATREON_CONFIRM_REFUSED', 'x'), 'GET ': ok(NOT_LINKED) });
    render(<AccountPage />);

    expect(await screen.findByRole('button', { name: 'Link Patreon' })).toBeTruthy();
    expect(screen.getByRole('alert')).toHaveTextContent(/link request expired/);
  });

  it('says the request expired when the redirect has no token', async () => {
    at('/account?patreon=confirm');
    patreon({ 'GET ': ok(NOT_LINKED) });
    render(<AccountPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent(/link request expired/);
    expect(calls().map(([method, path]) => `${method} ${path}`)).toEqual(['GET ']);
  });

  it.each([
    ['taken', /linked to another Formamorph account/],
    ['denied', /didn.t approve the request/],
    ['expired', /link request expired/],
    ['failed', /Patreon didn.t answer/],
  ])('says what the %s result means, and reads the status without a confirm', async (result, message) => {
    at(`/account?patreon=${result}`);
    patreon({ 'GET ': ok(NOT_LINKED) });
    render(<AccountPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(await screen.findByRole('button', { name: 'Link Patreon' })).toBeTruthy();
    expect(calls().map(([method, path]) => `${method} ${path}`)).toEqual(['GET ']);
    expect(window.location.search).toBe('');
  });
});

describe('a suspended account', () => {
  it('can read its status but not change it', async () => {
    signIn({ username: 'wren_hallow', status: 'suspended' });
    patreon({ 'GET ': ok(SUPPORTER) });
    render(<AccountPage />);

    expect((await screen.findByRole('button', { name: 'Unlink' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('checkbox', { name: 'Show Supporter Flair' }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('a slow first read', () => {
  it('cannot overwrite a newer read that already answered', async () => {
    let failFirst: (error: Error) => void = () => {};
    let reads = 0;
    vi.mocked(fetch).mockImplementation(async (url) => {
      if (!String(url).includes(ROUTE)) return res({ success: true, user: {} });
      reads += 1;
      // The first read hangs; the focus read answers at once.
      if (reads === 1) return new Promise<Response>((_, reject) => { failFirst = reject; });
      return ok(SUPPORTER);
    });
    render(<PatreonSection openAuthorize={() => {}} refreshOnFocus />);

    fireEvent.focus(window);
    expect(await screen.findByText('Supporter+')).toBeTruthy();

    await act(async () => { failFirst(new Error('offline')); });

    expect(screen.getByText('Supporter+')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Try Again' })).toBeNull();
  });
});
