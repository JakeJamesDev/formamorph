import { act, render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { renderMainMenu } from '@/test/mainMenu';
import { resetTutorials } from '@/lib/tutorials';
import { CUDA_PROMPT_SEEN_KEY, CudaNoticeHost } from '@/components/menu/CudaNotice';
import type { CudaStatus, LocalLlmState } from '@/lib/imageGen/desktop';

vi.mock('react-toastify', () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn(), warn: vi.fn(), dismiss: vi.fn(), update: vi.fn(), isActive: vi.fn(() => false) },
  ToastContainer: () => null,
}));
vi.mock('./VRMViewer', async () => {
  const { forwardRef } = await import('react');
  return { default: forwardRef(() => null) };
});

type CudaBridge = NonNullable<NonNullable<Window['formamorphDesktop']>['cuda']>;

const BASE = { nvidia: true, support: { supported: true as const }, downloadBytes: 592_528_572 };
const NOT_INSTALLED: CudaStatus = { ...BASE, state: 'not-installed', partialBytes: 0 };

const engine = (status: LocalLlmState['status']): LocalLlmState => ({
  status, modelPath: null, modelId: null, port: null, error: null, loadProgress: null, contextSize: null, gpuLayers: null,
  flashAttention: null, parallelRequests: null, unifiedKvCache: null, kCacheType: null, vCacheType: null, kvCacheInRam: null,
  maxContextSize: null, engineVramMB: null, backendSetting: null, gpuBackend: null, gpuDeviceNames: null, deviceVramTotalMB: null, deviceVramFreeMB: null,
  gpuDeviceIndex: null, gpuDeviceRawIndex: null, gpuDeviceOrigin: null, gpuDeviceOptions: null, serverPid: null, cudaFallback: null, cudaError: null,
});

let installCalls = 0;
let pushEngine: (s: LocalLlmState) => void = () => {};

/** Stand up a desktop whose engine starts stopped and whose CUDA status is the one given. */
function stubDesktop(cuda: CudaStatus | null) {
  installCalls = 0;
  const listeners = new Set<(s: LocalLlmState) => void>();
  pushEngine = (s) => act(() => { listeners.forEach((cb) => cb(s)); });
  const bridge: CudaBridge | undefined = cuda
    ? {
      status: () => Promise.resolve(cuda),
      install: () => { installCalls += 1; return Promise.resolve(cuda); },
      cancel: () => Promise.resolve(true),
      remove: () => Promise.resolve(cuda),
      retry: () => Promise.resolve(cuda),
      onStatus: () => () => {},
    }
    : undefined;
  window.formamorphDesktop = {
    fetch: () => Promise.resolve({ ok: true, status: 200, body: '' }),
    vramStats: () => Promise.resolve({ gpus: [], processes: [], selfPid: null }),
    ...(bridge ? { cuda: bridge } : {}),
    llm: {
      status: () => Promise.resolve(engine('stopped')),
      onStatus: (cb: (s: LocalLlmState) => void) => { listeners.add(cb); return () => { listeners.delete(cb); }; },
      listDevices: () => Promise.resolve({ backend: null, devices: [], autoPick: null }),
      listModels: () => Promise.resolve(['m.gguf']),
      listInstalled: () => Promise.resolve([]),
    },
  } as unknown as Window['formamorphDesktop'];
}

const answer = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  resetTutorials();
  // An engine that starts has a model, so the player already went through the AI setup nudge.
  localStorage.setItem('FORMAMORPH_aiSetupSeen', '1');
  window.history.replaceState(null, '', '/');
  vi.stubGlobal('fetch', vi.fn(async () => answer({ data: [] })));
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  delete (window as { formamorphDesktop?: unknown }).formamorphDesktop;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const notice = () => screen.queryByRole('region', { name: 'CUDA Engine' });
/** Lets the mount-time status reads settle. */
const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 60)));
const startEngine = async () => {
  await settle();
  pushEngine(engine('loading'));
  await settle();
  pushEngine(engine('ready'));
  await settle();
};

describe('the CUDA notice on the main menu', () => {
  it('shows once the engine first starts on a supported card with no CUDA install', async () => {
    stubDesktop(NOT_INSTALLED);
    renderMainMenu();
    await settle();
    expect(notice()).not.toBeInTheDocument();

    await startEngine();

    expect(await screen.findByRole('region', { name: 'CUDA Engine' })).toHaveTextContent('about 593 MB');
    expect(screen.getByRole('button', { name: 'Download' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Not Now' })).toBeInTheDocument();
  });

  it.each<[string, CudaStatus | null]>([
    ['an unsupported card', { ...BASE, support: { supported: false, reason: 'card-too-old', cardName: 'NVIDIA GeForce GTX 1080' }, state: 'unsupported' }],
    ['a machine without an NVIDIA card', { ...BASE, nvidia: false, support: { supported: false, reason: 'no-nvidia-card' }, state: 'unsupported' }],
    ['a CUDA install', { ...BASE, state: 'installed', tag: 'b12078' }],
    ['an older install waiting for its replace', { ...BASE, state: 'stale', tag: 'b11000', partialBytes: 0 }],
    ['a build without the CUDA bridge', null],
  ])('never shows for %s', async (_name, cuda) => {
    stubDesktop(cuda);
    renderMainMenu();
    await startEngine();

    expect(notice()).not.toBeInTheDocument();
    expect(localStorage.getItem(CUDA_PROMPT_SEEN_KEY)).toBeNull();
  });

  it('waits while another first-run step holds the screen, then shows', async () => {
    stubDesktop(NOT_INSTALLED);
    const view = render(<CudaNoticeHost held />);
    await startEngine();
    expect(notice()).not.toBeInTheDocument();

    view.rerender(<CudaNoticeHost held={false} />);

    expect(await screen.findByRole('region', { name: 'CUDA Engine' })).toBeInTheDocument();
  });

  it('waits while a modal dialog is open anywhere, then shows once it closes', async () => {
    stubDesktop(NOT_INSTALLED);
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('data-state', 'open');
    document.body.appendChild(dialog);
    render(<CudaNoticeHost held={false} />);
    await startEngine();
    expect(notice()).not.toBeInTheDocument();

    act(() => { dialog.remove(); });

    expect(await screen.findByRole('region', { name: 'CUDA Engine' })).toBeInTheDocument();
  });

  it('ignores a non-modal window and a closed dialog', async () => {
    stubDesktop(NOT_INSTALLED);
    for (const attrs of [{ 'aria-modal': 'false', 'data-state': 'open' }, { 'data-state': 'closed' }]) {
      const el = document.createElement('div');
      el.setAttribute('role', 'dialog');
      Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
      document.body.appendChild(el);
    }
    render(<CudaNoticeHost held={false} />);
    await startEngine();

    expect(await screen.findByRole('region', { name: 'CUDA Engine' })).toBeInTheDocument();
    document.querySelectorAll('[role="dialog"]').forEach((el) => el.remove());
  });

  it('stays up while a tutorial note is open', async () => {
    stubDesktop(NOT_INSTALLED);
    renderMainMenu();
    await startEngine();

    expect(await screen.findByRole('dialog')).toHaveAttribute('data-state', 'open');
    expect(notice()).toBeInTheDocument();
  });

  it('holds back while the load is still deciding whether the AI is usable, then shows', async () => {
    stubDesktop(NOT_INSTALLED);
    renderMainMenu();
    await settle();
    pushEngine(engine('loading'));
    await settle();
    expect(notice()).not.toBeInTheDocument();

    pushEngine(engine('ready'));

    expect(await screen.findByRole('region', { name: 'CUDA Engine' })).toBeInTheDocument();
  });

  it('shows for a menu that mounts after the engine is already ready', async () => {
    stubDesktop(NOT_INSTALLED);
    renderMainMenu();
    await settle();
    pushEngine(engine('ready'));

    expect(await screen.findByRole('region', { name: 'CUDA Engine' })).toBeInTheDocument();
  });

  it('starts the install on Download, closes, and stays closed on the next start', async () => {
    stubDesktop(NOT_INSTALLED);
    const first = renderMainMenu();
    await startEngine();
    fireEvent.click(await screen.findByRole('button', { name: 'Download' }));

    expect(installCalls).toBe(1);
    expect(notice()).not.toBeInTheDocument();
    expect(localStorage.getItem(CUDA_PROMPT_SEEN_KEY)).not.toBeNull();

    first.unmount();
    stubDesktop(NOT_INSTALLED);
    renderMainMenu();
    await startEngine();
    expect(notice()).not.toBeInTheDocument();
  });

  it('closes on Not Now without installing, and stays closed on the next start', async () => {
    stubDesktop(NOT_INSTALLED);
    const first = renderMainMenu();
    await startEngine();
    fireEvent.click(await screen.findByRole('button', { name: 'Not Now' }));

    expect(installCalls).toBe(0);
    expect(notice()).not.toBeInTheDocument();

    first.unmount();
    stubDesktop(NOT_INSTALLED);
    renderMainMenu();
    await startEngine();
    await waitFor(() => expect(notice()).not.toBeInTheDocument());
  });
});
