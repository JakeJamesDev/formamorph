import { describe, expect, it } from 'vitest';
import { optionsFor, ownerOfHome, PENDING_PERSONA_ID, snapshotOf, type ScriptRunUnit, type UnitHome } from './sandboxSnapshot';
import { inPlayOwners } from './ownedTraitsInPlay';
import type { SandboxState } from './statCodeTurn';
import type { RunTiming } from './statCodeTiming';
import type { Entity, PersonaRef, PlayerStat, Stat, Trait } from '@/types';

const stat = (over: Partial<PlayerStat>): PlayerStat => ({
  id: 'x', name: 'Stat', type: 'number', description: '', min: 0, max: 100, value: 50, regen: 0, descriptors: [],
  baseMin: 0, baseMax: 100, baseRegen: 0, aiMaxDelta: 0, ...over,
});
const trait = (id: string, name: string): Trait => ({ id, name, statChanges: [] });

const hp = stat({ id: 'hp', name: 'HP' });
const grit = stat({ id: 'grit', name: 'Grit', value: 3 });
const brave = trait('brave', 'Brave');
const calm = trait('calm', 'Calm');
const grim = trait('grim', 'Grim');
const bram: Entity = { id: 'bram', name: 'Bram', traits: [grim] };
const sela: Entity = { id: 'sela', name: 'Sela' };
const persona: PersonaRef = { source: 'none' };
const clock = { deltaHours: 2, elapsedHours: 7 };

/** HP global and Brave held; Bram in the cast with Grit and Grim; one place, one discovered entity. */
const state: SandboxState = {
  stats: [hp], enabled: { hp: true }, clock,
  owners: [{ id: 'bram', stats: [grit], enabled: { grit: false } }],
  ownerTraits: {
    acquired: [brave], disabledTraitIds: [], appliedValues: {}, ownedTraits: { bram: { chosen: ['grim'] } }, entities: [bram], library: [], discovered: [sela],
    world: { traits: [brave, calm], groups: [], entities: [bram], persona, ...inPlayOwners({ traits: [brave, calm], traitGroups: [], entities: [bram] }, persona, []) },
  },
  places: { locations: [{ id: 'dock', name: 'Dock' }], location: { id: 'dock', name: 'Dock' } },
};
const readings = {
  global: { hp: { delta: { regen: { value: 1 } } } },
  owners: { bram: { grit: { delta: { regen: { value: 2 } } } } },
};

const groupStats: Stat[] = [stat({ id: 'fur', name: 'Fur' })];
const HOMES: Record<string, UnitHome> = {
  'global stat': { kind: 'globalStat', stat: hp },
  'entity stat': { kind: 'entityStat', entityId: 'bram', stat: grit },
  'Blueprint stat': { kind: 'blueprintStat', stat: groupStats[0], groupStats },
  'global trait': { kind: 'trait', trait: brave, entityId: null },
  'trait on an entity': { kind: 'trait', trait: grim, entityId: 'bram' },
  'trait on a Blueprint': { kind: 'blueprintTrait', trait: trait('howl', 'Howl') },
  'world script': { kind: 'world' },
  'World Tool': { kind: 'tool' },
};

const bramEntry = {
  id: 'bram', name: 'Bram', inScene: false, description: '', summary: '', aliases: [], locationIds: [],
  traits: [expect.objectContaining({ id: 'grim', name: 'Grim', enabled: true, acquired: true })],
  stats: { stats: [expect.objectContaining({ id: 'grit', value: 3 })], readings: readings.owners.bram, enabled: { grit: false } },
};

/** What each Owner kind assembles as `owner` and `self`. */
const OWNER_ROWS: [string, unknown, unknown][] = [
  ['global stat', undefined, undefined],
  ['entity stat', expect.objectContaining(bramEntry), undefined],
  ['Blueprint stat', { name: '', traits: [], stats: { stats: groupStats, enabled: { fur: true } } }, undefined],
  ['global trait', undefined, expect.objectContaining({ id: 'brave', name: 'Brave', enabled: true, acquired: true })],
  ['trait on an entity', expect.objectContaining(bramEntry), expect.objectContaining({ id: 'grim', enabled: true, acquired: true })],
  ['trait on a Blueprint', { name: '', traits: [], stats: { stats: [], enabled: {} } }, { id: 'howl', name: 'Howl', enabled: false, acquired: false }],
  ['world script', undefined, undefined],
  ['World Tool', undefined, undefined],
];

const TIMINGS: RunTiming[] = ['before', 'start', 'after', 'output', 'switch'];
const narration = { sentence: 'She waits.', full: 'She waits.', index: 0, sent: [], buffered: [] };
const switched = { event: { traitId: 'calm', ownerId: null, enabled: true }, world: state.ownerTraits.world };
const unitAt = (home: UnitHome, timing: RunTiming): ScriptRunUnit => ({
  home, timing, code: 'return 1;', narration, switched, ...(home.kind === 'tool' ? { args: { n: 1 } } : {}),
});

describe('the options a snapshot assembles', () => {
  const snapshot = snapshotOf(state, { readings });

  describe.each(TIMINGS)('at %s', (timing) => {
    it.each(OWNER_ROWS)('for a %s', (name, owner, self) => {
      const options = optionsFor(snapshot, unitAt(HOMES[name], timing));
      expect(options.owner).toEqual(owner);
      expect(options.selfTrait).toEqual(self);
      expect(options.clock).toBe(clock);
      expect(options.enabled).toEqual({ hp: true });
      expect(options.readings).toEqual(readings.global);
      expect(options.entities).toEqual([expect.objectContaining(bramEntry), expect.objectContaining({ id: 'sela', name: 'Sela', traits: [] })]);
      expect(options.persona).toEqual(expect.objectContaining({ id: '', name: '' }));
      expect(options.traits?.map((t) => [t.name, t.enabled])).toEqual([['Brave', true], ['Calm', false]]);
      expect(options.places).toEqual({
        locations: [{ id: 'dock', name: 'Dock', description: '', summary: '', starting: false, links: expect.any(Function) }], location: { id: 'dock', name: 'Dock' },
      });
      expect(options.args).toEqual(name === 'World Tool' ? { n: 1 } : undefined);
      expect(options.narration).toEqual(timing === 'output' ? narration : undefined);
      expect(options.switchedTrait).toEqual(timing === 'switch'
        ? { id: 'calm', name: 'Calm', enabled: true, acquired: false, mode: 'optional', available: true, group: '', playerToggle: false, owner: '' }
        : undefined);
    });
  });

  it('hands every unit the state’s memories, and none when the state holds none', async () => {
    const memories = [{
      id: 't1', turn: 1, timestamp: 2, day: 1, daypart: 'morning', text: 'Tor lied.', custom: false, kept: true, inContext: true, pinned: false, forgotten: false,
    }];
    const played = snapshotOf({ ...state, memories });
    for (const home of Object.values(HOMES)) expect(optionsFor(played, unitAt(home, 'after')).memories).toBe(memories);
    expect(optionsFor(snapshot, unitAt(HOMES['world script'], 'after')).memories).toBeUndefined();
    const read = { home: HOMES['global stat'], timing: 'after' as const, code: 'return memories.length;' };
    expect((await played.run(read)).value).toBe(1);
    expect((await snapshot.run(read)).value).toBe(0);
  });

  it('reads an untouched turn when built with no turn readings', () => {
    const options = optionsFor(snapshotOf(state), unitAt(HOMES['entity stat'], 'after'));
    expect(options.readings).toBeUndefined();
    expect(options.owner?.stats?.readings).toBeUndefined();
  });

  it('gives an Owner outside the cast an entry of its own, where its traits read as not held', () => {
    const offstage: UnitHome = { kind: 'trait', trait: grim, entityId: 'ghost' };
    const options = optionsFor(snapshot, unitAt(offstage, 'after'));
    expect(options.owner).toEqual({ id: 'ghost', name: '', type: '', pronouns: '', inScene: false, traits: [], stats: { stats: [], readings: {}, enabled: {} } });
    expect(options.selfTrait).toEqual({ id: 'grim', name: 'Grim', enabled: false, acquired: false });
  });
});

describe('the readings and overlays an editor run takes', () => {
  const sample = (home: UnitHome): ScriptRunUnit => ({ home, timing: 'switch', code: 'return 1;', switched: 'sample' });

  it('opens the cast only when asked, as play never does', () => {
    expect(optionsFor(snapshotOf(state, { openCast: true }), unitAt(HOMES['world script'], 'after')).openCast).toBe(true);
    expect(optionsFor(snapshotOf(state), unitAt(HOMES['world script'], 'after')).openCast).toBeUndefined();
  });

  it('stands a pending persona in for every persona-capable entity, with its traits, placeholders and stats', () => {
    const playable: Entity = { ...bram, persona: true, placeholders: [{ id: 'oath', name: 'Oath', values: [{ id: 'o', text: 'iron' }] }] };
    const withPlayable: SandboxState = {
      ...state,
      ownerTraits: { ...state.ownerTraits, entities: [playable], world: { ...state.ownerTraits.world, entities: [playable] } },
      placeholders: { placeholders: playable.placeholders ?? [], owners: new Map([['oath', { kind: 'entity', id: 'bram', name: 'Bram' }]]), rolls: {} },
    };
    const options = optionsFor(snapshotOf(withPlayable, { pendingPersona: true }), unitAt(HOMES['world script'], 'after'));
    expect(options.persona).toMatchObject({
      id: PENDING_PERSONA_ID, name: '', inScene: true,
      traits: [{ name: 'Grim', enabled: false, acquired: false }],
      stats: { stats: [expect.objectContaining({ id: 'grit' })], enabled: { grit: true } },
      placeholders: { path: ['persona'], children: [expect.objectContaining({ name: 'Oath', path: ['persona', 'Oath'], ownedBy: 'persona' })] },
    });
    expect(optionsFor(snapshotOf(withPlayable), unitAt(HOMES['world script'], 'after')).persona?.id).not.toBe(PENDING_PERSONA_ID);
  });

  it('adds an assumed stat for a name the world lacks, switched on', () => {
    const options = optionsFor(snapshotOf(state, { assumedStats: ['Ghost'] }), unitAt(HOMES['world script'], 'after'));
    expect(Object.values(options.enabled ?? {})).toEqual([true, true]);
  });

  it('builds During AI Output’s narration from a sentence, as the first of its reply', () => {
    const fromSentence = (timing: RunTiming): ScriptRunUnit => ({ home: HOMES['world script'], timing, code: 'return 1;', narration: 'The door opens.' });
    expect(optionsFor(snapshotOf(state), fromSentence('output')).narration)
      .toEqual({ sentence: 'The door opens.', full: 'The door opens.', index: 0, sent: [], buffered: [] });
    expect(optionsFor(snapshotOf(state), fromSentence('after')).narration).toBeUndefined();
  });

  it('fires a sample switch on the home’s own trait, under its Owner', () => {
    const options = optionsFor(snapshotOf(state), sample(HOMES['trait on an entity']));
    expect(options.switchedTrait).toMatchObject({ id: 'grim', enabled: true, owner: 'Bram' });
  });

  it('fires a sample switch on the world’s first trait in tree order, else on a blank one', () => {
    expect(optionsFor(snapshotOf(state), sample(HOMES['world script'])).switchedTrait).toMatchObject({ id: 'brave', enabled: true, owner: '' });
    const bare: SandboxState = { ...state, ownerTraits: { ...state.ownerTraits, acquired: [], world: { ...state.ownerTraits.world, traits: [] } } };
    expect(optionsFor(snapshotOf(bare), sample(HOMES['world script'])).switchedTrait).toEqual({ name: '', enabled: true, acquired: true, owner: '' });
  });
});

describe('ownerOfHome', () => {
  it.each([
    ['global stat', { kind: 'none' }],
    ['entity stat', { kind: 'entity', entityId: 'bram' }],
    ['Blueprint stat', { kind: 'blueprintStat', stats: groupStats }],
    ['global trait', { kind: 'none' }],
    ['trait on an entity', { kind: 'entity', entityId: 'bram' }],
    ['trait on a Blueprint', { kind: 'blueprintTrait' }],
    ['world script', { kind: 'none' }],
    ['World Tool', { kind: 'none' }],
  ])('derives the Owner of a %s', (name, owner) => {
    expect(ownerOfHome(HOMES[name])).toEqual(owner);
  });
});

describe('switchesOf', () => {
  const snapshot = snapshotOf(state, { readings });

  it('names each switch by id: world traits by code name, entity rows by the cast, owner rows by the unit’s Owner', () => {
    expect(snapshot.switchesOf({ home: HOMES['entity stat'] }, {
      traits: [{ name: 'Calm', enabled: true }, { name: 'Nope', enabled: true }],
      entities: [
        { entity: 'Bram', traits: [{ name: 'Grim', enabled: false }] },
        { entity: '', owner: true, traits: [{ name: 'Grim', enabled: true }] },
        { entity: 'Nobody', traits: [{ name: 'Grim', enabled: false }] },
      ],
    })).toEqual([
      { traitId: 'calm', enabled: true },
      { traitId: 'grim', enabled: false, ownerId: 'bram' },
      { traitId: 'grim', enabled: true, ownerId: 'bram' },
    ]);
  });

  it('drops an owner row from a unit with no Owner, and a persona row when no persona plays', () => {
    expect(snapshot.switchesOf({ home: HOMES['world script'] }, {
      entities: [{ entity: '', owner: true, traits: [{ name: 'Grim', enabled: true }] }, { entity: '', traits: [{ name: 'Grim', enabled: true }] }],
    })).toEqual([]);
  });
});
