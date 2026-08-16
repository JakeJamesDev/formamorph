import { describe, it, expect, beforeEach } from 'vitest';
import {
  hasWorldPrompt, worldPrompt, storedWorldPrompt, worldPromptEnabled, resolveWorldPrompt,
  customizedPromptKinds, promptKindsPhrase, setWorldPromptOverride, clearWorldPromptOverride, useWorldPromptOptOut,
  WORLD_PROMPT_KINDS, type WorldPromptKind,
} from './worldPrompt';
import type { WorldOverview } from '@/types';
import { renderHook, act } from '@testing-library/react';

const overview = (promptOverrides?: WorldOverview['promptOverrides']): WorldOverview => ({
  name: 'W', description: '', author: '', thumbnail: null, bgm: null,
  systemPrompt: '', use3DModel: false, tags: [], ...(promptOverrides ? { promptOverrides } : {}),
});

const PRESET = 'the player preset prompt';
const WORLD = 'the world prompt';

/** The stored-text key each kind writes, so a per-kind case can build an overrides object for it. */
const TEXT_KEY: Record<WorldPromptKind, 'systemPrompt' | 'choicesPrompt' | 'statUpdatesPrompt'> = {
  narration: 'systemPrompt', choices: 'choicesPrompt', statUpdates: 'statUpdatesPrompt',
};
const FLAG_KEY: Record<WorldPromptKind, 'systemPromptEnabled' | 'choicesPromptEnabled' | 'statUpdatesPromptEnabled'> = {
  narration: 'systemPromptEnabled', choices: 'choicesPromptEnabled', statUpdates: 'statUpdatesPromptEnabled',
};

describe.each(WORLD_PROMPT_KINDS)('%s: what counts as shipping a prompt', (kind) => {
  const withText = (text: string, enabled?: boolean) => overview({
    [TEXT_KEY[kind]]: text, ...(enabled === undefined ? {} : { [FLAG_KEY[kind]]: enabled }),
  });

  it('reads the authored text', () => {
    expect(worldPrompt(withText(WORLD), kind)).toBe(WORLD);
    expect(hasWorldPrompt(withText(WORLD), kind)).toBe(true);
  });

  it('treats an absent, empty, or whitespace-only override as none', () => {
    // An author who clears the field must fall back to the player's prompt, not send a blank system prompt.
    for (const o of [overview(), overview({}), withText(''), withText('   \n ')]) {
      expect(worldPrompt(o, kind)).toBeNull();
      expect(hasWorldPrompt(o, kind)).toBe(false);
    }
  });

  it('survives a world with no overview at all', () => {
    expect(worldPrompt(null, kind)).toBeNull();
    expect(hasWorldPrompt(undefined, kind)).toBe(false);
  });

  it('ignores text the author switched off, without discarding it', () => {
    // The flag is what lets the editor's checkbox be non-destructive: the text stays on the world, and only
    // this reading decides it does not apply. A switched-off world must also not advertise a prompt.
    const off = withText(WORLD, false);
    expect(worldPrompt(off, kind)).toBeNull();
    expect(hasWorldPrompt(off, kind)).toBe(false);
    expect(storedWorldPrompt(off, kind)).toBe(WORLD); // still there to switch back on
  });

  it('applies text with the flag absent or true', () => {
    // Absent means a world authored before the flag existed, which must keep working.
    expect(worldPrompt(withText(WORLD), kind)).toBe(WORLD);
    expect(worldPrompt(withText(WORLD, true), kind)).toBe(WORLD);
  });

  it('counts a switched-on tab with nothing written as no override at all', () => {
    // The editor shows the live preset prompt as an unstored template. Until the author diverges from it
    // there is nothing authored, so the world must neither advertise nor apply anything.
    const drafting = overview({ [FLAG_KEY[kind]]: true });
    expect(worldPromptEnabled(drafting, kind)).toBe(true);
    expect(worldPrompt(drafting, kind)).toBeNull();
    expect(hasWorldPrompt(drafting, kind)).toBe(false);
  });

  it('reports no stored text when there never was any', () => {
    expect(storedWorldPrompt(overview(), kind)).toBeUndefined();
    expect(storedWorldPrompt(null, kind)).toBeUndefined();
  });

  it('leaves the other kinds alone', () => {
    const mine = withText(WORLD);
    for (const other of WORLD_PROMPT_KINDS.filter((k) => k !== kind)) {
      expect(worldPrompt(mine, other)).toBeNull();
      expect(resolveWorldPrompt(mine, other, PRESET, false)).toBe(PRESET);
    }
  });

  describe('resolveWorldPrompt: who wins', () => {
    it('gives the world its prompt by default', () => {
      expect(resolveWorldPrompt(withText(WORLD), kind, PRESET, false)).toBe(WORLD);
    });

    it('returns the preset when the player declined this world', () => {
      expect(resolveWorldPrompt(withText(WORLD), kind, PRESET, true)).toBe(PRESET);
    });

    it('returns the preset when the world ships nothing, opted out or not', () => {
      expect(resolveWorldPrompt(overview(), kind, PRESET, false)).toBe(PRESET);
      expect(resolveWorldPrompt(overview(), kind, PRESET, true)).toBe(PRESET);
    });

    it('returns the preset when the world has a prompt but switched it off', () => {
      expect(resolveWorldPrompt(withText(WORLD, false), kind, PRESET, false)).toBe(PRESET);
    });
  });
});

describe('customizedPromptKinds: what the player is told about', () => {
  it('names only the kinds that actually apply, in tab order', () => {
    const o = overview({
      systemPrompt: WORLD,
      choicesPrompt: WORLD, choicesPromptEnabled: false, // authored but switched off
      statUpdatesPrompt: WORLD, statUpdatesPromptEnabled: true,
    });
    expect(customizedPromptKinds(o)).toEqual(['narration', 'statUpdates']);
  });

  it('names nothing for a world with no overrides', () => {
    expect(customizedPromptKinds(overview())).toEqual([]);
    expect(customizedPromptKinds(null)).toEqual([]);
  });
});

describe('promptKindsPhrase: what the notice reads', () => {
  it('names one kind, two kinds, and three', () => {
    expect(promptKindsPhrase(['narration'])).toBe('a custom narration prompt');
    expect(promptKindsPhrase(['narration', 'choices'])).toBe('custom narration and choices prompts');
    expect(promptKindsPhrase(['narration', 'choices', 'statUpdates']))
      .toBe('custom narration, choices, and stats prompts');
  });

  it('says nothing for a world that customizes nothing', () => {
    expect(promptKindsPhrase([])).toBe('');
  });
});

describe('writing one kind', () => {
  it('sets text and flag without touching its siblings', () => {
    const before = { systemPrompt: 'narration', systemPromptEnabled: true };
    const after = setWorldPromptOverride(before, 'choices', { text: WORLD, enabled: true });

    expect(after).toEqual({ ...before, choicesPrompt: WORLD, choicesPromptEnabled: true });
    expect(before).toEqual({ systemPrompt: 'narration', systemPromptEnabled: true }); // unmutated
  });

  it('changes only what it is given', () => {
    const stored = { choicesPrompt: WORLD, choicesPromptEnabled: true };
    expect(setWorldPromptOverride(stored, 'choices', { enabled: false }))
      .toEqual({ choicesPrompt: WORLD, choicesPromptEnabled: false });
    expect(setWorldPromptOverride(stored, 'choices', { text: 'edited' }))
      .toEqual({ choicesPrompt: 'edited', choicesPromptEnabled: true });
  });

  it('clears the text back to live tracking, keeping the flag and the other kinds', () => {
    const after = clearWorldPromptOverride(
      { systemPrompt: 'narration', choicesPrompt: WORLD, choicesPromptEnabled: true }, 'choices');

    expect(after).toEqual({ systemPrompt: 'narration', choicesPromptEnabled: true });
    expect(storedWorldPrompt(overview(after), 'choices')).toBeUndefined();
    expect(hasWorldPrompt(overview(after), 'choices')).toBe(false);
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
