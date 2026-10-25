/**
 * @vitest-environment node
 * (No DOM needed; node keeps the QuickJS WASM engine loading through its filesystem path.)
 */
import { describe, expect, it } from 'vitest';
import { snapshotOf, type SnapshotOptions } from './sandboxSnapshot';
import { inPlayOwners } from './ownedTraitsInPlay';
import { openingStateOf } from './openingState';
import type { SandboxState } from './statCodeTurn';
import type { Entity, GameLocation, PersonaRef } from '@/types';

const hero: Entity = { id: 'hero', name: 'Hero', persona: true, aiDescription: 'The one who plays.' };
const mira: Entity = {
  id: 'mira', name: 'Mira', locations: ['gate'], aiDescription: 'A tall CHIP.', aiSummary: 'CHIP, the miller.', aliases: ['CHIP of the weir'],
  pronouns: 'CHIP/hers',
};
const tor: Entity = { id: 'tor', name: 'Tor', locations: ['mill', 'gate'] };
const sela: Entity = { id: 'sela', name: 'Sela', aiDescription: 'A stranger.' };
const mill: GameLocation = { id: 'mill', name: 'Old Mill', aiDescription: 'A mill by CHIP.', aiSummary: 'A mill.', isStarting: true };
const gate: GameLocation = { id: 'gate', name: 'North Gate' };
const persona: PersonaRef = { source: 'world', entityId: 'hero' };
const world = { traits: [], traitGroups: [], entities: [hero, mira, tor] };

/** A chip that reads as its owner's name, or `world` for a location's own text. */
const resolveText = (text: string, owner: Entity | null) => text.replaceAll('CHIP', owner ? owner.name : 'world');

/** Play's state: Mira placed at the gate, Tor at both places he lists, Sela discovered at the mill. */
const playState = (over: Partial<SandboxState> = {}): SandboxState => ({
  stats: [], enabled: {}, clock: { deltaHours: 1, elapsedHours: 1 },
  ownerTraits: {
    acquired: [], disabledTraitIds: [], appliedValues: {}, entities: world.entities, library: [], discovered: [sela],
    world: { traits: [], groups: [], entities: world.entities, persona, ...inPlayOwners(world, persona, []) },
  },
  places: { locations: [mill, gate], location: { id: 'mill', name: 'Old Mill' } },
  positions: { mira: 'gate', sela: 'mill' },
  resolveText,
  ...over,
});

/** What a World Tool script returns, read back from its reply. */
async function read(state: SandboxState, code: string, options: SnapshotOptions = {}): Promise<unknown> {
  const result = await snapshotOf(state, options).run({ home: { kind: 'tool' }, timing: 'after', code, args: {} });
  expect(result.error).toBeNull();
  return JSON.parse(result.reply ?? 'null');
}

const PRESENT = 'return [locations["Old Mill"].present.map((e) => e.name), locations["North Gate"].present.map((e) => e.name)];';

describe('the snapshot’s locations in play', () => {
  it('lists who stands where: the persona first at the player’s place, an unplaced entity at each place it lists', async () => {
    expect(await read(playState(), PRESENT)).toEqual([['Hero', 'Tor', 'Sela'], ['Mira', 'Tor']]);
  });

  it('reads each entity’s place and follower state from play', async () => {
    const code = 'return [entities.Mira.location, entities.Mira.following, entities.Tor.location, entities.Sela.location, persona.location];';
    expect(await read(playState(), code)).toEqual(['North Gate', false, '', 'Old Mill', 'Old Mill']);
    expect(await read(playState({ followers: ['mira'] }), code)).toEqual(['Old Mill', true, '', 'Old Mill', 'Old Mill']);
  });

  it('lists the Custom Persona first where the player stands, under no picked persona', async () => {
    const custom: Entity = { id: 'self', name: 'Self', customPersona: true };
    const none: PersonaRef = { source: 'none' };
    const cast = { traits: [], traitGroups: [], entities: [custom, mira, tor] };
    const state = playState({
      ownerTraits: {
        acquired: [], disabledTraitIds: [], appliedValues: {}, entities: cast.entities, library: [],
        world: { traits: [], groups: [], entities: cast.entities, persona: none, ...inPlayOwners(cast, none, []) },
      },
    });
    expect(await read(state, PRESENT)).toEqual([['Self', 'Tor'], ['Mira', 'Tor']]);
  });

  it('keeps a discovered character an entry of entities', async () => {
    expect(await read(playState(), 'return [Object.keys(entities), entities.Sela.description];')).toEqual([['Hero', 'Mira', 'Tor', 'Sela'], 'A stranger.']);
  });

  it('reads entity and location text with its chips resolved', async () => {
    const code = 'const m = entities.Mira; const l = locations["Old Mill"]; return [m.description, m.summary, m.aliases, m.pronouns, l.description, l.summary, l.starting, location.description];';
    expect(await read(playState(), code)).toEqual([
      'A tall Mira.', 'Mira, the miller.', ['Mira of the weir'], 'Mira/hers', 'A mill by world.', 'A mill.', true, 'A mill by world.',
    ]);
  });
});

describe('the snapshot’s locations in an editor run', () => {
  const authored = { entities: [hero, mira, tor], locations: [gate, mill] };

  it('stands at the starting location, every entity at each place it lists, the pending persona at the start', async () => {
    const state = openingStateOf(authored);
    const code = 'return [location.name, location.present.map((e) => e.id), locations["North Gate"].present.map((e) => e.name)];';
    expect(await read(state, code, { pendingPersona: true })).toEqual([
      'Old Mill', ['pending-persona', 'tor'], ['Mira', 'Tor'],
    ]);
  });

  it('reads the authored text with its chips resolved', async () => {
    const withChip = { ...authored, entities: [{ ...mira, aiDescription: 'Mira of {{ph:shade:world:p-shade}}.' }], placeholders: [{ id: 'shade', name: 'Shade', values: [{ id: 'v', text: 'ash' }] }] };
    expect(await read(openingStateOf(withChip), 'return [entities.Mira.description];')).toEqual(['Mira of ash.']);
  });
});
