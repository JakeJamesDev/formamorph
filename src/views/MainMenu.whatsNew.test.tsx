import { act, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { renderMainMenu } from '@/test/mainMenu';
import { serverEvent } from '@/test/serverEvents';
import AuthService from '@/services/AuthService';
import { resetReleaseFetch } from '@/services/UpdateService';
import { markFirstRunStepSeen, markWhatsNewSeen, whatsNewSeenVersion } from '@/lib/firstTimeFlowStore';
import { whatsNewDue } from '@/lib/firstTimeFlow';
import { resetTutorials, TUTORIAL_APPEAR_DELAY_MS } from '@/lib/tutorials';
import { APP_VERSION } from '@/lib/version';
import type { LocalLlmState } from '@/lib/imageGen/desktop';
import { markAutoLoadPending, markAutoLoadSettled } from '@/lib/engineAutoLoad';

/** The installed version a launch sees; null keeps the build's own. */
const installed = vi.hoisted(() => ({ version: null as string | null }));
vi.mock('@/lib/version', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/version')>();
  return { ...real, get APP_VERSION() { return installed.version ?? real.APP_VERSION; } };
});
vi.mock('react-toastify', () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn(), warn: vi.fn(), dismiss: vi.fn(), update: vi.fn(), isActive: vi.fn(() => false) },
  ToastContainer: () => null,
}));
vi.mock('./VRMViewer', async () => {
  const { forwardRef } = await import('react');
  return { default: forwardRef(() => null) };
});

/** The events the stubbed server reports as running. */
let running: unknown[] = [];
let fetchMock: ReturnType<typeof vi.fn<(input: RequestInfo | URL) => Promise<Response>>>;

const answer = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  resetTutorials();
  resetReleaseFetch();
  installed.version = null;
  running = [];
  window.history.replaceState(null, '', '/');
  // A release build: dev builds open What's New only through the dev route.
  vi.stubEnv('DEV', false);
  fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.startsWith(`${AuthService.API_URL}/events/active`)) return answer({ data: running });
    return answer({ data: [] });
  });
  vi.stubGlobal('fetch', fetchMock);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  delete (window as { formamorphDesktop?: unknown }).formamorphDesktop;
  markAutoLoadPending();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const whatsNew = (version = APP_VERSION) => screen.queryByRole('dialog', { name: `v${version}` });
const poster = () => screen.queryByRole('dialog', { name: /Winter World-Building Contest/ });
const tutorialShown = () => /Create a free account to like and comment/.test(document.body.textContent ?? '');
const settle = (ms = 300) => act(() => new Promise((resolve) => setTimeout(resolve, ms)));

/** An existing player: the intro was seen before this launch and the first-run step is done. */
function existingPlayer(seenVersion: string | null) {
  markFirstRunStepSeen();
  if (seenVersion !== null) markWhatsNewSeen(seenVersion);
}

async function closeWhatsNew() {
  fireEvent.keyDown(screen.getByRole('dialog', { name: `v${APP_VERSION}` }), { key: 'Escape' });
  await waitFor(() => expect(whatsNew()).not.toBeInTheDocument());
}

describe('What\'s New on launch', () => {
  it('opens once for a new version, stays closed on the next launch, and opens again for the next version', async () => {
    existingPlayer('0.0.1');
    renderMainMenu({ introSeenAtLaunch: true });

    expect(await screen.findByRole('dialog', { name: `v${APP_VERSION}` })).toBeInTheDocument();
    expect(whatsNewSeenVersion()).toBe(APP_VERSION);
    await closeWhatsNew();
    cleanup();

    renderMainMenu({ introSeenAtLaunch: true });
    await settle();
    expect(whatsNew()).not.toBeInTheDocument();
    cleanup();

    installed.version = '99.0.0';
    renderMainMenu({ introSeenAtLaunch: true });
    expect(await screen.findByRole('dialog', { name: 'v99.0.0' })).toBeInTheDocument();
    expect(whatsNewSeenVersion()).toBe('99.0.0');
  });

  it('is due whenever the installed version differs from the record', () => {
    const facts = { introSeenAtLaunch: true, devBuild: false };
    expect(whatsNewDue({ ...facts, seenVersion: '3.8.0', installedVersion: '3.8.0' })).toBe(false);
    expect(whatsNewDue({ ...facts, seenVersion: '3.8.0', installedVersion: '3.8.1' })).toBe(true);
  });

  it('opens for an existing player with no record', async () => {
    existingPlayer(null);
    renderMainMenu({ introSeenAtLaunch: true });

    expect(await screen.findByRole('dialog', { name: `v${APP_VERSION}` })).toBeInTheDocument();
  });

  it('records the version without opening on a fresh install', async () => {
    renderMainMenu({ introSeenAtLaunch: false });
    fireEvent.click(await screen.findByRole('button', { name: 'Browse Worlds' }));
    await settle();

    expect(whatsNew()).not.toBeInTheDocument();
    expect(whatsNewSeenVersion()).toBe(APP_VERSION);
  });

  it('waits for the intro to finish', async () => {
    existingPlayer('0.0.1');
    const view = renderMainMenu({ introSeenAtLaunch: true, introActive: true });
    await settle();
    expect(whatsNew()).not.toBeInTheDocument();

    view.rerenderMenu({ introActive: false });
    expect(await screen.findByRole('dialog', { name: `v${APP_VERSION}` })).toBeInTheDocument();
  });

  it('starts the release fetch on load while it waits for the intro', async () => {
    existingPlayer('0.0.1');
    renderMainMenu({ introSeenAtLaunch: true, introActive: true });
    await settle();

    const urls = fetchMock.mock.calls.map(([input]) => String(input instanceof Request ? input.url : input));
    expect(urls.some((url) => url.includes('/releases'))).toBe(true);
    expect(whatsNew()).not.toBeInTheDocument();
  });

  it('never opens by itself in a dev build', async () => {
    vi.stubEnv('DEV', true);
    existingPlayer('0.0.1');
    renderMainMenu({ introSeenAtLaunch: true });
    await settle();

    expect(whatsNew()).not.toBeInTheDocument();
  });

  it('writes the record when the player opens it from the version button', async () => {
    vi.stubEnv('DEV', true);
    existingPlayer('0.0.1');
    renderMainMenu({ introSeenAtLaunch: true });

    fireEvent.click(await screen.findByRole('button', { name: 'What’s New' }));

    expect(await screen.findByRole('dialog', { name: `v${APP_VERSION}` })).toBeInTheDocument();
    expect(whatsNewSeenVersion()).toBe(APP_VERSION);
  });
});

describe('startup prompts behind What\'s New', () => {
  it('holds the event poster until What\'s New closes', async () => {
    running = [serverEvent()];
    existingPlayer('0.0.1');
    renderMainMenu({ introSeenAtLaunch: true });
    await screen.findByRole('dialog', { name: `v${APP_VERSION}` });
    await settle(400);
    expect(poster()).not.toBeInTheDocument();

    await closeWhatsNew();

    expect(await screen.findByRole('dialog', { name: /Winter World-Building Contest/ })).toBeInTheDocument();
  });

  it('holds the main menu tutorial until What\'s New closes', async () => {
    existingPlayer('0.0.1');
    renderMainMenu({ introSeenAtLaunch: true });
    await screen.findByRole('dialog', { name: `v${APP_VERSION}` });
    // Longer than the appear delay: a tutorial that ran behind the dialog would be ready by now.
    await settle(TUTORIAL_APPEAR_DELAY_MS + 400);
    expect(tutorialShown()).toBe(false);

    await closeWhatsNew();
    await settle(150);

    // Held, not just covered: the appear delay starts over once What's New closes.
    expect(tutorialShown()).toBe(false);
    await waitFor(() => expect(tutorialShown()).toBe(true), { timeout: 3000 });
  });
});

describe('What\'s New behind the AI setup gate', () => {
  /** A desktop whose built-in engine reports `initial` at launch and has a model on disk. */
  function stubDesktop(initial: LocalLlmState['status']) {
    const listeners = new Set<(s: LocalLlmState) => void>();
    const status = (s: LocalLlmState['status']) => ({ status: s, modelPath: null, modelId: null, port: null, error: null }) as LocalLlmState;
    window.formamorphDesktop = {
      fetch: () => Promise.resolve({ ok: true, status: 200, body: '' }),
      vramStats: () => Promise.resolve({ gpus: [], processes: [], selfPid: null }),
      llm: {
        status: () => Promise.resolve(status(initial)),
        onStatus: (cb: (s: LocalLlmState) => void) => { listeners.add(cb); return () => { listeners.delete(cb); }; },
        listDevices: () => Promise.resolve({ backend: null, devices: [], autoPick: null }),
        listModels: () => Promise.resolve(['m.gguf']),
        listInstalled: () => Promise.resolve([]),
      },
    } as unknown as Window['formamorphDesktop'];
    return (next: LocalLlmState['status']) => act(() => { listeners.forEach((cb) => cb(status(next))); });
  }

  const setupGate = () => screen.queryByRole('dialog', { name: /model didn.t load/ });

  it('waits while the engine loads its model, then opens', async () => {
    // The player answered the setup nudge on an earlier launch; only the model load is pending.
    localStorage.setItem('FORMAMORPH_aiSetupSeen', '1');
    const pushEngine = stubDesktop('loading');
    existingPlayer('0.0.1');
    renderMainMenu({ introSeenAtLaunch: true });
    await settle();
    expect(whatsNew()).not.toBeInTheDocument();

    await pushEngine('ready');

    expect(await screen.findByRole('dialog', { name: `v${APP_VERSION}` })).toBeInTheDocument();
  });

  it('waits while the AI setup gate is open, then opens after the player closes it', async () => {
    // Auto-load has nothing coming, so the stopped engine stays stopped.
    stubDesktop('stopped');
    markAutoLoadSettled();
    existingPlayer('0.0.1');
    renderMainMenu({ introSeenAtLaunch: true });
    const gate = await screen.findByRole('dialog', { name: /model didn.t load/ });
    await settle();
    expect(whatsNew()).not.toBeInTheDocument();

    fireEvent.keyDown(gate, { key: 'Escape' });
    await waitFor(() => expect(setupGate()).not.toBeInTheDocument());

    expect(await screen.findByRole('dialog', { name: `v${APP_VERSION}` })).toBeInTheDocument();
  });
});
