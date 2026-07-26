import { describe, it, expect } from 'vitest';
import { computePromptTabAvailability, type PromptTabFlags } from './promptTabAvailability';

const base: PromptTabFlags = {
  thinkingMode: 'off',
  choicesEnabled: false,
  statUpdatesEnabled: false,
  locationChangeEnabled: false,
  memoryDigests: false,
  characterDiaries: false,
  aiClock: false,
};

describe('computePromptTabAvailability — Diary gating', () => {
  it('hides Diary when Character Diaries is on but Thinking is not Staged', () => {
    // The regression: Character Diaries is only toggleable in Staged, so the flag can
    // persist true after switching away. Diaries are read only by the staged pass.
    for (const thinkingMode of ['off', 'precall', 'inline'] as const) {
      expect(computePromptTabAvailability({ ...base, thinkingMode, characterDiaries: true }).diary).toBe(false);
    }
  });

  it('shows Diary only when Staged and Character Diaries are both on', () => {
    expect(computePromptTabAvailability({ ...base, thinkingMode: 'staged', characterDiaries: true }).diary).toBe(true);
  });

  it('hides Diary in Staged when Character Diaries is off', () => {
    expect(computePromptTabAvailability({ ...base, thinkingMode: 'staged', characterDiaries: false }).diary).toBe(false);
  });
});

describe('computePromptTabAvailability — other tabs', () => {
  it('always exposes Narration', () => {
    expect(computePromptTabAvailability(base).narration).toBe(true);
  });

  it('gates the staged-only tabs on Staged mode', () => {
    const staged = computePromptTabAvailability({ ...base, thinkingMode: 'staged' });
    expect(staged.director).toBe(true);
    expect(staged.character).toBe(true);
    expect(staged.storyboard).toBe(true);
    const off = computePromptTabAvailability(base);
    expect(off.director).toBe(false);
    expect(off.character).toBe(false);
    expect(off.storyboard).toBe(false);
  });

  it('gates Planning on precall mode only', () => {
    expect(computePromptTabAvailability({ ...base, thinkingMode: 'precall' }).thinking).toBe(true);
    expect(computePromptTabAvailability({ ...base, thinkingMode: 'staged' }).thinking).toBe(false);
  });

  it('maps each feature toggle to its tab', () => {
    expect(computePromptTabAvailability({ ...base, choicesEnabled: true }).choices).toBe(true);
    expect(computePromptTabAvailability({ ...base, statUpdatesEnabled: true }).statupdates).toBe(true);
    expect(computePromptTabAvailability({ ...base, locationChangeEnabled: true }).location).toBe(true);
    expect(computePromptTabAvailability({ ...base, memoryDigests: true }).summary).toBe(true);
  });
});
