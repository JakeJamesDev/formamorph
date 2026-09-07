import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AGE_GATE_VERSION } from '@/lib/ageGate';
import AuthService from '@/services/AuthService';
import { ProfilePage } from './ProfilePage';
import { leaveTo } from '../leaveSite';
import { res, resetAccountPage, signIn } from '../test/support';

// jsdom implements no navigation, so where a declined gate sent the reader is only observable here.
vi.mock('../leaveSite', () => ({ leaveTo: vi.fn() }));

/** The record the app writes when a player accepts the gate inside `/play/`. */
const alreadyAttested = () => localStorage.setItem('FORMAMORPH_ageGate', JSON.stringify({
  accepted: true,
  acceptanceVersion: AGE_GATE_VERSION,
  acceptedAt: '2026-01-01T00:00:00.000Z',
}));

const adoptAccountFromAnotherTab = (username: string, token = 'second-token') => {
  localStorage.setItem(AuthService.tokenKey, token);
  localStorage.setItem(AuthService.userKey, JSON.stringify({ username }));
  window.dispatchEvent(new StorageEvent('storage', { key: AuthService.tokenKey, newValue: token }));
};

const PROFILE = {
  id: 'u1',
  username: 'wren_hallow',
  avatarUrl: null,
  createdAt: '2026-01-02T00:00:00.000Z',
  role: 'normal',
  followers: 3,
  likes: 41,
  downloads: 108,
};

/**
 * Answer the two calls a profile makes: the profile itself, then their listings.
 *
 * @param profile - The profile body, or null for the 404 an unknown *and* a suspended name both get
 */
const serverHas = (profile: unknown | null) => {
  vi.mocked(fetch).mockImplementation((input) => {
    const url = String(input);
    if (url.includes('/by-username/')) {
      return Promise.resolve(profile
        ? res({ success: true, data: profile })
        : res({ success: false, error: 'User not found' }, false, 404));
    }

    return Promise.resolve(res({ success: true, data: [] }));
  });
};

beforeEach(() => resetAccountPage('/u/wren_hallow'));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.mocked(leaveTo).mockClear();
});

describe('the age gate in front of a profile', () => {
  it('holds the warning and profile while restoring a current account answer', async () => {
    signIn({ username: 'signed-in-reader' });
    let resolveAcceptance: (response: Response) => void = () => {};
    const acceptance = new Promise<Response>((resolve) => { resolveAcceptance = resolve; });
    serverHas(PROFILE);
    const existingFetch = vi.mocked(fetch).getMockImplementation();
    vi.mocked(fetch).mockImplementation((input, init) => String(input).includes('/policies/age-gate')
      ? acceptance
      : existingFetch!(input, init));

    render(<ProfilePage username="wren_hallow" />);

    await waitFor(() => expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/policies/age-gate'),
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer tok' }) }),
    ));
    expect(screen.queryByText('Adult Content Ahead')).not.toBeInTheDocument();
    expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).includes('/by-username/'))).toBe(false);

    await act(async () => resolveAcceptance(res({
      success: true,
      accepted: true,
      requiredVersion: AGE_GATE_VERSION,
      acceptedAt: '2026-09-06T12:00:00.000Z',
    })));

    expect(await screen.findByRole('heading', { name: 'wren_hallow' })).toBeInTheDocument();
    expect(screen.queryByText('Adult Content Ahead')).not.toBeInTheDocument();
  });

  it('keeps a failed account write pending and retries before opening the profile', async () => {
    signIn({ username: 'signed-in-reader' });
    let writes = 0;
    serverHas(PROFILE);
    const existingFetch = vi.mocked(fetch).getMockImplementation();
    vi.mocked(fetch).mockImplementation((input, init) => {
      const url = String(input);
      if (url.endsWith('/policies/age-gate')) {
        return Promise.resolve(res({
          success: true, accepted: false, requiredVersion: AGE_GATE_VERSION, acceptedAt: null,
        }));
      }
      if (url.endsWith('/policies/age-gate/accept')) {
        writes += 1;
        return Promise.resolve(writes === 1
          ? res({ success: false, error: 'Could not save your answer' }, false, 503)
          : res({
            success: true,
            accepted: true,
            requiredVersion: AGE_GATE_VERSION,
            acceptedAt: '2026-09-06T12:00:00.000Z',
          }));
      }
      return existingFetch!(input, init);
    });

    render(<ProfilePage username="wren_hallow" />);
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Accept' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not save your answer');
    expect(screen.getByRole('button', { name: 'Retry' })).toBeVisible();
    expect(localStorage.getItem('FORMAMORPH_ageGate')).toBeNull();
    expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).includes('/by-username/'))).toBe(false);

    await userEvent.setup().click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByRole('heading', { name: 'wren_hallow' })).toBeInTheDocument();
    const requests = vi.mocked(fetch).mock.calls.filter(([url]) => String(url).endsWith('/policies/age-gate/accept'));
    expect(requests).toHaveLength(2);
    expect(requests[1]?.[1]).toMatchObject({
      method: 'POST',
      body: JSON.stringify({ acceptanceVersion: AGE_GATE_VERSION }),
    });
  });

  it('shows a retryable error when the account answer cannot be read', async () => {
    signIn({ username: 'signed-in-reader' });
    let reads = 0;
    serverHas(PROFILE);
    const existingFetch = vi.mocked(fetch).getMockImplementation();
    vi.mocked(fetch).mockImplementation((input, init) => {
      if (String(input).endsWith('/policies/age-gate')) {
        reads += 1;
        return Promise.resolve(reads === 1
          ? res({ success: false, error: 'Could not check your answer' }, false, 503)
          : res({
            success: true,
            accepted: true,
            requiredVersion: AGE_GATE_VERSION,
            acceptedAt: '2026-09-06T12:00:00.000Z',
          }));
      }
      return existingFetch!(input, init);
    });

    render(<ProfilePage username="wren_hallow" />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not check your answer');
    expect(screen.queryByText('Adult Content Ahead')).not.toBeInTheDocument();
    expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).includes('/by-username/'))).toBe(false);

    await userEvent.setup().click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByRole('heading', { name: 'wren_hallow' })).toBeInTheDocument();
    expect(reads).toBe(2);
  });

  it('does not offer wording older than the server requires', async () => {
    signIn({ username: 'signed-in-reader' });
    vi.mocked(fetch).mockResolvedValue(res({
      success: true,
      accepted: false,
      requiredVersion: AGE_GATE_VERSION + 1,
      acceptedAt: null,
    }));

    render(<ProfilePage username="wren_hallow" />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Update Formamorph to review the current adult-content warning.',
    );
    expect(screen.queryByText('Adult Content Ahead')).not.toBeInTheDocument();
    expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).endsWith('/policies/age-gate/accept')))
      .toBe(false);
    expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).includes('/by-username/'))).toBe(false);
  });

  it('keeps a newer client closed until the server carries the same warning', async () => {
    signIn({ username: 'signed-in-reader' });
    vi.mocked(fetch).mockResolvedValue(res({
      success: true,
      accepted: true,
      requiredVersion: AGE_GATE_VERSION - 1,
      acceptedAt: '2026-09-06T12:00:00.000Z',
    }));

    render(<ProfilePage username="wren_hallow" />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The account server is not ready for this content warning. Try again later.',
    );
    expect(screen.queryByText('Adult Content Ahead')).not.toBeInTheDocument();
    expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).includes('/by-username/'))).toBe(false);
  });

  it('discards a completed write after another account is adopted', async () => {
    signIn({ username: 'first-reader' });
    let resolveWrite: (response: Response) => void = () => {};
    const write = new Promise<Response>((resolve) => { resolveWrite = resolve; });
    serverHas(PROFILE);
    const existingFetch = vi.mocked(fetch).getMockImplementation();
    vi.mocked(fetch).mockImplementation((input, init) => {
      const url = String(input);
      if (url.endsWith('/policies/age-gate')) {
        return Promise.resolve(res({
          success: true, accepted: false, requiredVersion: AGE_GATE_VERSION, acceptedAt: null,
        }));
      }
      if (url.endsWith('/policies/age-gate/accept')) return write;
      return existingFetch!(input, init);
    });

    render(<ProfilePage username="wren_hallow" />);
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Accept' }));

    await act(async () => {
      adoptAccountFromAnotherTab('second-reader');
    });

    expect(await screen.findByRole('button', { name: 'Accept' })).toBeEnabled();

    await act(async () => resolveWrite(res({
      success: true,
      accepted: true,
      requiredVersion: AGE_GATE_VERSION,
      acceptedAt: '2026-09-06T12:00:00.000Z',
    })));

    expect(screen.getByText('Adult Content Ahead')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Accept' })).toBeEnabled();
    expect(localStorage.getItem('FORMAMORPH_ageGate')).toBeNull();
    expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).includes('/by-username/'))).toBe(false);
  });

  it('does not upload a historical guest answer into a signed-in account', async () => {
    alreadyAttested();
    signIn({ username: 'signed-in-reader' });
    serverHas(PROFILE);
    const existingFetch = vi.mocked(fetch).getMockImplementation();
    vi.mocked(fetch).mockImplementation((input, init) => String(input).endsWith('/policies/age-gate')
      ? Promise.resolve(res({
        success: true, accepted: false, requiredVersion: AGE_GATE_VERSION, acceptedAt: null,
      }))
      : existingFetch!(input, init));

    render(<ProfilePage username="wren_hallow" />);

    expect(await screen.findByText('Adult Content Ahead')).toBeInTheDocument();
    expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).endsWith('/policies/age-gate/accept')))
      .toBe(false);
    expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).includes('/by-username/'))).toBe(false);
  });

  it('keeps a guest in the current visit when local storage refuses the answer', async () => {
    serverHas(PROFILE);
    render(<ProfilePage username="wren_hallow" />);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('storage denied'); });

    await userEvent.setup().click(await screen.findByRole('button', { name: 'Accept' }));

    expect(await screen.findByRole('heading', { name: 'wren_hallow' })).toBeInTheDocument();
    expect(localStorage.getItem('FORMAMORPH_ageGate')).toBeNull();
  });

  it('discards a delayed read after another account is adopted', async () => {
    signIn({ username: 'first-reader' });
    let resolveFirst: (response: Response) => void = () => {};
    const first = new Promise<Response>((resolve) => { resolveFirst = resolve; });
    vi.mocked(fetch).mockImplementation((input, init) => {
      if (!String(input).endsWith('/policies/age-gate')) return Promise.resolve(res({ success: true, data: [] }));
      const token = (init?.headers as Record<string, string> | undefined)?.Authorization;
      return token === 'Bearer tok'
        ? first
        : Promise.resolve(res({
          success: true, accepted: false, requiredVersion: AGE_GATE_VERSION, acceptedAt: null,
        }));
    });

    render(<ProfilePage username="wren_hallow" />);
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));

    await act(async () => {
      adoptAccountFromAnotherTab('second-reader');
    });

    expect(await screen.findByText('Adult Content Ahead')).toBeInTheDocument();
    await act(async () => resolveFirst(res({
      success: true,
      accepted: true,
      requiredVersion: AGE_GATE_VERSION,
      acceptedAt: '2026-09-06T12:00:00.000Z',
    })));

    expect(screen.getByText('Adult Content Ahead')).toBeInTheDocument();
    expect(localStorage.getItem('FORMAMORPH_ageGate')).toBeNull();
    expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).includes('/by-username/'))).toBe(false);
  });

  it('falls back to the guest gate when a delayed account read is logged out', async () => {
    signIn({ username: 'signed-in-reader' });
    let resolveRead: (response: Response) => void = () => {};
    vi.mocked(fetch).mockReturnValue(new Promise<Response>((resolve) => { resolveRead = resolve; }));
    render(<ProfilePage username="wren_hallow" />);
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));

    await act(async () => {
      localStorage.removeItem(AuthService.tokenKey);
      localStorage.removeItem(AuthService.userKey);
      window.dispatchEvent(new StorageEvent('storage', { key: AuthService.tokenKey, newValue: null }));
    });

    expect(await screen.findByText('Adult Content Ahead')).toBeInTheDocument();
    await act(async () => resolveRead(res({
      success: true,
      accepted: true,
      requiredVersion: AGE_GATE_VERSION,
      acceptedAt: '2026-09-06T12:00:00.000Z',
    })));

    expect(screen.getByText('Adult Content Ahead')).toBeInTheDocument();
    expect(localStorage.getItem('FORMAMORPH_ageGate')).toBeNull();
  });

  it('asks before the page reads anything', async () => {
    serverHas(PROFILE);
    render(<ProfilePage username="wren_hallow" />);

    expect(await screen.findByText('Adult Content Ahead')).toBeInTheDocument();
    // Not merely hidden: a mounted profile fetches, and a fetch is the page having been visited.
    expect(fetch).not.toHaveBeenCalled();
    expect(screen.queryByText('wren_hallow')).not.toBeInTheDocument();
  });

  it('renders the profile once the reader accepts, and records the answer for the game', async () => {
    serverHas(PROFILE);
    render(<ProfilePage username="wren_hallow" />);

    await userEvent.setup().click(await screen.findByRole('button', { name: 'Accept' }));

    expect(await screen.findByRole('heading', { name: 'wren_hallow' })).toBeInTheDocument();
    // The app's own key and version, so `/play/` on this origin does not ask a second time.
    const stored = JSON.parse(localStorage.getItem('FORMAMORPH_ageGate') ?? 'null');
    expect(stored).toMatchObject({ accepted: true, acceptanceVersion: AGE_GATE_VERSION });
  });

  it('does not ask a reader who already answered in the game', async () => {
    alreadyAttested();
    serverHas(PROFILE);
    render(<ProfilePage username="wren_hallow" />);

    expect(await screen.findByRole('heading', { name: 'wren_hallow' })).toBeInTheDocument();
    expect(screen.queryByText('Adult Content Ahead')).not.toBeInTheDocument();
  });

  it('asks again when the copy has moved on since the stored answer', async () => {
    localStorage.setItem('FORMAMORPH_ageGate', JSON.stringify({
      accepted: true,
      acceptanceVersion: AGE_GATE_VERSION - 1,
      acceptedAt: '2026-01-01T00:00:00.000Z',
    }));
    serverHas(PROFILE);
    render(<ProfilePage username="wren_hallow" />);

    expect(await screen.findByText('Adult Content Ahead')).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('sends a reader who declines back to the start', async () => {
    serverHas(PROFILE);
    render(<ProfilePage username="wren_hallow" />);

    await userEvent.setup().click(await screen.findByRole('button', { name: 'Decline' }));

    expect(leaveTo).toHaveBeenCalledWith('/');
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('a profile that is not there', () => {
  beforeEach(() => alreadyAttested());

  it('shows the plain not-found page for a name nobody has', async () => {
    serverHas(null);
    render(<ProfilePage username="nobody_at_all" />);

    expect(await screen.findByRole('heading', { name: 'Page Not Found' })).toBeInTheDocument();
    // The name is not echoed back: the page is the same one a mistyped URL gets.
    expect(screen.queryByText(/nobody_at_all/)).not.toBeInTheDocument();
  });

  it('shows that same page, byte for byte, for a suspended account', async () => {
    // The server refuses both identically on purpose. If this page ever rendered them differently, the
    // site would become a way to ask who is suspended.
    serverHas(null);
    const unknown = render(<ProfilePage username="nobody_at_all" />);
    await screen.findByRole('heading', { name: 'Page Not Found' });
    const unknownHtml = unknown.container.innerHTML;
    unknown.unmount();

    serverHas(null);
    const suspended = render(<ProfilePage username="wren_hallow" />);
    await screen.findByRole('heading', { name: 'Page Not Found' });

    expect(suspended.container.innerHTML).toBe(unknownHtml);
  });

  it('leaves the missing name out of the tab title too', async () => {
    // The name came off the address bar, so titling from it would put an account nobody has above a
    // page that says exactly that.
    serverHas(null);
    render(<ProfilePage username="nobody_at_all" />);

    await screen.findByRole('heading', { name: 'Page Not Found' });
    expect(document.title).not.toContain('nobody_at_all');
  });

  it('says the server broke rather than claiming the person does not exist', async () => {
    vi.mocked(fetch).mockResolvedValue(res({ success: false, error: 'Server error' }, false, 500));
    render(<ProfilePage username="wren_hallow" />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Server error');
    expect(screen.queryByRole('heading', { name: 'Page Not Found' })).not.toBeInTheDocument();
  });
});

describe('what a profile shows', () => {
  beforeEach(() => alreadyAttested());

  it('draws the same numbers the in-app dialog does', async () => {
    serverHas(PROFILE);
    render(<ProfilePage username="wren_hallow" />);

    await screen.findByRole('heading', { name: 'wren_hallow' });
    expect(document.title).toBe('wren_hallow · Formamorph');
    expect(await screen.findByText('3')).toBeInTheDocument();
    expect(screen.getByText('41')).toBeInTheDocument();
    expect(screen.getByText('108')).toBeInTheDocument();
  });

  it('reads their listings for the id the profile came back with', async () => {
    serverHas(PROFILE);
    render(<ProfilePage username="wren_hallow" />);

    await waitFor(() => {
      const asked = vi.mocked(fetch).mock.calls.map(([url]) => String(url));
      expect(asked.some((url) => url.includes('/users/u1/worlds'))).toBe(true);
    });
  });
});
