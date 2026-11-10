// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readVramClass, useVramClass, vramClassForTotal } from './vramClass';

const SAVED = { gpuDevice: 'auto', engineBackend: 'auto' } as const;

const shell = vi.hoisted(() => ({
  desktop: true,
  answer: (_saved: unknown): Promise<unknown> => Promise.resolve('low'),
  asked: [] as unknown[],
  settings: { localGpuDevice: 'auto', localEngineBackend: 'auto' },
}));

vi.mock('@/lib/imageGen/desktop', () => ({
  isLocalLlmAvailable: () => shell.desktop,
  desktopVramClass: (saved: unknown) => { shell.asked.push(saved); return shell.answer(saved); },
}));
vi.mock('@/contexts/SettingsContext', () => ({ useSettings: () => shell.settings }));

beforeEach(() => {
  shell.desktop = true;
  shell.answer = () => Promise.resolve('low');
  shell.asked = [];
  shell.settings = { localGpuDevice: 'auto', localEngineBackend: 'auto' };
});

describe('readVramClass', () => {
  it('passes the shell’s answer through', async () => {
    shell.answer = () => Promise.resolve('ok');
    expect(await readVramClass(SAVED)).toBe('ok');
  });

  it('asks the shell with the saved Device and Backend settings', async () => {
    await readVramClass({ gpuDevice: 'Intel(R) UHD Graphics 770', engineBackend: 'vulkan' });
    expect(shell.asked).toEqual([{ gpuDevice: 'Intel(R) UHD Graphics 770', engineBackend: 'vulkan' }]);
  });

  it('answers unknown outside the desktop build', async () => {
    shell.desktop = false;
    expect(await readVramClass(SAVED)).toBe('unknown');
  });

  it('answers unknown when the shell fails or answers something else', async () => {
    shell.answer = () => Promise.reject(new Error('no handler'));
    expect(await readVramClass(SAVED)).toBe('unknown');
    shell.answer = () => Promise.resolve('huge');
    expect(await readVramClass(SAVED)).toBe('unknown');
  });
});

describe('useVramClass', () => {
  // The shell answers by the settings it is asked with, so a stale read shows as the old class.
  const answerBySetting = (saved: unknown) =>
    Promise.resolve((saved as { gpuDevice: string }).gpuDevice === 'all' ? 'ok' : 'low');

  it('reads the class again when the saved Device setting changes', async () => {
    shell.answer = answerBySetting;
    const { result, rerender } = renderHook(() => useVramClass());
    await waitFor(() => expect(result.current).toBe('low'));
    shell.settings = { localGpuDevice: 'all', localEngineBackend: 'auto' };
    rerender();
    await waitFor(() => expect(result.current).toBe('ok'));
    expect(shell.asked).toEqual([
      { gpuDevice: 'auto', engineBackend: 'auto' },
      { gpuDevice: 'all', engineBackend: 'auto' },
    ]);
  });

  it('reads the class again when the saved Backend setting changes', async () => {
    const { rerender } = renderHook(() => useVramClass());
    await waitFor(() => expect(shell.asked).toHaveLength(1));
    shell.settings = { localGpuDevice: 'auto', localEngineBackend: 'cuda' };
    rerender();
    await waitFor(() => expect(shell.asked).toEqual([
      { gpuDevice: 'auto', engineBackend: 'auto' },
      { gpuDevice: 'auto', engineBackend: 'cuda' },
    ]));
  });
});

describe('vramClassForTotal', () => {
  it('reads the shell’s limit for the dev route', () => {
    expect(vramClassForTotal(8500)).toBe('low');
    expect(vramClassForTotal(8501)).toBe('ok');
  });
});
