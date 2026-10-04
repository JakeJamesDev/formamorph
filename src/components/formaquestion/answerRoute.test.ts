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

  it('skips a routeless lead for the first routed hit', () => {
    const sources = [{ id: 'lead' }, { id: 'hit', route: 'settings.display' }];
    expect(answerRoute({ ...done, sources, lead: { id: 'lead' } })).toBe('settings.display');
  });

  it('lets the lead decide when it is the only source', () => {
    expect(answerRoute({ ...done, sources: [{ id: 'lead', route: 'settings.display' }], lead: { id: 'lead' } })).toBe('settings.display');
    expect(answerRoute({ ...done, sources: [{ id: 'lead' }], lead: { id: 'lead' } })).toBeNull();
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
