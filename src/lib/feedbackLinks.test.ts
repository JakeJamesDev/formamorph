import { describe, expect, it } from 'vitest';
import { parseFeedbackLinks } from './feedbackLinks';
import cases from './feedbackLinkCases.json';

describe('the feedback link grammar', () => {
  it.each(cases.map((c) => [c.name, c] as const))('%s', (_name, { text, links }) => {
    expect(parseFeedbackLinks(text)).toEqual(links);
  });
});
