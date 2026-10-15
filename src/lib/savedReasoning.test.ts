import { describe, it, expect } from 'vitest';
import { parseSavedReasoning } from './savedReasoning';

describe('parseSavedReasoning', () => {
  it('reads a strict JSON turn', () => {
    expect(parseSavedReasoning('{"narration":"n","reasoning":{"text":"plan","ms":120}}')).toEqual({ text: 'plan', ms: 120 });
  });

  it('reads a json5-only turn', () => {
    expect(parseSavedReasoning("{ narration: 'n', reasoning: { text: 'plan', ms: 5 }, }")).toEqual({ text: 'plan', ms: 5 });
  });

  it('defaults ms to 0 when missing', () => {
    expect(parseSavedReasoning('{"reasoning":{"text":"plan"}}')).toEqual({ text: 'plan', ms: 0 });
  });

  it('returns null with no reasoning or unparseable content', () => {
    expect(parseSavedReasoning('{"narration":"n"}')).toBeNull();
    expect(parseSavedReasoning('not json at all')).toBeNull();
  });
});
