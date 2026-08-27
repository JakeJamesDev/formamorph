// Storage is real (in-memory): SettingsProvider reads it on mount, and the device setting persists there.
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SettingsProvider } from '@/contexts/SettingsContext';
import { LocalModelPanel } from './LocalModelPanel';
import type { LocalLlmState } from '@/lib/imageGen/desktop';

// The model manager is its own surface with its own coverage, and mounting it pulls in the whole install
// /download/move bridge. Nothing here is about it.
vi.mock('./LocalModelModal', () => ({ LocalModelModal: () => null }));

const DISCRETE = 'NVIDIA GeForce RTX 4080';
const IGPU = 'Intel(R) UHD Graphics 770';

/** A loaded engine at the renderer's own defaults, so only the device row can differ from what's applied. */
const readyEngine = (over: Partial<LocalLlmState> = {}): LocalLlmState => ({
  status: 'ready', modelPath: 'D:/models/m.gguf', modelId: 'm.gguf', port: 8977, error: null, loadProgress: null,
  contextSize: 8192, gpuLayers: -1, flashAttention: true, parallelRequests: 2,
  maxContextSize: 32768, engineVramMB: 4096,
  gpuBackend: 'vulkan', gpuDeviceNames: [IGPU, DISCRETE], deviceVramTotalMB: 16376, deviceVramFreeMB: 15176,
  gpuDeviceIndex: null, gpuDeviceOrigin: null, gpuDeviceOptions: null,
  ...over,
});

let setOptionsCalls: Record<string, unknown>[] = [];

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
  delete (window as { formamorphDesktop?: unknown }).formamorphDesktop;
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
