import { describe, expect, it } from 'vitest';
import { helpRoutes } from './helpRoutes';
import { DEFAULT_HELP_SETTINGS, SAME_AS_ANSWER, SAME_AS_SEARCH, helpSettingsOf } from './helpSettings';

describe('the help routes', () => {
  const routes = (answerEndpoint: string | null, pickEndpoint: string | null, intentEndpoint: string | null = SAME_AS_SEARCH) =>
    helpRoutes(helpSettingsOf({ answerEndpoint, pickEndpoint, intentEndpoint }));

  it('follow the active endpoint for every request by default', () => {
    expect(helpRoutes(DEFAULT_HELP_SETTINGS)).toEqual({ answer: [], pick: [], intent: [] });
  });

  it('send picks where answers go with Same as Answer', () => {
    expect(routes('p1', SAME_AS_ANSWER)).toEqual({ answer: ['p1'], pick: ['p1'], intent: ['p1'] });
  });

  it('send picks to their own preset, with the answer route behind it for a deleted preset', () => {
    expect(routes('p1', 'p2')).toEqual({ answer: ['p1'], pick: ['p2', 'p1'], intent: ['p2', 'p1'] });
  });

  it('send picks to the active endpoint with Follow Active, whatever the answer route', () => {
    expect(routes('p1', null)).toEqual({ answer: ['p1'], pick: [], intent: [] });
  });

  it('send the Intent Classifier where picks go with Same as Search, to its own preset with the pick route behind it, or to the active endpoint', () => {
    expect(routes('p1', 'p2', SAME_AS_SEARCH).intent).toEqual(['p2', 'p1']);
    expect(routes('p1', 'p2', 'p3').intent).toEqual(['p3', 'p2', 'p1']);
    expect(routes('p1', 'p2', null).intent).toEqual([]);
  });
});
