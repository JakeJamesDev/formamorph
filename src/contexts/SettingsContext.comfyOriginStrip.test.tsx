import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { SettingsProvider, useSettings } from './SettingsContext';

// The provider probes the active endpoint; keep the network out of it.
vi.mock('@/lib/reasoningEffort', async () => {
  const actual = await vi.importActual<typeof import('@/lib/reasoningEffort')>('@/lib/reasoningEffort');
  return { ...actual, detectReasoningCapability: vi.fn().mockResolvedValue(null), resolveReasoningCapability: vi.fn().mockResolvedValue(null) };
});
vi.mock('@/lib/contextLength', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@/lib/contextLength');
  return { ...actual, fetchContextLength: vi.fn().mockResolvedValue(32768) };
});

const wrapper = ({ children }: { children: ReactNode }) => <SettingsProvider>{children}</SettingsProvider>;
const setComfyEndpoint = vi.fn(async (_url: string | null) => {});
const lastPushed = () => setComfyEndpoint.mock.calls.at(-1)?.[0];

beforeEach(() => {
  localStorage.clear();
  setComfyEndpoint.mockClear();
  window.matchMedia = ((query: string) => ({
    matches: false, media: query, onchange: null,
    addListener: vi.fn(), removeListener: vi.fn(),
    addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
  window.formamorphDesktop = { fetch: vi.fn(), setComfyEndpoint };
});

afterEach(() => {
  delete window.formamorphDesktop;
});

describe('SettingsContext: the desktop Origin strip target', () => {
  it('follows the ComfyUI endpoint, the default when blank, and clears for other providers', () => {
    const { result } = renderHook(() => useSettings(), { wrapper });
    act(() => result.current.setImageProvider('comfyui'));
    act(() => result.current.setImageEndpoint(''));
    expect(lastPushed()).toBe('http://localhost:8188');

    act(() => result.current.setImageEndpoint('http://192.168.1.5:8188'));
    expect(lastPushed()).toBe('http://192.168.1.5:8188');

    act(() => result.current.setImageProvider('a1111'));
    expect(lastPushed()).toBeNull();
  });
});
