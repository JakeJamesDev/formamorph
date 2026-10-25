import { describe, expect, it } from 'vitest';
import { FEEDBACK_TITLE_MAX } from './feedbackDraft';
import { questionFromHelp } from './feedbackOpener';

describe('questionFromHelp', () => {
  it('collapses every run of whitespace, line breaks included, to one space', () => {
    expect(questionFromHelp('  How do I\n\n  change\tthe theme?  ')).toEqual({ title: 'How do I change the theme?', body: '' });
  });

  it('cuts a long question to the title limit, ending it with an ellipsis', () => {
    const { title } = questionFromHelp('word '.repeat(60))!;
    expect(title).toHaveLength(FEEDBACK_TITLE_MAX);
    expect(title.endsWith('…')).toBe(true);
  });

  it('gives no fill for a question with no text', () => {
    expect(questionFromHelp(' \n ')).toBeNull();
  });
});
