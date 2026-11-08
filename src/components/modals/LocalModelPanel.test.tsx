// Storage is real (in-memory): SettingsProvider reads it on mount, and the device setting persists there.
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SettingsProvider } from '@/contexts/SettingsContext';
import { LocalModelPanel } from './LocalModelPanel';
import { LocalEngineManager } from '../LocalEngineManager';
import { closeErrorDetails, getErrorDetailsState } from '@/lib/errorDetails';
import type { CudaInstallError, CudaStatus, EngineBackendChoice, EngineDeviceList, LocalLlmState } from '@/lib/imageGen/desktop';

type CudaBridge = NonNullable<NonNullable<Window['formamorphDesktop']>['cuda']>;

const CUDA_BASE = { nvidia: true, support: { supported: true as const }, downloadBytes: 592_528_572 };
const notInstalled = (over: { partialBytes?: number; error?: CudaInstallError } = {}): CudaStatus =>
  ({ ...CUDA_BASE, state: 'not-installed', partialBytes: 0, ...over });

/** A CUDA bridge whose status the test pushes, recording each call. */
function cudaBridge(initial: CudaStatus) {
  let listener: ((s: CudaStatus) => void) | null = null;
  const calls: string[] = [];
  const bridge: CudaBridge = {
    status: () => Promise.resolve(initial),
    install: () => { calls.push('install'); return Promise.resolve(initial); },
    cancel: () => { calls.push('cancel'); return Promise.resolve(true); },
    remove: () => { calls.push('remove'); return Promise.resolve(initial); },
    retry: () => { calls.push('retry'); return Promise.resolve(initial); },
    onStatus: (cb) => { listener = cb; return () => { listener = null; }; },
  };
  const push = (s: CudaStatus) => act(() => { listener?.(s); });
  return { bridge, calls, push };
}

// The model manager is its own surface with its own coverage, and mounting it pulls in the whole install
// /download/move bridge. Nothing here is about it.
vi.mock('./LocalModelModal', () => ({ LocalModelModal: () => null }));

const DISCRETE = 'NVIDIA GeForce RTX 4080';
const IGPU = 'Intel(R) UHD Graphics 770';

/** A loaded engine at the renderer's own defaults, so only the device row can differ from what's applied. */
const readyEngine = (over: Partial<LocalLlmState> = {}): LocalLlmState => ({
  status: 'ready', modelPath: 'D:/models/m.gguf', modelId: 'm.gguf', port: 8977, error: null, loadProgress: null,
  contextSize: 8192, gpuLayers: -1, flashAttention: true, parallelRequests: 2, unifiedKvCache: true, kCacheType: 'f16', vCacheType: 'f16', kvCacheInRam: false,
  maxContextSize: 32768, engineVramMB: 4096, backendSetting: 'auto',
  gpuBackend: 'vulkan', gpuDeviceNames: [IGPU, DISCRETE], deviceVramTotalMB: 16376, deviceVramFreeMB: 15176,
  gpuDeviceIndex: null, gpuDeviceRawIndex: null, gpuDeviceOrigin: null, gpuDeviceOptions: null, serverPid: null, cudaFallback: false, cudaError: null,
  ...over,
});

let setOptionsCalls: Record<string, unknown>[] = [];
let contextOverflowCalls: string[] = [];
let listDevicesCalls: unknown[] = [];
let restartCalls = 0;

/** Stand the desktop bridge up so the panel takes its desktop path — the only one the picker exists on. */
function stubDesktop({ devices, backend = 'vulkan', autoPick = null, choice, listFor, engine = readyEngine(), cuda = null }: {
  devices: string[];
  backend?: string | null;
  autoPick?: string | null;
  choice?: EngineBackendChoice;
  /** Answers by the pending settings asked about, in place of the fixed list. */
  listFor?: (pending: { engineBackend?: string; gpuDevice?: string } | undefined) => EngineDeviceList;
  engine?: LocalLlmState;
  cuda?: CudaBridge | null;
}) {
  window.formamorphDesktop = {
    fetch: () => Promise.resolve({ ok: true, status: 200, body: '' }),
    vramStats: () => Promise.resolve({ gpus: [], processes: [], selfPid: null }),
    ...(cuda ? { cuda } : {}),
    llm: {
      status: () => Promise.resolve(engine),
      onStatus: () => () => {},
      listDevices: (pending?: { engineBackend?: string; gpuDevice?: string }) => {
        listDevicesCalls.push(pending);
        return Promise.resolve(listFor ? listFor(pending) : { backend, devices, autoPick, ...(choice ? { choice } : {}) });
      },
      restart: () => { restartCalls += 1; return Promise.resolve(engine); },
      setOptions: (opts: Record<string, unknown>) => { setOptionsCalls.push(opts); return Promise.resolve(engine); },
      setContextOverflow: (policy: string) => { contextOverflowCalls.push(policy); return Promise.resolve(policy); },
      stop: () => Promise.resolve(engine),
    },
  } as unknown as Window['formamorphDesktop'];
}

const openPanel = () => render(<SettingsProvider><LocalModelPanel /></SettingsProvider>);

/** The device row's dropdown. The panel's other controls are sliders and toggles, so it is the only one. */
const devicePicker = () => screen.getByRole('combobox');

/** Seed the persisted device choice the way SettingsProvider stores it (raw string, app-prefixed key). */
const savedDevice = (name: string) => localStorage.setItem('FORMAMORPH_localGpuDevice', name);

beforeEach(() => {
  localStorage.clear();
  setOptionsCalls = [];
  contextOverflowCalls = [];
  listDevicesCalls = [];
  restartCalls = 0;
  delete (window as { formamorphDesktop?: unknown }).formamorphDesktop;
});

describe('local model Unified KV Cache row', () => {
  const unifiedBox = () => screen.getByRole('checkbox', { name: /unified kv cache/i });
  const reloadButton = () => screen.getByRole('button', { name: /save.*reload/i });

  it('shows in Advanced only', async () => {
    stubDesktop({ devices: [IGPU, DISCRETE] });
    openPanel();
    await screen.findAllByRole('combobox');
    expect(screen.queryByText('Unified KV Cache')).toBeNull();

    await userEvent.click(screen.getByRole('radio', { name: 'Advanced' }));
    expect(unifiedBox()).toBeChecked();
  });

  it('stays disarmed while it matches the applied value, then arms on a change and sends it', async () => {
    stubDesktop({ devices: [IGPU, DISCRETE] });
    localStorage.setItem('FORMAMORPH_advancedMode', 'true');
    openPanel();
    await screen.findAllByRole('combobox');
    expect(reloadButton()).toBeDisabled();

    await userEvent.click(unifiedBox());
    expect(reloadButton()).toBeEnabled();
    await userEvent.click(reloadButton());
    expect(setOptionsCalls[0].unifiedKvCache).toBe(false);
  });

  it('Reset restores on', async () => {
    stubDesktop({ devices: [IGPU, DISCRETE], engine: readyEngine({ unifiedKvCache: false }) });
    localStorage.setItem('FORMAMORPH_advancedMode', 'true');
    localStorage.setItem('FORMAMORPH_localUnifiedKvCache', 'false');
    openPanel();
    await screen.findAllByRole('combobox');
    expect(unifiedBox()).not.toBeChecked();

    await userEvent.click(screen.getByRole('button', { name: /reset/i }));
    expect(unifiedBox()).toBeChecked();
  });
});

describe('local model KV cache rows', () => {
  const kvBox = () => screen.getByRole('checkbox', { name: /kv cache in ram/i });
  const flashBox = () => screen.getByRole('checkbox', { name: /flash attention/i });
  const reloadButton = () => screen.getByRole('button', { name: /save.*reload/i });
  const advanced = async (engine = readyEngine()) => {
    stubDesktop({ devices: [IGPU, DISCRETE], engine });
    localStorage.setItem('FORMAMORPH_advancedMode', 'true');
    openPanel();
    await screen.findAllByRole('combobox');
  };
  // The cache pickers are the only comboboxes whose trigger id names them.
  const picker = (id: string) => document.getElementById(id) as HTMLElement;
  const choose = async (id: string, label: string) => {
    await userEvent.click(picker(id));
    await userEvent.click(await screen.findByRole('option', { name: label }));
  };

  it('show in Advanced only', async () => {
    stubDesktop({ devices: [IGPU, DISCRETE] });
    openPanel();
    await screen.findByRole('combobox');
    expect(screen.queryByText('K Cache Type')).toBeNull();
    expect(screen.queryByText('V Cache Type')).toBeNull();
    expect(screen.queryByText('KV Cache in RAM')).toBeNull();

    await userEvent.click(screen.getByRole('radio', { name: 'Advanced' }));
    expect(picker('localKCacheType')).toHaveTextContent('F16');
    expect(picker('localVCacheType')).toHaveTextContent('F16');
    expect(kvBox()).not.toBeChecked();
  });

  it('stay disarmed at the defaults, then arm on a change and send all three', async () => {
    await advanced();
    expect(reloadButton()).toBeDisabled();

    await choose('localKCacheType', 'Q8_0');
    await userEvent.click(kvBox());
    expect(reloadButton()).toBeEnabled();
    await userEvent.click(reloadButton());
    expect(setOptionsCalls[0]).toMatchObject({ kCacheType: 'q8_0', vCacheType: 'f16', kvCacheInRam: true });
  });

  it('block a quantized V cache while Flash Attention is off, and say why', async () => {
    localStorage.setItem('FORMAMORPH_localFlashAttention', 'false');
    await advanced(readyEngine({ flashAttention: false }));
    await userEvent.click(picker('localVCacheType'));
    expect(await screen.findByRole('option', { name: 'Q8_0' })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('option', { name: 'Q4_0' })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('option', { name: 'F16' })).not.toHaveAttribute('aria-disabled', 'true');
  });

  it('block Flash Attention while V is quantized, without changing V', async () => {
    localStorage.setItem('FORMAMORPH_localVCacheType', 'q8_0');
    await advanced(readyEngine({ vCacheType: 'q8_0' }));
    expect(flashBox()).toBeDisabled();
    expect(flashBox()).toBeChecked();
    expect(picker('localVCacheType')).toHaveTextContent('Q8_0');
  });

  it('stay disarmed when main coerced a stored quantized V to f16 with Flash Attention off', async () => {
    localStorage.setItem('FORMAMORPH_localFlashAttention', 'false');
    localStorage.setItem('FORMAMORPH_localVCacheType', 'q8_0');
    await advanced(readyEngine({ flashAttention: false, vCacheType: 'f16' }));
    expect(reloadButton()).toBeDisabled();
  });

  it('Reset restores the defaults', async () => {
    localStorage.setItem('FORMAMORPH_localKCacheType', 'q4_0');
    localStorage.setItem('FORMAMORPH_localVCacheType', 'q8_0');
    localStorage.setItem('FORMAMORPH_localKvCacheInRam', 'true');
    await advanced(readyEngine({ kCacheType: 'q4_0', vCacheType: 'q8_0', kvCacheInRam: true }));
    expect(kvBox()).toBeChecked();

    await userEvent.click(screen.getByRole('button', { name: /reset/i }));
    expect(picker('localKCacheType')).toHaveTextContent('F16');
    expect(picker('localVCacheType')).toHaveTextContent('F16');
    expect(kvBox()).not.toBeChecked();
  });
});

describe('local model Context Overflow row', () => {
  const picker = () => document.getElementById('localContextOverflow') as HTMLElement;
  const reloadButton = () => screen.getByRole('button', { name: /save.*reload/i });
  // The manager is what pushes a change to the engine, so it mounts beside the panel as in the app.
  const openWithManager = () => render(<SettingsProvider><LocalEngineManager /><LocalModelPanel /></SettingsProvider>);

  it('shows in Advanced only, on Truncate Middle by default', async () => {
    stubDesktop({ devices: [IGPU, DISCRETE] });
    openPanel();
    await screen.findByRole('combobox');
    expect(screen.queryByText('Context Overflow')).toBeNull();

    await userEvent.click(screen.getByRole('radio', { name: 'Advanced' }));
    expect(picker()).toHaveTextContent('Truncate Middle');
  });

  it('sends a change to the engine at once, with no reload', async () => {
    stubDesktop({ devices: [IGPU, DISCRETE] });
    localStorage.setItem('FORMAMORPH_advancedMode', 'true');
    openWithManager();
    await screen.findAllByRole('combobox');
    expect(contextOverflowCalls).toEqual(['truncateMiddle']);

    await userEvent.click(picker());
    await userEvent.click(await screen.findByRole('option', { name: 'Stop at Limit' }));
    expect(picker()).toHaveTextContent('Stop at Limit');
    expect(contextOverflowCalls.at(-1)).toBe('stopAtLimit');
    expect(reloadButton()).toBeDisabled();
    expect(setOptionsCalls.some((o) => 'contextOverflow' in o)).toBe(false);
  });

  it('Reset restores Truncate Middle', async () => {
    localStorage.setItem('FORMAMORPH_localContextOverflow', 'rollingWindow');
    stubDesktop({ devices: [IGPU, DISCRETE] });
    localStorage.setItem('FORMAMORPH_advancedMode', 'true');
    openPanel();
    await screen.findAllByRole('combobox');
    expect(picker()).toHaveTextContent('Rolling Window');

    await userEvent.click(screen.getByRole('button', { name: /reset/i }));
    expect(picker()).toHaveTextContent('Truncate Middle');
  });
});

describe('local model GPU device picker', () => {
  it('offers every GPU the engine can see, and starts on Auto naming the card it will use', async () => {
    stubDesktop({ devices: [IGPU, DISCRETE], autoPick: DISCRETE });
    openPanel();

    const picker = await screen.findByRole('combobox');
    expect(picker).toHaveTextContent('Auto');

    await userEvent.click(picker);
    const options = (await screen.findAllByRole('option')).map((o) => o.textContent);
    expect(options).toEqual([`Auto (${DISCRETE})`, 'All GPUs', IGPU, DISCRETE]);
  });

  it('labels Auto with All GPUs when it will not choose between several real cards', async () => {
    stubDesktop({ devices: ['NVIDIA GeForce RTX 3090', 'NVIDIA GeForce RTX 3090'], autoPick: null });
    openPanel();

    await userEvent.click(await screen.findByRole('combobox'));
    const options = (await screen.findAllByRole('option')).map((o) => o.textContent);
    expect(options[0]).toBe('Auto (All GPUs)');
  });

  it('offers All GPUs, and choosing it arms a reload that undoes the pin in force', async () => {
    // A dGPU+iGPU rig whose owner wants llama.cpp splitting across both: Auto pinned the discrete card,
    // and All GPUs is the way out.
    stubDesktop({
      devices: [IGPU, DISCRETE],
      engine: readyEngine({ gpuDeviceNames: [DISCRETE], gpuDeviceIndex: 1, gpuDeviceOrigin: 'auto', gpuDeviceOptions: [IGPU, DISCRETE] }),
    });
    openPanel();

    await userEvent.click(await screen.findByRole('combobox'));
    await userEvent.click(await screen.findByRole('option', { name: 'All GPUs' }));

    const reload = screen.getByRole('button', { name: /save.*reload/i });
    expect(reload).toBeEnabled();
    await userEvent.click(reload);
    expect(setOptionsCalls[0].gpuDevice).toBe('all');
  });

  it('keeps the reload disarmed on All GPUs while nothing is pinned', async () => {
    // All GPUs = no pin, and an unpinned engine is already exactly that — arming here would offer a
    // reload that changes nothing.
    stubDesktop({ devices: [IGPU, DISCRETE] }); // readyEngine(): unpinned
    savedDevice('all');
    openPanel();

    expect(await screen.findByRole('combobox')).toHaveTextContent('All GPUs');
    expect(screen.getByRole('button', { name: /save.*reload/i })).toBeDisabled();
  });

  it('hides the GPU Device row while GPU is off', async () => {
    // With zero layers offloaded the whole model runs on the CPU. A device choice changes nothing then,
    // so the row goes away instead of offering a dead control.
    stubDesktop({ devices: [IGPU, DISCRETE], autoPick: DISCRETE });
    localStorage.setItem('FORMAMORPH_localGpuLayers', '0');
    openPanel();

    await act(async () => {}); // let the device fetch land, so a wrongly rendered row would be visible
    expect(screen.queryByText('GPU Device')).toBeNull();
    expect(screen.queryByRole('combobox')).toBeNull();
  });

  it('says no GPU is available rather than offering an empty list', async () => {
    stubDesktop({ devices: [], backend: 'cpu', engine: readyEngine({ gpuBackend: 'cpu', gpuDeviceNames: [] }) });
    openPanel();

    expect(await screen.findByText(/no gpu/i)).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).toBeNull();
  });

  it('sends the chosen device to the engine, so the reload lands on that card', async () => {
    stubDesktop({ devices: [IGPU, DISCRETE] });
    openPanel();

    await userEvent.click(await screen.findByRole('combobox'));
    await userEvent.click(await screen.findByRole('option', { name: DISCRETE }));

    // The picked device differs from what the loaded model was pinned to, which is what arms the reload.
    const reload = screen.getByRole('button', { name: /save.*reload/i });
    expect(reload).toBeEnabled();
    await userEvent.click(reload);

    expect(setOptionsCalls).toHaveLength(1);
    expect(setOptionsCalls[0].gpuDevice).toBe(DISCRETE);
  });

  it('leaves the reload alone while the picked device is the one already in force', async () => {
    stubDesktop({
      devices: [IGPU, DISCRETE],
      engine: readyEngine({ gpuDeviceNames: [DISCRETE], gpuDeviceIndex: 1, gpuDeviceOrigin: 'manual', gpuDeviceOptions: [IGPU, DISCRETE] }),
    });
    savedDevice(DISCRETE);
    openPanel();

    await screen.findByRole('combobox');
    expect(screen.getByRole('button', { name: /save.*reload/i })).toBeDisabled();
  });

  it('reads the device in force from the list it was picked from, not from what the pinned engine reports', async () => {
    // A pinned backend enumerates only its own device, and can fail to name even that. Inferring the pin
    // from that filtered list leaves the reload armed forever, reloading the model onto the same card.
    stubDesktop({
      devices: [IGPU, DISCRETE],
      engine: readyEngine({
        gpuDeviceNames: null, // the pinned backend could not name its device
        gpuDeviceIndex: 1, gpuDeviceOrigin: 'manual', gpuDeviceOptions: [IGPU, DISCRETE],
      }),
    });
    savedDevice(DISCRETE);
    openPanel();

    await screen.findByRole('combobox');
    expect(screen.getByRole('button', { name: /save.*reload/i })).toBeDisabled();
  });

  it('does not call a machine GPU-less when the engine never answered', async () => {
    // No backend replied, which is not the same as a backend reporting no GPU — saying so would be a claim
    // about the machine we have not earned.
    stubDesktop({ devices: [], backend: null, engine: readyEngine({ gpuBackend: null, gpuDeviceNames: null }) });
    openPanel();

    expect(await screen.findByText(/couldn’t list your graphics cards/i)).toBeInTheDocument();
    expect(screen.queryByText(/no gpu available/i)).toBeNull();
  });

  it('keeps a chosen device that has gone missing on the list, so it can be changed', async () => {
    // An eGPU unplugged or a driver removed: dropping the value silently would leave the row blank.
    savedDevice('AMD Radeon RX 7900 XTX');
    stubDesktop({ devices: [IGPU, DISCRETE] });
    openPanel();

    const picker = await screen.findByRole('combobox');
    expect(picker).toHaveTextContent(/not found/i);

    await userEvent.click(picker);
    await userEvent.click(await screen.findByRole('option', { name: /^Auto \(/ }));
    expect(picker).toHaveTextContent('Auto');
  });

  it('puts the device back to Auto when the panel is reset', async () => {
    savedDevice(IGPU);
    stubDesktop({ devices: [IGPU, DISCRETE] });
    openPanel();

    expect(await screen.findByRole('combobox')).toHaveTextContent(IGPU);
    await userEvent.click(screen.getByRole('button', { name: /reset/i }));
    expect(devicePicker()).toHaveTextContent('Auto');
  });
});

describe('local model CUDA row', () => {
  const installed: CudaStatus = { ...CUDA_BASE, state: 'installed', tag: 'b9' };

  it('shows on a machine whose nvidia-smi lists an NVIDIA card, with the size, the license line and the EULA link', async () => {
    const { bridge } = cudaBridge(notInstalled());
    stubDesktop({ devices: [DISCRETE], cuda: bridge });
    openPanel();

    expect(await screen.findByRole('button', { name: 'Download (593 MB)' })).toBeEnabled();
    expect(screen.getByText(/NVIDIA’s CUDA libraries, under NVIDIA’s license/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'CUDA EULA' })).toHaveAttribute('href', 'https://docs.nvidia.com/cuda/eula/index.html');
  });

  it('is absent when nvidia-smi lists no NVIDIA card', async () => {
    const { bridge } = cudaBridge({ ...CUDA_BASE, nvidia: false, support: { supported: false, reason: 'no-nvidia-card' }, state: 'unsupported' });
    stubDesktop({ devices: [IGPU], cuda: bridge });
    openPanel();
    await screen.findByRole('combobox');
    await act(async () => {});
    expect(screen.queryByText('CUDA')).toBeNull();
    expect(screen.queryByRole('link', { name: 'CUDA EULA' })).toBeNull();
  });

  it('tells a driver under the floor to update, with the floor and a driver link, and offers no Download', async () => {
    const { bridge } = cudaBridge({ ...CUDA_BASE, support: { supported: false, reason: 'driver-too-old', driverFloor: 615, cardName: 'NVIDIA GeForce RTX 2080' }, state: 'unsupported' });
    stubDesktop({ devices: [DISCRETE], cuda: bridge });
    openPanel();

    expect(await screen.findByText(/Update it to version 615 or later/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Get the Latest Driver' })).toHaveAttribute('href', 'https://www.nvidia.com/en-us/drivers/');
    expect(screen.queryByRole('button', { name: /download/i })).toBeNull();
  });

  it.each([
    ['card-too-old', /GTX 1080 is too old for CUDA/],
    ['support-unknown', /Couldn’t read your NVIDIA driver details/],
  ] as const)('states the %s reason with no Download', async (reason, text) => {
    const { bridge } = cudaBridge({ ...CUDA_BASE, support: { supported: false, reason, cardName: 'NVIDIA GeForce GTX 1080' }, state: 'unsupported' });
    stubDesktop({ devices: [DISCRETE], cuda: bridge });
    openPanel();
    expect(await screen.findByText(text)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /download/i })).toBeNull();
  });

  it('offers Remove beside the reason when an unsupported machine still holds a CUDA folder, then shows the reason alone', async () => {
    const unsupported = { ...CUDA_BASE, support: { supported: false as const, reason: 'driver-too-old' as const, driverFloor: 580, cardName: DISCRETE } };
    const { bridge, calls, push } = cudaBridge({ ...unsupported, state: 'unsupported', hasFiles: true });
    stubDesktop({ devices: [DISCRETE], cuda: bridge, engine: readyEngine({ status: 'stopped' }) });
    openPanel();

    expect(await screen.findByText(/Update it to version 580 or later/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /download/i })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(calls).toEqual(['remove']);
    await push({ ...unsupported, state: 'unsupported' });
    expect(screen.getByText(/Update it to version 580 or later/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remove' })).toBeNull();
  });

  it('downloads with progress and a Cancel, resumes, then reads installed', async () => {
    const { bridge, calls, push } = cudaBridge(notInstalled());
    stubDesktop({ devices: [DISCRETE], cuda: bridge });
    openPanel();

    await userEvent.click(await screen.findByRole('button', { name: /^Download/ }));
    expect(calls).toEqual(['install']);
    await push({ ...CUDA_BASE, state: 'downloading', received: 200_000_000, total: CUDA_BASE.downloadBytes, phase: 'download' });
    expect(screen.getByText('200 MB of 593 MB')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'CUDA download' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(calls).toEqual(['install', 'cancel']);

    await push(notInstalled({ partialBytes: 200_000_000 }));
    expect(screen.getByText('200 MB of 593 MB downloaded')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Resume Download' }));
    expect(calls).toEqual(['install', 'cancel', 'install']);

    await push(installed);
    expect(screen.getByText('Installed')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove' })).toBeEnabled();
  });

  it('states how much space a refused download needs', async () => {
    const { bridge } = cudaBridge(notInstalled({ error: { kind: 'no-space', neededBytes: 1_363_265_321, freeBytes: 800_000_000 } }));
    stubDesktop({ devices: [DISCRETE], cuda: bridge });
    openPanel();
    expect(await screen.findByText(/CUDA needs 1.4 GB, and the drive has 800 MB free/)).toBeInTheDocument();
  });

  it('says CUDA is updating while a replace downloads, and not during a first download', async () => {
    const { bridge, push } = cudaBridge(notInstalled());
    stubDesktop({ devices: [DISCRETE], cuda: bridge });
    openPanel();
    await screen.findByRole('button', { name: /^Download/ });
    const downloading = { ...CUDA_BASE, state: 'downloading', received: 1, total: CUDA_BASE.downloadBytes, phase: 'download' } as const;
    await push(downloading);
    expect(screen.queryByText(/CUDA needs new files/)).toBeNull();
    await push({ ...downloading, replacing: true });
    expect(screen.getByText(/The engine uses Vulkan until they’re installed/)).toBeInTheDocument();
  });

  it('a stale install that couldn’t fit says it is updating, how much it needs, and offers Download', async () => {
    const error = { kind: 'no-space', neededBytes: 1_363_265_321, freeBytes: 800_000_000 } as const;
    const { bridge } = cudaBridge({ ...CUDA_BASE, state: 'stale', tag: 'b8', partialBytes: 0, error });
    stubDesktop({ devices: [DISCRETE], cuda: bridge });
    openPanel();
    expect(await screen.findByText(/CUDA needs new files/)).toBeInTheDocument();
    expect(screen.getByText(/CUDA needs 1.4 GB, and the drive has 800 MB free/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Download/ })).toBeEnabled();
  });

  it('asks before Remove while the engine runs, then removes', async () => {
    const { bridge, calls } = cudaBridge(installed);
    stubDesktop({ devices: [DISCRETE], cuda: bridge, engine: readyEngine() });
    openPanel();

    await userEvent.click(await screen.findByRole('button', { name: 'Remove' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent(/stops the engine and unloads your model/);
    expect(calls).toEqual([]);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Remove' }));
    expect(calls).toEqual(['remove']);
  });

  it('keeps Remove and shows the reason when an installed machine is no longer supported', async () => {
    const { bridge } = cudaBridge({ ...installed, support: { supported: false, reason: 'driver-too-old', driverFloor: 580, cardName: 'NVIDIA GeForce RTX 4090' } });
    stubDesktop({ devices: [DISCRETE], cuda: bridge });
    openPanel();

    expect(await screen.findByRole('button', { name: 'Remove' })).toBeEnabled();
    expect(screen.getByText(/Update it to version 580 or later/)).toBeInTheDocument();
  });

  it('removes at once while the engine is stopped', async () => {
    const { bridge, calls } = cudaBridge(installed);
    stubDesktop({ devices: [DISCRETE], cuda: bridge, engine: readyEngine({ status: 'stopped' }) });
    openPanel();

    await userEvent.click(await screen.findByRole('button', { name: 'Remove' }));
    expect(calls).toEqual(['remove']);
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });
});

describe('local model Backend row', () => {
  const RTX_4090 = 'NVIDIA GeForce RTX 4090';
  const installed: CudaStatus = { ...CUDA_BASE, state: 'installed', tag: 'b9' };
  const ON_CUDA: EngineBackendChoice = { backend: 'cuda', reason: null };
  const backendPicker = () => screen.findByRole('combobox', { name: /backend/i });
  const devicePickerByName = () => screen.getByRole('combobox', { name: /gpu device/i });
  const optionTexts = async () => (await screen.findAllByRole('option')).map((o) => o.textContent);

  it('grays CUDA out until it is installed', async () => {
    const { bridge, push } = cudaBridge(notInstalled());
    stubDesktop({ devices: [RTX_4090], cuda: bridge, choice: { backend: 'vulkan', reason: 'not-installed' } });
    openPanel();

    await userEvent.click(await backendPicker());
    expect(await screen.findByRole('option', { name: 'CUDA' })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('option', { name: 'Vulkan' })).not.toHaveAttribute('aria-disabled');
    await userEvent.keyboard('{Escape}');

    await push(installed);
    await userEvent.click(await backendPicker());
    expect(await screen.findByRole('option', { name: 'CUDA' })).not.toHaveAttribute('aria-disabled');
  });

  it('names the backend Auto will run', async () => {
    const { bridge } = cudaBridge(installed);
    stubDesktop({ devices: [RTX_4090], cuda: bridge, choice: ON_CUDA, engine: readyEngine({ gpuBackend: 'cuda' }) });
    openPanel();
    await screen.findByText('Auto (CUDA)');
    await userEvent.click(await backendPicker());
    expect(await optionTexts()).toEqual(['Auto (CUDA)', 'Vulkan', 'CUDA']);
  });

  it('arms Save & Reload on a change and sends the setting', async () => {
    const { bridge } = cudaBridge(installed);
    stubDesktop({ devices: [RTX_4090], cuda: bridge, choice: ON_CUDA, engine: readyEngine({ gpuBackend: 'cuda' }) });
    openPanel();
    const reload = () => screen.getByRole('button', { name: /save.*reload/i });
    await backendPicker();
    expect(reload()).toBeDisabled();

    await userEvent.click(await backendPicker());
    await userEvent.click(await screen.findByRole('option', { name: 'Vulkan' }));
    expect(reload()).toBeEnabled();
    await userEvent.click(reload());
    expect(setOptionsCalls[0].engineBackend).toBe('vulkan');
  });

  it('offers Restart on CUDA when CUDA lands under a Vulkan run, and reloads only on the click', async () => {
    const { bridge, push } = cudaBridge(notInstalled());
    let cudaReady = false;
    stubDesktop({
      devices: [RTX_4090], cuda: bridge, engine: readyEngine({ gpuBackend: 'vulkan' }),
      listFor: () => ({ backend: cudaReady ? 'cuda' : 'vulkan', devices: [RTX_4090], autoPick: null, choice: cudaReady ? ON_CUDA : { backend: 'vulkan', reason: 'not-installed' } }),
    });
    openPanel();
    await backendPicker();
    await act(async () => {});
    expect(screen.queryByRole('button', { name: 'Restart on CUDA' })).toBeNull();

    cudaReady = true;
    await push(installed);
    const restart = await screen.findByRole('button', { name: 'Restart on CUDA' });
    expect(restartCalls).toBe(0);
    expect(setOptionsCalls).toEqual([]);
    await userEvent.click(restart);
    expect(restartCalls).toBe(1);
  });

  it('offers no Restart on CUDA while the model already runs on CUDA', async () => {
    const { bridge } = cudaBridge(installed);
    stubDesktop({ devices: [RTX_4090], cuda: bridge, choice: ON_CUDA, engine: readyEngine({ gpuBackend: 'cuda' }) });
    openPanel();
    await screen.findByText('Auto (CUDA)');
    expect(screen.queryByRole('button', { name: 'Restart on CUDA' })).toBeNull();
  });

  it('lists the devices of the backend the settings would run, asking again on a change', async () => {
    const { bridge } = cudaBridge(installed);
    const AMD = 'AMD Radeon RX 7900 XTX';
    stubDesktop({
      devices: [], cuda: bridge,
      listFor: (pending) => (pending?.engineBackend === 'vulkan'
        ? { backend: 'vulkan', devices: [RTX_4090, AMD], autoPick: null, choice: { backend: 'vulkan', reason: 'setting' } }
        : { backend: 'cuda', devices: [RTX_4090], autoPick: null, choice: ON_CUDA }),
    });
    openPanel();
    await screen.findByText('Auto (CUDA)');
    expect(listDevicesCalls[0]).toEqual({ engineBackend: 'auto', gpuDevice: 'auto' });

    await userEvent.click(devicePickerByName());
    expect(await optionTexts()).toEqual([`Auto (${RTX_4090})`, 'All GPUs', RTX_4090]);
    await userEvent.keyboard('{Escape}');

    await userEvent.click(await backendPicker());
    await userEvent.click(await screen.findByRole('option', { name: 'Vulkan' }));
    await act(async () => {});
    expect(listDevicesCalls.at(-1)).toEqual({ engineBackend: 'vulkan', gpuDevice: 'auto' });
    await userEvent.click(devicePickerByName());
    expect(await optionTexts()).toEqual(['Auto (All GPUs)', 'All GPUs', RTX_4090, AMD]);
  });

  it('says why Auto stays on Vulkan beside another graphics card', async () => {
    const { bridge } = cudaBridge(installed);
    stubDesktop({ devices: [RTX_4090, 'AMD Radeon RX 7900 XTX'], cuda: bridge, choice: { backend: 'vulkan', reason: 'mixed-gpus' } });
    openPanel();
    expect(await screen.findByText('Auto (Vulkan)')).toBeInTheDocument();
    expect(await screen.findByText(/another graphics card/)).toBeInTheDocument();
  });

  it('names the pinned device when it keeps Auto on Vulkan', async () => {
    const { bridge } = cudaBridge(installed);
    savedDevice(IGPU);
    stubDesktop({ devices: [IGPU, RTX_4090], cuda: bridge, choice: { backend: 'vulkan', reason: 'device-pin' } });
    openPanel();
    expect(await screen.findByText('Auto (Vulkan)')).toBeInTheDocument();
    expect(await screen.findByText(new RegExp(`is set to ${IGPU.replace(/[()]/g, '\\$&')}\\. Pick your NVIDIA card`))).toBeInTheDocument();
  });

  it('keeps a stored CUDA choice selected but grayed while CUDA is not installed, and says why', async () => {
    const { bridge } = cudaBridge(notInstalled());
    localStorage.setItem('FORMAMORPH_localEngineBackend', 'cuda');
    stubDesktop({ devices: [RTX_4090], cuda: bridge, choice: { backend: 'vulkan', reason: 'not-installed' }, engine: readyEngine({ backendSetting: 'cuda' }) });
    openPanel();
    const picker = await backendPicker();
    expect(picker).toHaveTextContent('CUDA');
    expect(picker).toHaveClass('text-muted-foreground');
    expect(await screen.findByText(/Download CUDA below to use it/)).toBeInTheDocument();
  });

  it('is absent off NVIDIA machines', async () => {
    const { bridge } = cudaBridge({ ...CUDA_BASE, nvidia: false, support: { supported: false, reason: 'no-nvidia-card' }, state: 'unsupported' });
    stubDesktop({ devices: [IGPU], cuda: bridge });
    openPanel();
    await screen.findByRole('combobox');
    await act(async () => {});
    expect(screen.queryByRole('combobox', { name: /backend/i })).toBeNull();
  });
});

describe('local model CUDA fallback and failure memory', () => {
  const RTX_4090 = 'NVIDIA GeForce RTX 4090';
  const installed: CudaStatus = { ...CUDA_BASE, state: 'installed', tag: 'b9' };
  const failed: CudaStatus = { ...installed, failedLastTime: true };
  const CUDA_ERROR = "Context Size 8192 doesn't fit in this GPU's VRAM. Lower Context Size.";
  const NOTICE = /CUDA couldn’t load your model, so it runs on Vulkan/;

  it('says a start fell back to Vulkan, and Error Details shows the CUDA error', async () => {
    const { bridge } = cudaBridge(failed);
    stubDesktop({
      devices: [RTX_4090], cuda: bridge, choice: { backend: 'vulkan', reason: 'failed-last-time' },
      engine: readyEngine({ gpuBackend: 'vulkan', cudaFallback: true, cudaError: CUDA_ERROR }),
    });
    openPanel();
    expect(await screen.findByText(NOTICE)).toBeInTheDocument();
    // The notice says it for this start; the Backend row's own reason line stays out of the way.
    expect(screen.queryByText(/because CUDA failed last time/)).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'View Details' }));
    expect(getErrorDetailsState()).toMatchObject({ open: true, entry: { details: CUDA_ERROR } });
    closeErrorDetails();
  });

  it('shows no notice for a start that ran on CUDA or never tried it', async () => {
    const { bridge } = cudaBridge(installed);
    stubDesktop({ devices: [RTX_4090], cuda: bridge, choice: { backend: 'cuda', reason: null }, engine: readyEngine({ gpuBackend: 'cuda' }) });
    openPanel();
    await screen.findByText('Auto (CUDA)');
    expect(screen.queryByText(NOTICE)).toBeNull();
    expect(screen.queryByRole('button', { name: 'View Details' })).toBeNull();
  });

  it('shows no Vulkan notice when the fallback ended on the CPU', async () => {
    const { bridge } = cudaBridge(installed);
    stubDesktop({
      devices: [RTX_4090], cuda: bridge, choice: { backend: 'cuda', reason: null },
      engine: readyEngine({ gpuBackend: 'cpu', cudaFallback: true, cudaError: CUDA_ERROR }),
    });
    openPanel();
    await screen.findByText('Auto (CUDA)');
    expect(screen.queryByText(NOTICE)).toBeNull();
  });

  it('says CUDA failed last time with a Retry, and names it as the reason Auto uses Vulkan', async () => {
    const { bridge, calls, push } = cudaBridge(failed);
    stubDesktop({ devices: [RTX_4090], cuda: bridge, choice: { backend: 'vulkan', reason: 'failed-last-time' }, engine: readyEngine({ gpuBackend: 'vulkan' }) });
    openPanel();
    expect(await screen.findByText('CUDA couldn’t load a model last time.')).toBeInTheDocument();
    expect(screen.getByText('Auto uses Vulkan because CUDA failed last time.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Retry CUDA' }));
    expect(calls).toEqual(['retry']);

    await push(installed);
    expect(screen.queryByRole('button', { name: 'Retry CUDA' })).toBeNull();
  });
});
