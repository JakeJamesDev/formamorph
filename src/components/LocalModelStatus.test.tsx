import { render, cleanup } from '@testing-library/react';
import { describe, it, expect, afterEach } from 'vitest';
import { EngineDeviceLine, EngineStatusLine, GpuMemoryBox } from './LocalModelStatus';
import type { LocalLlmState } from '@/lib/imageGen/desktop';
import type { VramStats } from '@/lib/useVramStats';

afterEach(cleanup);

const stopped: LocalLlmState = {
  status: 'stopped', modelPath: null, modelId: null, port: null, error: null, loadProgress: null,
  contextSize: null, gpuLayers: null, flashAttention: null, parallelRequests: null,
  maxContextSize: null, engineVramMB: null,
  gpuBackend: null, gpuDeviceNames: null, deviceVramTotalMB: null, deviceVramFreeMB: null,
};

const engine = (over: Partial<LocalLlmState>): LocalLlmState => ({ ...stopped, ...over });

// A machine whose discrete card has plenty free — the readout the engine line is meant to be compared against.
const vram: VramStats = {
  status: 'online',
  gpus: [{ index: 0, name: 'NVIDIA GeForce RTX 4080', totalMB: 16376, usedMB: 1200, freeMB: 15176 }],
  processes: [],
  selfPid: null,
  lastUpdated: 0,
};

describe('EngineDeviceLine', () => {
  it('names the backend, the devices it enumerated, and the VRAM it sized the load against', () => {
    const { container } = render(<EngineDeviceLine engine={engine({
      status: 'ready', gpuBackend: 'cuda', gpuDeviceNames: ['NVIDIA GeForce RTX 4080'],
      deviceVramTotalMB: 16376, deviceVramFreeMB: 15176,
    })} />);
    const text = container.textContent ?? '';
    expect(text).toContain('CUDA');
    expect(text).toContain('NVIDIA GeForce RTX 4080');
    expect(text).toContain('14.8 / 16.0 GB');
  });

  it('shows the device a failed load ran on, so an out-of-VRAM error says which one it was', () => {
    // The reported bug: CUDA stops initializing, llama.cpp falls back to Vulkan on the iGPU, and every model
    // fails for "VRAM" while nvidia-smi shows the discrete card idle.
    const { container } = render(<EngineDeviceLine engine={engine({
      status: 'error', error: 'not enough VRAM', gpuBackend: 'vulkan',
      gpuDeviceNames: ['Intel(R) UHD Graphics 770'], deviceVramTotalMB: 2048, deviceVramFreeMB: 1900,
    })} />);
    const text = container.textContent ?? '';
    expect(text).toContain('Vulkan');
    expect(text).toContain('Intel(R) UHD Graphics 770');
    expect(text).toContain('1.9 / 2.0 GB');
  });

  it('flags a CPU-only backend as a warning', () => {
    const { container } = render(<EngineDeviceLine engine={engine({ status: 'ready', gpuBackend: 'cpu' })} />);
    expect(container.textContent).toContain('CPU');
    expect(container.querySelector('.text-warning')?.textContent).toBe('CPU');
  });

  it('renders nothing before a backend has been selected', () => {
    const { container } = render(<EngineDeviceLine engine={stopped} />);
    expect(container.textContent).toBe('');
  });

  it('omits the VRAM figures when the backend does not report them', () => {
    const { container } = render(<EngineDeviceLine engine={engine({ gpuBackend: 'metal', gpuDeviceNames: [] })} />);
    expect(container.textContent).toContain('Metal');
    expect(container.textContent).not.toContain('GB');
  });
});

describe('EngineStatusLine', () => {
  it('shows how far a load has got, so a minute-long load is visibly moving', () => {
    const { container } = render(<EngineStatusLine engine={engine({
      status: 'loading', modelId: 'big-model.gguf', loadProgress: 42,
    })} />);
    expect(container.textContent).toContain('loading big-model.gguf — 42%');
  });

  it('names the model without a percentage before the first progress report', () => {
    const { container } = render(<EngineStatusLine engine={engine({
      status: 'loading', modelId: 'big-model.gguf', loadProgress: null,
    })} />);
    // Scoped to the status text: the indeterminate bar ships a <style> block whose keyframes contain '%'.
    const line = container.firstElementChild?.firstElementChild;
    expect(line?.textContent).toContain('loading big-model.gguf');
    expect(line?.textContent).not.toContain('%');
  });

  it('draws a bar filled to the load position, not just a number', () => {
    const { container } = render(<EngineStatusLine engine={engine({
      status: 'loading', modelId: 'big-model.gguf', loadProgress: 42,
    })} />);
    const bar = container.querySelector('[role="progressbar"]');
    expect(bar).not.toBeNull();
    // The fill is drawn by sliding the indicator in from the left, so 42% sits at translateX(-58%).
    expect(bar?.querySelector('div')?.getAttribute('style')).toContain('translateX(-58%)');
  });

  it('keeps a bar moving before the first percentage arrives', () => {
    const { container } = render(<EngineStatusLine engine={engine({
      status: 'loading', modelId: 'big-model.gguf', loadProgress: null,
    })} />);
    // Indeterminate: a bar is present, but it reports no position to sit at.
    const bar = container.querySelector('[role="progressbar"]');
    expect(bar).not.toBeNull();
    expect(bar?.getAttribute('aria-valuenow')).toBeNull();
  });

  it('shows no bar once the model is ready', () => {
    const { container } = render(<EngineStatusLine engine={engine({ status: 'ready', modelId: 'm.gguf' })} />);
    expect(container.querySelector('[role="progressbar"]')).toBeNull();
  });

  it('drops the percentage once the model is ready', () => {
    const { container } = render(<EngineStatusLine engine={engine({
      status: 'ready', modelId: 'big-model.gguf', loadProgress: null,
    })} />);
    expect(container.textContent).toContain('ready — big-model.gguf');
    expect(container.textContent).not.toContain('%');
  });
});

describe('GpuMemoryBox', () => {
  it('puts the engine device beside the nvidia-smi bars, so a mismatch reads in one screenshot', () => {
    const { container } = render(<GpuMemoryBox stats={vram} engine={engine({
      status: 'error', gpuBackend: 'vulkan', gpuDeviceNames: ['Intel(R) UHD Graphics 770'],
      deviceVramTotalMB: 2048, deviceVramFreeMB: 1900,
    })} />);
    const text = container.textContent ?? '';
    expect(text).toContain('NVIDIA GeForce RTX 4080'); // what nvidia-smi sees
    expect(text).toContain('Intel(R) UHD Graphics 770'); // what the engine picked
  });

  it('omits the device line when no engine is passed', () => {
    const { container } = render(<GpuMemoryBox stats={vram} />);
    expect(container.textContent).not.toContain('Engine device');
  });
});
