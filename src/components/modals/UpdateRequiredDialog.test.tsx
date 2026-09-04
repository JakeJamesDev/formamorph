import { useEffect } from 'react';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { UpdateRequiredGate } from '@/components/modals/UpdateRequiredDialog';
import { APP_VERSION } from '@/lib/version';
import { CLIENT_HEADER } from '@/lib/clientIdentity';
import AuthService from '@/services/AuthService';

/** The bridge the dialog reaches for; absent unless a test hands one over. */
const bridgeHolder = vi.hoisted(() => ({ current: null as unknown }));
vi.mock('@/lib/updates/updateBridge', () => ({ updateBridge: () => bridgeHolder.current }));

/** The update channel the player picked. The dialog reads it to choose which release to ask for. */
vi.mock('@/contexts/SettingsContext', () => ({ useSettings: () => ({ updateChannel: 'stable' }) }));

const checkForUpdate = vi.hoisted(() => vi.fn());
vi.mock('@/services/UpdateService', () => ({ checkForUpdate }));

const API = 'https://api.example.test/api';

/** A fresh refusal every time it is asked for: one reply is one response body. */
const refusal = (feature: string, minVersion = '2.18.0') => () => new Response(
  JSON.stringify({ success: false, code: 'CLIENT_UPDATE_REQUIRED', feature, minVersion }),
  { status: 426, headers: { 'Content-Type': 'application/json' } },
);

const ok = () => new Response(JSON.stringify({ success: true }), { status: 200 });

/** A bridge that records what it was asked to download. */
const fakeBridge = () => ({ download: vi.fn(async () => {}) });

let apiUrl = '';
const reload = vi.fn();

beforeEach(() => {
  apiUrl = AuthService.API_URL;
  AuthService.API_URL = API;
  bridgeHolder.current = null;
  reload.mockClear();
  checkForUpdate.mockReset();
  checkForUpdate.mockResolvedValue({ success: true, result: { available: true, latestVersion: '2.20.0' } });
  vi.stubGlobal('location', { ...window.location, reload });
});

afterEach(() => {
  cleanup();
  AuthService.API_URL = apiUrl;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** Mount the gate over a `fetch` that answers each call with the next reply, then repeats the last. */
const mount = (...answers: Array<() => Response>) => {
  let call = 0;
  vi.spyOn(window, 'fetch').mockImplementation(async () => answers[Math.min(call++, answers.length - 1)]());
  render(<UpdateRequiredGate />);
};

/** What a refused request looks like from the caller's side. */
const refusedCall = () => fetch(`${API}/contests/abc/enter`, { method: 'POST' });

describe('the update dialog', () => {
  it('stays away until a request is refused', () => {
    mount(ok);

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('names the feature, the version it needs, and the one running', async () => {
    mount(refusal('Contests'));

    await refusedCall();

    expect(await screen.findByText(/Contests/)).toBeTruthy();
    expect(screen.getByText(/2\.18\.0/)).toBeTruthy();
    expect(screen.getByText(new RegExp(APP_VERSION.replace(/\./g, '\\.')))).toBeTruthy();
  });

  it('leaves the refused call its own reply to report', async () => {
    mount(refusal('Contests'));

    const response = await refusedCall();

    expect(response.status).toBe(426);
    await expect(response.json()).resolves.toMatchObject({ feature: 'Contests' });
  });

  it('closes on Not Now', async () => {
    mount(refusal('Contests'));

    await refusedCall();
    fireEvent.click(await screen.findByRole('button', { name: /not now/i }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('reloads the page on Update where there is no bridge', async () => {
    mount(refusal('Contests'));

    await refusedCall();
    fireEvent.click(await screen.findByRole('button', { name: /^update$/i }));

    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('starts the platform download on the channel the player picked', async () => {
    const bridge = fakeBridge();
    bridgeHolder.current = bridge;
    mount(refusal('Contests'));

    await refusedCall();
    fireEvent.click(await screen.findByRole('button', { name: /^update$/i }));

    // The version comes from the channel-aware check, never from the bridge's own newest-of-either default.
    await waitFor(() => expect(bridge.download).toHaveBeenCalledWith({ version: '2.20.0', channel: 'stable' }));
    expect(checkForUpdate).toHaveBeenCalledWith('stable');
    expect(reload).not.toHaveBeenCalled();

    expect(await screen.findByText(/update has started/i)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^update$/i })).toBeNull();
  });

  it('says so when there is no release to take yet, and offers the button again', async () => {
    bridgeHolder.current = fakeBridge();
    checkForUpdate.mockResolvedValue({ success: true, result: { available: false } });
    mount(refusal('Contests'));

    await refusedCall();
    fireEvent.click(await screen.findByRole('button', { name: /^update$/i }));

    expect(await screen.findByText(/no newer version/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /^update$/i })).toBeTruthy();
  });

  it('says so when the download fails, and offers the button again', async () => {
    const bridge = fakeBridge();
    bridge.download.mockRejectedValueOnce(new Error('no route to host'));
    bridgeHolder.current = bridge;
    mount(refusal('Contests'));

    await refusedCall();
    fireEvent.click(await screen.findByRole('button', { name: /^update$/i }));

    expect(await screen.findByText(/no route to host/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /^update$/i })).toBeTruthy();
  });
});

describe('a second refusal', () => {
  // The retry loop the de-duplication exists for: a screen that keeps asking must not restart the
  // dialog it already raised, least of all an update the player has already started.
  it('for the same feature leaves a started update alone', async () => {
    const bridge = fakeBridge();
    bridgeHolder.current = bridge;
    mount(refusal('Contests'));

    await refusedCall();
    fireEvent.click(await screen.findByRole('button', { name: /^update$/i }));
    expect(await screen.findByText(/update has started/i)).toBeTruthy();

    await refusedCall();

    expect(screen.getByText(/update has started/i)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^update$/i })).toBeNull();
    expect(bridge.download).toHaveBeenCalledTimes(1);
  });

  it('for another feature names the one the player just tried', async () => {
    mount(refusal('Contests'), refusal('Publishing', '2.19.0'));

    await refusedCall();
    expect(await screen.findByText(/Contests/)).toBeTruthy();

    await refusedCall();

    expect(await screen.findByText(/Publishing/)).toBeTruthy();
    expect(screen.queryByText(/Contests/)).toBeNull();
  });
});

describe('where the gate sits in the tree', () => {
  /** A screen that asks the server for something the moment it mounts. */
  function Boot() {
    useEffect(() => { void fetch(`${API}/policies`); }, []);
    return null;
  }

  // React runs sibling effects in tree order, so a screen mounted before the gate would send its first
  // request unstamped — and a route gated on the version would refuse it with nothing listening.
  it('stamps a request a screen makes as it mounts', async () => {
    const inner = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => ok());
    vi.spyOn(window, 'fetch').mockImplementation(inner);

    render(<><UpdateRequiredGate /><Boot /></>);

    await waitFor(() => expect(inner).toHaveBeenCalled());
    const [input, init] = inner.mock.calls[0];
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    expect(headers.get(CLIENT_HEADER)).toContain(APP_VERSION);
  });
});
