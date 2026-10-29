import { describe, expect, it } from 'vitest';
import type { ChatMessage, Connection, Entity, GameLocation, GameState, Item, ItemCopy, PlayerStat, Trait } from '@/types';
import type { ChipScene } from '@/lib/chipValues/chipScene';
import type { SandboxState } from '@/lib/statCodeTurn';
import type { StatCodeWorld } from '@/lib/statCodeTestRun';
import { serializeTurnContent } from '@/lib/turnDigest';
import { buildToolSnapshot } from '@/lib/tools/toolSnapshot';
import { buildPlayerView } from './playerView';
import { playerViewMemory, playerViewScene, playerViewState, playerViewWorld, type PlayerViewReach } from './playerViewWorld';

const entity = (id: string, name: string, extra: Partial<Entity> = {}): Entity => ({
  id, name, playerDescription: `${name} player text.`, aiDescription: `${name} AI secret.`, aiSummary: `${name} AI summary.`, ...extra,
});
const stat = (id: string, extra: Partial<PlayerStat> = {}): PlayerStat => ({
  id, name: id, type: 'number', description: `${id} AI meaning.`, min: 0, max: 10, value: 3, regen: 0, descriptors: [], ...extra,
});
const trait = (id: string, extra: Partial<Trait> = {}): Trait =>
  ({ id, name: id, playerDescription: `${id} player text.`, aiDescription: `${id} AI secret.`, statChanges: [], ...extra });
const item = (id: string): Item => ({
  id, name: id, playerDescription: `${id} player text.`, aiDescription: `${id} AI secret.`,
  // One effect on a hidden stat, which the cut must drop; its other fields don't matter here.
  statEffects: [{ statId: 'dread' }] as unknown as Item['statEffects'], traitEffects: [], equipRequires: [],
});
const copy = (id: string, itemId: string, where: ItemCopy['where'], visibility: ItemCopy['visibility'] = 'visible'): ItemCopy => ({
  id, item: { kind: 'item', itemId }, where, quantity: 1, visibility,
});

const WARDEN = entity('warden', 'Warden', {
  aliases: ['The Butcher'], stats: [stat('w-grit'), stat('w-rage', { hidden: true })], traits: [trait('w-oath')],
});
const STRANGER = entity('stranger', 'Stranger');
const LOCATIONS: GameLocation[] = [
  { id: 'gate', name: 'Gate', playerDescription: 'Gate player text.', aiDescription: 'Gate AI secret.' },
  { id: 'hall', name: 'Hall', playerDescription: 'Hall player text.', aiDescription: 'Hall AI secret.', parentId: 'vault' },
  { id: 'vault', name: 'Vault', playerDescription: 'Vault player text.', aiDescription: 'Vault AI secret.' },
];
const CONNECTIONS: Connection[] = [
  { id: 'c-hall', a: 'gate', b: 'hall', aToB: { hint: 'through the secret door' } },
  { id: 'c-vault', a: 'gate', b: 'vault' },
];
const BRAVE = trait('brave');
const CURSED = trait('cursed', { mode: 'hidden' });
const IDLE = trait('idle');
const STATS = [stat('nerve'), stat('dread', { hidden: true }), stat('numb', { enabled: false })];
const COPIES = [copy('c1', 'key', { kind: 'you' }), copy('c2', 'gem', { kind: 'location', id: 'vault' }), copy('c3', 'key', { kind: 'location', id: 'gate' }, 'hidden')];

const turn = (locationId: string): ChatMessage => ({
  role: 'assistant', content: JSON.stringify({ narration: 'A turn.', choices: [], stat_changes: [], turnId: locationId, locationId }),
});

/** The player met the warden, once seen as "the hooded one", stood in the hall and now stands at the gate. */
function reach(): PlayerViewReach {
  const current: GameState = {
    globalStats: STATS, globalTraits: [BRAVE, CURSED, IDLE], disabledTraitIds: ['idle'], visibleEntities: [{ name: 'Warden', alias: 'the hooded one', revealed: true }],
    logEntries: [], gameplayText: '', gameTime: 0, characterData: null, choices: [], isGameStarted: true, timestamp: '', worldName: null,
    playerNotes: '', previousStateIndex: null, stateVersion: 1, metEntities: ['warden'], locationId: 'gate', itemCopies: COPIES,
    entityStats: { warden: WARDEN.stats as PlayerStat[] },
  };
  const view = buildPlayerView({
    world: { entities: [WARDEN, STRANGER], locations: LOCATIONS, traits: [BRAVE, CURSED, IDLE], items: [item('key'), item('gem')] },
    chain: [current], history: [turn('hall')], persona: null, resolve: (text) => text,
  });
  return { view, current };
}

const ids = <T extends { id: string }>(rows: readonly T[] | undefined) => (rows ?? []).map((row) => row.id);

describe('playerViewScene', () => {
  const scene: ChipScene = {
    overview: 'The heir hides in the vault.', stats: STATS, traits: [BRAVE, CURSED], traitGroups: [], persona: null,
    location: LOCATIONS[0], locations: LOCATIONS, connections: CONNECTIONS, entities: [WARDEN, STRANGER],
    presentIds: ['warden', 'stranger'], inSceneIds: ['stranger'], items: [item('key'), item('gem')], itemCopies: COPIES,
    lore: [{ id: 'l1', name: 'Pact', key: ['pact'], value: 'The pact binds the heir.' }], notes: 'My notes.', time: null,
    resolve: (text) => text,
  };
  const cut = playerViewScene(scene, reach());

  it('holds met entities only, in player text, under the names the player saw', () => {
    expect(cut.entities).toEqual([expect.objectContaining({
      id: 'warden', name: 'Warden', aliases: ['the hooded one'], playerDescription: 'Warden player text.', aiDescription: 'Warden player text.',
    })]);
    expect(cut.entities[0].aiSummary).toBeUndefined();
    expect(cut.presentIds).toEqual(['warden']);
    expect(cut.inSceneIds).toEqual([]);
  });

  it("keeps only the player's own stats and traits, and only the met entity's visible stats", () => {
    expect(ids(cut.stats)).toEqual(['nerve']);
    expect(ids(cut.traits)).toEqual(['brave']);
    expect(cut.traits[0].aiDescription).toBe('brave player text.');
    expect(ids(cut.entities[0].stats)).toEqual(['w-grit']);
    expect(cut.entities[0].traits).toEqual([]);
  });

  it('holds met places and their connections, without travel hints or an unmet parent', () => {
    expect(ids(cut.locations)).toEqual(['gate', 'hall']);
    expect(cut.locations[1].parentId).toBeNull();
    expect(cut.location?.aiDescription).toBe('Gate player text.');
    expect(cut.connections).toEqual([{ id: 'c-hall', a: 'gate', b: 'hall', aToB: {} }]);
  });

  it('holds met items and visible copies, with no effects', () => {
    expect(cut.items).toEqual([expect.objectContaining({ id: 'key', aiDescription: 'key player text.', statEffects: [] })]);
    expect(ids(cut.itemCopies)).toEqual(['c1']);
  });

  it('drops the world overview and the lore, and keeps the notes', () => {
    expect(cut.overview).toBe('');
    expect(cut.lore).toEqual([]);
    expect(cut.notes).toBe('My notes.');
    expect(JSON.stringify(cut)).not.toMatch(/AI secret|AI summary|AI meaning|heir|Butcher|secret door|Stranger|Vault/);
  });
});

describe('playerViewMemory', () => {
  const history: ChatMessage[] = [1, 2].flatMap((n) => [
    { role: 'user', content: `Action ${n}.` },
    {
      role: 'assistant', content: serializeTurnContent({
        narration: `Narration ${n}.`, choices: [], stat_changes: [], turnId: `t${n}`,
        summary: `Digest ${n}.`, diaries: { Bell: 'I promised the ferryman my lantern.' },
      }),
    },
  ]);
  const memory = { history, overrides: null, verbatimFloor: 0 };
  const scene = playerViewScene({
    overview: '', stats: [], traits: [], traitGroups: [], persona: null, location: null, locations: [], connections: [],
    entities: [], presentIds: [], inSceneIds: [], lore: [], notes: '', time: null, resolve: (text) => text,
  }, reach());

  it('gives recall the digests and no diary entries', () => {
    const { memories } = buildToolSnapshot(scene, [], playerViewMemory(memory));
    expect(memories).toEqual([{ turn: 1, digest: 'Digest 1.', diaries: [] }, { turn: 2, digest: 'Digest 2.', diaries: [] }]);
    expect(buildToolSnapshot(scene, [], memory).memories[0].diaries).toHaveLength(1);
  });
});

describe('playerViewState', () => {
  const state: SandboxState = {
    stats: STATS, enabled: { nerve: true, dread: true, numb: false },
    owners: [
      { id: 'warden', stats: WARDEN.stats as PlayerStat[], enabled: { 'w-grit': true, 'w-rage': true } },
      { id: 'stranger', stats: [stat('s-will')], enabled: { 's-will': true } },
    ],
    gateStats: {
      global: { nerve: { name: 'nerve', value: 3 }, dread: { name: 'dread', value: 3 } },
      owners: { warden: { 'w-grit': { name: 'w-grit', value: 3 }, 'w-rage': { name: 'w-rage', value: 3 } }, stranger: { 's-will': { name: 's-will', value: 3 } } },
    // Gate stats with only the fields the cut reads.
    } as unknown as SandboxState['gateStats'],
    ownerTraits: {
      acquired: [BRAVE, CURSED, IDLE], disabledTraitIds: ['idle'], appliedValues: { brave: { nerve: 1 }, cursed: { dread: 2 } },
      world: { traits: [BRAVE, CURSED, IDLE], groups: [], entities: [{ id: 'warden', name: 'Warden' }, { id: 'stranger', name: 'Stranger' }] },
      entities: [WARDEN, STRANGER],
    },
    places: { locations: LOCATIONS, location: { id: 'gate', name: 'Gate' }, connections: CONNECTIONS },
    positions: { warden: 'gate', stranger: 'gate' }, followers: ['stranger'],
    itemCopies: COPIES, items: [item('key'), item('gem')], clock: {},
    memories: [
      { id: 'm1', turn: 1, timestamp: 0, day: 1, daypart: '', text: 'Digest 1.', custom: false, kept: false, inContext: true, pinned: false, forgotten: false },
      { id: 'm2', turn: 1, timestamp: 0, day: 1, daypart: '', text: 'A script line.', custom: true, kept: false, inContext: true, pinned: false, forgotten: false },
    ],
  };
  const cut = playerViewState(state, reach());

  it('holds visible stats only, in the stats, the enabled map and the gate stats', () => {
    expect(ids(cut.stats)).toEqual(['nerve']);
    expect(cut.enabled).toEqual({ nerve: true });
    expect(Object.keys(cut.gateStats!.global)).toEqual(['nerve']);
    expect(Object.keys(cut.gateStats!.owners)).toEqual(['warden']);
    expect(Object.keys(cut.gateStats!.owners.warden)).toEqual(['w-grit']);
  });

  it("holds met owners with their visible stats, and the player's active traits", () => {
    expect(cut.owners).toEqual([{ id: 'warden', stats: [{ ...WARDEN.stats![0], description: '' }], enabled: { 'w-grit': true } }]);
    expect(ids(cut.ownerTraits.acquired)).toEqual(['brave']);
    expect(ids(cut.ownerTraits.world.traits)).toEqual(['brave']);
    expect(cut.ownerTraits.appliedValues).toEqual({ brave: { nerve: 1 } });
    expect(ids(cut.ownerTraits.world.entities)).toEqual(['warden']);
    expect(ids(cut.ownerTraits.entities)).toEqual(['warden']);
  });

  it('holds met places, met positions and followers, and visible copies of met items', () => {
    expect(ids(cut.places?.locations)).toEqual(['gate', 'hall']);
    expect(cut.places?.locations[0].aiDescription).toBe('Gate player text.');
    expect(cut.positions).toEqual({ warden: 'gate' });
    expect(cut.followers).toEqual([]);
    expect(ids(cut.itemCopies)).toEqual(['c1']);
    expect(ids(cut.items)).toEqual(['key']);
    expect(ids(cut.memories)).toEqual(['m1']);
    expect(JSON.stringify(cut)).not.toMatch(/AI secret|AI meaning|Stranger|Vault|\b(dread|numb|cursed)\b/);
  });

  it("keeps each book's name and placeholders, with no entries to list", () => {
    const pact = { id: 'l1', name: 'Pact', key: ['pact'], value: 'The pact binds the heir.' };
    const book = { id: 'lore', name: 'Lore', entries: [pact] };
    const placeholders = { placeholders: [], rolls: {}, dictionaries: [book], libraryDictionaries: [{ ...book, id: 'lib' }] };
    const books = playerViewState({ ...state, placeholders } as SandboxState, reach()).placeholders;
    expect(books?.dictionaries).toEqual([{ id: 'lore', name: 'Lore', entries: [] }]);
    expect(books?.libraryDictionaries).toEqual([{ id: 'lib', name: 'Lore', entries: [] }]);
  });

  it("lists in each book only the entries the question fired", () => {
    const pact = { id: 'l1', name: 'Pact', key: ['pact'], value: 'The pact binds the heir.' };
    const heir = { id: 'l2', name: 'Heir', key: ['heir'], value: 'The heir hides in the vault.' };
    const book = { id: 'lore', name: 'Lore', entries: [pact, heir] };
    const placeholders = { placeholders: [], rolls: {}, dictionaries: [book], libraryDictionaries: [] };
    const books = playerViewState({ ...state, placeholders } as SandboxState, reach(), new Set(['l1'])).placeholders;
    expect(books?.dictionaries).toEqual([{ id: 'lore', name: 'Lore', entries: [pact] }]);
  });
});

describe('playerViewWorld', () => {
  const world: StatCodeWorld = {
    stats: STATS, statGroups: [], traits: [BRAVE, CURSED, IDLE], traitGroups: [], entities: [WARDEN, STRANGER], entityGroups: [],
    placeholders: [], placeholderGroups: [], dictionaries: [], locations: LOCATIONS,
  };
  const cut = playerViewWorld(world, reach());

  it("holds visible stats, the player's active traits, and met entities and places in player text", () => {
    expect(ids(cut.stats)).toEqual(['nerve']);
    expect(ids(cut.traits)).toEqual(['brave']);
    expect(ids(cut.entities)).toEqual(['warden']);
    expect(ids(cut.entities[0].stats)).toEqual(['w-grit']);
    expect(ids(cut.locations)).toEqual(['gate', 'hall']);
    expect(JSON.stringify(cut)).not.toMatch(/AI secret|AI summary|AI meaning|Butcher|Stranger|Vault/);
  });

  it('keeps only the groups that hold a row the player sees, with their parents', () => {
    const grouped = playerViewWorld({
      ...world,
      stats: [{ ...STATS[0], groupId: 'body' }, { ...STATS[1], groupId: 'plot' }],
      statGroups: [
        { id: 'all', name: 'All', parentId: null, aiDescription: 'Group AI secret.' }, { id: 'body', name: 'Body', parentId: 'all', aiVisible: false },
        { id: 'plot', name: 'Plot Twists', parentId: null },
      ],
      entities: [{ ...WARDEN, groupId: 'guards' }, { ...STRANGER, groupId: 'heirs' }],
      entityGroups: [{ id: 'guards', name: 'Guards', parentId: null }, { id: 'heirs', name: 'Hidden Heirs', parentId: null }],
    }, reach());
    expect(grouped.statGroups).toEqual([{ id: 'all', name: 'All', parentId: null }]);
    expect(ids(grouped.entityGroups)).toEqual(['guards']);
  });

  it('keeps a Blueprint stat only when a met entity links it', () => {
    const blueprints = [{ id: 'bp', name: 'Blueprints', parentId: null, system: 'blueprints' as const }];
    const linked = playerViewWorld({
      ...world,
      stats: [...STATS, stat('bp-grit', { groupId: 'bp' }), stat('bp-oath', { groupId: 'bp' })],
      statGroups: blueprints,
      entities: [
        { ...WARDEN, statLinks: [{ id: 'l1', originalId: 'bp-grit', kind: 'stat', originalName: 'bp-grit', groupId: null }] },
        { ...STRANGER, statLinks: [{ id: 'l2', originalId: 'bp-oath', kind: 'stat', originalName: 'bp-oath', groupId: null }] },
      ],
    }, reach());
    expect(ids(linked.stats)).toEqual(['nerve', 'bp-grit']);
  });
});
