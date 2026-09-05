import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AGE_GATE_VERSION } from '@/lib/ageGate';
import { ProfilePage } from './ProfilePage';
import { leaveTo } from '../leaveSite';
import { res, resetAccountPage } from '../test/support';

// jsdom implements no navigation, so where a declined gate sent the reader is only observable here.
vi.mock('../leaveSite', () => ({ leaveTo: vi.fn() }));

/** The record the app writes when a player accepts the gate inside `/play/`. */
const alreadyAttested = () => localStorage.setItem('FORMAMORPH_ageGate', JSON.stringify({
  accepted: true,
  acceptanceVersion: AGE_GATE_VERSION,
  acceptedAt: '2026-01-01T00:00:00.000Z',
}));

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
