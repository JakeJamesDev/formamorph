import { describe, expect, it } from 'vitest';
import { helpRoutes } from './helpRoutes';
import { DEFAULT_HELP_SETTINGS, SAME_AS_ANSWER, helpSettingsOf } from './helpSettings';

describe('the help routes', () => {
  const routes = (answerEndpoint: string | null, pickEndpoint: string | null) => helpRoutes(helpSettingsOf({ answerEndpoint, pickEndpoint }));

  it('follow the active endpoint for both requests by default', () => {
    expect(helpRoutes(DEFAULT_HELP_SETTINGS)).toEqual({ answer: [], pick: [] });
  });

  it('send picks where answers go with Same as Answer', () => {
    expect(routes('p1', SAME_AS_ANSWER)).toEqual({ answer: ['p1'], pick: ['p1'] });
  });

  it('send picks to their own preset, with the answer route behind it for a deleted preset', () => {
    expect(routes('p1', 'p2')).toEqual({ answer: ['p1'], pick: ['p2', 'p1'] });
  });

  it('send picks to the active endpoint with Follow Active, whatever the answer route', () => {
    expect(routes('p1', null)).toEqual({ answer: ['p1'], pick: [] });
  });
});
