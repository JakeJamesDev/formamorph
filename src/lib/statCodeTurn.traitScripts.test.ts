/**
 * @vitest-environment node
 * (No DOM needed; node keeps the QuickJS WASM engine loading through its filesystem path.)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runStatCodeTurn, type OwnerCodeTurn } from './statCodeTurn';
import type { StatCodeOwners } from './statCodeTraits';
import { inPlayOwners } from './ownedTraitsInPlay';
import { worldScriptEntries } from './worldScripts';
import type { Entity, OwnedTraitStates, PersonaRef, PlayerStat, Script, Trait, TraitGroup } from '@/types';
import { statCodeTurnOf, type FlatStatCodeTurn } from '@/test/statCodeTurnFixture';

const NO_PERSONA: PersonaRef = { source: 'none' };

const stat = (over: Partial<PlayerStat>): PlayerStat => ({
  id: 'x', name: 'Stat', type: 'number', description: '', min: 0, max: 100, value: 50, regen: 0, descriptors: [],
  baseMin: 0, baseMax: 100, baseRegen: 0, aiMaxDelta: 0, ...over,
});

const script = (code: string, over: Partial<Script> = {}): Script => ({ id: `s-${code.length}`, timing: 'after', code, ...over });

const trait = (id: string, name: string, scripts: Script[]): Trait => ({ id, name, statChanges: [], scripts });

const hp = () => stat({ id: 'hp', name: 'HP', value: 50 });

/** A playthrough of the world's `traits` and `entities`: `acquired` holds the global picks, `off` the ones
 *  switched off, `owned` each entity's picks. */
function ownerTraits({ traits = [], groups = [], entities = [], acquired = [], off = [], owned = {}, persona = NO_PERSONA }: {
  traits?: Trait[]; groups?: TraitGroup[]; entities?: Entity[]; acquired?: Trait[]; off?: string[]; owned?: OwnedTraitStates;
  persona?: PersonaRef;
}): StatCodeOwners {
  return {
    acquired, disabledTraitIds: off, appliedValues: {}, ownedTraits: owned, entities, library: [],
    world: {
      traits, groups, entities, persona,
      ...inPlayOwners({ traits, traitGroups: groups, entities }, persona, []),
    },
  };
}

const run = (traits: StatCodeOwners, { stats = [hp()], owners, timing }: {
  stats?: PlayerStat[]; owners?: OwnerCodeTurn[]; timing?: 'before' | 'after';
} = {}) => runStatCodeTurn(statCodeTurnOf({
  ...(timing ? { timing } : {}),
  stats, enabled: {}, previous: stats, asks: [], regenApplied: {}, clock: {}, ownerTraits: traits,
  ...(owners ? { owners } : {}),
  statNameOf: (s) => s.name, traitNameOf: (t) => t.name,
} satisfies FlatStatCodeTurn));

const hpOf = (out: { stats: readonly PlayerStat[] }) => out.stats.find((s) => s.id === 'hp')?.value;

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('a global trait’s scripts', () => {
  const brave = trait('brave', 'Brave', [script('stats.HP.value = 80;')]);

  it('run while the trait is held and on', async () => {
    expect(hpOf(await run(ownerTraits({ traits: [brave], acquired: [brave] })))).toBe(80);
  });

  it('do not run while the trait is switched off, and no write lands (Q3)', async () => {
    const out = await run(ownerTraits({ traits: [brave], acquired: [brave], off: ['brave'] }));
    expect(hpOf(out)).toBe(50);
    expect(out.moved).toEqual([]);
  });

  it('do not run while the player does not hold the trait', async () => {
    expect(hpOf(await run(ownerTraits({ traits: [brave] })))).toBe(50);
  });

  it('run only at their own timing', async () => {
    expect(hpOf(await run(ownerTraits({ traits: [brave], acquired: [brave] }), { timing: 'before' }))).toBe(50);
  });

  it('run the world’s current code, not the copy the pick stored', async () => {
    const picked = trait('brave', 'Brave', [script('stats.HP.value = 1;')]);
    expect(hpOf(await run(ownerTraits({ traits: [brave], acquired: [picked] })))).toBe(80);
  });

  it('read self as the trait’s own entry, and drop a write to it', async () => {
    const reader = trait('brave', 'Brave', [script('self.enabled = false; stats.HP.value = self.name === "Brave" && self.enabled ? 70 : 10;')]);
    const out = await run(ownerTraits({ traits: [reader], acquired: [reader] }));
    expect(hpOf(out)).toBe(70);
    expect(out.traits).toBeUndefined();
  });

  it('ignore a return value rather than fail the script (Q31)', async () => {
    const returner = trait('brave', 'Brave', [script('stats.HP.value = 60; return "done";')]);
    expect(hpOf(await run(ownerTraits({ traits: [returner], acquired: [returner] })))).toBe(60);
  });

  it('run after the stats’ scripts of the same owner, so the trait wins a shared write', async () => {
    const writer = stat({ id: 'hp', name: 'HP', value: 50, scripts: [script('return 20;')] });
    expect(hpOf(await run(ownerTraits({ traits: [brave], acquired: [brave] }), { stats: [writer] }))).toBe(80);
  });

  it('lose a shared write when ordered before the stat’s script', async () => {
    const early = trait('brave', 'Brave', [script('stats.HP.value = 80;', { order: 0 })]);
    const writer = stat({ id: 'hp', name: 'HP', value: 50, scripts: [script('return 20;', { order: 1 })] });
    expect(hpOf(await run(ownerTraits({ traits: [early], acquired: [early] }), { stats: [writer] }))).toBe(20);
  });

  it('run in the world’s tree order, not pick order, so the later-authored trait wins a shared write (Q38)', async () => {
    const first = trait('first', 'First', [script('stats.HP.value = 10;')]);
    const second = trait('second', 'Second', [script('stats.HP.value = 90;')]);
    const authored = [first, second];
    expect(hpOf(await run(ownerTraits({ traits: authored, acquired: [first, second] })))).toBe(90);
    expect(hpOf(await run(ownerTraits({ traits: authored, acquired: [second, first] })))).toBe(90);
  });

  it('run in the tree order a group sets, not the order the traits were authored in', async () => {
    const outer = { ...trait('outer', 'Outer', [script('stats.HP.value = 10;')]), order: 1 };
    const inner = { ...trait('inner', 'Inner', [script('stats.HP.value = 90;')]), groupId: 'folder' };
    const folder: TraitGroup = { id: 'folder', name: 'Folder', parentId: null, order: 0 };
    // The folder sits ahead of `outer`, so `inner` runs first and `outer` wins.
    expect(hpOf(await run(ownerTraits({ traits: [outer, inner], groups: [folder], acquired: [outer, inner] })))).toBe(10);
  });

  it('move with the Traits tab together with the Scripts tab when a trait is dragged (Q50)', async () => {
    const stored = { ...trait('stored', 'Stored', [script('stats.HP.value = 10;', { id: 'stored-after' })]), order: 1 };
    const dragged = { ...trait('dragged', 'Dragged', [script('stats.HP.value = 90;', { id: 'dragged-after' })]), order: 0 };
    const traits = [stored, dragged];
    const tab = worldScriptEntries({ stats: [], statGroups: [], traits, traitGroups: [], entities: [], placeholders: [] });
    expect(tab.map((entry) => entry.script.id)).toEqual(['dragged-after', 'stored-after']);
    expect(hpOf(await run(ownerTraits({ traits, acquired: [dragged, stored] })))).toBe(10);
  });
});

describe('an entity’s trait scripts', () => {
  const grim = trait('grim', 'Grim', [script('owner.stats.Grit.value = 9; stats.HP.value = owner.name === "Bram" ? 30 : 0;')]);
  const bram: Entity = { id: 'bram', name: 'Bram', traits: [grim] };
  const grit = () => stat({ id: 'grit', name: 'Grit', value: 1 });
  const bramTurn = (): OwnerCodeTurn => ({ id: 'bram', stats: [grit()], enabled: {}, previous: [grit()], regenApplied: {} });

  it('run under the entity as owner while the entity holds the trait', async () => {
    const out = await run(ownerTraits({ entities: [bram], owned: { bram: { chosen: ['grim'] } } }), { owners: [bramTurn()] });
    expect(hpOf(out)).toBe(30);
    expect(out.owners?.bram.stats[0].value).toBe(9);
  });

  it('do not run while the entity’s trait is switched off', async () => {
    const out = await run(
      ownerTraits({ entities: [bram], owned: { bram: { chosen: ['grim'], disabled: ['grim'] } } }), { owners: [bramTurn()] },
    );
    expect(hpOf(out)).toBe(50);
    expect(out.owners?.bram.stats[0].value).toBe(1);
  });

  it('run for an entity with no stats of its own', async () => {
    const reader = trait('grim', 'Grim', [script('stats.HP.value = owner.name === "Bram" ? 30 : 0;')]);
    const statless: Entity = { id: 'bram', name: 'Bram', traits: [reader] };
    const out = await run(ownerTraits({ entities: [statless], owned: { bram: { chosen: ['grim'] } } }));
    expect(hpOf(out)).toBe(30);
    expect(out.owners).toBeUndefined();
  });

  it('run a link’s scripts override in place of the Blueprint’s, and the Blueprint’s where the link has none', async () => {
    const original = [script('stats.HP.value = stats.HP.value + 1;')];
    const blueprint = { ...trait('howl', 'Howl', original), groupId: 'bp' };
    const override = [script('stats.HP.value = stats.HP.value + 10;')];
    const linked = (id: string, scripts?: Script[]): Entity => ({
      id, name: id, traitLinks: [{
        id: `l-${id}`, originalId: 'howl', kind: 'trait', originalName: 'Howl', groupId: null,
        ...(scripts ? { overrides: { howl: { scripts: { value: scripts, blueprint: original } } } } : {}),
      }],
    });
    const groups: TraitGroup[] = [{ id: 'bp', name: 'Blueprints', parentId: null, system: 'blueprints' }];
    const playing = (bram: Entity) => ownerTraits({ traits: [blueprint], groups, entities: [bram], owned: { Bram: { chosen: ['howl'] } } });
    expect(hpOf(await run(playing(linked('Bram', override))))).toBe(60);
    expect(hpOf(await run(playing(linked('Bram'))))).toBe(51);
  });

  it('run in owner order for an owner with no stats, so a later owner with stats wins a shared write', async () => {
    // Mira is the played persona, so she runs before Bram, whose own stat writes HP last.
    const loud = trait('loud', 'Loud', [script('stats.HP.value = 10;')]);
    const mira: Entity = { id: 'mira', name: 'Mira', persona: true, traits: [loud] };
    const writer = stat({ id: 'grit', name: 'Grit', value: 1, scripts: [script('stats.HP.value = 20;')] });
    const persona: PersonaRef = { source: 'world', entityId: 'mira' };
    const traits = ownerTraits({ entities: [{ ...bram, traits: [] }, mira], owned: { mira: { chosen: ['loud'] } }, persona });
    const out = await run(traits, { owners: [{ id: 'bram', stats: [writer], enabled: {}, previous: [writer], regenApplied: {} }] });
    expect(hpOf(out)).toBe(20);
  });

  it('run once per owner when two entities hold the trait', async () => {
    const counter = trait('grim', 'Grim', [script('stats.HP.value = stats.HP.value + (owner.name === "Bram" ? 1 : 10);')]);
    const twins = [{ id: 'bram', name: 'Bram', traits: [counter] }, { id: 'cass', name: 'Cass', traits: [{ ...counter }] }];
    const out = await run(ownerTraits({
      entities: twins, owned: { bram: { chosen: ['grim'] }, cass: { chosen: ['grim'] } },
    }));
    // Both read one snapshot; the later owner's write wins the field.
    expect(hpOf(out)).toBe(60);
  });
});
