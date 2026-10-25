import { describe, expect, it } from 'vitest';
import { codeCard, type CodeCard, type CodeCardItem } from './codeCards';
import { statBoxLookup, traitBoxSelf, type CodeCardWorld } from './codeWorldLookup';
import type { CodeUse } from './codeUses';
import type { SurfaceAnalysisOptions } from './statCodeAnalysis';
import { scriptSurface, WORLD_SCRIPT_SURFACE } from './statCodeSurface';
import { statCodeOwners } from './statCodeTargets';
import type { Entity, GameLocation, Script, Stat } from '@/types';
import { boxScripts } from '@/test/scriptFixtures';
import { scriptWorldTool } from '@/test/worldToolFixtures';

/** A place named by the literal in `location.move("<name>")`: its card, and the Find All Uses that lists the calls. */

const inn: GameLocation = {
  id: 'inn', name: 'Inn', isStarting: true, playerDescription: 'A low room that smells of peat.',
};
const gate: GameLocation = { id: 'gate', name: 'North Gate' };
const tor: Entity = { id: 'tor', name: 'Tor', locations: ['inn'] };
const calm: Stat = {
  id: 'calm', name: 'Calm', type: 'number', description: '', min: 0, max: 10, value: 0, regen: 0, descriptors: [],
  scripts: boxScripts({ after: 'location.move("Inn");\nlocation.move("North Gate");' }),
};
const weather: Script = { id: 'weather', timing: 'after', code: '// open\nlocation.move("Inn");' };

const world: CodeCardWorld = {
  traits: [], traitGroups: [], entities: [tor], stats: [calm], statGroups: [], placeholders: [], locations: [inn, gate],
  worldScripts: [weather], worldTools: [scriptWorldTool('go-id', 'go', 'location.move(args.place);\nlocation.move("Inn");', 'after')],
};
const owners = statCodeOwners(world);
const lookup = statBoxLookup(owners, { owner: null, timing: 'after', self: traitBoxSelf('', '') }, world);
const options: SurfaceAnalysisOptions = { surface: scriptSurface(WORLD_SCRIPT_SURFACE, 'after'), lookup };

/** The card under a caret written as `|`. */
function cardAt(doc: string): CodeCard | null {
  const pos = doc.indexOf('|');
  return codeCard(doc.replace('|', ''), pos, options);
}

const rows = (uses: CodeUse[]) => uses.map((use) => `${use.name} ${use.timing} ${use.line}`);

describe('the card of a place named in location.move', () => {
  it('names the location, with its description, who is there, and the item to open', () => {
    expect(cardAt('location.move("In|n");')).toEqual({
      from: 14, to: 19,
      signature: { kind: 'location', path: 'Inn', type: 'Location' },
      description: 'A low room that smells of peat.',
      rows: [{ label: 'Starting', value: 'Yes' }, { label: 'Present', value: 'Tor' }],
      item: { kind: 'location', locationId: 'inn' },
    });
  });

  it('reads a single-quoted name and a location with no one there', () => {
    const card = cardAt("location.move('North G|ate');");
    expect(card?.item).toEqual({ kind: 'location', locationId: 'gate' });
    expect(card?.rows).toEqual([{ label: 'Present', value: 'None' }]);
  });

  it('gives a card to a name the world lacks, with no details, rather than none', () => {
    const card = cardAt('location.move("Mo|on");');
    expect(card?.signature).toEqual({ kind: 'location', path: 'Moon', type: 'Location' });
    expect(card?.item).toBeUndefined();
  });

  it('gives a string anywhere else no card', () => {
    expect(cardAt('const a = "In|n";')).toBeNull();
    expect(cardAt('if (location.name === "In|n") {}')).toBeNull();
    expect(cardAt('location.move(where, "In|n");')).toBeNull();
  });
});

describe('Find All Uses for a location', () => {
  const item: CodeCardItem = { kind: 'location', locationId: 'inn' };

  it('lists each location.move that names it, in a world script, a World Tool and a stat, and no other place', () => {
    expect(rows(lookup.uses(item))).toEqual(['World after 2', 'Calm after 1', 'go after 2']);
  });

  it('lists the Tool and the world script as the rows the editor opens', () => {
    const uses = lookup.uses(item);
    expect(uses.find((use) => use.tool)).toMatchObject({ rowId: 'go-id', scriptId: 'go-id', tool: true });
    expect(uses.find((use) => use.world)).toMatchObject({ rowId: 'weather', scriptId: 'weather', world: true });
  });

  // The sandbox takes the first location with the name (`location.move` finds by id, else the first name).
  it('reads a name two locations share as the first one, as the move does', () => {
    const twin: GameLocation = { id: 'inn-two', name: 'Inn' };
    const shared: CodeCardWorld = { ...world, locations: [inn, twin, gate] };
    const sharedLookup = statBoxLookup(statCodeOwners(shared), { owner: null, timing: 'after', self: traitBoxSelf('', '') }, shared);
    const card = codeCard('location.move("Inn");', 17, { surface: options.surface, lookup: sharedLookup });
    expect(card?.item).toEqual({ kind: 'location', locationId: 'inn' });
    expect(rows(sharedLookup.uses({ kind: 'location', locationId: 'inn-two' }))).toEqual([]);
    expect(rows(sharedLookup.uses({ kind: 'location', locationId: 'inn' })).length).toBeGreaterThan(0);
  });

  it('keeps a location apart from another that a call also names', () => {
    expect(rows(lookup.uses({ kind: 'location', locationId: 'gate' }))).toEqual(['Calm after 2']);
  });
});

describe('the cards of a locations read', () => {
  it('gives a locations key the location’s card', () => {
    expect(cardAt('const l = locations["North G|ate"];')?.item).toEqual({ kind: 'location', locationId: 'gate' });
    expect(cardAt('const l = locations.In|n;')?.item).toEqual({ kind: 'location', locationId: 'inn' });
  });

  it.each(['description', 'summary', 'starting', 'present', 'parent', 'children', 'exits'])('describes the %s field of an entry and of location', (field) => {
    const caret = `${field.slice(0, 2)}|${field.slice(2)}`;
    expect(cardAt(`const v = locations.Inn.${caret};`)?.signature).toMatchObject({ path: `Location.${field}` });
    expect(cardAt(`const v = location.${caret};`)?.signature).toMatchObject({ path: `location.${field}` });
  });

  it.each([
    ['location.exits[0].hi|nt;', 'hint'], ['locations.Inn.exits.find((e) => e.hint).na|me;', 'name'],
  ])('describes an exit field in %s', (doc, field) => {
    expect(cardAt(`const v = ${doc}`)?.signature).toMatchObject({ path: `Exit.${field}` });
  });

  it.each(['location', 'following', 'description', 'summary', 'aliases'])('describes the %s field of an entity entry', (field) => {
    expect(cardAt(`const v = entities.Tor.${field.slice(0, 2)}|${field.slice(2)};`)?.signature).toMatchObject({ path: `Entity.${field}` });
  });
});
