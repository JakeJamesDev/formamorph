import { describe, expect, it } from 'vitest';
import { applyInventoryOps, settleInventory, type InventoryOp, type InventorySettleWorld } from '.';
import { seedStatBases, type TraitRuntimeState, type TraitWorld } from '@/lib/traitRuntime';
import type { Body, BodyRuntime, Item, ItemCopy, ItemCopyWhere, ItemEffectLedger, PersonaRef, PlayerStat, Slot, Trait } from '@/types';

const stat = (id: string, value: number): PlayerStat => ({ id, name: 'Strength', value, min: 0, max: 20 } as PlayerStat);
const item = (id: string, name: string, over: Partial<Item> = {}): Item =>
  ({ id, name, stackable: false, statEffects: [], traitEffects: [], equipRequires: [], ...over });
const trait = (id: string, over: Partial<Trait> = {}): Trait => ({ id, name: id, statChanges: [], playerToggle: true, ...over });
const sets = (id: string): Trait['body'] => ({ pick: { kind: 'body', id } });

const slots: Slot[] = [{ id: 'hand', name: 'Hand' }, { id: 'head', name: 'Head' }, { id: 'collar', name: 'Collar' }];
const bodies: Body[] = [
  { id: 'humanoid', name: 'Humanoid', entries: [{ slotId: 'hand', capacity: 2 }, { slotId: 'head' }] },
  { id: 'wolf', name: 'Wolf', entries: [{ slotId: 'collar' }] },
  { id: 'cat', name: 'Cat', entries: [{ slotId: 'head' }] },
  { id: 'tiny', name: 'Tiny', entries: [{ slotId: 'hand' }, { slotId: 'head' }] },
];
const sword = item('sword', 'Sword', { slotId: 'hand', statEffects: [{ id: 'e1', statId: 'strength', facet: 'value', timing: 'equipped', amount: 3, op: 'add' }] });
const dagger = item('dagger', 'Dagger', { slotId: 'hand' });
const helm = item('helm', 'Helm', { slotId: 'head' });
const items = [sword, dagger, helm];

const rexTraits = [
  trait('wolfForm', { body: sets('wolf') }), trait('catCurse', { body: sets('cat') }), trait('shrink', { body: sets('tiny') }),
  trait('ghost', { body: { pick: { kind: 'none' } } }), trait('blank', { body: {} }),
];
// Hidden acts as Automatic: on exactly while the moon is full.
const moonlit = trait('moonlit', {
  body: sets('wolf'), mode: 'hidden', requires: [{ all: [{ kind: 'stat', id: 'moon', operator: '>=', value: 10, unit: 'raw' }] }],
});
const wolfSkin = trait('wolfSkin', { body: sets('wolf') });
const catSkin = trait('catSkin', { body: sets('cat') });
const worldTraits = [moonlit, wolfSkin, catSkin];
const heroRef: PersonaRef = { source: 'world', entityId: 'hero' };
const otherRef: PersonaRef = { source: 'world', entityId: 'other' };
const entities = [
  { id: 'hero', name: 'Hero', persona: true }, { id: 'other', name: 'Other', persona: true, body: sets('cat')!.pick },
  { id: 'rex', name: 'Rex' },
];

const traitWorld = (persona: PersonaRef = heroRef): TraitWorld => ({
  traits: worldTraits, groups: [], entities, persona, items,
  global: { traits: worldTraits, groups: [] },
  owners: [
    { id: 'rex', name: 'Rex', traits: rexTraits, groups: [] }, { id: 'hero', name: 'Hero', traits: [], groups: [] },
    { id: 'other', name: 'Other', traits: [], groups: [] },
  ],
});
const settleWorld = (persona: PersonaRef = heroRef, previousPersona?: PersonaRef): InventorySettleWorld => ({
  items, traits: traitWorld(persona), entities, persona, bodies: { bodies, slots, entities },
  ...(previousPersona && { previousPersona }),
});

interface Play { copies: readonly ItemCopy[]; traits: TraitRuntimeState; ledger: ItemEffectLedger | undefined; bodies: BodyRuntime }
type Settled = Play & ReturnType<typeof settleInventory>;

const rex = { kind: 'entity', id: 'rex' } as const;
const you = { kind: 'you' } as const;

/** Rex and the hero at Strength 5, nothing on. */
const start = (): Play => ({
  copies: [],
  traits: {
    stats: seedStatBases([stat('moon', 0)]), traits: [], disabledTraitIds: [], appliedValues: {},
    entityStats: { hero: seedStatBases([stat('strength', 5)]), rex: seedStatBases([stat('strength', 5)]) },
    ownedTraits: { rex: { chosen: [] } },
  },
  ledger: undefined, bodies: {},
});

const settle = (play: Play, world = settleWorld()): Settled => {
  const settled = settleInventory({ copies: play.copies, traits: play.traits, ledger: play.ledger, bodies: play.bodies }, world);
  return { ...settled, ledger: settled.ledger };
};

/** Gains and equips `itemIds` on `to` in order, then settles. */
function wear(play: Play, to: ItemCopyWhere, ...itemIds: string[]): Settled {
  let copies = play.copies;
  let n = copies.length;
  for (const itemId of itemIds) {
    const gained = applyInventoryOps(copies, [{ kind: 'gain', itemId, quantity: 1, to }], {
      world: { items, slots, bodies, entities }, source: 'script', newId: () => `c${n++}`, persona: heroRef,
    }).copies;
    const copy = gained.find((c) => !copies.some((o) => o.id === c.id))!;
    const equip: InventoryOp = { kind: 'equip', copyId: copy.id };
    const equipped = applyInventoryOps(gained, [equip], { world: { items, slots, bodies, entities }, source: 'script', newId: () => `c${n++}`, persona: heroRef });
    expect(equipped.diagnostics).toEqual([]);
    copies = equipped.copies;
  }
  return settle({ ...play, copies });
}

/** Rex's chosen traits set to `ids`, as a switch leaves them, then settled. */
const rexOn = (play: Play, ids: string[]): Settled =>
  settle({ ...play, traits: { ...play.traits, ownedTraits: { rex: { chosen: ids } } } });

const worn = (play: Play, where: ItemCopyWhere) => play.copies
  .filter((c) => c.equipped && JSON.stringify(c.where) === JSON.stringify(where))
  .map((c) => (c.item.kind === 'item' ? c.item.itemId : '')).sort();
const strength = (play: Play, owner: string) => play.traits.entityStats![owner].find((s) => s.id === 'strength')!.value;

describe('trait Body rows', () => {
  it("changes an entity's Body, unequips what it lacks, reverses the effects exactly and fires When Unequipped", () => {
    const armed = wear(start(), rex, 'sword', 'helm');
    expect(strength(armed, 'rex')).toBe(8);
    const wolf = rexOn(armed, ['wolfForm']);
    expect(worn(wolf, rex)).toEqual([]);
    expect(strength(wolf, 'rex')).toBe(5);
    expect(wolf.bodyLog).toEqual(["Rex's Body: Wolf. Unequipped Sword, Helm"]);
    expect(wolf.events.map((e) => [e.timing, e.itemId])).toEqual([['unequipped', 'sword'], ['unequipped', 'helm']]);
    expect(wolf.bodyUnequipped).toBe(2);
    expect(wolf.copies.every((c) => c.where.kind === 'entity')).toBe(true);
  });

  it('changes the played Persona through a global trait, a Hidden one included', () => {
    const armed = wear(start(), you, 'helm');
    expect(worn(armed, you)).toEqual(['helm']);
    const full = { ...armed, traits: { ...armed.traits, stats: seedStatBases([stat('moon', 10)]) } };
    const wolf = settle(full);
    expect(wolf.traits.traits.map((t) => t.id)).toEqual(['moonlit']);
    expect(worn(wolf, you)).toEqual([]);
    expect(wolf.bodyLog).toEqual(['Body: Wolf. Unequipped Helm']);
  });

  it('lets the latest switch-on win, and unwinds in order back to the authored Body', () => {
    const cat = rexOn(start(), ['catCurse']);
    expect(cat.bodyLog).toEqual(["Rex's Body: Cat"]);
    const wolf = rexOn(cat, ['catCurse', 'wolfForm']);
    expect(wolf.bodyLog).toEqual(["Rex's Body: Wolf"]);
    expect(wolf.bodies.traitsOn).toEqual([{ ownerId: 'rex', traitId: 'catCurse' }, { ownerId: 'rex', traitId: 'wolfForm' }]);
    const back = rexOn(wolf, ['catCurse']);
    expect(back.bodyLog).toEqual(["Rex's Body: Cat"]);
    const cured = rexOn(back, []);
    expect(cured.bodyLog).toEqual(["Rex's Body: Humanoid"]);
    expect(cured.bodies.traitsOn).toBeUndefined();
  });

  it('breaks a same-commit tie by trait tree order: the later trait wins', () => {
    expect(rexOn(start(), ['catCurse', 'wolfForm']).bodyLog).toEqual(["Rex's Body: Cat"]);
    // Acquired Cat first, Wolf second, in one commit: the tree still puts Cat last.
    const both = settle({ ...start(), traits: { ...start().traits, traits: [catSkin, wolfSkin] } });
    expect(both.bodyLog).toEqual(['Body: Cat']);
  });

  it('keeps the switch-on order through a save, so a load restores the same Body', () => {
    // Switched on Cat, then Wolf: tree order alone would pick Cat.
    const wolf = rexOn(rexOn(start(), ['catCurse']), ['catCurse', 'wolfForm']);
    expect(wolf.bodyLog).toEqual(["Rex's Body: Wolf"]);
    const saved: BodyRuntime = JSON.parse(JSON.stringify(wolf.bodies));
    const loaded = settle({ ...wolf, bodies: saved });
    expect(loaded.bodyLog).toEqual([]);
    expect(loaded.bodies).toEqual(saved);
    const ending = rexOn({ ...wolf, bodies: saved }, ['catCurse']);
    expect(ending.bodyLog).toEqual(["Rex's Body: Cat"]);
  });

  it('unequips the most recently equipped copy first when a capacity drops', () => {
    const armed = wear(start(), rex, 'sword', 'dagger');
    const tiny = rexOn(armed, ['shrink']);
    expect(worn(tiny, rex)).toEqual(['sword']);
    expect(tiny.bodyLog).toEqual(["Rex's Body: Tiny. Unequipped Dagger"]);
  });

  it('logs None for a None pick, and a blank row sets no Body', () => {
    const armed = wear(start(), rex, 'helm');
    const ghost = rexOn(armed, ['ghost']);
    expect(worn(ghost, rex)).toEqual([]);
    expect(ghost.bodyLog).toEqual(["Rex's Body: None. Unequipped Helm"]);
    const blank = rexOn(armed, ['blank']);
    expect(worn(blank, rex)).toEqual(['helm']);
    expect(blank.bodyLog).toEqual([]);
    expect(blank.bodies.traitsOn).toBeUndefined();
  });

  it('settles a persona change onto the new persona\'s Body', () => {
    const armed = wear(start(), you, 'sword');
    const moved = settle(armed, settleWorld(otherRef, heroRef));
    expect(worn(moved, you)).toEqual([]);
    expect(moved.bodyLog).toEqual(['Body: Cat. Unequipped Sword']);
  });

  it('leaves Bodies alone without a Body world', () => {
    const armed = wear(start(), rex, 'helm');
    const settled = settleInventory(
      { copies: armed.copies, traits: { ...armed.traits, ownedTraits: { rex: { chosen: ['wolfForm'] } } }, ledger: armed.ledger },
      { ...settleWorld(), bodies: undefined },
    );
    expect(worn(settled, rex)).toEqual(['helm']);
    expect(settled.bodyLog).toEqual([]);
  });
});
