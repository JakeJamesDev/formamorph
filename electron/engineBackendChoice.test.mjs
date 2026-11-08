// @vitest-environment node
// Main's backend choice over fake sources: what main gathers reaches the policy.
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createBackendChoice } = require('./engineBackendChoice.cjs');

const CUDA_BIN = 'engines/llama-server-cuda/llama-server.exe';
const RTX_4090 = { name: 'NVIDIA GeForce RTX 4090', driverVersion: '616.92', computeCap: '8.9' };
const IGPU = 'Intel(R) UHD Graphics 770';
const WITH_IGPU_NAMES = [IGPU, 'NVIDIA GeForce RTX 4090'];

/** A choice over a Windows machine with CUDA installed and the 4090 beside an Intel iGPU, unless overridden. */
function choiceOver({ platform = 'win32', status = { state: 'installed', nvidia: true }, cards = [RTX_4090], names = WITH_IGPU_NAMES, failedFor = () => false } = {}) {
  const calls = { failedFor: [], readCards: 0 };
  const install = {
    status: async () => status,
    serverPath: () => CUDA_BIN,
    failedFor: (drivers) => { calls.failedFor.push(drivers); return failedFor(drivers); },
  };
  const backendChoice = createBackendChoice({
    platform,
    install: () => install,
    readCards: async () => { calls.readCards += 1; return cards; },
    vulkanDeviceNames: async () => names,
  });
  return { backendChoice, calls };
}

describe('main backend choice', () => {
  it('a pinned integrated GPU keeps Auto on Vulkan with the device-pin reason', async () => {
    const { backendChoice } = choiceOver();
    expect(await backendChoice({ engineBackend: 'auto', gpuDevice: IGPU })).toEqual({ backend: 'vulkan', reason: 'device-pin', cudaBinary: null });
  });

  it('Auto with no pin, or a pin on the NVIDIA card, starts on CUDA with the installed server', async () => {
    const { backendChoice } = choiceOver();
    for (const gpuDevice of ['auto', 'NVIDIA GeForce RTX 4090']) {
      expect(await backendChoice({ engineBackend: 'auto', gpuDevice })).toEqual({ backend: 'cuda', reason: null, cudaBinary: CUDA_BIN });
    }
  });

  it('passes the Backend setting through', async () => {
    const { backendChoice } = choiceOver();
    expect(await backendChoice({ engineBackend: 'vulkan', gpuDevice: 'auto' })).toMatchObject({ backend: 'vulkan', reason: 'setting' });
    expect(await backendChoice({ engineBackend: 'cuda', gpuDevice: IGPU })).toMatchObject({ backend: 'cuda', cudaBinary: CUDA_BIN });
  });

  it('checks the failure record against the cards’ drivers', async () => {
    const { backendChoice, calls } = choiceOver({ failedFor: () => true });
    expect(await backendChoice({ engineBackend: 'auto', gpuDevice: 'auto' })).toMatchObject({ backend: 'vulkan', reason: 'failed-last-time' });
    expect(calls.failedFor).toEqual([['616.92']]);
  });

  it('reads no cards when the install found no NVIDIA card', async () => {
    const { backendChoice, calls } = choiceOver({ status: { state: 'installed', nvidia: false } });
    expect(await backendChoice({ engineBackend: 'auto', gpuDevice: 'auto' })).toMatchObject({ backend: 'vulkan', reason: 'no-nvidia-card' });
    expect(calls.readCards).toBe(0);
  });

  it('never chooses CUDA off Windows', async () => {
    const { backendChoice, calls } = choiceOver({ platform: 'linux' });
    expect(await backendChoice({ engineBackend: 'cuda', gpuDevice: 'auto' })).toEqual({ backend: 'vulkan', reason: 'not-installed', cudaBinary: null });
    expect(calls.readCards).toBe(0);
  });
});
