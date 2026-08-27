// The gate's local first-run walk: recommend → expand → download → dismiss → load → ready. Everything
// asserted here is what the player sees or clicks, never how the component tracks where it is.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AiSetupGate } from './AiSetupGate';
import { LOCAL_MODELS, groupModelsByFit, type LocalModelInfo } from '@/lib/localModels';
import { downloadLocalModel, type LocalDownloadProgress } from '@/lib/imageGen/desktop';
import { toast } from 'react-toastify';

const DISCRETE = 'NVIDIA GeForce RTX 4080';

// The desktop bits the gate reads, held where both the mock factories and the tests can reach them.
const rig = vi.hoisted(() => ({
  engineStatus: 'stopped' as 'stopped' | 'loading' | 'ready' | 'error',
  engineError: null as string | null,
  gpuTotalMB: 16376 as number | null,
  emitProgress: null as null | ((p: LocalDownloadProgress) => void),
  settleDownload: null as null | (() => void),
  failDownload: null as null | ((message: string) => void),
}));

vi.mock('@/lib/useLocalLlmStatus', () => ({
  useLocalLlmStatus: () => ({ status: rig.engineStatus, modelId: 'loaded.gguf', error: rig.engineError }),
}));

vi.mock('@/lib/useVramStats', async (orig) => ({
  ...(await orig<typeof import('@/lib/useVramStats')>()),
  useVramStats: () => ({
    status: rig.gpuTotalMB == null ? 'no-gpu' : 'online',
    gpus: rig.gpuTotalMB == null
      ? []
      : [{ index: 0, name: DISCRETE, totalMB: rig.gpuTotalMB, usedMB: 0, freeMB: rig.gpuTotalMB }],
    processes: [], selfPid: null, lastUpdated: 0,
  }),
}));

// Only the download bridge is stubbed; the module's pure helpers stay real.
vi.mock('@/lib/imageGen/desktop', async (orig) => {
  const actual = await orig<typeof import('@/lib/imageGen/desktop')>();
  return {
    ...actual,
    downloadLocalModel: vi.fn(() => new Promise<{ path: string }>((resolve, reject) => {
      rig.settleDownload = () => resolve({ path: 'D:/models/m.gguf' });
      rig.failDownload = (message: string) => reject(new Error(message));
    })),
    cancelLocalDownload: vi.fn(() => Promise.resolve(true)),
    subscribeLocalDownload: (cb: (p: LocalDownloadProgress) => void) => {
      rig.emitProgress = cb;
      return () => { rig.emitProgress = null; };
    },
  };
});

vi.mock('react-toastify', () => ({
  toast: Object.assign(vi.fn(() => 'toast-id'), { update: vi.fn(), dismiss: vi.fn(), error: vi.fn() }),
}));

// The gate reads one field off settings; the provider itself is a different surface's concern.
vi.mock('@/contexts/SettingsContext', () => ({
  useSettings: () => ({ activeEndpointUrl: 'http://localhost:8977/v1/chat/completions' }),
}));

const onOpenChange = vi.fn();
const onOpenSettings = vi.fn();
const onReady = vi.fn();

/** Mount the gate on the desktop local branch — the first-run case, with nothing downloaded yet. */
function mountGate(props: Partial<Parameters<typeof AiSetupGate>[0]> = {}) {
  const all = {
    open: true, reason: 'firstRun' as const, mode: 'local' as const, blocker: 'noModel' as const,
    reachable: false as boolean | null, recheck: () => {}, onOpenChange, onOpenSettings, onReady,
    ...props,
  };
  const view = render(<AiSetupGate {...all} />);
  return {
    ...view,
    /** Re-render with a changed prop, as the caller would when it closes the gate. */
    set: (next: Partial<typeof all>) => view.rerender(<AiSetupGate {...all} {...next} />),
  };
}

/** Push the engine to a new status and let the gate's effects run. */
async function setEngine(status: typeof rig.engineStatus, view: { set: (n: Record<string, unknown>) => void }) {
  rig.engineStatus = status;
  await act(async () => { view.set({}); });
}

const row = (model: LocalModelInfo) => screen.getByText(model.name).closest('div.rounded-md') as HTMLElement;

/** The dialog's own X — it carries the same accessible name as the footer button, via an sr-only label. */
const dialogX = () => screen.getAllByRole('button', { name: 'Close' }).find((b) => b.querySelector('.sr-only'));
/** The footer's Close button, the one with visible text. */
const closeButton = () => screen.getAllByRole('button', { name: 'Close' })
  .find((b) => !b.querySelector('.sr-only')) as HTMLElement;

// A 16 GB card: every section has content, so the fit grouping is visible on screen.
const GROUPS = groupModelsByFit('tier16');
const PICK = GROUPS.recommended as LocalModelInfo;

beforeEach(() => {
  vi.clearAllMocks();
  rig.engineStatus = 'stopped';
  rig.engineError = null;
  rig.gpuTotalMB = 16376;
  rig.emitProgress = null;
  rig.settleDownload = null;
  rig.failDownload = null;
});

describe('AiSetupGate — the local setup walk', () => {
  it('recommends the model built for the detected card, and names the card', async () => {
    mountGate();
    expect(await screen.findByText(PICK.name)).toBeInTheDocument();
    expect(within(row(PICK)).getByText('Recommended')).toBeInTheDocument();
    expect(screen.getByText(new RegExp(DISCRETE))).toBeInTheDocument();
    expect(screen.getByText(/16\.0 GB VRAM/)).toBeInTheDocument();
  });

  it('never promises the game starts on its own', () => {
    // The old copy said a download would launch the player into the game. Nothing in the app does that.
    mountGate();
    expect(document.body.textContent).not.toMatch(/starts on its own/);
    expect(screen.getByText(/Settings → Endpoints/)).toBeInTheDocument();
  });

  it('expands into three fit-grouped sections inside a scroller, and collapses back', async () => {
    mountGate();
    await userEvent.click(screen.getByRole('button', { name: 'Show all models' }));

    expect(screen.getByText('Best for Your GPU')).toBeInTheDocument();
    expect(screen.getByText('Also Fits')).toBeInTheDocument();
    expect(screen.getByText('Too Big for Your GPU')).toBeInTheDocument();
    // Without a scroll container the list runs off the bottom of the viewport, buttons included.
    expect(screen.getByTestId('model-list-scroll')).toBeInTheDocument();
    // Every catalog entry is reachable, and the pick is badged in place rather than duplicated above.
    for (const m of LOCAL_MODELS) expect(screen.getByText(m.name), m.id).toBeInTheDocument();
    expect(screen.getAllByText('Recommended')).toHaveLength(1);
    expect(within(row(PICK)).getByText('Recommended')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Show fewer models' }));
    expect(screen.queryByText('Also Fits')).not.toBeInTheDocument();
    expect(screen.getByText(PICK.name)).toBeInTheDocument();
  });

  it('badges reasoning models and keeps too-big ones downloadable', async () => {
    mountGate();
    await userEvent.click(screen.getByRole('button', { name: 'Show all models' }));

    const reasoner = LOCAL_MODELS.find((m) => m.reasoning) as LocalModelInfo;
    expect(within(row(reasoner)).getByText('Reasoning')).toBeInTheDocument();

    const oversized = GROUPS.tooBig[0];
    await userEvent.click(within(row(oversized)).getByRole('button', { name: 'Download' }));
    expect(downloadLocalModel).toHaveBeenCalledWith({ url: oversized.url, fileName: oversized.fileName });
  });

  it('shows live byte progress once a download starts', async () => {
    mountGate();
    await userEvent.click(within(row(PICK)).getByRole('button', { name: 'Download' }));
    expect(downloadLocalModel).toHaveBeenCalledWith({ url: PICK.url, fileName: PICK.fileName });

    await act(async () => {
      rig.emitProgress?.({ fileName: PICK.fileName, received: 7_165_000_000, total: 14_330_000_000, done: false });
    });
    expect(screen.getByText('7.2 GB / 14.3 GB (50%)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument();
    // A download used to hide the X and swallow escape, so the player was held here until it finished.
    expect(dialogX()).toBeInTheDocument();
  });

  it('hands a download to a progress toast when the player closes the gate', async () => {
    const view = mountGate();
    await userEvent.click(within(row(PICK)).getByRole('button', { name: 'Download' }));
    await act(async () => {
      rig.emitProgress?.({ fileName: PICK.fileName, received: 7_165_000_000, total: 14_330_000_000, done: false });
    });

    await userEvent.click(closeButton());
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(toast).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ toastId: 'ai-setup-progress', autoClose: false }),
    );
    // The toast carries the name and the byte line the dialog was showing.
    const body = render(vi.mocked(toast).mock.calls[0][0] as React.ReactElement);
    expect(body.container.textContent).toContain(`Downloading ${PICK.name}`);
    expect(body.container.textContent).toContain('7.2 GB / 14.3 GB (50%)');

    // It keeps updating in place rather than stacking a toast per event.
    await act(async () => {
      view.set({ open: false });
      rig.emitProgress?.({ fileName: PICK.fileName, received: 10_000_000_000, total: 14_330_000_000, done: false });
    });
    expect(toast.update).toHaveBeenCalledWith('ai-setup-progress', expect.objectContaining({ progress: 0.7 }));
  });

  it('holds the gate on a loading step while the engine reads the weights', async () => {
    mountGate();
    await userEvent.click(within(row(PICK)).getByRole('button', { name: 'Download' }));
    await act(async () => {
      rig.emitProgress?.({ fileName: PICK.fileName, received: 14_330_000_000, total: 14_330_000_000, done: true });
    });

    // The silent window between file-landed and engine-ready gets its own state, not the model list back.
    expect(screen.getByText('Loading your model')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Show all models' })).not.toBeInTheDocument();
    expect(onReady).not.toHaveBeenCalled();
  });

  it('ends on a success step, and only fires the ready callback from its action', async () => {
    const view = mountGate();
    await userEvent.click(within(row(PICK)).getByRole('button', { name: 'Download' }));
    await act(async () => { rig.settleDownload?.(); });
    await setEngine('ready', view);

    expect(screen.getByText('You’re ready')).toBeInTheDocument();
    // Auto-closing on ready is what made setup end in a vanishing dialog with nothing to click.
    expect(onReady).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Start Playing' }));
    expect(onReady).toHaveBeenCalledTimes(1);
  });

  it('names the success action for a player already in a world', async () => {
    const view = mountGate({ reason: 'play' });
    await userEvent.click(within(row(PICK)).getByRole('button', { name: 'Download' }));
    await act(async () => { rig.settleDownload?.(); });
    await setEngine('ready', view);
    expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
  });

  it('swaps the progress toast for a completion toast when the gate was dismissed', async () => {
    const view = mountGate();
    await userEvent.click(within(row(PICK)).getByRole('button', { name: 'Download' }));
    await act(async () => {
      rig.emitProgress?.({ fileName: PICK.fileName, received: 1, total: 14_330_000_000, done: false });
    });
    await userEvent.click(closeButton());
    await act(async () => { view.set({ open: false }); });

    await act(async () => { rig.settleDownload?.(); });
    rig.engineStatus = 'ready';
    await act(async () => { view.set({ open: false }); });

    expect(toast.dismiss).toHaveBeenCalledWith('ai-setup-progress');
    const done = vi.mocked(toast).mock.calls.find(([, o]) => (o as { toastId?: string })?.toastId === 'ai-setup-ready');
    expect(done, 'no completion toast').toBeTruthy();
    const body = render(done?.[0] as React.ReactElement);
    expect(body.container.textContent).toContain('Your model is ready');

    await userEvent.click(within(body.container).getByRole('button', { name: 'Open Settings' }));
    expect(onOpenSettings).toHaveBeenCalled();
  });

  it('treats a paused download as a choice and returns to the list', async () => {
    mountGate();
    await userEvent.click(within(row(PICK)).getByRole('button', { name: 'Download' }));
    await act(async () => { rig.failDownload?.('DOWNLOAD_PAUSED'); });

    expect(screen.getByText(PICK.name)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show all models' })).toBeInTheDocument();
    expect(screen.queryByText(/DOWNLOAD_PAUSED/)).not.toBeInTheDocument();
  });

  it('reports a download that actually failed', async () => {
    mountGate();
    await userEvent.click(within(row(PICK)).getByRole('button', { name: 'Download' }));
    await act(async () => { rig.failDownload?.('disk full'); });
    expect(screen.getByText('disk full')).toBeInTheDocument();
  });

  it('lets the player leave without downloading, and says where setup lives', async () => {
    mountGate();
    await userEvent.click(screen.getByRole('button', { name: 'Later' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    // Nothing was in flight, so nothing is handed to a toast.
    expect(toast).not.toHaveBeenCalled();
  });

  it('keeps the handoff toast full while the engine reads the weights', async () => {
    // The bar emptying on the final event reads as the download restarting at the one moment it succeeded.
    const view = mountGate();
    await userEvent.click(within(row(PICK)).getByRole('button', { name: 'Download' }));
    await act(async () => {
      rig.emitProgress?.({ fileName: PICK.fileName, received: 14_000_000_000, total: 14_330_000_000, done: false });
    });
    await userEvent.click(closeButton());
    await act(async () => { view.set({ open: false }); });

    await act(async () => {
      rig.emitProgress?.({ fileName: PICK.fileName, received: 14_330_000_000, total: 14_330_000_000, done: true });
    });
    const last = vi.mocked(toast.update).mock.calls.at(-1);
    expect((last?.[1] as { progress?: number })?.progress).toBeGreaterThan(0.9);
  });

  it('takes the handoff toast down and reports a download that failed after the gate closed', async () => {
    const view = mountGate();
    await userEvent.click(within(row(PICK)).getByRole('button', { name: 'Download' }));
    await act(async () => {
      rig.emitProgress?.({ fileName: PICK.fileName, received: 1, total: 14_330_000_000, done: false });
    });
    await userEvent.click(closeButton());
    await act(async () => { view.set({ open: false }); });

    await act(async () => { rig.failDownload?.('disk full'); });

    // A toast that outlives its download claims work that stopped, and hides the reason it stopped.
    expect(toast.dismiss).toHaveBeenCalledWith('ai-setup-progress');
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('disk full'));
  });

  it('takes the handoff toast down when the engine fails to load the model', async () => {
    const view = mountGate();
    await userEvent.click(within(row(PICK)).getByRole('button', { name: 'Download' }));
    await act(async () => {
      rig.emitProgress?.({ fileName: PICK.fileName, received: 14_330_000_000, total: 14_330_000_000, done: true });
    });
    await userEvent.click(closeButton());
    await act(async () => { view.set({ open: false }); });

    rig.engineStatus = 'error';
    rig.engineError = 'not enough VRAM';
    await act(async () => { view.set({ open: false }); });

    expect(toast.dismiss).toHaveBeenCalledWith('ai-setup-progress');
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('not enough VRAM'));
  });

  it('sizes the recommendation to a smaller card', () => {
    rig.gpuTotalMB = 8192;
    mountGate();
    expect(screen.getByText(groupModelsByFit('tier8').recommended?.name as string)).toBeInTheDocument();
  });
});
