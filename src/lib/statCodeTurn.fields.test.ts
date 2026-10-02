/**
 * @vitest-environment node
 * (No DOM needed; node keeps the QuickJS WASM engine loading through its filesystem path.)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runStatCodeTurn, type StatCodeTurn } from './statCodeTurn';
import type { StatCodeBearers } from './statCodeTraits';
import { inPlayBearers } from './ownedTraitsInPlay';
import { withPersonaEntry } from './persona';
import type { Entity, PersonaRef, Placeholder, PlayerStat, Trait, TraitGroup } from '@/types';

const stat = (over: Partial<PlayerStat>): PlayerStat => ({
  id: 'x', name: 'Stat', type: 'number', description: '', min: 0, max: 100, value: 50, regen: 0, descriptors: [],
  baseMin: 0, baseMax: 100, baseRegen: 0, aiMaxDelta: 0, ...over,
});

const mood: TraitGroup = { id: 'mood', name: 'Mood', parentId: null };
// The world trait is Always On and gated on a trait the player lacks; the gifted one is player-toggled in a group.
const edge: Trait = { id: 'edge', name: 'Edge', statChanges: [] };
const oath: Trait = { id: 'oath', name: 'Oath', mode: 'alwaysOn', requires: [{ kind: 'trait', id: 'edge' }], statChanges: [] };
const gifted: Trait = { id: 'gifted', name: 'Gifted', groupId: 'mood', playerToggle: true, statChanges: [] };
const calm: Trait = { id: 'calm', name: 'Calm', statChanges: [] };
const sworn: Trait = { id: 'sworn', name: 'Sworn', requires: [{ kind: 'trait', id: 'calm' }], statChanges: [] };
const mira: Entity = { id: 'mira', name: 'Mira', persona: true, type: 'Knight', pronouns: 'she/her', traits: [calm] };
const rook: Entity = { id: 'rook', name: 'Rook', traits: [calm, sworn].map((t) => ({ ...t, id: `rook-${t.id}`, requires: t.requires?.map((r) => ({ ...r, id: `rook-${r.id}` })) })) };
const pip: Entity = { id: 'pip', name: 'Pip' };
const asMira: PersonaRef = { source: 'world', entityId: 'mira' };

function played(over: { inSceneIds?: string[] } = {}): StatCodeBearers {
  const entities = [mira, rook, pip];
  const entered = [...withPersonaEntry(entities, asMira, undefined)];
  const bearerWorld = { traits: [oath, gifted, edge], traitGroups: [mood], entities: entered };
  return {
    acquired: [gifted],
    disabledTraitIds: [],
    appliedValues: {},
    ownedTraits: { mira: { chosen: ['calm'] } },
    entities,
    library: [],
    ...over,
    world: {
      traits: [oath, gifted, edge], groups: [mood], entities: entered, persona: asMira,
      bearers: inPlayBearers(bearerWorld, asMira, []),
    },
  };
}

const sky: Placeholder = { id: 'p-sky', name: 'Sky', values: [] };

/** One stat per piece of code; `S1` is switched off when `off` is set. */
const run = (codes: string[], traits: StatCodeBearers = played(), off = false) => runStatCodeTurn({
  stats: codes.map((code, i) => stat({ id: `s${i}`, name: `S${i}`, value: 0, code })),
  enabled: off ? { s1: false } : {}, previous: [], asks: [], regenApplied: {}, clock: {}, bearers: traits,
  placeholders: { placeholders: [sky], rolls: {} },
  statNameOf: (s) => s.name, traitNameOf: (t) => t.name,
} satisfies StatCodeTurn);

const valueOf = (out: { stats: readonly PlayerStat[] }, id: string) => out.stats.find((s) => s.id === id)?.value;

/** Whether an expression holds, read through the stat's value. */
const holds = async (expression: string, traits: StatCodeBearers = played(), off = false) =>
  valueOf(await run([`return (${expression}) ? 1 : 0;`, 'return 0;'], traits, off), 's0') === 1;

describe('runStatCodeTurn entry fields', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it.each([
    ['id', "entities.Rook.id === 'rook'"],
    ['type', "entities.Mira.type === 'Knight'"],
    ['pronouns', "entities.Mira.pronouns === 'she/her'"],
    ['an unset type', "entities.Rook.type === ''"],
    ['an unset pronouns', "entities.Rook.pronouns === ''"],
    ['the persona’s id', "persona.id === 'mira'"],
  ])('reads an entity’s %s', async (_, expression) => {
    expect(await holds(expression)).toBe(true);
  });

  it('follows the turn’s scene list for inScene, and always reads the played persona as in it', async () => {
    const scene = played({ inSceneIds: ['rook'] });
    expect(await holds('entities.Rook.inScene', scene)).toBe(true);
    expect(await holds('entities.Pip.inScene', scene)).toBe(false);
    expect(await holds('entities.Mira.inScene && persona.inScene', played())).toBe(true);
    expect(await holds('entities.Rook.inScene', played())).toBe(false);
  });

  it('reads a blank entity entry as outside the scene, with no identity', async () => {
    expect(await holds("entities.Ghost.id === '' && entities.Ghost.type === '' && !entities.Ghost.inScene")).toBe(true);
  });

  it.each([
    ['id', "traits.Gifted.id === 'gifted'"],
    ['name', "traits.Gifted.name === 'Gifted'"],
    ['mode', "traits.Oath.mode === 'alwaysOn' && traits.Gifted.mode === 'optional'"],
    ['group', "traits.Gifted.group === 'Mood' && traits.Oath.group === ''"],
    ['playerToggle', 'traits.Gifted.playerToggle && !traits.Oath.playerToggle'],
  ])('reads a world trait’s %s', async (_, expression) => {
    expect(await holds(expression)).toBe(true);
  });

  it('reads available from the gate: false while the requirements fail, true once they hold', async () => {
    expect(await holds('!traits.Oath.available && traits.Gifted.available')).toBe(true);
    expect(await holds('traits.Oath.available', { ...played(), acquired: [gifted, edge] })).toBe(true);
  });

  it('reads an entity trait’s fields, its gate checked for its own Bearer', async () => {
    expect(await holds("entities.Rook.traits.Calm.id === 'rook-calm' && entities.Rook.traits.Calm.mode === 'optional'")).toBe(true);
    expect(await holds('!entities.Rook.traits.Sworn.available && entities.Rook.traits.Calm.available')).toBe(true);
    const chosen = { ...played(), ownedTraits: { rook: { chosen: ['rook-calm'] } } };
    expect(await holds('entities.Rook.traits.Sworn.available', chosen)).toBe(true);
    expect(await holds("persona.traits.Calm.id === 'calm' && persona.traits.Calm.available")).toBe(true);
  });

  it('reads a blank trait entry as unavailable and unnamed', async () => {
    expect(await holds("traits.Nope.id === '' && traits.Nope.mode === '' && !traits.Nope.available && !traits.Nope.playerToggle")).toBe(true);
  });

  it('reads a placeholder’s id and name', async () => {
    expect(await holds("placeholders.Sky.id === 'p-sky' && placeholders.Sky.name === 'Sky'")).toBe(true);
  });

  it('reads a stat’s enabled: true for a running stat, false for one a trait switched off', async () => {
    const reads = ['return (stats.S0.enabled && self.enabled && !stats.S1.enabled && !stats.Nobody.enabled) ? 1 : 0;', 'return 0;'];
    expect(valueOf(await run(reads, played(), true), 's0')).toBe(1);
    expect(valueOf(await run(reads, played(), false), 's0')).toBe(0);
  });

  it('drops a write to every read-only field, reports each, and leaves the reads as they were', async () => {
    const out = await run([[
      "traits.Gifted.mode = 'hidden'; traits.Gifted.available = false;",
      "entities.Rook.inScene = true; entities.Rook.id = 'z'; persona.type = 'z';",
      "entities.Rook.traits.Calm.group = 'z'; persona.traits.Calm.id = 'z';",
      "placeholders.Sky.name = 'z'; placeholders.Nope.id = 'z';",
      "stats.S1.enabled = false; self.enabled = false;",
      "return (traits.Gifted.mode === 'optional' && traits.Gifted.available && !entities.Rook.inScene",
      "  && entities.Rook.id === 'rook' && persona.type === 'Knight' && placeholders.Sky.name === 'Sky') ? 1 : 0;",
    ].join('\n'), 'return 0;']);
    expect(valueOf(out, 's0')).toBe(1);
    const reported = vi.mocked(console.warn).mock.calls.map(([line]) => String(line)).join('\n');
    for (const path of [
      'traits.Gifted.mode', 'traits.Gifted.available', 'entities.Rook.inScene', 'entities.Rook.id', 'entities.Mira.type',
      'entities.Rook.traits.Calm.group', 'entities.Mira.traits.Calm.id', 'placeholders.Sky.name', 'placeholders.Nope.id',
      'stats.S1.enabled', 'stats.S0.enabled',
    ]) expect(reported).toContain(path);
  });

  it('reads a switched-off stat as a real entry, its writes dropped and reported', async () => {
    const out = await runStatCodeTurn({
      stats: [
        stat({ id: 'a', name: 'A', value: 0, code: 'stats.B.value = 9; return (!stats.B.enabled && stats.B.value === 7 && stats.B.max === 40 && stats.B.previous.value === 7) ? 1 : 0;' }),
        stat({ id: 'b', name: 'B', value: 7, max: 40, code: 'return 99;' }),
      ],
      enabled: { b: false }, previous: [], asks: [], regenApplied: {}, clock: {}, bearers: played(),
      statNameOf: (s) => s.name, traitNameOf: (t) => t.name,
    });
    expect(valueOf(out, 'a')).toBe(1);
    expect(valueOf(out, 'b')).toBe(7);
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('stats.B.value'));
  });

  it('keys a shared name to the live stat over a switched-off one, and to the later of two alike', async () => {
    const twin = (id: string, value: number, code = '') => stat({ id, name: 'Twin', value, code });
    const reads = async (enabled: Record<string, boolean>) => {
      const out = await runStatCodeTurn({
        stats: [twin('a', 1, 'return self === stats.Twin ? stats.Twin.value * 10 : 99;'), twin('b', 2), twin('c', 3)],
        enabled, previous: [], asks: [], regenApplied: {}, clock: {}, bearers: played(),
        statNameOf: (s) => s.name, traitNameOf: (t) => t.name,
      });
      return valueOf(out, 'a');
    };
    expect(await reads({ b: false, c: false })).toBe(10);
    expect(await reads({})).toBe(99);
  });

  it('drops and reports every read-only stat write, and keeps self’s own writes', async () => {
    const out = await run([[
      "stats.S1.value = 5; stats.S1.name = 'z'; self.name = 'z'; self.previous.value = 3; self.delta.ai.value = 2;",
      'self.delta = null; self.value = 4;',
      "return self.value + (self.name === 'S0' && stats.S1.value === 0 && self.previous.value === 0 && self.delta.ai.value === 0 ? 10 : 0);",
    ].join('\n'), 'return 0;']);
    expect(valueOf(out, 's0')).toBe(14);
    const reported = vi.mocked(console.warn).mock.calls.map(([line]) => String(line)).join('\n');
    for (const path of ['stats.S1.value', 'stats.S1.name', 'stats.S0.name', 'stats.S0.previous.value', 'stats.S0.delta.ai.value', 'stats.S0.delta']) {
      expect(reported).toContain(path);
    }
    expect(reported).not.toContain('stats.S0.value');
  });

  it('drops and reports a write to clock and clock.previous', async () => {
    const out = await run([[
      'clock.day = 9; clock.previous = null; clock.previous.day = 9;',
      'return clock.day === 1 && clock.previous.day === 1 ? 1 : 0;',
    ].join('\n'), 'return 0;']);
    expect(valueOf(out, 's0')).toBe(1);
    const reported = vi.mocked(console.warn).mock.calls.map(([line]) => String(line)).join('\n');
    for (const path of ['clock.day', 'clock.previous', 'clock.previous.day']) expect(reported).toContain(path);
  });

  it('reads a switched-off stat’s previous and delta from the turn', async () => {
    const out = await runStatCodeTurn({
      stats: [
        stat({ id: 'a', name: 'A', value: 0, max: 1000, code: 'return stats.B.previous.value * 100 + stats.B.delta.ai.value;' }),
        stat({ id: 'b', name: 'B', value: 7 }),
      ],
      enabled: { b: false }, previous: [stat({ id: 'b', name: 'B', value: 3 })], asks: [{ id: 'b', value: 4, max: 0 }],
      regenApplied: {}, clock: {}, bearers: played(),
      statNameOf: (s) => s.name, traitNameOf: (t) => t.name,
    });
    expect(valueOf(out, 'a')).toBe(304);
  });

  it('leaves an entity with an empty code name out of entities, and reports a write through the blank name as such', async () => {
    const blank: Entity = { id: 'blank', name: '', traits: [calm] };
    const traits = { ...played(), entities: [mira, rook, pip, blank] };
    expect(await holds("!Object.keys(entities).includes('') && entities[''].id === ''", traits)).toBe(true);
    await run(["entities[''].type = 'z';", 'return 0;'], traits);
    const reported = vi.mocked(console.warn).mock.calls.map(([line]) => String(line)).join('\n');
    expect(reported).toContain('entities[""].type');
    expect(reported).not.toContain('persona.type');
  });

  it('still switches an unnamed persona’s trait through persona', async () => {
    const nameless: Entity = { ...mira, name: '' };
    const entered = [...withPersonaEntry([nameless], asMira, undefined)];
    const traits: StatCodeBearers = {
      acquired: [], disabledTraitIds: [], appliedValues: {}, ownedTraits: { mira: { chosen: ['calm'] } },
      entities: [nameless], library: [],
      world: {
        traits: [], groups: [], entities: entered, persona: asMira,
        bearers: inPlayBearers({ traits: [], traitGroups: [], entities: entered }, asMira, []),
      },
    };
    const out = await run(['persona.traits.Calm.enabled = false;', 'return 0;'], traits);
    expect(out.traits?.ownedTraits.mira?.disabled).toEqual(['calm']);
  });

  it('still switches a trait through enabled, the one writable field', async () => {
    const out = await run(['traits.Gifted.enabled = false;', 'return 0;']);
    expect(out.traits?.disabledTraitIds).toEqual(['gifted']);
    expect(console.warn).not.toHaveBeenCalledWith(expect.stringContaining('read-only'));
  });
});
