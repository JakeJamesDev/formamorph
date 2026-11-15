import { describe, expect, it } from 'vitest';
import { splitToken } from '../promptVariables';
import { chipValues } from './chipValues';
import { liveChipScene, type LiveSceneSources } from './liveScene';
import type { Connection, Entity, GameLocation } from '@/types';

// The inn holds an unmet stranger and a met regular; the smithy, one link away, holds another stranger.
const inn: GameLocation = { id: 'inn', name: 'Inn', aiDescription: 'A low room.' };
const smithy: GameLocation = { id: 'smithy', name: 'Smithy', aiDescription: 'A hot forge.' };
const connections: Connection[] = [{ id: 'lane', a: 'inn', b: 'smithy', aToB: {}, bToA: {} }];

const veiled: Entity = {
  id: 'veiled', name: 'Mirelle Vane', aliases: ['Lady Vane'], pronouns: 'she/her', locations: ['inn'], aiSummary: 'A quiet guest.',
};
const regular: Entity = { id: 'regular', name: 'Tobin', aliases: ['Old Tob'], locations: ['inn'], aiSummary: 'A drinker.' };
const smith: Entity = { id: 'smith', name: 'Hesk Arden', aliases: ['Arden'], locations: ['smithy'], knownIn: ['inn'], aiSummary: 'The smith.' };
const cast = [veiled, regular, smith];

const sources: LiveSceneSources = {
  overview: '', stats: [], statPlacement: { groups: [], authored: [] }, traits: [], traitGroups: [],
  standings: { positions: {}, generics: {} },
  resolve: (text) => text, resolveTrait: (_t, text) => text, resolveEntity: (_e, text) => text,
  persona: null, location: inn, locations: [inn, smithy], connections,
  entities: cast, allEntities: cast, participants: [], notes: '', time: null, placeholders: [],
  strangerLabels: { veiled: 'The Veiled Guest', smith: 'The Smith' },
};

const values = (() => {
  const lookup = chipValues(liveChipScene(sources));
  return (token: string) => lookup(splitToken(token)?.key ?? token) ?? '';
})();

describe('Known Name Only on the Entities chip', () => {
  it('heads an unmet stranger with its label and drops its true name and aliases', () => {
    const block = values('<ENTITIES|summary.knownname.markdown>');
    expect(block).toContain('- **The Veiled Guest**');
    expect(block).not.toMatch(/Mirelle|Vane|stranger name/);
    expect(block).toContain('**pronouns:** she/her');
    expect(block).toContain('A quiet guest.');
  });

  it('leaves a met entity under its true name with its aliases', () => {
    const block = values('<ENTITIES|knownname.markdown>');
    expect(block).toContain('- **Tobin**');
    expect(block).toContain('Old Tob');
  });

  it('applies to the Known Here scope', () => {
    const block = values('<ENTITIES|known.summary.knownname.markdown>');
    expect(block).toContain('- **The Smith**');
    expect(block).not.toContain('Arden');
  });

  it('applies to the xml shape and Name content', () => {
    const xml = values('<ENTITIES|knownname.xml>');
    expect(xml).toContain('The Veiled Guest');
    expect(xml).not.toContain('Mirelle');
    expect(values('<ENTITIES|name.knownname>')).toBe('The Veiled Guest, Tobin');
  });

  it('keeps the true name and the stranger name line when off', () => {
    const block = values('<ENTITIES|markdown>');
    expect(block).toContain('- **Mirelle Vane**');
    expect(block).toContain('**stranger name:** The Veiled Guest');
    expect(block).toContain('Lady Vane');
    expect(values('<ENTITIES|name>')).toBe('Mirelle Vane (The Veiled Guest), Tobin');
  });
});
