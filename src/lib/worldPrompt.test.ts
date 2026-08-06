import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { hasWorldNarrationPrompt, worldNarrationPrompt, storedNarrationPrompt, resolveNarrationPrompt, useWorldPromptOptOut } from './worldPrompt';
import type { WorldOverview } from '@/types';

const overview = (promptOverrides?: WorldOverview['promptOverrides']): WorldOverview => ({
  name: 'W', description: '', author: '', thumbnail: null, bgm: null,
  systemPrompt: '', use3DModel: false, tags: [], ...(promptOverrides ? { promptOverrides } : {}),
});

const PRESET = 'the player preset prompt';
const WORLD = 'the world prompt';

describe('worldNarrationPrompt: what counts as shipping one', () => {
  it('reads the authored text', () => {
    expect(worldNarrationPrompt(overview({ systemPrompt: WORLD }))).toBe(WORLD);
    expect(hasWorldNarrationPrompt(overview({ systemPrompt: WORLD }))).toBe(true);
  });

  it('treats an absent, empty, or whitespace-only override as none', () => {
    // An author who clears the field must fall back to the player's prompt, not send a blank system prompt.
    for (const value of [undefined, {}, { systemPrompt: '' }, { systemPrompt: '   \n ' }]) {
      const o = overview(value as WorldOverview['promptOverrides']);
      expect(worldNarrationPrompt(o)).toBeNull();
      expect(hasWorldNarrationPrompt(o)).toBe(false);
    }
  });

  it('survives a world with no overview at all', () => {
    expect(worldNarrationPrompt(null)).toBeNull();
    expect(hasWorldNarrationPrompt(undefined)).toBe(false);
  });

  it('ignores text the author switched off, without discarding it', () => {
    // The flag is what lets the editor's toggle be non-destructive: the text stays on the world, and only
    // this reading decides it does not apply. A switched-off world must also not advertise a prompt.
    const off = overview({ systemPrompt: WORLD, systemPromptEnabled: false });
    expect(worldNarrationPrompt(off)).toBeNull();
    expect(hasWorldNarrationPrompt(off)).toBe(false);
    expect(storedNarrationPrompt(off)).toBe(WORLD); // still there to switch back on
  });

  it('applies text with the flag absent or true', () => {
    // Absent means a world authored before the flag existed, which must keep working.
    expect(worldNarrationPrompt(overview({ systemPrompt: WORLD }))).toBe(WORLD);
    expect(worldNarrationPrompt(overview({ systemPrompt: WORLD, systemPromptEnabled: true }))).toBe(WORLD);
  });

  it('reports no stored text when there never was any', () => {
    expect(storedNarrationPrompt(overview())).toBeUndefined();
    expect(storedNarrationPrompt(null)).toBeUndefined();
  });
});

describe('resolveNarrationPrompt: who wins', () => {
  it('gives the world its prompt by default', () => {
    expect(resolveNarrationPrompt(overview({ systemPrompt: WORLD }), PRESET, false)).toBe(WORLD);
  });

  it('returns the preset when the player declined this world', () => {
    expect(resolveNarrationPrompt(overview({ systemPrompt: WORLD }), PRESET, true)).toBe(PRESET);
  });

  it('returns the preset when the world ships nothing, opted out or not', () => {
    expect(resolveNarrationPrompt(overview(), PRESET, false)).toBe(PRESET);
    expect(resolveNarrationPrompt(overview(), PRESET, true)).toBe(PRESET);
  });

  it('returns the preset when the world has a prompt but switched it off', () => {
    const off = overview({ systemPrompt: WORLD, systemPromptEnabled: false });
    expect(resolveNarrationPrompt(off, PRESET, false)).toBe(PRESET);
  });
});

describe('useWorldPromptOptOut: the per-world preference', () => {
  beforeEach(() => localStorage.clear());

  it('defaults to using the world prompt for a world never touched', () => {
    const { result } = renderHook(() => useWorldPromptOptOut());
    expect(result.current.applyWorldPrompt('w1')).toBe(true);
  });

  it('remembers a decline for that world only, and persists it', () => {
    const { result } = renderHook(() => useWorldPromptOptOut());
    act(() => result.current.setApplyWorldPrompt('w1', false));

    expect(result.current.applyWorldPrompt('w1')).toBe(false);
    expect(result.current.applyWorldPrompt('w2')).toBe(true); // a choice never leaks between worlds

    const reread = renderHook(() => useWorldPromptOptOut());
    expect(reread.result.current.applyWorldPrompt('w1')).toBe(false);
  });

  it('takes the decline back', () => {
    const { result } = renderHook(() => useWorldPromptOptOut());
    act(() => result.current.setApplyWorldPrompt('w1', false));
    act(() => result.current.setApplyWorldPrompt('w1', true));
    expect(result.current.applyWorldPrompt('w1')).toBe(true);
  });

  it('reads a corrupt stored value as "nothing declined" rather than throwing', () => {
    localStorage.setItem('FORMAMORPH_worldPromptOptOut', '{not json');
    const { result } = renderHook(() => useWorldPromptOptOut());
    expect(result.current.applyWorldPrompt('w1')).toBe(true);
  });
});
