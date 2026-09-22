import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { SettingsProvider, useSettings } from './SettingsContext';
import { PROMPT_TEXT_DEFAULTS } from '@/components/game/GamePrompts';
import { EXPERIMENTAL_PROMPT_VALUES } from '@/components/game/ExperimentalPrompts';
import { buildStyledValues } from '@/lib/sectionStyle';

vi.mock('@/lib/reasoningEffort', async () => {
  const actual = await vi.importActual<typeof import('@/lib/reasoningEffort')>('@/lib/reasoningEffort');
  return { ...actual, detectReasoningCapability: vi.fn().mockResolvedValue(null) };
});

const experimental = buildStyledValues(EXPERIMENTAL_PROMPT_VALUES, 'markdown');
const defaults = buildStyledValues(PROMPT_TEXT_DEFAULTS, 'markdown');

const wrapper = ({ children }: { children: ReactNode }) => <SettingsProvider>{children}</SettingsProvider>;

beforeEach(() => {
  localStorage.clear();
  window.matchMedia = ((media: string) => ({
    matches: false, media, onchange: null, addListener: vi.fn(), removeListener: vi.fn(),
    addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
});

describe('Experimental built-in prompt', () => {
  it('is opt-in and leaves the established presets unchanged', () => {
    const { result } = renderHook(() => useSettings(), { wrapper });
    expect(result.current.activePresetId).toBe('default');
    expect(result.current.builtinPresets).toContainEqual({ id: 'experimental', name: 'Experimental' });
    for (const [id, style] of [['default', 'markdown'], ['simple', 'labels'], ['xml', 'xml']] as const) {
      act(() => result.current.selectPreset(id));
      expect(result.current.systemPrompt).toBe(buildStyledValues(PROMPT_TEXT_DEFAULTS, style).systemPrompt);
    }
  });

  it('selects and persists its own narration without the forced-response rider', () => {
    const first = renderHook(() => useSettings(), { wrapper });
    act(() => first.result.current.selectPreset('experimental'));
    expect(first.result.current.systemPrompt).toBe(experimental.systemPrompt);
    expect(first.result.current.narrationUserPrompt).toBe('<PLAYER ACTION>');
    expect(first.result.current.activePresetIsBuiltIn).toBe(true);
    expect(first.result.current.choicesPrompt).toBe(PROMPT_TEXT_DEFAULTS.choicesPrompt);
    first.unmount();
    const second = renderHook(() => useSettings(), { wrapper });
    expect(second.result.current.activePresetId).toBe('experimental');
    expect(second.result.current.systemPrompt).toContain('An observational turn can remain silent.');
    expect(second.result.current.systemPrompt).not.toContain('then the character answers');
    act(() => second.result.current.selectPreset('default'));
    expect(second.result.current.systemPrompt).toBe(defaults.systemPrompt);
    expect(second.result.current.narrationUserPrompt).toBe(PROMPT_TEXT_DEFAULTS.narrationUserPrompt);
  });

  it('copies Experimental into an editable preset without changing either built-in', () => {
    const { result } = renderHook(() => useSettings(), { wrapper });
    act(() => result.current.selectPreset('experimental'));
    act(() => { result.current.addPreset('My experiment'); });
    expect(result.current.activePresetIsBuiltIn).toBe(false);
    expect(result.current.systemPrompt).toBe(experimental.systemPrompt);
    act(() => result.current.setSystemPrompt('My revised narration'));
    expect(result.current.systemPrompt).toBe('My revised narration');
    act(() => result.current.selectPreset('experimental'));
    expect(result.current.systemPrompt).toBe(experimental.systemPrompt);
    act(() => result.current.selectPreset('default'));
    expect(result.current.systemPrompt).toBe(defaults.systemPrompt);
  });
});
