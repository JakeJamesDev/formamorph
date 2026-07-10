import { describe, it, expect } from 'vitest';
import {
  activeSamplers, activeReasoning, activeVerbatim,
  updateSamplers, updateReasoning, updateVerbatim, foldTuningIntoUserPresets,
  type PromptPresetStore, type PromptValues,
} from './promptPresets';

const V = {} as PromptValues; // tuning helpers never touch text values
const builtin: PromptPresetStore = { activeId: 'default', presets: [] };
const userStore = (extra: Record<string, unknown> = {}): PromptPresetStore => ({
  activeId: 'u1',
  presets: [{ id: 'u1', name: 'U1', values: V, ...extra }],
});

describe('preset-scoped tuning resolvers', () => {
  it('a built-in resolves to empty tuning (→ defaults)', () => {
    expect(activeSamplers(builtin)).toEqual({});
    expect(activeReasoning(builtin)).toEqual({});
    expect(activeVerbatim(builtin)).toEqual({});
  });

  it('a user preset returns its stored tuning', () => {
    const s = userStore({
      samplers: { statUpdates: { temperature: { custom: true, value: 0.2 } } },
      reasoning: { narration: 'high' },
      verbatim: { narration: 5 },
    });
    expect(activeSamplers(s).statUpdates?.temperature?.value).toBe(0.2);
    expect(activeReasoning(s).narration).toBe('high');
    expect(activeVerbatim(s).narration).toBe(5);
  });
});

describe('preset-scoped tuning setters', () => {
  it('no-op under a built-in (read-only)', () => {
    expect(updateReasoning(builtin, 'narration', 'high')).toEqual(builtin);
    expect(updateVerbatim(builtin, 'narration', 5)).toEqual(builtin);
    expect(updateSamplers(builtin, () => ({ narration: {} }))).toEqual(builtin);
  });

  it('patch the active user preset', () => {
    let s = userStore();
    s = updateReasoning(s, 'choices', 'none');
    s = updateVerbatim(s, 'thinking', 2);
    s = updateSamplers(s, (m) => ({ ...m, summary: { temperature: { custom: true, value: 0 } } }));
    const p = s.presets[0];
    expect(p.reasoning).toEqual({ choices: 'none' });
    expect(p.verbatim).toEqual({ thinking: 2 });
    expect(p.samplers?.summary?.temperature?.value).toBe(0);
  });
});

describe('foldTuningIntoUserPresets (migration)', () => {
  it('fills only missing categories, never overwrites, only when non-empty', () => {
    const store: PromptPresetStore = {
      activeId: 'u1',
      presets: [
        { id: 'u1', name: 'U1', values: V, reasoning: { narration: 'low' } }, // already has reasoning
        { id: 'u2', name: 'U2', values: V },
      ],
    };
    const out = foldTuningIntoUserPresets(store, { summary: { temperature: { custom: true, value: 0 } } }, { narration: 'high' }, { narration: 3 });
    expect(out.presets[0].reasoning).toEqual({ narration: 'low' }); // not overwritten
    expect(out.presets[0].samplers?.summary?.temperature?.value).toBe(0); // filled
    expect(out.presets[1].reasoning).toEqual({ narration: 'high' }); // filled
    expect(out.presets[1].verbatim).toEqual({ narration: 3 });
  });

  it('is a no-op when all categories are empty', () => {
    const store = userStore();
    expect(foldTuningIntoUserPresets(store, {}, {}, {})).toBe(store);
  });
});
