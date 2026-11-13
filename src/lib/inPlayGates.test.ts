import { describe, expect, it } from 'vitest';
import { evaluateGates, ownGateIds, selfLocked } from './inPlayGates';
import { resolveInPlayWorld, startGateInput } from './inPlayWorld';
import { scoped } from './scope';
import type { GateInput, GateStatSet } from './traitGates';
import type { Entity, ItemCopy, StatRequirement, Trait, TraitGroup, TraitRequirement } from '@/types';

const T = (id: string): Trait => ({ id, name: id, statChanges: [] });
const brave = T('brave');
const watchful = T('watchful');
const moods: TraitGroup = { id: 'moods', name: 'Moods', parentId: null };
const noStats: GateStatSet = {};
const gate = (...all: TraitRequirement[]): Entity['enabledWhen'] => [{ all }];
const ring = (where: ItemCopy['where']): ItemCopy => ({ id: 'c1', item: { kind: 'item', itemId: 'ring' }, where, quantity: 1, visibility: 'visible' });

/** Mira owns Brave and an `hp` stat; the world holds Watchful globally and one ring. */
const input = (over: Partial<GateInput> = {}): GateInput => ({
  global: { traits: [watchful], groups: [moods] },
  owners: [{ id: 'mira', name: 'Mira', traits: [brave], groups: [] }],
  active: scoped([], { mira: [] }),
  stats: scoped({ hp: { name: 'HP', value: 5, min: 0, max: 10 } }, { mira: { hp: { name: 'HP', value: 2, min: 0, max: 10 } } }),
  entities: [{ id: 'mira', name: 'Mira' }, { id: 'ash', name: 'Ash', persona: true }],
  persona: { source: 'none' },
  worldItems: [{ id: 'ring', name: 'Ring' }],
  itemCopies: [],
  daypart: 'morning',
  ...over,
});
const entity = (enabledWhen: Entity['enabledWhen']): Entity => ({ id: 'mira', name: 'Mira', enabledWhen });
const on = (rows: Entity['enabledWhen'], over: Partial<GateInput> = {}, played: string | null = null) =>
  !evaluateGates({ entities: [entity(rows)], locations: [], connections: [] }, { playedEntityId: played, gate: input(over) })
    .offEntityIds.has('mira');

describe('an entity Enabled gate', () => {
  it('is on with no rows, and with no gate input', () => {
    expect(on(undefined)).toBe(true);
    expect(on([])).toBe(true);
    expect(evaluateGates({ entities: [entity(gate({ kind: 'time', dayparts: ['night'] }))], locations: [], connections: [] }, {})
      .offEntityIds.size).toBe(0);
  });

  it.each<[string, TraitRequirement, Partial<GateInput>, Partial<GateInput>]>([
    ['a trait', { kind: 'trait', id: 'watchful' }, { active: scoped(['watchful'], { mira: [] }) }, {}],
    ['a group', { kind: 'group', id: 'moods' }, {
      global: { traits: [{ ...watchful, groupId: 'moods' }], groups: [moods] }, active: scoped(['watchful'], { mira: [] }),
    }, { global: { traits: [{ ...watchful, groupId: 'moods' }], groups: [moods] } }],
    ['a stat', { kind: 'stat', id: 'hp', owner: { kind: 'entity', id: 'mira' }, operator: '>=', value: 2, unit: 'raw' }, {},
      { stats: scoped(noStats, { mira: { hp: { name: 'HP', value: 1, min: 0, max: 10 } } }) }],
    ['an item', { kind: 'item', id: 'ring', status: 'owned', owner: { kind: 'entity', id: 'mira' } }, { itemCopies: [ring({ kind: 'entity', id: 'mira' })] }, {}],
    ['the time', { kind: 'time', dayparts: ['morning'] }, {}, { daypart: 'night' }],
    ['playing as', { kind: 'playingAs', id: 'ash' }, { persona: { source: 'world', entityId: 'ash' } }, {}],
  ])('reads %s Condition: on while it holds, off while it fails', (_kind, req, holds, fails) => {
    expect(on(gate(req), holds)).toBe(true);
    expect(on(gate(req), fails)).toBe(false);
  });

  it('is on while any row holds', () => {
    const rows = [{ all: [{ kind: 'time', dayparts: ['night'] } as TraitRequirement] }, { all: [{ kind: 'time', dayparts: ['morning'] } as TraitRequirement] }];
    expect(on(rows)).toBe(true);
    expect(on(rows, { daypart: 'evening' })).toBe(false);
  });

  it('reads a blank owner as the entity itself (Q29)', () => {
    // Mira's own HP is 2 while the global HP is 5.
    const atLeastFour: TraitRequirement = { kind: 'stat', id: 'hp', operator: '>=', value: 4, unit: 'raw' };
    expect(on(gate(atLeastFour))).toBe(false);
    expect(on(gate(atLeastFour), { stats: scoped({ hp: { name: 'HP', value: 5, min: 0, max: 10 } }, { mira: { hp: { name: 'HP', value: 6, min: 0, max: 10 } } }) })).toBe(true);
    const isBrave: TraitRequirement = { kind: 'trait', id: 'brave' };
    expect(on(gate(isBrave))).toBe(false);
    expect(on(gate(isBrave), { active: scoped([], { mira: ['brave'] }) })).toBe(true);
  });

  it('never turns off the played entity', () => {
    expect(on(gate({ kind: 'time', dayparts: ['night'] }), {}, 'mira')).toBe(true);
  });

  it('gates library and runtime entities by their own rows', () => {
    const drifter: Entity = { id: 'drifter', name: 'Drifter', enabledWhen: gate({ kind: 'time', dayparts: ['night'] }) };
    const verdicts = evaluateGates({ entities: [], locations: [], connections: [], others: [drifter] }, { gate: input() });
    expect([...verdicts.offEntityIds]).toEqual(['drifter']);
  });

  it('reads an off entity\'s stored state frozen, so gates on each other settle in one pass (Q47)', () => {
    // Mira is off (Wren lacks Bold). Wren's gate still reads Mira's stored Brave, so Wren stays on; a cascade
    // that read an off entity's traits as gone would turn Wren off too.
    const wren: Entity = { id: 'wren', name: 'Wren', enabledWhen: gate({ kind: 'trait', id: 'brave', owner: { kind: 'entity', id: 'mira' } }) };
    const mira: Entity = { id: 'mira', name: 'Mira', enabledWhen: gate({ kind: 'trait', id: 'bold', owner: { kind: 'entity', id: 'wren' } }) };
    const both = input({
      owners: [{ id: 'mira', name: 'Mira', traits: [brave], groups: [] }, { id: 'wren', name: 'Wren', traits: [T('bold')], groups: [] }],
      active: scoped([], { mira: ['brave'], wren: [] }),
      entities: [{ id: 'mira', name: 'Mira' }, { id: 'wren', name: 'Wren' }],
    });
    const verdicts = evaluateGates({ entities: [mira, wren], locations: [], connections: [] }, { gate: both });
    expect([...verdicts.offEntityIds]).toEqual(['mira']);
  });
});

describe('the resolver at a world\'s start', () => {
  it('reads authored start stats, so a gate on a stat below its start is off', () => {
    const world = {
      entities: [{ id: 'mira', name: 'Mira', stats: [{ id: 'trust', name: 'Trust', value: 1, min: 0, max: 10 }] as Entity['stats'],
        enabledWhen: gate({ kind: 'stat', id: 'trust', operator: '>=', value: 3, unit: 'raw' }) }],
      locations: [], connections: [],
    };
    const view = resolveInPlayWorld(world, { playedEntityId: null, gate: startGateInput(world, null) });
    expect(view.entities).toEqual([]);
  });
});

describe('the self-lock check (Q48)', () => {
  const own = { traitIds: new Set(['brave']), groupIds: new Set(['nerve']), statIds: new Set(['trust']) };
  const trust: StatRequirement = { kind: 'stat', id: 'trust', operator: '>=', value: 3, unit: 'raw' };
  const onWren: StatRequirement = { ...trust, owner: { kind: 'entity', id: 'wren' } };

  it('flags a gate whose every Condition reads the entity\'s own stats, traits or groups', () => {
    expect(selfLocked('mira', gate(trust), own)).toBe(true);
    expect(selfLocked('mira', [{ all: [trust] }, { all: [{ kind: 'trait', id: 'brave', owner: { kind: 'entity', id: 'mira' } }] }], own)).toBe(true);
    expect(selfLocked('mira', gate({ kind: 'group', id: 'nerve' }), own)).toBe(true);
  });

  it('counts a trait the entity links as its own', () => {
    const linked = ownGateIds({ traitLinks: [{ id: 'l1', originalId: 'w-brave', kind: 'trait', originalName: 'Brave', groupId: null }] }, []);
    expect(selfLocked('mira', gate({ kind: 'trait', id: 'w-brave' }), linked)).toBe(true);
    expect(selfLocked('mira', gate({ kind: 'trait', id: 'w-brave' }), ownGateIds({}, []))).toBe(false);
  });

  it('leaves a mixed gate, a gate on someone else, an item gate and an empty gate alone', () => {
    expect(selfLocked('mira', gate(trust, { kind: 'time', dayparts: ['night'] }), own)).toBe(false);
    expect(selfLocked('mira', [{ all: [trust] }, { all: [{ kind: 'trait', id: 'watchful' }] }], own)).toBe(false);
    expect(selfLocked('mira', gate(onWren), own)).toBe(false);
    expect(selfLocked('mira', gate({ kind: 'item', id: 'ring', status: 'owned' }), own)).toBe(false);
    expect(selfLocked('mira', [], own)).toBe(false);
  });
});
