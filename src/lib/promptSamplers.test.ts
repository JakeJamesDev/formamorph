import { describe, it, expect } from 'vitest';
import {
  defaultPromptSampler,
  resolvePromptSampler,
  promptSamplerMapCodec,
  PROMPT_SAMPLER_PINS,
  type PromptSamplerMap,
} from './promptSamplers';

describe('per-prompt sampler defaults', () => {
  it('gives pinned prompts their constant on any endpoint, independent of the global value', () => {
    for (const isBuiltIn of [true, false]) {
      expect(defaultPromptSampler('statUpdates', 'temperature', 0.9, isBuiltIn)).toBe(PROMPT_SAMPLER_PINS.statUpdates!.temperature);
      expect(defaultPromptSampler('summary', 'temperature', 0.9, isBuiltIn)).toBe(PROMPT_SAMPLER_PINS.summary!.temperature);
      // Planning pins BOTH a moderate temperature and a rep-penalty of 1.
      expect(defaultPromptSampler('thinking', 'temperature', 0.9, isBuiltIn)).toBe(PROMPT_SAMPLER_PINS.thinking!.temperature);
      expect(defaultPromptSampler('thinking', 'repetitionPenalty', 1.3, isBuiltIn)).toBe(PROMPT_SAMPLER_PINS.thinking!.repetitionPenalty);
    }
  });

  it('sends the global value for an unpinned sampler on the built-in engine', () => {
    expect(defaultPromptSampler('narration', 'temperature', 0.85, true)).toBe(0.85);
    expect(defaultPromptSampler('narration', 'repetitionPenalty', 1.1, true)).toBe(1.1);
    // statUpdates pins temperature but NOT rep-penalty, so rep-penalty falls through to the global.
    expect(defaultPromptSampler('statUpdates', 'repetitionPenalty', 1.1, true)).toBe(1.1);
  });

  it('omits (undefined) for an unpinned sampler on a custom endpoint, so its own value applies', () => {
    expect(defaultPromptSampler('narration', 'temperature', 0.85, false)).toBeUndefined();
    expect(defaultPromptSampler('narration', 'repetitionPenalty', 1.1, false)).toBeUndefined();
    expect(defaultPromptSampler('statUpdates', 'repetitionPenalty', 1.1, false)).toBeUndefined();
  });
});

describe('resolvePromptSampler', () => {
  it('uses the kind/sampler default when the prompt has no override', () => {
    expect(resolvePromptSampler('statUpdates', 'temperature', {}, 0.7, false)).toBe(PROMPT_SAMPLER_PINS.statUpdates!.temperature);
    expect(resolvePromptSampler('narration', 'temperature', {}, 0.7, true)).toBe(0.7);
    expect(resolvePromptSampler('narration', 'temperature', {}, 0.7, false)).toBeUndefined();
    expect(resolvePromptSampler('thinking', 'repetitionPenalty', {}, 1.1, false)).toBe(1);
  });

  it('uses the default when an override exists but custom is off (value preserved but unused)', () => {
    const map: PromptSamplerMap = { statUpdates: { temperature: { custom: false, value: 1.5 } } };
    expect(resolvePromptSampler('statUpdates', 'temperature', map, 0.7, true)).toBe(PROMPT_SAMPLER_PINS.statUpdates!.temperature);
  });

  it('sends the custom value on any endpoint when custom is on, per sampler independently', () => {
    const map: PromptSamplerMap = {
      narration: { temperature: { custom: true, value: 0.3 }, repetitionPenalty: { custom: false, value: 1.4 } },
    };
    expect(resolvePromptSampler('narration', 'temperature', map, 0.7, false)).toBe(0.3);
    // rep-penalty override is off, so it still omits on a custom endpoint even though temperature is custom.
    expect(resolvePromptSampler('narration', 'repetitionPenalty', map, 1.1, false)).toBeUndefined();
  });
});

describe('promptSamplerMapCodec', () => {
  it('round-trips a map', () => {
    const map: PromptSamplerMap = { summary: { temperature: { custom: true, value: 0.4 } } };
    expect(promptSamplerMapCodec.parse(promptSamplerMapCodec.serialize(map))).toEqual(map);
  });

  it('falls back to an empty map on malformed storage', () => {
    expect(promptSamplerMapCodec.parse('not json')).toEqual({});
    expect(promptSamplerMapCodec.parse('null')).toEqual({});
  });
});
