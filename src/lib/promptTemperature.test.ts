import { describe, it, expect } from 'vitest';
import {
  defaultPromptTemperature,
  resolvePromptTemperature,
  promptTempMapCodec,
  DETERMINISTIC_PROMPT_TEMPS,
  type PromptTempMap,
} from './promptTemperature';

describe('per-prompt temperature defaults', () => {
  it('gives deterministic prompts a low constant on any endpoint, independent of the global temperature', () => {
    for (const isBuiltIn of [true, false]) {
      expect(defaultPromptTemperature('statUpdates', 0.9, isBuiltIn)).toBe(DETERMINISTIC_PROMPT_TEMPS.statUpdates);
      expect(defaultPromptTemperature('locationChange', 0.9, isBuiltIn)).toBe(DETERMINISTIC_PROMPT_TEMPS.locationChange);
      expect(defaultPromptTemperature('summary', 0.9, isBuiltIn)).toBe(DETERMINISTIC_PROMPT_TEMPS.summary);
    }
  });

  it('sends the global temperature for non-pinned prompts on the built-in engine', () => {
    expect(defaultPromptTemperature('narration', 0.85, true)).toBe(0.85);
    expect(defaultPromptTemperature('choices', 0.6, true)).toBe(0.6);
    expect(defaultPromptTemperature('director', 1.2, true)).toBe(1.2);
  });

  it('omits (undefined) for non-pinned prompts on a custom endpoint, so its own value applies', () => {
    expect(defaultPromptTemperature('narration', 0.85, false)).toBeUndefined();
    expect(defaultPromptTemperature('choices', 0.6, false)).toBeUndefined();
    expect(defaultPromptTemperature('diary', 0.9, false)).toBeUndefined();
  });
});

describe('resolvePromptTemperature', () => {
  it('uses the kind default when the prompt has no override', () => {
    expect(resolvePromptTemperature('statUpdates', {}, 0.7, false)).toBe(DETERMINISTIC_PROMPT_TEMPS.statUpdates);
    expect(resolvePromptTemperature('narration', {}, 0.7, true)).toBe(0.7);
    expect(resolvePromptTemperature('narration', {}, 0.7, false)).toBeUndefined();
  });

  it('uses the kind default when an override exists but custom is off (value preserved but unused)', () => {
    const map: PromptTempMap = { statUpdates: { custom: false, value: 1.5 } };
    expect(resolvePromptTemperature('statUpdates', map, 0.7, true)).toBe(DETERMINISTIC_PROMPT_TEMPS.statUpdates);
  });

  it('sends the custom value on any endpoint when custom is on, including a non-pinned prompt', () => {
    const map: PromptTempMap = { narration: { custom: true, value: 0.3 } };
    expect(resolvePromptTemperature('narration', map, 0.7, true)).toBe(0.3);
    expect(resolvePromptTemperature('narration', map, 0.7, false)).toBe(0.3);
  });
});

describe('promptTempMapCodec', () => {
  it('round-trips a map', () => {
    const map: PromptTempMap = { summary: { custom: true, value: 0.4 } };
    expect(promptTempMapCodec.parse(promptTempMapCodec.serialize(map))).toEqual(map);
  });

  it('falls back to an empty map on malformed storage', () => {
    expect(promptTempMapCodec.parse('not json')).toEqual({});
    expect(promptTempMapCodec.parse('null')).toEqual({});
  });
});
