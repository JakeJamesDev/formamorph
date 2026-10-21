import { describe, expect, it } from 'vitest';
import { codeCard } from './codeCards';
import { statBoxLookup, traitBoxSelf, type CodeCardWorld } from './codeWorldLookup';
import { codeDiagnostics, type SurfaceAnalysisOptions } from './statCodeAnalysis';
import { scriptSurface, WORLD_SCRIPT_SURFACE } from './statCodeSurface';
import { statCodeOwners } from './statCodeTargets';
import type { Entity } from '@/types';

/** `diary` lives on an entity's entry: the member has a card, and the retired top-level name has none. */

const tor: Entity = { id: 'tor', name: 'Tor' };
const world: CodeCardWorld = {
  traits: [], traitGroups: [], entities: [tor], stats: [], statGroups: [], placeholders: [], locations: [], worldScripts: [], worldTools: [],
};
const lookup = statBoxLookup(statCodeOwners(world), { owner: null, timing: 'after', self: traitBoxSelf('', '') }, world);
const options: SurfaceAnalysisOptions = { surface: scriptSurface(WORLD_SCRIPT_SURFACE, 'after'), lookup };

const cardAt = (doc: string) => codeCard(doc.replace('|', ''), doc.indexOf('|'), options);

describe('the diary card', () => {
  it.each([
    ['an entity entry', 'entities.Tor.dia|ry("Hello.");'],
    ['a bracketed entry', 'entities["Tor"].dia|ry("Hello.");'],
    ['owner', 'owner.dia|ry("Hello.");'],
  ])('shows diary on %s', (_case, doc) => {
    const card = cardAt(doc);
    expect(card?.signature).toEqual({ kind: 'method', path: 'Entity.diary', type: '(line) => void' });
    expect(card?.description).toMatch(/diary for this turn/);
  });

  it('has no card on the persona, which has no diary', () => {
    expect(cardAt('persona.dia|ry("Hello.");')).toBeNull();
  });

  it('marks the top-level name unknown and gives it no card', () => {
    expect(cardAt('dia|ry("Tor", "Hello.");')).toBeNull();
    const messages = codeDiagnostics('diary("Tor", "Hello.");', options).map((d) => d.message);
    expect(messages).toEqual([expect.stringMatching(/^“diary” isn’t available in /)]);
    expect(codeDiagnostics('entities.Tor.diary("Hello.");', options)).toEqual([]);
  });
});
