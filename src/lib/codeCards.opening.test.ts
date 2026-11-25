import { describe, expect, it } from 'vitest';
import { codeCard, type CodeCard } from './codeCards';
import { statBoxLookup, type CodeCardWorld } from './codeWorldLookup';
import type { SurfaceAnalysisOptions } from './statCodeAnalysis';
import { STAT_CODE_SURFACE } from './statCodeSurface';
import { statCodeOwners } from './statCodeTargets';
import { entityTraitNames, worldTraitPlaces } from './statCodeTraits';
import type { OpeningKey } from './drawnOpening';
import type { Opening, OpeningRequirement, Stat, Trait } from '@/types';

/** A trait's Opening Condition reads the picked Openings' names on its code card, as the editor reads them. */

const stat: Stat = { id: 'courage', name: 'Courage', type: 'number', description: '', min: 0, max: 100, value: 0, regen: 0, descriptors: [] };
const ambush: Opening = { id: 'o1', text: 'Ambush!', kind: 'action', name: 'ambush' };
const quiet: Opening = { id: 'o2', text: 'Quiet.', kind: 'action' };
const key = (openingId: string): OpeningKey => ({ ownerId: null, openingId });

const gated = (name: string, req: OpeningRequirement): Trait =>
  ({ id: name, name, statChanges: [], requires: [{ all: [req] }] });

const world: CodeCardWorld = {
  traits: [
    gated('Named', { kind: 'opening', openings: [key('o1')] }),
    gated('Unnamed', { kind: 'opening', openings: [key('o2')] }),
    gated('Negated', { kind: 'opening', openings: [key('o1')], not: true }),
  ],
  traitGroups: [], entities: [], stats: [stat], statGroups: [], placeholders: [], locations: [],
  worldOverview: { openings: [ambush, quiet] } as CodeCardWorld['worldOverview'],
};

function requiresOf(name: string): string | undefined {
  const options: SurfaceAnalysisOptions = {
    surface: STAT_CODE_SURFACE,
    selfName: stat.name,
    statNames: [stat.name],
    ownerStatNames: [],
    traits: worldTraitPlaces(world, []).map((place) => place.name),
    entities: entityTraitNames(world, []),
    placeholders: { list: [], owners: new Map(), dictionaries: [] },
    lookup: statBoxLookup(statCodeOwners(world), { owner: null, timing: 'after', self: stat }, world),
  };
  const doc = `return traits.${name.slice(0, 2)}|${name.slice(2)}.enabled;`;
  const card: CodeCard | null = codeCard(doc.replace('|', ''), doc.indexOf('|'), options);
  return card?.rows?.find((row) => row.label === 'Requires')?.value;
}

describe('a code card’s Opening Condition line', () => {
  it('reads the picked Opening’s name', () => {
    expect(requiresOf('Named')).toBe('the opening is ambush');
  });

  it('reads an unnamed Opening’s derived label', () => {
    expect(requiresOf('Unnamed')).toBe('the opening is World · Opening 2');
  });

  it('reads the negated form for a Not Condition', () => {
    expect(requiresOf('Negated')).toBe('the opening is not ambush');
  });
});
