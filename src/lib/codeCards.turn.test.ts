import { describe, expect, it } from 'vitest';
import { codeCard } from './codeCards';
import { statBoxLookup, traitBoxSelf, type CodeCardWorld } from './codeWorldLookup';
import type { SurfaceAnalysisOptions } from './statCodeAnalysis';
import { scriptSurface, TURN_MEMBERS, WORLD_SCRIPT_SURFACE } from './statCodeSurface';
import { statCodeOwners } from './statCodeTargets';

/** `turn` and its fields have cards, each read-only but `choices` at After the AI. */

const world: CodeCardWorld = {
  traits: [], traitGroups: [], entities: [], stats: [], statGroups: [], placeholders: [], locations: [], worldScripts: [], worldTools: [],
};
const lookup = statBoxLookup(statCodeOwners(world), { owner: null, timing: 'after', self: traitBoxSelf('', '') }, world);
const options: SurfaceAnalysisOptions = { surface: scriptSurface(WORLD_SCRIPT_SURFACE, 'after'), lookup };

const cardAt = (doc: string) => codeCard(doc.replace('|', ''), doc.indexOf('|'), options);

describe('the turn cards', () => {
  it('describes the global with its shape and access', () => {
    const card = cardAt('if (tu|rn.number > 1) {}');
    expect(card?.signature).toMatchObject({ path: 'turn', type: '{ action, number, narration, choices }' });
    expect(card?.description).toMatch(/action, the turn number, and the turn’s page and choices/);
  });

  it.each([
    ['action', 'string', /OOC brackets included/],
    ['number', 'number', /memories\[\]\.turn/],
    ['narration', 'string', /During AI Output rewrites applied/],
    ['choices', 'string[]', /empty until After the AI, and when choices are off/],
  ])('shows turn.%s with its type and help line', (field, type, line) => {
    const card = cardAt(`const x = turn.${field.slice(0, 2)}|${field.slice(2)};`);
    expect(card?.signature).toMatchObject({ path: `turn.${field}`, type });
    expect(card?.description).toMatch(line);
  });

  it('lists every field as read-only', () => {
    expect(TURN_MEMBERS.map((entry) => [entry.name, entry.access])).toEqual([
      ['action', 'readOnly'], ['number', 'readOnly'], ['narration', 'readOnly'], ['choices', 'readOnly'],
    ]);
  });

  it('carries the read-only access on the global’s card and each field’s but choices at After the AI', () => {
    for (const doc of ['tu|rn;', 'turn.ac|tion;', 'turn.nu|mber;', 'turn.na|rration;']) expect(cardAt(doc)?.access).toBe('readOnly');
    expect(cardAt('turn.ch|oices;')?.access).toBe('writable');
  });

  it('shows turn.choices read-only at every other timing', () => {
    for (const timing of ['start', 'before', 'output', 'switch'] as const) {
      const at: SurfaceAnalysisOptions = { surface: scriptSurface(WORLD_SCRIPT_SURFACE, timing), lookup };
      expect(codeCard('turn.choices;', 8, at)?.access, timing).toBe('readOnly');
    }
  });
});
