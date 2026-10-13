import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { SettingsProvider, useSettings } from './SettingsContext';
import { BUILTIN_PRESETS } from '@/lib/promptPresets';
import { builtinStatTextPrompts, statTextFor } from '@/lib/statTextPrompts';

vi.mock('@/lib/reasoningEffort', async () => {
  const actual = await vi.importActual<typeof import('@/lib/reasoningEffort')>('@/lib/reasoningEffort');
  return { ...actual, detectReasoningCapability: vi.fn().mockResolvedValue(null) };
});

const wrapper = ({ children }: { children: ReactNode }) => <SettingsProvider>{children}</SettingsProvider>;

beforeEach(() => {
  localStorage.clear();
  window.matchMedia = ((media: string) => ({
    matches: false, media, onchange: null, addListener: vi.fn(), removeListener: vi.fn(),
    addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
});

describe('the stat pass text prompts the settings layer offers', () => {
  it.each(BUILTIN_PRESETS.map((b) => [b.id, b.style] as const))('gives the %s built-in its text pair in its own style', (id, style) => {
    const { result } = renderHook(() => useSettings(), { wrapper });
    act(() => result.current.selectPreset(id));
    expect(result.current.statTextPrompts).toEqual(builtinStatTextPrompts(style));
  });

  it('gives a user preset none, so its stat prompt goes as written', () => {
    const { result } = renderHook(() => useSettings(), { wrapper });
    act(() => { result.current.addPreset('Mine'); });
    expect(result.current.activePresetIsBuiltIn).toBe(false);
    expect(result.current.statTextPrompts).toBeNull();
  });
});

describe('the text pair a turn carries', () => {
  const builtin = builtinStatTextPrompts('labels');

  it('is the built-in pair when no world prompt applies', () => {
    expect(statTextFor(builtin, { worldPrompt: false })).toEqual(builtin);
  });

  it('keeps the world prompt as written but still follows the preset for the user message', () => {
    expect(statTextFor(builtin, { worldPrompt: true })).toEqual({ system: null, user: builtin.user });
  });

  it('sends a user preset as written on both sides', () => {
    expect(statTextFor(null, { worldPrompt: false })).toEqual({ system: null, user: null });
    expect(statTextFor(null, { worldPrompt: true })).toEqual({ system: null, user: null });
  });
});
