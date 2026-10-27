import { describe, expect, it } from 'vitest';
import { feedbackBoardPath, feedbackTarget, feedbackThreadPath } from './feedbackPath';

const ID = '3f2b8c1e-9a4d-4e6f-8b7a-1c2d3e4f5a6b';

describe('feedback addresses', () => {
  it('opens a bare board on Suggestions and reads Questions from the query', () => {
    expect(feedbackTarget('/feedback', '')).toEqual({ status: 'board', board: 'suggestions' });
    expect(feedbackTarget('/feedback', '?board=questions')).toEqual({ status: 'board', board: 'questions' });
  });

  it('never opens the bug board from the query', () => {
    expect(feedbackTarget('/feedback', '?board=bugs')).toEqual({ status: 'board', board: 'suggestions' });
  });

  it('reads a thread number', () => {
    expect(feedbackTarget('/feedback/23', '')).toEqual({ status: 'thread', number: '23' });
  });

  it('reads a trailing slash as the same address', () => {
    expect(feedbackTarget('/feedback/23/', '')).toEqual({ status: 'thread', number: '23' });
    expect(feedbackTarget('/feedback/', '?board=questions')).toEqual({ status: 'board', board: 'questions' });
  });

  it('calls anything else under the route invalid, a thread UUID included', () => {
    for (const path of [`/feedback/${ID}`, '/feedback/0', '/feedback/007', '/feedback/23x', '/feedback/not-a-number', '/feedback/23/x']) {
      expect(feedbackTarget(path, '')).toEqual({ status: 'invalid' });
    }
  });

  it('writes addresses the reader reads back', () => {
    const [pathname, query] = feedbackBoardPath('questions').split('?');
    expect(feedbackTarget(pathname, query)).toEqual({ status: 'board', board: 'questions' });
    expect(feedbackBoardPath('suggestions')).toBe('/feedback');
    expect(feedbackTarget(feedbackThreadPath(23), '')).toEqual({ status: 'thread', number: '23' });
  });
});
