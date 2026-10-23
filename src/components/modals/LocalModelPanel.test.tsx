// Storage is real (in-memory): SettingsProvider reads it on mount, and the device setting persists there.
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SettingsProvider } from '@/contexts/SettingsContext';
import { LocalModelPanel } from './LocalModelPanel';
import { LocalEngineManager } from '../LocalEngineManager';
import type { LocalLlmState } from '@/lib/imageGen/desktop';

// The model manager is its own surface with its own coverage, and mounting it pulls in the whole install
// /download/move bridge. Nothing here is about it.
vi.mock('./LocalModelModal', () => ({ LocalModelModal: () => null }));

const DISCRETE = 'NVIDIA GeForce RTX 4080';
const IGPU = 'Intel(R) UHD Graphics 770';

/** A loaded engine at the renderer's own defaults, so only the device row can differ from what's applied. */
const readyEngine = (over: Partial<LocalLlmState> = {}): LocalLlmState => ({
  status: 'ready', modelPath: 'D:/models/m.gguf', modelId: 'm.gguf', port: 8977, error: null, loadProgress: null,
  contextSize: 8192, gpuLayers: -1, flashAttention: true, parallelRequests: 2, unifiedKvCache: true, kCacheType: 'f16', vCacheType: 'f16', kvCacheInRam: false,
  maxContextSize: 32768, engineVramMB: 4096,
  gpuBackend: 'vulkan', gpuDeviceNames: [IGPU, DISCRETE], deviceVramTotalMB: 16376, deviceVramFreeMB: 15176,
  gpuDeviceIndex: null, gpuDeviceRawIndex: null, gpuDeviceOrigin: null, gpuDeviceOptions: null, serverPid: null,
  ...over,
});

let setOptionsCalls: Record<string, unknown>[] = [];
let contextOverflowCalls: string[] = [];

/** Stand the desktop bridge up so the panel takes its desktop path — the only one the picker exists on. */
function stubDesktop({ devices, backend = 'vulkan', autoPick = null, engine = readyEngine() }: {
  devices: string[];
  backend?: string | null;
  autoPick?: string | null;
  engine?: LocalLlmState;
}) {
  window.formamorphDesktop = {
    fetch: () => Promise.resolve({ ok: true, status: 200, body: '' }),
    vramStats: () => Promise.resolve({ gpus: [], processes: [], selfPid: null }),
    llm: {
      status: () => Promise.resolve(engine),
      onStatus: () => () => {},
      listDevices: () => Promise.resolve({ backend, devices, autoPick }),
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
