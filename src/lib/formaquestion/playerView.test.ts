import { describe, expect, it } from 'vitest';
import type { ChatMessage, DiscoveredEntity, Entity, GameState, ItemCopy, PlayerStat, Trait, World } from '@/types';
import { buildPlayerView, type PlayerViewInput } from './playerView';

const entity = (id: string, name: string, extra: Partial<Entity> = {}): Entity => ({
  id, name, playerDescription: `${name} player text.`, aiDescription: `${name} AI secret.`, aiSummary: `${name} AI summary.`, ...extra,
});

const WARDEN = entity('warden', 'Warden');
const STRANGER = entity('stranger', 'Stranger');
const VEILED = entity('veiled', 'Veiled Figure');
const HEIR = entity('heir', 'Heir', { persona: true, personaOnly: true });
const PLAYED = entity('played', 'Rover', { persona: true });

const stat = (id: string, extra: Partial<PlayerStat> = {}): PlayerStat => ({
  id, name: id, type: 'number', description: `${id} AI meaning.`, min: 0, max: 10, value: 3, regen: 0,
  descriptors: [{ id: `${id}-low`, threshold: 5, description: `${id} low` }], ...extra,
});

const trait = (id: string, extra: Partial<Trait> = {}): Trait => ({
  id, name: id, playerDescription: `${id} player text.`, aiDescription: `${id} AI secret.`, statChanges: [], ...extra,
});

const WORLD: PlayerViewInput['world'] = {
  entities: [WARDEN, STRANGER, VEILED, HEIR, PLAYED],
  locations: [
    { id: 'gate', name: 'Gate', playerDescription: 'Gate player text.', aiDescription: 'Gate AI secret.' },
    { id: 'hall', name: 'Hall', description: 'Hall legacy text.', aiDescription: 'Hall AI secret.' },
    { id: 'vault', name: 'Vault', playerDescription: 'Vault player text.', aiDescription: 'Vault AI secret.' },
  ],
  traits: [trait('linked')],
  items: (['key', 'coin', 'gem', 'map'] as const).map((id) => ({
    id, name: id, playerDescription: `${id} player text.`, aiDescription: `${id} AI secret.`,
    statEffects: [], traitEffects: [], equipRequires: [],
  })),
} satisfies Pick<World, 'entities' | 'locations' | 'traits' | 'items'>;

const state = (extra: Partial<GameState> = {}): GameState => ({
  globalStats: [], globalTraits: [], visibleEntities: [], logEntries: [], gameplayText: '', gameTime: 0,
  characterData: null, choices: [], isGameStarted: true, timestamp: '', worldName: null, playerNotes: '',
  previousStateIndex: null, stateVersion: 1, ...extra,
});

const turn = (turnId: string, extra: Record<string, unknown> = {}): ChatMessage => ({
  role: 'assistant', content: JSON.stringify({ narration: `Turn ${turnId}.`, choices: [], stat_changes: [], turnId, ...extra }),
});

const copy = (id: string, itemId: string, where: ItemCopy['where'], visibility: ItemCopy['visibility'] = 'visible'): ItemCopy => ({
  id, item: { kind: 'item', itemId }, where, quantity: 1, visibility,
});

const view = (input: Partial<PlayerViewInput> & Pick<PlayerViewInput, 'chain'>) =>
  buildPlayerView({ world: WORLD, history: [], persona: null, resolve: (text) => text, ...input });

const names = <T extends { name: string }>(rows: readonly T[]) => rows.map((r) => r.name);

describe('buildPlayerView entities', () => {
  it('holds met entities with their player description and leaves unmet ones out', () => {
    const v = view({ chain: [state({ metEntities: ['warden'] })] });
    expect(v.entities).toEqual([{ kind: 'entity', id: 'warden', name: 'Warden', description: 'Warden player text.' }]);
  });

  it('shows an unrevealed entity under its alias alone, and under its name once revealed', () => {
    const hidden = view({ chain: [state({ visibleEntities: [{ name: 'Veiled Figure', alias: 'the hooded one', revealed: false }] })] });
    expect(hidden.entities).toEqual([{ kind: 'entity', id: 'veiled', name: 'the hooded one', description: '', alias: true }]);
    expect(JSON.stringify(hidden)).not.toContain('Veiled');

    const shown = view({ chain: [state({ metEntities: ['veiled'], visibleEntities: [{ name: 'Veiled Figure', revealed: true }] })] });
    expect(names(shown.entities)).toEqual(['Veiled Figure']);
  });

  it('holds a discovered entity, and drops one the player deleted', () => {
    const invented: DiscoveredEntity = { entity: { id: 'rt-1', name: 'Ferryman', aiDescription: 'An old ferryman.' }, sourceTurnId: 't1' };
    const kept = view({ chain: [state({ metEntities: ['rt-1'], discoveredEntities: [invented] })] });
    expect(kept.entities).toEqual([{ kind: 'entity', id: 'rt-1', name: 'Ferryman', description: 'An old ferryman.' }]);

    // Deletion drops the record; the met list keeps the id.
    const deleted = view({ chain: [state({ metEntities: ['rt-1'], discoveredEntities: [] })] });
    expect(deleted.entities).toEqual([]);
  });

  it("gives a peeled follower its source's player description, never the AI text it carries", () => {
    const peeled: DiscoveredEntity = {
      entity: { id: 'rt-2', name: 'Warden', aiDescription: 'Warden AI summary.' }, sourceTurnId: 't3', peeledFrom: 'warden',
    };
    const v = view({ chain: [state({ metEntities: ['rt-2'], discoveredEntities: [peeled] })] });
    expect(v.entities).toEqual([{ kind: 'entity', id: 'rt-2', name: 'Warden', description: 'Warden player text.' }]);
  });

  it('keeps a discovered entity under its alias while its scene row is unrevealed', () => {
    const visitor: DiscoveredEntity = { entity: VEILED, locationId: 'gate', sourceTurnId: 't2' };
    const v = view({ chain: [state({
      discoveredEntities: [visitor], visibleEntities: [{ name: 'Veiled Figure', alias: 'the hooded one', revealed: false }],
    })] });
    expect(v.entities).toEqual([{ kind: 'entity', id: 'veiled', name: 'the hooded one', description: '', alias: true }]);
  });

  it('keeps an alias-known entity after it leaves the scene', () => {
    const seen = state({ visibleEntities: [{ name: 'Veiled Figure', alias: 'the hooded one', revealed: false }] });
    expect(names(view({ chain: [seen, state()] }).entities)).toEqual(['the hooded one']);
  });

  it('uses the player description of an authored entity carried in a discovered record', () => {
    const pick: DiscoveredEntity = { entity: STRANGER, locationId: 'gate', sourceTurnId: 'initial' };
    const visitor: DiscoveredEntity = { entity: WARDEN, locationId: 'gate', sourceTurnId: 't2' };
    const libraryPick: DiscoveredEntity = { entity: entity('lib-1', 'Drifter'), locationId: 'gate', sourceTurnId: 'initial' };
    const v = view({ chain: [state({ discoveredEntities: [pick, visitor, libraryPick] })] });
    expect(v.entities.map((e) => e.description)).toEqual(['Stranger player text.', 'Warden player text.', 'Drifter player text.']);
  });

  it('holds the played persona and leaves an unplayed persona-only entity out', () => {
    const v = view({ chain: [state({ metEntities: ['heir', 'played'] })], persona: PLAYED });
    expect(v.entities).toEqual([{ kind: 'entity', id: 'played', name: 'Rover', description: 'Rover player text.', player: true }]);
  });
});

describe('buildPlayerView locations', () => {
  it('holds the current location and each location a turn recorded, and no other', () => {
    const history = [turn('t1', { locationId: 'hall' }), turn('t2'), { role: 'user', content: 'go' } as ChatMessage];
    const v = view({ chain: [state({ locationId: 'gate' })], history });
    expect(v.locations).toEqual([
      { kind: 'location', id: 'hall', name: 'Hall', description: 'Hall legacy text.' },
      { kind: 'location', id: 'gate', name: 'Gate', description: 'Gate player text.', current: true },
    ]);
  });

  it('marks the current location when a turn recorded it too', () => {
    const v = view({ chain: [state({ locationId: 'hall' })], history: [turn('t1', { locationId: 'hall' }), turn('t2', { locationId: 'gate' })] });
    expect(v.locations.map((l) => [l.id, l.current])).toEqual([['hall', true], ['gate', undefined]]);
  });
});

describe('buildPlayerView items', () => {
  it('counts an item once held or once visible where the player stood', () => {
    const v = view({ chain: [state({
      locationId: 'gate',
      itemCopies: [copy('c1', 'key', { kind: 'you' }), copy('c2', 'coin', { kind: 'location', id: 'gate' }), copy('c3', 'gem', { kind: 'location', id: 'vault' }), copy('c4', 'map', { kind: 'entity', id: 'warden' })],
    })] });
    expect(v.items).toEqual([
      { kind: 'item', id: 'key', name: 'key', description: 'key player text.' },
      { kind: 'item', id: 'coin', name: 'coin', description: 'coin player text.' },
    ]);
  });

  it('keeps a hidden copy out until it is revealed', () => {
    const hidden = state({ itemCopies: [copy('c1', 'key', { kind: 'you' }, 'hidden')] });
    expect(view({ chain: [hidden] }).items).toEqual([]);
    const revealed = state({ itemCopies: [copy('c1', 'key', { kind: 'you' })] });
    expect(names(view({ chain: [hidden, revealed] }).items)).toEqual(['key']);
  });

  it('keeps an item the player held in an earlier snapshot', () => {
    const held = state({ itemCopies: [copy('c1', 'key', { kind: 'you' })] });
    expect(names(view({ chain: [held, state()] }).items)).toEqual(['key']);
  });

  it('uses a runtime item description', () => {
    const v = view({ chain: [state({
      runtimeItems: [{ id: 'rt-rope', name: 'rope', description: 'A coil of rope.' }],
      itemCopies: [{ id: 'c1', item: { kind: 'runtime', runtimeItemId: 'rt-rope' }, where: { kind: 'you' }, quantity: 1, visibility: 'visible' }],
    })] });
    expect(v.items).toEqual([{ kind: 'item', id: 'rt-rope', name: 'rope', description: 'A coil of rope.' }]);
  });
});

describe('buildPlayerView stats and traits', () => {
  it('holds visible stats with their band and leaves hidden and disabled stats out', () => {
    const v = view({ chain: [state({ globalStats: [stat('health'), stat('secret', { hidden: true }), stat('dormant', { enabled: false })] })] });
    expect(v.stats).toEqual([{ kind: 'stat', id: 'health', name: 'health', type: 'number', value: 3, min: 0, max: 10, band: 'health low' }]);
  });

  it('holds the persona stats and no other entity stats', () => {
    const v = view({
      chain: [state({ entityStats: { played: [stat('stamina'), stat('mood', { hidden: true })], warden: [stat('resolve')] } })], persona: PLAYED,
    });
    expect(v.stats.map((s) => [s.id, s.ownerId])).toEqual([['stamina', 'played']]);
  });

  it('holds the active global traits and leaves hidden and switched-off traits out', () => {
    const v = view({ chain: [state({
      globalTraits: [trait('brave'), trait('cursed', { mode: 'hidden' }), trait('lazy'), trait('weary')],
      disabledTraitIds: ['lazy'], cascadeOffTraitIds: { global: ['weary'] },
    })] });
    expect(v.traits).toEqual([{ kind: 'trait', id: 'brave', name: 'brave', description: 'brave player text.' }]);
  });

  it("holds the persona's active owned traits, linked ones included", () => {
    const persona = { ...PLAYED, traits: [trait('sly'), trait('marked', { mode: 'hidden' }), trait('tired'), trait('lost')] };
    const v = view({
      chain: [state({
        ownedTraits: { played: { chosen: ['sly', 'marked', 'tired', 'linked', 'lost'], disabled: ['tired'] }, warden: { chosen: ['sly'] } },
        cascadeOffTraitIds: { owners: { played: ['lost'] } },
      })],
      persona,
    });
    expect(v.traits.map((t) => [t.id, t.ownerId])).toEqual([['sly', 'played'], ['linked', 'played']]);
  });
});

describe('buildPlayerView never holds hidden text', () => {
  it('holds no AI description, AI summary, diary or script memory text', () => {
    const history = [turn('t1', {
      locationId: 'gate', summary: 'Digest text.', diaries: { Warden: 'Diary text.' }, codeMemory: ['Script memory text.'], codeDiaries: { Warden: ['Script diary text.'] },
    })];
    const v = view({
      chain: [state({
        locationId: 'gate', metEntities: ['warden'], globalStats: [stat('health')], globalTraits: [trait('brave')],
        itemCopies: [copy('c1', 'key', { kind: 'you' })],
      })],
      history,
    });
    const text = JSON.stringify(v);
    expect(names(v.entities)).toEqual(['Warden']);
    expect(text).not.toMatch(/AI secret|AI summary|AI meaning|Digest text|Diary text|Script memory text|Script diary text/);
  });

  it('resolves chips the way the player sees them', () => {
    const v = view({ chain: [state({ metEntities: ['warden'] })], resolve: (text) => text.replace('Warden', 'Keeper') });
    expect(v.entities[0]).toMatchObject({ name: 'Keeper', description: 'Keeper player text.' });
  });
});

describe('buildPlayerView after an undo', () => {
  it('drops what the undone turn added', () => {
    const before = state({ locationId: 'gate', metEntities: [] });
    const after = state({
      locationId: 'vault', metEntities: ['warden'], itemCopies: [copy('c1', 'gem', { kind: 'location', id: 'vault' })],
    });
    const history = [turn('t1', { locationId: 'gate' }), turn('t2', { locationId: 'vault' })];

    const full = view({ chain: [before, after], history });
    expect([names(full.entities), names(full.locations), names(full.items)]).toEqual([['Warden'], ['Gate', 'Vault'], ['gem']]);

    const undone = view({ chain: [before], history: history.slice(0, 1) });
    expect([names(undone.entities), names(undone.locations), names(undone.items)]).toEqual([[], ['Gate'], []]);
  });

  it('is empty with no snapshot', () => {
    expect(view({ chain: [] })).toEqual({ entities: [], locations: [], items: [], stats: [], traits: [] });
  });
});
