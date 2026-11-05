import { describe, expect, it } from 'vitest';
import { ENDPOINT_COPY, GENERAL_COPY } from './formaquestionSettingsTabs';

describe('the Backdrop setting', () => {
  it('has the Q48 label and hint', () => {
    expect(GENERAL_COPY.scrimOpacity).toEqual({ label: 'Backdrop', hint: 'Shades the screen behind the chat so the text stands out' });
  });
});

describe('the Q50 lines', () => {
  it('are each 12 words or fewer', () => {
    expect(GENERAL_COPY.keyword.hint).toBe('Matches the words in your question to guide sections');
    expect(GENERAL_COPY.aiPicks.hint).toBe('Asks your AI to choose guide sections first. Adds one request.');
    expect(GENERAL_COPY.semantic.hint).toBe('Finds guide sections by meaning. Downloads a small model once.');
    expect(ENDPOINT_COPY.pick.description).toBe('Runs the search request. A small, fast model is enough.');
    for (const line of [GENERAL_COPY.keyword.hint, GENERAL_COPY.aiPicks.hint, GENERAL_COPY.semantic.hint, ENDPOINT_COPY.pick.description]) {
      expect(line.split(/\s+/).length, line).toBeLessThanOrEqual(12);
    }
  });
});
