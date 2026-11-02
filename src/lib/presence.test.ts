import { describe, expect, it } from 'vitest';
import type { Entity, GameLocation } from '@/types';
import {
  computePresence, connectedPlaces, introducedIds, strangersInPlay, sceneAfterMove, startsMet, strangerAliasesFromCast, withMet,
  type PresenceInput, type SceneTurn,
} from './presence';
import { readNarration } from './turnPipeline/narrationReading';

// The keep holds the hall, the smithy and the gate yard; the harbor connects to the gate yard by map.
const LOCATIONS: Pick<GameLocation, 'id' | 'parentId'>[] = [
  { id: 'keep', parentId: null },
  { id: 'hall', parentId: 'keep' },
  { id: 'smithy', parentId: 'keep' },
  { id: 'gateyard', parentId: 'keep' },
  { id: 'cellar', parentId: 'hall' },
  { id: 'harbor', parentId: null },
  { id: 'moors', parentId: null },
  { id: 'mound1', parentId: 'moors' },
  { id: 'mound2', parentId: 'moors' },
  { id: 'mound3', parentId: 'moors' },
];
const CONNECTIONS = [{ a: 'gateyard', b: 'harbor' }];

const mara: Entity = { id: 'mara', name: 'Mara', locations: ['hall'] };
const bram: Entity = { id: 'bram', name: 'Bram', locations: ['smithy'] };
const persona: Entity = { id: 'me', name: 'Wren', locations: ['cellar'] };

const turn = (participants: string[], locationId?: string): SceneTurn => ({ participants, ...(locationId ? { locationId } : {}) });

const presence = (over: Partial<PresenceInput> = {}) => computePresence({
  entities: [mara, bram],
  runtime: [],
  positions: {},
  followers: [],
  locationId: 'hall',
  locations: LOCATIONS,
  connections: CONNECTIONS,
  persona,
  met: [],
  strangerAliases: {},
  turns: [],
  ...over,
});

const ids = (rows: { entity: Entity }[]) => rows.map((p) => p.entity.id);

describe('In Scene', () => {
  it('keeps Mara in scene for 2 quiet turns and drops her after 3', () => {
    expect(presence({ turns: [turn(['Mara'], 'hall'), turn([], 'hall'), turn([], 'hall')] }).byId.get('mara')?.inScene).toBe(true);
    expect(presence({ turns: [turn(['Mara'], 'hall'), turn([], 'hall'), turn([], 'hall'), turn([], 'hall')] }).byId.get('mara')?.inScene).toBe(false);
  });

  it('clears the scene on a move except for followers', () => {
    // Bram is listed at both places, so only the move can drop him.
    const both = { ...bram, locations: ['smithy', 'gateyard'] };
    const nell: Entity = { id: 'nell', name: 'Nell', locations: ['smithy'] };
    const p = presence({
      entities: [both, nell], positions: { nell: 'gateyard' }, followers: ['nell'], locationId: 'gateyard',
      turns: [turn(['Bram', 'Nell'], 'smithy')],
    });
    expect(ids(p.inScene)).toEqual(['nell']);
    expect(p.byId.get('bram')?.where).toBe('here');
  });

  it('does not put a follower in scene for following alone', () => {
    const nell: Entity = { id: 'nell', name: 'Nell', locations: ['smithy'] };
    const p = presence({ entities: [nell], positions: { nell: 'hall' }, followers: ['nell'], turns: [turn(['Mara'], 'hall')] });
    expect(p.byId.get('nell')?.inScene).toBe(false);
  });

  it('lets a turn with no location not cut the window', () => {
    expect(presence({ turns: [turn(['Mara']), turn([], 'hall')] }).byId.get('mara')?.inScene).toBe(true);
  });

  it('drops Mara at once when the story moves her away', () => {
    const p = presence({ positions: { mara: 'smithy' }, turns: [turn(['Mara'], 'hall')] });
    expect(p.byId.get('mara')).toMatchObject({ where: 'connected', inScene: false });
    expect(ids(p.inScene)).toEqual([]);
  });

  it('keeps someone shouting from the next room connected and out of scene', () => {
    const p = presence({ turns: [turn(['Bram'], 'hall')] });
    expect(p.byId.get('bram')).toMatchObject({ where: 'connected', inScene: false });
  });

  it('keeps Bram out of scene when only Mara\'s dialogue names him, but meets him', () => {
    const stranger = { ...bram, locations: ['hall'], strangerName: 'a smith' };
    const narration = 'Mara wipes the table. "Bram went to the mill," she says.';
    const reading = readNarration({
      narration, priorNarration: '', entities: [mara, stranger], directorCandidates: [], adHocCandidates: [], exclusions: {}, sceneCast: null,
    });
    expect(reading.participants).toEqual(['Mara']);
    const p = presence({ entities: [mara, stranger], turns: [turn(reading.participants, 'hall')] });
    expect(p.byId.get('bram')).toMatchObject({ where: 'here', inScene: false, met: false });
    expect(introducedIds(narration, [mara, stranger], ['mara', 'bram'])).toEqual(['mara', 'bram']);
  });
});

describe('where', () => {
  it('counts the parent, siblings, children and map connections as connected', () => {
    expect([...connectedPlaces('hall', LOCATIONS, CONNECTIONS)].sort()).toEqual(['cellar', 'gateyard', 'keep', 'smithy']);
    expect([...connectedPlaces('gateyard', LOCATIONS, CONNECTIONS)].sort()).toEqual(['hall', 'harbor', 'keep', 'smithy']);
  });

  it('puts an entity elsewhere when nothing connects it', () => {
    expect(presence({ locationId: 'harbor' }).byId.get('mara')?.where).toBe('elsewhere');
  });

  it('puts an unpositioned entity here at every place it lists', () => {
    const lights: Entity = { id: 'lights', name: 'The Cold Lights', locations: ['mound1', 'mound2', 'mound3'] };
    for (const at of ['mound1', 'mound2', 'mound3']) {
      expect(presence({ entities: [lights], locationId: at }).byId.get('lights')?.where).toBe('here');
    }
  });

  it('puts a positioned entity only at its position', () => {
    const lights: Entity = { id: 'lights', name: 'The Cold Lights', locations: ['mound1', 'mound2'] };
    expect(presence({ entities: [lights], positions: { lights: 'mound2' }, locationId: 'mound1' }).byId.get('lights')?.where).toBe('connected');
  });

  it('leaves out the played persona and the Custom Persona', () => {
    const custom: Entity = { id: 'custom', name: 'You', customPersona: true, locations: ['hall'] };
    const played = { ...persona, locations: ['hall'] };
    const p = presence({ entities: [mara, custom, played], persona: played });
    expect([...p.byId.keys()]).toEqual(['mara']);
  });
});

describe('start-met', () => {
  const sylvie: Entity = { id: 'sylvie', name: 'Sylvie', strangerName: 'a hooded woman', locations: ['hall'] };

  it('meets an entity with no Stranger Name', () => {
    expect(startsMet(mara, persona, LOCATIONS)).toBe(true);
  });

  it('leaves a stranger unmet', () => {
    expect(startsMet(sylvie, persona, LOCATIONS)).toBe(false);
  });

  it('meets a childhood friend tied on either side', () => {
    expect(startsMet({ ...sylvie, relationships: [{ targetId: 'me', label: 'friend' }] }, persona, LOCATIONS)).toBe(true);
    expect(startsMet(sylvie, { ...persona, relationships: [{ targetId: 'sylvie', label: 'friend' }] }, LOCATIONS)).toBe(true);
    expect(startsMet({ ...sylvie, relationships: [{ targetId: 'bram', label: 'friend' }] }, persona, LOCATIONS)).toBe(false);
  });

  it('meets through a Known In pick whose subtree covers a place the persona lists', () => {
    expect(startsMet({ ...sylvie, knownIn: ['keep'] }, persona, LOCATIONS)).toBe(true);
    expect(startsMet({ ...sylvie, knownIn: ['cellar'] }, persona, LOCATIONS)).toBe(true);
    expect(startsMet({ ...sylvie, knownIn: ['smithy'] }, persona, LOCATIONS)).toBe(false);
  });

  it('meets nobody through Nearby or Nowhere', () => {
    expect(startsMet(sylvie, persona, LOCATIONS)).toBe(false);
    expect(startsMet({ ...sylvie, knownIn: 'nowhere' }, persona, LOCATIONS)).toBe(false);
  });

  it('lets a persona with no places meet strangers fresh', () => {
    const wanderer: Entity = { id: 'me', name: 'The Wanderer' };
    expect(startsMet({ ...sylvie, knownIn: ['keep'] }, wanderer, LOCATIONS)).toBe(false);
    expect(startsMet(sylvie, null, LOCATIONS)).toBe(false);
  });

  it('meets a runtime character', () => {
    const fishwife: Entity = { id: 'fish', name: 'The Fishwife', strangerName: 'a fishwife', locations: ['hall'] };
    expect(presence({ entities: [], runtime: [fishwife] }).byId.get('fish')?.met).toBe(true);
  });

  it('reads an older save with an empty met list as meeting everyone without a Stranger Name', () => {
    const p = presence({ entities: [mara, bram, sylvie], met: [] });
    expect(ids(p.met)).toEqual(['mara', 'bram']);
  });

  it('meets an entity on the met-in-play list', () => {
    expect(presence({ entities: [sylvie], met: ['sylvie'] }).byId.get('sylvie')?.met).toBe(true);
  });
});

describe('labels', () => {
  const marr: Entity = { id: 'marr', name: 'Marr', strangerName: 'a gate guard', locations: ['hall'] };
  // A Stranger Name whose placeholder resolved blank.
  const nameless: Entity = { id: 'shade', name: 'The Shade', locations: ['hall'], strangerName: ' ' };

  it('shows a met entity by name', () => {
    expect(presence({ entities: [marr], met: ['marr'] }).byId.get('marr')?.label).toBe('Marr');
  });

  it('shows a stranger by Stranger Name, then by the latest alias', () => {
    expect(presence({ entities: [marr] }).byId.get('marr')?.label).toBe('a gate guard');
    expect(presence({ entities: [marr], strangerAliases: { marr: 'the guard with the scar' } }).byId.get('marr')?.label).toBe('the guard with the scar');
  });

  it('gives a stranger with no alias and no Stranger Name no label, and leaves it out of the sets', () => {
    const p = presence({ entities: [nameless], turns: [turn(['The Shade'], 'hall')] });
    expect(p.byId.get('shade')?.label).toBeNull();
    expect(p.lookAround).toEqual([]);
    expect(p.inScene).toEqual([]);
  });

  it('meets hooded Sylvie when Mara names her in dialogue', () => {
    const sylvie: Entity = { id: 'sylvie', name: 'Sylvie', strangerName: 'a hooded woman', locations: ['hall'] };
    const before = presence({ entities: [mara, sylvie], strangerAliases: { sylvie: 'the hooded stranger' } });
    expect(before.byId.get('sylvie')?.label).toBe('the hooded stranger');
    const met = withMet([], introducedIds('"Sit down, Sylvie," Mara says.', [mara, sylvie], ['mara', 'sylvie']));
    expect(presence({ entities: [mara, sylvie], met }).byId.get('sylvie')?.label).toBe('Sylvie');
  });
});

describe('the named sets', () => {
  it('lists Look Around with In Scene first, then the quiet ones', () => {
    const tilly: Entity = { id: 'tilly', name: 'Tilly', locations: ['hall'] };
    const p = presence({ entities: [mara, bram, tilly], turns: [turn(['Tilly'], 'hall')] });
    expect(ids(p.lookAround)).toEqual(['tilly', 'mara']);
    expect(ids(p.inScene)).toEqual(['tilly']);
  });

  it('holds met people wherever they are in Met', () => {
    expect(ids(presence({ locationId: 'harbor' }).met)).toEqual(['mara', 'bram']);
  });
});

describe('introducedIds', () => {
  const sylvie: Entity = { id: 'sylvie', name: 'Sylvie Thornwhistle', aliases: ['the Matron'], strangerName: 'a hooded woman' };

  it('introduces by a part of the true name', () => {
    expect(introducedIds('Sylvie lowers her hood.', [sylvie], ['sylvie'])).toEqual(['sylvie']);
  });

  it('never introduces by an authored alias', () => {
    expect(introducedIds('The Matron lowers her hood.', [sylvie], ['sylvie'])).toEqual([]);
  });

  it('never introduces someone who is not here', () => {
    expect(introducedIds('"Sylvie is at the docks," Mara says.', [sylvie], [])).toEqual([]);
  });
});

describe('withMet', () => {
  it('appends new ids in order and keeps the array when nobody is new', () => {
    const met = ['mara'];
    expect(withMet(met, ['bram', 'mara', 'bram'])).toEqual(['mara', 'bram']);
    expect(withMet(met, ['mara'])).toBe(met);
  });
});

describe('sceneAfterMove', () => {
  it('keeps only the followers\' rows', () => {
    const rows = [{ name: 'Mara', revealed: true }, { name: 'Bram', revealed: true }];
    expect(sceneAfterMove(rows, ['bram'], [mara, bram])).toEqual([{ name: 'Bram', revealed: true }]);
    expect(sceneAfterMove(rows, [], [mara, bram])).toEqual([]);
  });
});

describe('strangerAliasesFromCast', () => {
  const sylvie: Entity = { id: 'sylvie', name: 'Sylvie', strangerName: 'a hooded woman' };
  const isMet = (e: Entity) => e.id === 'mara';

  it('remembers the latest alias of a stranger the cast names', () => {
    const first = strangerAliasesFromCast({}, [{ name: 'Sylvie', alias: 'the hooded woman' }], [mara, sylvie], isMet);
    expect(first).toEqual({ sylvie: 'the hooded woman' });
    expect(strangerAliasesFromCast(first, [{ name: 'sylvie', alias: 'the cloaked figure' }], [mara, sylvie], isMet)).toEqual({ sylvie: 'the cloaked figure' });
  });

  it('skips met entities, the player, ad-hoc names and empty aliases', () => {
    const none = {};
    const cast = [
      { name: 'Mara', alias: 'the innkeeper' }, { name: 'Sylvie', alias: 'you', isPlayer: true },
      { name: 'A Drover', alias: 'a drover' }, { name: 'Sylvie', alias: ' ' },
    ];
    expect(strangerAliasesFromCast(none, cast, [mara, sylvie], isMet)).toBe(none);
  });
});

describe('the stranger labels in play', () => {
  const marr: Entity = { id: 'marr', name: 'Marr', strangerName: 'a gate guard', locations: ['hall'] };
  const sylvie: Entity = { id: 'sylvie', name: 'Sylvie', strangerName: 'a hooded woman', locations: ['hall'] };
  const shade: Entity = { id: 'shade', name: 'The Shade', strangerName: ' ', locations: ['hall'] };
  const isMet = (e: Entity) => e.id === 'sylvie' || e.strangerName === undefined;
  const aliases = { marr: 'the guard with the scar' };

  it('labels each unmet stranger by its latest alias, else its Stranger Name', () => {
    expect(strangersInPlay([marr, mara], isMet, {}).labels).toEqual({ marr: 'a gate guard' });
    expect(strangersInPlay([marr], isMet, aliases).labels).toEqual({ marr: 'the guard with the scar' });
  });

  it('leaves out met strangers, entities without a Stranger Name, and strangers with no label', () => {
    expect(strangersInPlay([sylvie, mara, shade], isMet, {}).labels).toEqual({});
  });

  it('reveals a stranger by met, by true name in any case, and knows nothing of other entities', () => {
    const { reveal } = strangersInPlay([marr, sylvie, mara, shade], isMet, aliases);
    expect(reveal('marr')).toEqual({ met: false, label: 'the guard with the scar' });
    expect(reveal('Sylvie')).toEqual({ met: true, label: null });
    expect(reveal('The Shade')).toEqual({ met: false, label: null });
    expect(reveal('Mara')).toBeUndefined();
  });

  it('labels a stranger as the panels do', () => {
    const p = presence({ entities: [marr, mara], strangerAliases: aliases });
    expect(strangersInPlay([marr], (e) => p.byId.get(e.id)!.met, aliases).labels.marr).toBe(p.byId.get('marr')?.label);
  });
});
