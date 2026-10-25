import { describe, expect, it } from 'vitest';
import { codeCard } from './codeCards';
import { statBoxLookup, traitBoxSelf, type CodeCardWorld } from './codeWorldLookup';
import type { SurfaceAnalysisOptions } from './statCodeAnalysis';
import { scriptSurface, TURN_MEMBERS, WORLD_SCRIPT_SURFACE } from './statCodeSurface';
import { statCodeOwners } from './statCodeTargets';

/** `turn` and its two fields have cards, each read-only. */

const world: CodeCardWorld = {
  traits: [], traitGroups: [], entities: [], stats: [], statGroups: [], placeholders: [], locations: [], worldScripts: [], worldTools: [],
};
const lookup = statBoxLookup(statCodeOwners(world), { owner: null, timing: 'after', self: traitBoxSelf('', '') }, world);
const options: SurfaceAnalysisOptions = { surface: scriptSurface(WORLD_SCRIPT_SURFACE, 'after'), lookup };

const cardAt = (doc: string) => codeCard(doc.replace('|', ''), doc.indexOf('|'), options);

describe('the turn cards', () => {
  it('describes the global with its shape and access', () => {
    const card = cardAt('if (tu|rn.number > 1) {}');
    expect(card?.signature).toMatchObject({ path: 'turn', type: '{ action, number }' });
    expect(card?.description).toMatch(/action and the turn number/);
  });

  it.each([
    ['action', 'string', /OOC brackets included/],
    ['number', 'number', /memories\[\]\.turn/],
  ])('shows turn.%s with its type and help line', (field, type, line) => {
    const card = cardAt(`const x = turn.${field.slice(0, 2)}|${field.slice(2)};`);
    expect(card?.signature).toMatchObject({ path: `turn.${field}`, type });
    expect(card?.description).toMatch(line);
  });

  it('lists both fields as read-only', () => {
    expect(TURN_MEMBERS.map((entry) => [entry.name, entry.access])).toEqual([['action', 'readOnly'], ['number', 'readOnly']]);
  });

  it('carries the read-only access on the global’s card and each field’s', () => {
    for (const doc of ['tu|rn;', 'turn.ac|tion;', 'turn.nu|mber;']) expect(cardAt(doc)?.access).toBe('readOnly');
  });
});
