import { describe, expect, it } from 'vitest';
import { checkPreset, type PresetCheckWorld } from './presetCheck';
import type { Entity, GameLocation, PresetRow, PresetWorldOption, Trait, TraitGroup, WorldOption, WorldOverview } from '@/types';

const person = (id: string, extra: Partial<Entity> = {}): Entity =>
  ({ id, name: id, playerDescription: '', aiDescription: '', aiSummary: '', ...extra });
const place = (id: string, isStarting = false): GameLocation => ({ id, name: id, description: '', isStarting });

// Elf and Evil block each other; the one-pick Kin category holds Elf and Orc; the crown is Always On, the veil Hidden.
const traits: Trait[] = [
  { id: 'elf', name: 'Elf', statChanges: [], groupId: 'kin', requires: [{ all: [{ kind: 'trait', id: 'evil', not: true }] }] },
  { id: 'orc', name: 'Orc', statChanges: [], groupId: 'kin' },
  { id: 'evil', name: 'Evil', statChanges: [], requires: [{ all: [{ kind: 'trait', id: 'elf', not: true }] }] },
  { id: 'crown', name: 'Crown', statChanges: [], mode: 'alwaysOn' },
  { id: 'veil', name: 'Veil', statChanges: [], mode: 'hidden' },
  { id: 'pet', name: 'Pet', statChanges: [] },
];
const traitGroups: TraitGroup[] = [{ id: 'kin', name: 'Kin', parentId: null, maxPicks: 1 }];
// The knight starts at the keep and owns an oath; the rogue plays only as a persona, so never joins the cast.
const knight = person('knight', { persona: true, locations: ['keep'], traits: [{ id: 'oath', name: 'Oath', statChanges: [] }] });
const rogue = person('rogue', { persona: true, personaOnly: true, traits: [{ id: 'knife', name: 'Knife', statChanges: [] }] });
const npc = person('npc');
const LIT: WorldOption = { id: 'lit', name: 'Lit', type: 'boolean', shownToPlayer: true, midGame: false, default: true };
const SIZE: WorldOption = {
  id: 'size', name: 'Size', type: 'choice', shownToPlayer: true, midGame: false, values: [{ id: 'small', name: 'Small' }], default: 'small',
};
const SECRET: WorldOption = { id: 'secret', name: 'Secret', type: 'boolean', shownToPlayer: false, midGame: false, default: false };
const OTHER: WorldOption = { id: 'other', name: 'Other', type: 'preset', mode: 'overlay', values: [] };

const on = (traitId: string, ownerId?: string): PresetRow => ({ kind: 'trait', traitId, on: true, ...(ownerId ? { ownerId } : {}) });
const opt = (optionId: string, value: string | boolean): PresetRow => ({ kind: 'option', optionId, value });
const persona = (entityId: string): PresetRow => ({ kind: 'persona', entityId });
const at = (locationId: string): PresetRow => ({ kind: 'location', locationId });

const presetOf = (...values: PresetRow[][]): PresetWorldOption => ({
  id: 'start', name: 'Start', type: 'preset', mode: 'snapshot',
  values: values.map((rows, i) => ({ id: `v${i}`, name: `V${i}`, description: '', rows })),
});
const worldOf = (overview: Partial<WorldOverview> = {}): PresetCheckWorld => ({
  worldOverview: { ...overview } as WorldOverview,
  entities: [knight, rogue, npc], locations: [place('town', true), place('keep'), place('cave')],
  traits, traitGroups, stats: [], statGroups: [], items: [], placements: [], slots: [], bodies: [],
  options: [LIT, SIZE, SECRET, OTHER],
});
const issuesOf = (rows: PresetRow[], overview?: Partial<WorldOverview>) =>
  checkPreset(presetOf(rows), worldOf(overview)).get('v0') ?? [];

describe('checkPreset', () => {
  it('reports nothing for a value whose rows all apply, or that has no rows', () => {
    const preset = presetOf([on('orc'), on('evil'), opt('lit', false), persona('knight'), on('oath', 'knight'), at('keep')], []);
    expect(checkPreset(preset, worldOf()).size).toBe(0);
  });

  it('reports the row a self-contradicting value cannot hold', () => {
    expect(issuesOf([on('pet'), on('elf'), on('evil')])).toEqual([{ row: on('evil'), deleted: false }]);
  });

  it('reports the row that over-fills its category', () => {
    expect(issuesOf([on('orc'), on('elf')])).toEqual([{ row: on('elf'), deleted: false }]);
  });

  it('reports a row for a trait the player cannot toggle, even one that already holds', () => {
    const off: PresetRow = { kind: 'trait', traitId: 'crown', on: false };
    expect(issuesOf([off])).toEqual([{ row: off, deleted: false }]);
    expect(issuesOf([on('crown')])).toEqual([{ row: on('crown'), deleted: false }]);
    expect(issuesOf([on('veil')])).toEqual([{ row: on('veil'), deleted: false }]);
  });

  it('reports a row whose owner is not in the starting cast', () => {
    expect(issuesOf([on('knife', 'rogue')])).toEqual([{ row: on('knife', 'rogue'), deleted: false }]);
  });

  it('reports rows naming a hidden or Preset Option, or a value the Option no longer has', () => {
    const rows = [opt('secret', true), opt('other', 'x'), opt('size', 'huge')];
    expect(issuesOf(rows)).toEqual(rows.map((row) => ({ row, deleted: false })));
  });

  it('reports a persona no longer marked, and a location the step would not offer', () => {
    expect(issuesOf([persona('npc')])).toEqual([{ row: persona('npc'), deleted: false }]);
    // The cave is neither a starting location nor a persona's start place.
    expect(issuesOf([at('cave')])).toEqual([{ row: at('cave'), deleted: false }]);
  });

  it('marks rows whose target was deleted', () => {
    const rows = [on('gone'), on('gone', 'knight'), on('pet', 'ghost'), opt('gone', true), persona('ghost'), at('nowhere')];
    expect(issuesOf(rows)).toEqual(rows.map((row) => ({ row, deleted: true })));
  });

  it('checks each value from the preselected persona at its start place', () => {
    // The keep is offered only while the knight plays, and the knight is the Starting Persona.
    expect(issuesOf([at('keep')])).toEqual([{ row: at('keep'), deleted: false }]);
    expect(issuesOf([at('keep')], { startPersona: { source: 'world', entityId: 'knight' } })).toEqual([]);
  });
});
