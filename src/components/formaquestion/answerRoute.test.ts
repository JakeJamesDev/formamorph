import { describe, expect, it } from 'vitest';
import { answerRoute, type RoutedAnswer } from './answerRoute';

const done: Omit<RoutedAnswer, 'sources'> = { status: 'answered', flagged: false };

describe('answerRoute', () => {
  it('is the top source route of a finished answer', () => {
    expect(answerRoute({ ...done, sources: [{ route: 'settings.display' }, {}] })).toEqual({ id: 'settings.display' });
  });

  it('ignores a route on a later source', () => {
    expect(answerRoute({ ...done, sources: [{}, { route: 'settings.display' }] })).toBeNull();
  });

  it('skips a routeless lead for the first routed hit', () => {
    const sources = [{ id: 'lead' }, { id: 'hit', route: 'settings.display' }];
    expect(answerRoute({ ...done, sources, lead: { id: 'lead' } })).toEqual({ id: 'settings.display' });
  });

  it('lets the lead decide when it is the only source', () => {
    expect(answerRoute({ ...done, sources: [{ id: 'lead', route: 'settings.display' }], lead: { id: 'lead' } })).toEqual({ id: 'settings.display' });
    expect(answerRoute({ ...done, sources: [{ id: 'lead' }], lead: { id: 'lead' } })).toBeNull();
  });

  it('keeps a target the surface registers', () => {
    const sources = [{ route: 'settings.display', target: 'narration-layout' }];
    expect(answerRoute({ ...done, sources })).toEqual({ id: 'settings.display', target: 'narration-layout' });
  });

  it('drops a target the surface does not register, keeping the surface', () => {
    expect(answerRoute({ ...done, sources: [{ route: 'settings.display', target: 'nowhere' }] })).toEqual({ id: 'settings.display' });
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
