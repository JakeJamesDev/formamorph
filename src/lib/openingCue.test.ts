import { describe, it, expect } from 'vitest';
import { OPENING_SCENE_CUE } from '@/components/game/GamePrompts';
import type { WorldOverview } from '@/types';
import {
  clearOpeningCue, hasOpeningCue, openingCueEnabled, OPENING_CUE_FIELD_KEY, resolveOpeningCue, setOpeningCue,
  storedOpeningCue,
} from './openingCue';

const AUTHORED = 'You wake in the reed-beds with the tide already climbing.';

const overview = (over: Partial<WorldOverview> = {}): WorldOverview => ({
  name: 'W', description: '', author: '', thumbnail: null, bgm: null,
  systemPrompt: '', use3DModel: false, tags: [], ...over,
});

describe('what counts as a world having an opening cue', () => {
  it('reads the authored text whether or not it is applied', () => {
    expect(storedOpeningCue(overview({ openingCue: AUTHORED }))).toBe(AUTHORED);
    expect(storedOpeningCue(overview({ openingCue: AUTHORED, openingCueEnabled: false }))).toBe(AUTHORED);
    expect(storedOpeningCue(overview())).toBeUndefined();
    expect(storedOpeningCue(null)).toBeUndefined();
  });

  it('counts stored text with no flag as switched on', () => {
    // Forward-compat: a hand-authored world JSON carrying only the text still opens with it.
    expect(openingCueEnabled(overview({ openingCue: AUTHORED }))).toBe(true);
    expect(resolveOpeningCue(overview({ openingCue: AUTHORED }))).toBe(AUTHORED);
  });

  it('lets an explicit flag decide over the stored text', () => {
    expect(openingCueEnabled(overview({ openingCue: AUTHORED, openingCueEnabled: false }))).toBe(false);
    expect(openingCueEnabled(overview({ openingCueEnabled: true }))).toBe(true);
    expect(openingCueEnabled(overview())).toBe(false);
  });

  it('falls back to the shipped cue for a world that has none', () => {
    expect(resolveOpeningCue(overview())).toBe(OPENING_SCENE_CUE);
    expect(resolveOpeningCue(null)).toBe(OPENING_SCENE_CUE);
    expect(hasOpeningCue(overview())).toBe(false);
  });

  it('falls back to the shipped cue when the text is switched off', () => {
    const off = overview({ openingCue: AUTHORED, openingCueEnabled: false });
    expect(resolveOpeningCue(off)).toBe(OPENING_SCENE_CUE);
    expect(hasOpeningCue(off)).toBe(false);
  });

  it('falls back to the shipped cue when an applied cue is blank', () => {
    // An accidentally emptied field must never send an empty opening action.
    for (const text of ['', '   ', ' \n\t ']) {
      const blank = overview({ openingCue: text, openingCueEnabled: true });
      expect(resolveOpeningCue(blank)).toBe(OPENING_SCENE_CUE);
      expect(hasOpeningCue(blank)).toBe(false);
    }
  });
});

describe('what the editor writes', () => {
  it('sets text and flag independently, so switching off keeps the text', () => {
    expect(setOpeningCue({ text: AUTHORED })).toEqual({ openingCue: AUTHORED });
    expect(setOpeningCue({ enabled: false })).toEqual({ openingCueEnabled: false });
    expect(setOpeningCue({ text: AUTHORED, enabled: true }))
      .toEqual({ openingCue: AUTHORED, openingCueEnabled: true });
  });

  it('clears only the stored text, leaving the switch as the author left it', () => {
    const patch = clearOpeningCue();
    expect(patch.openingCue).toBeUndefined();
    expect('openingCueEnabled' in patch).toBe(false);
    expect(storedOpeningCue(overview({ openingCue: AUTHORED, openingCueEnabled: true, ...patch })))
      .toBeUndefined();
  });

  it('names the field the find bar navigates by', () => {
    expect(OPENING_CUE_FIELD_KEY).toBe('openingCue');
  });
});
