import { describe, expect, it } from 'vitest';
import { answerRoute, type RoutedAnswer } from './answerRoute';

const done: Omit<RoutedAnswer, 'sources'> = { status: 'answered', flagged: false };

describe('answerRoute', () => {
  it('is the top source route of a finished answer', () => {
    expect(answerRoute({ ...done, sources: [{ route: 'settings.display' }, {}] })).toBe('settings.display');
  });

  it('ignores a route on a later source', () => {
    expect(answerRoute({ ...done, sources: [{}, { route: 'settings.display' }] })).toBeNull();
  });

  it('is null for a stopped, failed or flagged answer', () => {
    const sources = [{ route: 'settings.display' }];
    expect(answerRoute({ ...done, status: 'stopped', sources })).toBeNull();
    expect(answerRoute({ ...done, status: 'failed', sources })).toBeNull();
    expect(answerRoute({ ...done, flagged: true, sources })).toBeNull();
  });

  it('is null for a route that opens nothing', () => {
    expect(answerRoute({ ...done, sources: [{ route: 'settings.nowhere' }] })).toBeNull();
    expect(answerRoute({ ...done, sources: [{ route: 'errorDetails' }] })).toBeNull();
  });
});
