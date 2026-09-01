import { screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderMainMenu } from '@/test/mainMenu';
import AuthService from '@/services/AuthService';
import { AGE_GATE_VERSION, acceptAgeGate } from '@/lib/ageGate';
import { getCatalog, replaceCatalog } from '@/lib/worldCatalog';
import { getThumb, putThumb } from '@/lib/thumbnailCache';
import { getCachedImage, putCachedImage } from '@/lib/remoteImageCache';
import { serverEvent } from '@/test/serverEvents';

/**
 * The age gate, observed at the one boundary that matters: what leaves the client, and what the player
 * is shown. Every case renders the real main menu under the real providers and drives it by clicking, so
 * nothing here asserts the gate's internals — a case still passes if the flag moves house.
 *
 * The community server is answered by a stubbed `fetch` rather than by mocked services, because "no UGC
 * request leaves the client" is a claim about requests. Every call is recorded, and the load-bearing
 * assertion is that the only ones addressed at the server are the admin-authored exemptions.
 */

vi.mock('react-toastify', () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn(), warn: vi.fn() },
  ToastContainer: () => null,
}));

const STORAGE_KEY = 'FORMAMORPH_ageGate';

/** Every URL the app asked for during a case, in order. */
let requested: string[] = [];

/** The events currently running, as `/events/active` answers. */
let running: unknown[] = [];

/** What was asked of the community server — anything else (assets, the update check) is not its business. */
const serverCalls = () => requested.filter((url) => url.startsWith(AuthService.API_URL));

/** The admin-authored exemptions: events, their prose, and the contest archive read from the same route. */
const isExempt = (url: string) => url.startsWith(`${AuthService.API_URL}/events`);

const answer = (body: unknown) => new Response(JSON.stringify(body), {
  status: 200,
  headers: { 'Content-Type': 'application/json' },
});

beforeEach(() => {
  requested = [];
  running = [];
  localStorage.clear();
  AuthService.token = null;
  AuthService.currentUser = null;

  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input instanceof Request ? input.url : input);
    requested.push(url);
    if (url.startsWith(`${AuthService.API_URL}/events/active`)) return answer({ data: running });
    return answer({ data: [] });
  }));
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** Arrive the way a returning player does: a token already on disk, nothing else asked. */
const withStoredSession = () => {
  localStorage.setItem('authToken', 'stored-token');
  AuthService.token = 'stored-token';
};

const openCommunity = () => fireEvent.click(screen.getByRole('button', { name: /Community Creations/ }));
const gate = () => screen.queryByRole('dialog', { name: /Adult Content Ahead/ });
const browser = () => screen.queryByRole('dialog', { name: /Community Creations/ });

describe('the age gate in front of Community Creations', () => {
  it('asks before the browser opens, and nothing user-written is fetched while it waits', async () => {
    renderMainMenu();
    openCommunity();

    expect(gate()).toBeInTheDocument();
    expect(browser()).not.toBeInTheDocument();
    // The load-bearing one: whatever else went out, none of it was somebody's uploaded work.
    await waitFor(() => expect(serverCalls().length).toBeGreaterThan(0));
    expect(serverCalls().filter((url) => !isExempt(url))).toEqual([]);
  });

  it('opens the browser in the same session once accepted — no reload', () => {
    renderMainMenu();
    openCommunity();
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }));

    expect(gate()).not.toBeInTheDocument();
    expect(browser()).toBeInTheDocument();
  });

  it('leaves the browser shut on a decline, and asks again on the next try', () => {
    renderMainMenu();
    openCommunity();
    fireEvent.click(screen.getByRole('button', { name: 'Decline' }));

    expect(gate()).not.toBeInTheDocument();
    expect(browser()).not.toBeInTheDocument();

    openCommunity();
    expect(gate()).toBeInTheDocument();
  });

  it('closes only by being answered — no Escape, no X to click past it with', () => {
    renderMainMenu();
    openCommunity();

    fireEvent.keyDown(screen.getByRole('dialog', { name: /Adult Content Ahead/ }), { key: 'Escape' });

    expect(gate()).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /close/i })).not.toBeInTheDocument();
  });

  it('does not ask a player who has already attested', () => {
    acceptAgeGate();
    renderMainMenu();
    openCommunity();

    expect(gate()).not.toBeInTheDocument();
    expect(browser()).toBeInTheDocument();
  });

  it('asks on the side door too — the contest banner that offers to show the entries', async () => {
    running = [serverEvent()];
    renderMainMenu();

    fireEvent.click(await screen.findByRole('button', { name: 'View Entries' }));

    expect(gate()).toBeInTheDocument();
    expect(browser()).not.toBeInTheDocument();
  });

  it('answers once, not twice — the asking surface is not run again by a repeated render', () => {
    // React may call a state updater more than once, so the answer's side effects must not live inside
    // one. Accepting from a signed-in boot used to log the session out twice through exactly that.
    const warnings: unknown[] = [];
    vi.spyOn(console, 'warn').mockImplementation((...args) => warnings.push(args));
    const errors: unknown[] = [];
    vi.mocked(console.error).mockImplementation((...args: unknown[]) => { errors.push(args); });

    renderMainMenu();
    openCommunity();
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }));

    const complaints = [...warnings, ...errors].map((args) => String(args));
    expect(complaints.filter((text) => text.includes('while rendering a different component'))).toEqual([]);
  });

  it('asks again once the wording of the attestation has moved on', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      accepted: true,
      acceptanceVersion: AGE_GATE_VERSION - 1,
      acceptedAt: new Date().toISOString(),
    }));

    renderMainMenu();
    openCommunity();

    expect(gate()).toBeInTheDocument();
  });
});

describe('the age gate in front of signing in', () => {
  it('asks before the account dialog, since an account is what unlocks the profiles', () => {
    renderMainMenu();
    fireEvent.click(screen.getByRole('button', { name: 'Login' }));

    expect(gate()).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: /sign in|log in|account/i })).not.toBeInTheDocument();
  });

  it('asks nothing further of a player who attested on the way into the browser', () => {
    acceptAgeGate();
    renderMainMenu();

    fireEvent.click(screen.getByRole('button', { name: 'Login' }));

    expect(gate()).not.toBeInTheDocument();
  });
});

describe('the age gate at boot', () => {
  it('asks a signed-in player before anything else is put on screen', async () => {
    withStoredSession();
    running = [serverEvent()];

    renderMainMenu();

    expect(gate()).toBeInTheDocument();
    // The event poster is the other blocking dialog at boot. It waits its turn rather than stacking.
    await waitFor(() => expect(serverCalls().some(isExempt)).toBe(true));
    expect(screen.queryByText('A Contest Has Started')).not.toBeInTheDocument();
  });

  it('lets the poster through once the gate is answered', async () => {
    withStoredSession();
    running = [serverEvent()];

    renderMainMenu();
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }));

    expect(await screen.findByText('A Contest Has Started')).toBeInTheDocument();
  });

  it('asks the server for nothing but the announcements while a held session has not answered', async () => {
    withStoredSession();
    renderMainMenu();

    await waitFor(() => expect(serverCalls().length).toBeGreaterThan(0));
    expect(serverCalls().filter((url) => !isExempt(url))).toEqual([]);
  });

  it('leaves the session standing on an accept', () => {
    withStoredSession();
    renderMainMenu();

    fireEvent.click(screen.getByRole('button', { name: 'Accept' }));

    expect(AuthService.isAuthenticated()).toBe(true);
  });

  it('signs the session out on a decline, and drops what it had cached', async () => {
    await replaceCatalog([{ id: 'w1', name: 'Somebody else, published' }]);
    await putThumb('thumb-1.webp', new Blob(['pixels']), 1);
    withStoredSession();

    renderMainMenu();
    fireEvent.click(screen.getByRole('button', { name: 'Decline' }));

    expect(AuthService.isAuthenticated()).toBe(false);
    await waitFor(async () => expect(await getCatalog()).toEqual([]));
    expect(await getThumb('thumb-1.webp')).toBeNull();
  });

  it('says nothing at all to a signed-out player until they reach for something', () => {
    renderMainMenu();

    expect(gate()).not.toBeInTheDocument();
  });

  it('does not ask a signed-in player who has already attested', () => {
    acceptAgeGate();
    withStoredSession();

    renderMainMenu();

    expect(gate()).not.toBeInTheDocument();
  });
});

describe('what the gate throws away, and what it leaves alone', () => {
  it('drops a catalog and thumbnails cached before the gate existed', async () => {
    await replaceCatalog([{ id: 'w1', name: 'Cached before the gate' }]);
    await putThumb('thumb-1.webp', new Blob(['pixels']), 1);

    renderMainMenu();

    await waitFor(async () => expect(await getCatalog()).toEqual([]));
    expect(await getThumb('thumb-1.webp')).toBeNull();
  });

  it('leaves the remote-image cache alone — it serves worlds already in the library', async () => {
    const url = 'https://example.test/a-world-i-downloaded.webp';
    await putCachedImage(url, new Blob(['pixels']));

    renderMainMenu();

    await waitFor(async () => expect(await getCatalog()).toEqual([]));
    expect(await getCachedImage(url)).not.toBeNull();
  });

  it('keeps the caches of a player who has already attested', async () => {
    acceptAgeGate();
    await replaceCatalog([{ id: 'w1', name: 'Mine to keep' }]);

    renderMainMenu();

    await waitFor(() => expect(serverCalls().length).toBeGreaterThan(0));
    expect(await getCatalog()).toHaveLength(1);
  });
});

describe('what the gate is not in front of', () => {
  it('still reads the running events and the contest archive while unattested', async () => {
    running = [serverEvent()];
    renderMainMenu();

    await waitFor(() => {
      expect(requested).toContain(`${AuthService.API_URL}/events/active`);
      expect(requested).toContain(`${AuthService.API_URL}/events?slim=1`);
    });
  });

  it('shows the event banner without asking anybody their age', async () => {
    running = [serverEvent()];
    renderMainMenu();

    // The banner writes its window and its blurb into one line, so this matches the blurb inside it.
    expect(await screen.findByText(/Build a world around a single season/)).toBeInTheDocument();
    expect(gate()).not.toBeInTheDocument();
  });
});
