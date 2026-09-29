// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { clearSentPrompts, formatSentAt, getSentPrompts, recordSentPrompt, SENT_PROMPT_LIMIT } from './sentPromptLog';

beforeEach(() => clearSentPrompts());

describe('the sent prompt log', () => {
  it('keeps sent actions newest first, trimmed, and persists them', () => {
    recordSentPrompt('  I knock on the seam. ', 1);
    recordSentPrompt('I wait.', 2);
    expect(getSentPrompts()).toEqual([{ text: 'I wait.', at: 2 }, { text: 'I knock on the seam.', at: 1 }]);
    expect(JSON.parse(localStorage.getItem('FORMAMORPH_sentPromptLog')!)).toHaveLength(2);
  });

  it('keeps one entry for the same text sent twice in a row, and ignores blank text', () => {
    recordSentPrompt('I wait.', 1);
    recordSentPrompt('I wait.', 2);
    recordSentPrompt('   ', 3);
    expect(getSentPrompts()).toEqual([{ text: 'I wait.', at: 2 }]);
  });

  it('drops the oldest past the limit', () => {
    for (let i = 0; i < SENT_PROMPT_LIMIT + 5; i++) recordSentPrompt(`action ${i}`, i);
    const log = getSentPrompts();
    expect(log).toHaveLength(SENT_PROMPT_LIMIT);
    expect(log[0].text).toBe(`action ${SENT_PROMPT_LIMIT + 4}`);
    expect(log[log.length - 1].text).toBe('action 5');
  });
});

describe('formatSentAt', () => {
  it('shows the time alone today and the day and month before that, 24-hour', () => {
    const now = new Date(2026, 8, 29, 18, 0).getTime();
    expect(formatSentAt(new Date(2026, 8, 29, 14, 5).getTime(), now)).toBe('14:05');
    expect(formatSentAt(new Date(2026, 8, 28, 9, 30).getTime(), now)).toBe('28.09 09:30');
  });
});
