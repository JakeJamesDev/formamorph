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

  describe('with an answer that copies a later source', () => {
    const addLocation = {
      id: 'World-Editor-Locations#how-to-add-a-location',
      route: 'worldEditor.locations',
      markdown: '## How to Add a Location\n\n1. Open the **Locations** tab.\n2. Type the location\'s name in the **Search or add new locations** box.\n3. Select the **+** button (**Add to Locations**). The new location opens in the panel.\n4. On the **Details** tab, write the **AI-Facing Description**.\n5. Select **Save** at the bottom of the editor.',
    };
    const addEntity = {
      id: 'World-Editor-Entities#how-to-add-an-entity',
      route: 'worldEditor.entities',
      markdown: '## How to Add an Entity\n\n1. Open the **Entities** tab.\n2. Type the entity\'s name in the **Search or add new entities** box.\n3. Select the **+** button (**Add to Entities**). In Advanced mode, the button opens a menu: select **Add Entity**.\n4. The new entity opens in the panel. On the **Profile** tab, pick one or more places in **Locations**.\n5. On the **Descriptions** tab, write the **AI-Facing Description**.\n6. Select **Save** at the bottom of the editor.',
    };
    const lead = { id: 'World-Editor-Stats#dynamic-value-calculation', route: 'worldEditor.stats', markdown: '## Dynamic Value Calculation' };
    const answer = 'Adding entities to a location is a breeze! Here\'s how you do it:\n\n1. Open the **Entities** tab.\n2. Type the entity\'s name in the **Search or add new entities** box.\n3. Select the **+** button (**Add to Entities**). In Advanced mode, the button opens a menu: select **Add Entity**.\n4. The new entity opens in the panel. On the **Profile** tab, pick one or more places in **Locations**.\n5. On the **Descriptions** tab, write the **AI-Facing Description**.\n6. Select **Save** at the bottom of the editor.';

    it('routes to the copied source over an earlier one', () => {
      const sources = [lead, addLocation, addEntity];
      expect(answerRoute({ ...done, answer, sources, lead })).toEqual({ id: 'worldEditor.entities' });
    });

    it('keeps the first source when the answer copies none', () => {
      const sources = [lead, addLocation, addEntity];
      expect(answerRoute({ ...done, answer: 'Open the editor and look around.', sources, lead })).toEqual({ id: 'worldEditor.locations' });
    });
  });

  it('is null for a route that opens nothing', () => {
    expect(answerRoute({ ...done, sources: [{ route: 'settings.nowhere' }] })).toBeNull();
    expect(answerRoute({ ...done, sources: [{ route: 'errorDetails' }] })).toBeNull();
  });
});
