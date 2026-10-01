import { describe, it, expect } from 'vitest';
import { includesAttachments, sanitizePromptAttachments } from './promptAttachments';

describe('includesAttachments', () => {
  it('defaults Narration on and every other prompt off', () => {
    expect(includesAttachments({}, 'narration')).toBe(true);
    for (const kind of ['director', 'statUpdates', 'choices', 'summary'] as const) {
      expect(includesAttachments({}, kind), kind).toBe(false);
    }
  });

  it('never sends images to a prompt whose pass lacks the player action', () => {
    for (const kind of ['diary', 'discoverEntity', 'openingTime', 'sceneTags', 'milestoneSelect'] as const) {
      expect(includesAttachments({ [kind]: true }, kind), kind).toBe(false);
      expect(sanitizePromptAttachments({ [kind]: true }), kind).toBeUndefined();
    }
  });

  it('lets a stored flag override the default either way', () => {
    expect(includesAttachments({ narration: false }, 'narration')).toBe(false);
    expect(includesAttachments({ director: true }, 'director')).toBe(true);
  });
});

describe('sanitizePromptAttachments', () => {
  it('keeps boolean flags for known prompts', () => {
    expect(sanitizePromptAttachments({ narration: false, director: true })).toEqual({ narration: false, director: true });
  });

  it('drops unknown prompts and non-boolean values', () => {
    expect(sanitizePromptAttachments({ narration: 'yes', director: 1, nonsense: true, choices: true })).toEqual({ choices: true });
  });

  it('reads nothing usable as absent', () => {
    expect(sanitizePromptAttachments(undefined)).toBeUndefined();
    expect(sanitizePromptAttachments('x')).toBeUndefined();
    expect(sanitizePromptAttachments({ nonsense: true })).toBeUndefined();
  });
});
