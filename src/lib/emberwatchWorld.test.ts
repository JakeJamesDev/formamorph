import { describe, it, expect } from 'vitest';
import { bundledWorldText } from '@/test/bundledWorldFiles';
import { balanceOf, currencyStatGroups, worthText } from './currency';
import { sameWhere } from './items';
import { migrateWorld } from './version';
import { DEFAULT_WORLDS } from './defaultWorlds';
import { runRules } from './testBench/rules';
import { resolveOwners, type OwnerWorld } from './owners';
import { gateOf, gateStates, settleDefaults, switchTrait } from './traitGates';
import { syncBlueprintCopies } from './blueprintCopies';
import { copyLookup, effectiveCopy, readerFor } from './blueprints';
import { buildPlaceholderPreview, resolvePlaceholders } from './placeholders';
import { ownerPreview, inPlayOwners } from './ownedTraitsInPlay';
import { applyOwnedStatTraits, seedNewGameStats, type TraitRuntimeState, type TraitWorld } from './traitRuntime';
import { ownedTraitStatesFrom } from './ownedTraitState';
import { seedEntityStats } from './entityStats';
import { openingPool } from './openings';
import { personaStartLocation } from './personaPick';
import { visibleImages, visibleLocationImages } from './imageVisibility';
import { scoped } from './scope';
import type { GateInput, GateStatSet } from './traitGates';
import { applyInventoryOps, applyInventoryPass, seedItemCopies } from './inventory';
import { openingFold } from './openingState';
import { wantedGrants } from './inventory/grants';
import type { Entity, InventoryPassOp, ItemCopy, PersonaRef, World } from '@/types';

// The stored text through the world migration, images included: the Test Bench pass below reads them.
const raw = bundledWorldText('emberwatch');
const world: World = migrateWorld(JSON.parse(raw));
const NONE: PersonaRef = { source: 'none' };

const entityNamed = (w: World, name: string): Entity => {
  const found = w.entities.find((e) => e.name === name);
  if (!found) throw new Error(`no entity ${name}`);
  return found;
};
const traitId = (w: World, name: string): string => {
  const found = w.traits.find((t) => t.name === name);
  if (!found) throw new Error(`no trait ${name}`);
  return found.id;
};
const asEntity = (w: World, name: string): PersonaRef => ({ source: 'world', entityId: entityNamed(w, name).id });

const ownerWorld = (w: World): OwnerWorld => ({ traits: w.traits, traitGroups: w.traitGroups ?? [], entities: w.entities });
const customPersonaId = (w: World): string => {
  const marked = w.entities.find((e) => e.customPersona);
  if (!marked) throw new Error('no Custom Persona entity');
  return marked.id;
};

/** The settled default active set of one owner under a persona choice. */
const settledDefaults = (w: World, ownerId: string, persona: PersonaRef): string[] => {
  const { gate } = resolveOwners(ownerWorld(w), persona);
  return settleDefaults(gate).active.owners[ownerId] ?? [];
};

const names = (w: World, ids: readonly string[]) => ids.map((id) => w.traits.find((t) => t.id === id)?.name ?? id);

describe('the Emberwatch default world', () => {
  it('carries no retired startingLocationId, and both personas start at Emberwatch Keep through their locations', () => {
    const entities = JSON.parse(raw).entities as Record<string, unknown>[];
    expect(entities.some((e) => 'startingLocationId' in e)).toBe(false);
    const keep = world.locations.find((l) => l.name === 'Emberwatch Keep')!.id;
    for (const name of ['Albus', 'Sylvie Thornwhistle']) {
      expect(personaStartLocation(entityNamed(world, name), world.locations)).toBe(keep);
    }
  });

  it('is listed as a bundled default before Open Chat', () => {
    const ids = DEFAULT_WORLDS.map((d) => d.id);
    expect(ids.indexOf('emberwatch')).toBeGreaterThanOrEqual(0);
    expect(ids.indexOf('emberwatch')).toBeLessThan(ids.indexOf('open-chat'));
    expect(world.worldOverview.name).toBe('Emberwatch');
    expect(world.worldOverview.tags).toContain('example');
  });

  it("raises no Test Bench finding, the Founders' Pact included, since its script switches it on", () => {
    // Stored art is lossless at full size, so the size budget stays out (Q13).
    const findings = runRules(world).filter((f) => f.ruleId !== 'world-oversized-images');
    expect(findings.map((f) => `${f.ruleId}: ${f.message}`)).toEqual([]);
  });

  it('carries every copy its owners need, so the reconcile has nothing to add or take', () => {
    expect(syncBlueprintCopies({ ...ownerWorld(world), placeholders: world.placeholders ?? [], placeholderGroups: world.placeholderGroups ?? [] }))
      .toBe(world.entities);
  });

  it("gives Hesk's copies her own words on the values her class and race pin", () => {
    const hesk = entityNamed(world, 'Mother Hesk');
    const garb = world.placeholders!.find((p) => p.name === 'Class Garb')!;
    const clericPin = world.traits.find((t) => t.name === 'Cleric')!.placeholderPins![0];
    const copy = hesk.placeholders!.find((p) => p.blueprintId === garb.id)!;
    expect(copy.values).toEqual([]);
    expect(effectiveCopy(copy, garb).values.find((v) => v.id === clericPin.valueId)?.text).toMatch(/scorched gray vestments/);
    expect(hesk.playerDescription).toContain(`{{ph:${copy.id}:`);
  });

  it("reads each owner's own garb from the Class Garb chip in a class's text", () => {
    const garb = world.placeholders!.find((p) => p.name === 'Class Garb')!;
    const classText = (owner: string, className: string) => {
      const cls = world.traits.find((t) => t.name === className)!;
      const pinned = cls.placeholderPins![0].valueId;
      return resolvePlaceholders(cls.aiDescription ?? '', {
        placeholders: [...world.placeholders!, ...world.entities.flatMap((e) => e.placeholders ?? [])],
        rolls: {}, pick: (values) => values.find((v) => v.id === pinned)!.text,
        copies: copyLookup({ placeholders: world.placeholders!, entities: world.entities }, readerFor(undefined, entityNamed(world, owner), false)),
      });
    };
    expect(classText('Mother Hesk', 'Cleric')).toMatch(/wears scorched gray vestments/);
    expect(classText('Albus', 'Paladin')).toContain(`wears ${garb.values[0].text}`);
  });

  it("previews a class's text as each owner's: its name, its copy and its class's pin", () => {
    const shared = world.placeholders ?? [];
    const all = [...shared, ...world.entities.flatMap((e) => e.placeholders ?? [])];
    const previewAs = (owner: string, trait: string) => {
      const entity = entityNamed(world, owner);
      const text = world.traits.find((t) => t.name === trait)!.aiDescription!;
      const as = ownerPreview(ownerWorld(world), shared, all, entity.id, traitId(world, trait))!;
      const values = buildPlaceholderPreview(text, all, (vs) => vs[vs.length - 1].text, undefined, entity.name, as);
      return Object.entries(values).reduce((out, [token, value]) => out.split(token).join(value), text);
    };
    expect(previewAs('Albus', 'Paladin')).toMatch(/^Albus is a paladin.*Albus wears white tabard and mail/);
    expect(previewAs('Mother Hesk', 'Cleric')).toMatch(/Mother Hesk wears scorched gray vestments/);
    // Wanderer starts a Wizard; the Paladin being viewed outranks its exclusive sibling.
    expect(previewAs('Wanderer', 'Paladin')).toMatch(/Wanderer wears white tabard and mail/);
    expect(previewAs('Mother Hesk', 'Dwarf')).toMatch(/Mother Hesk has the iron-gray braids/);
  });

  it('teaches each feature in the readme by naming its example', () => {
    const readme = world.worldOverview.readme ?? '';
    expect(readme).toContain('## How this world is built');
    for (const label of ['Blueprints', 'Group links', 'Trait links', 'Per-link defaults', 'Link overrides', 'Blueprint pins', 'Blueprint chips',
      'Custom Persona', 'Persona-only', 'Same-owner gates', 'Any-of gates', 'Named-scope gates', 'Gated defaults', 'Lorebook', 'Self openings',
      'Script control of lore', 'Relationship labels', 'Rolled label', 'Known In', 'Random presence']) {
      expect(readme, label).toContain(`**${label}`);
    }
  });
});

describe('the Emberwatch map', () => {
  const at = (name: string) => world.locations.find((l) => l.name === name)!.canvasPosition!;

  it('places every location on the canvas', () => {
    expect(world.locations.filter((l) => !l.canvasPosition).map((l) => l.name)).toEqual([]);
  });

  it('runs north from the river to the barrow, with the road far to the west', () => {
    const southToNorth = ['Riverside Market', 'Ashford Square', 'Emberwatch Keep', 'The Boundary Wall', 'The Barrow Beyond the Wall'];
    const ys = southToNorth.map((name) => at(name).y);
    expect(ys).toEqual([...ys].sort((a, b) => b - a));
    expect(at('The Cinder and Crown').x).toBeLessThan(at('Ashford Square').x);
    expect(at('Chapel of the Ember').x).toBeGreaterThan(at('Ashford Square').x);
    expect(at('The Old Watchtower').x).toBeLessThan(at('Emberwatch Keep').x);
    expect(at('The Frontier Road').x).toBeLessThan(at('The Old Watchtower').x);
  });
});

describe('openings on Emberwatch', () => {
  const start = world.locations.find((l) => l.isStarting)!.id;
  const poolAs = (persona: PersonaRef) => {
    const played = persona.source === 'world' ? world.entities.find((e) => e.id === persona.entityId)! : null;
    return openingPool({
      overview: world.worldOverview,
      entities: resolveOwners(ownerWorld(world), persona).cast,
      locations: world.locations,
      startingLocationId: start,
      persona: played ? { entity: played, source: 'world' } : null,
      customPersona: entityNamed(world, 'Wanderer'),
    });
  };

  it("draws the world's own openings under None", () => {
    expect(poolAs(NONE).map((e) => e.ownerId)).toEqual(world.worldOverview.openings!.map(() => null));
    expect(poolAs(NONE).length).toBeGreaterThan(1);
  });

  it.each(['Albus', 'Sylvie Thornwhistle'])('draws only %s\'s own opening while the player plays them', (name) => {
    const own = entityNamed(world, name);
    expect(poolAs(asEntity(world, name)).map((e) => [e.ownerId, e.opening.self])).toEqual([[own.id, true]]);
  });
});

describe('owners on Emberwatch', () => {
  it('makes Wanderer the Custom Persona entity, out of the cast either way', () => {
    expect(customPersonaId(world)).toBe(entityNamed(world, 'Wanderer').id);
    expect(resolveOwners(ownerWorld(world), NONE).cast.map((e) => e.name)).not.toContain('Wanderer');
    expect(resolveOwners(ownerWorld(world), asEntity(world, 'Albus')).cast.map((e) => e.name)).not.toContain('Wanderer');
  });

  it("gives Albus's Paladin more Faith than the blueprint's, and nobody else's", () => {
    const faith = (persona: PersonaRef, owner: string) => resolveOwners(ownerWorld(world), persona).owners
      .find((b) => b.name === owner)!.traits.find((t) => t.name === 'Paladin')!.statChanges;
    expect(faith(NONE, 'Albus')).toEqual([{ statId: 'faith', value: 40, type: 'max' }]);
    expect(faith(NONE, 'Sylvie Thornwhistle')).toEqual([{ statId: 'faith', value: 30, type: 'max' }]);
    expect(faith(NONE, 'Wanderer')).toEqual([{ statId: 'faith', value: 30, type: 'max' }]);
  });

  it('starts Albus as a Human Paladin with his racial ability on', () => {
    const albus = entityNamed(world, 'Albus');
    expect(names(world, settledDefaults(world, albus.id, NONE)).sort()).toEqual(['Human', 'Paladin', 'Stubborn Heart']);
    expect(names(world, settledDefaults(world, albus.id, asEntity(world, 'Albus'))).sort()).toEqual(['Human', 'Paladin', 'Stubborn Heart']);
  });

  it("starts Hesk's and Corvin's race and class on their own stats, never the global ones", () => {
    const hesk = entityNamed(world, 'Mother Hesk').id;
    const corvin = entityNamed(world, 'Corvin Vale').id;
    const picks = { [hesk]: settledDefaults(world, hesk, NONE), [corvin]: settledDefaults(world, corvin, NONE) };
    const tw: TraitWorld = {
      traits: world.traits, groups: world.traitGroups ?? [], entities: world.entities, persona: NONE, ...inPlayOwners(ownerWorld(world), NONE),
    };
    const seeded: TraitRuntimeState = {
      stats: seedNewGameStats(world.stats), traits: [], disabledTraitIds: [], appliedValues: {},
      ownedTraits: ownedTraitStatesFrom(picks), entityStats: seedEntityStats(world.entities),
    };
    const started = applyOwnedStatTraits(seeded, tw);
    const own = (owner: string, id: string) => started.entityStats![owner].find((s) => s.id === id)!;
    // Dwarf +10 max Health and Cleric +30 max Faith on Hesk; Human +10 Renown and Wizard +30 max Mana on Corvin.
    expect(own(hesk, 'health')).toMatchObject({ max: 110, value: 110 });
    expect(own(hesk, 'faith')).toMatchObject({ max: 130, value: 70 });
    expect(own(corvin, 'renown')).toMatchObject({ max: 100, value: 35 });
    expect(own(corvin, 'mana')).toMatchObject({ max: 130, value: 50 });
    expect(started.stats).toEqual(seeded.stats);
  });

  it('starts Sylvie as an Elf Rogue and Hesk as a Dwarf Cleric', () => {
    expect(names(world, settledDefaults(world, entityNamed(world, 'Sylvie Thornwhistle').id, NONE)).sort())
      .toEqual(['Elf', 'Keen Senses', 'Rogue']);
    expect(names(world, settledDefaults(world, entityNamed(world, 'Mother Hesk').id, NONE)).sort()).toEqual(['Cleric', 'Darkvision', 'Dwarf']);
  });

  it("gives the player the Custom Persona entity's links under None, and a persona's own tree when played", () => {
    const cp = customPersonaId(world);
    const none = resolveOwners(ownerWorld(world), NONE);
    expect(none.global.groups.map((g) => g.name)).toEqual(['Bonds']);
    const custom = none.owners.find((b) => b.id === cp)!;
    expect(custom.isPlayer).toBe(true);
    expect(custom.present).toBe(true);
    expect(none.cast.map((e) => e.id)).not.toContain(cp);
    expect(custom.groups.map((g) => g.name)).toEqual(expect.arrayContaining(['Races', 'Classes', 'Racial Abilities', 'Class Abilities']));
    expect(custom.groups.map((g) => g.name)).not.toContain('Blueprints');
    expect(names(world, settledDefaults(world, cp, NONE)).sort()).toEqual(['Halfling', 'Lucky Step', 'Wizard']);

    const played = resolveOwners(ownerWorld(world), asEntity(world, 'Albus'));
    expect(played.global.groups.map((g) => g.name)).toEqual(['Bonds']);
    expect(played.owners.find((b) => b.id === cp)!.present).toBe(false);
    expect(played.playedIds).toEqual([entityNamed(world, 'Albus').id]);
  });

  it('switches a racial ability off and on with the race', () => {
    const { gate } = resolveOwners(ownerWorld(world), NONE);
    const wanderer = entityNamed(world, 'Wanderer').id;
    const start = settleDefaults(gate);
    expect(names(world, start.active.owners[wanderer]).sort()).toEqual(['Halfling', 'Lucky Step', 'Wizard']);
    const asElf = switchTrait({ ...gate, active: start.active }, wanderer, traitId(world, 'Elf'), start.cascadeOff)!;
    expect(names(world, asElf.active.owners[wanderer]).sort()).toEqual(['Elf', 'Keen Senses', 'Wizard']);
  });

  it('unlocks a class ability only on an owner whose class it names', () => {
    const { gate } = resolveOwners(ownerWorld(world), asEntity(world, 'Albus'));
    const albus = entityNamed(world, 'Albus').id;
    const states = gateStates({ ...gate, active: settleDefaults(gate).active });
    expect(gateOf(states, albus, traitId(world, 'Smite'))?.unlocked).toBe(true);
    expect(gateOf(states, albus, traitId(world, 'Firebolt'))?.unlocked).toBe(false);
    expect(gateOf(states, albus, traitId(world, 'Blessed Light'))?.unlocked).toBe(true);
    expect(gateOf(states, entityNamed(world, 'Mother Hesk').id, traitId(world, 'Blessed Light'))).toBeUndefined();
  });

  it('never offers Squire to Albus to Albus himself', () => {
    const globalOf = (persona: PersonaRef) => resolveOwners(ownerWorld(world), persona).global;
    expect(names(world, globalOf(asEntity(world, 'Sylvie Thornwhistle')).traits.map((t) => t.id))).toContain('Squire to Albus');
    expect(names(world, globalOf(asEntity(world, 'Albus')).traits.map((t) => t.id))).not.toContain('Squire to Albus');
  });

  it('keeps a Custom Persona pick from unlocking a racial ability on the played persona', () => {
    // The Custom Persona entity is absent under Sylvie, so its picks (Halfling among them) gate nothing on her.
    const cp = customPersonaId(world);
    const { gate, owners } = resolveOwners(ownerWorld(world), asEntity(world, 'Sylvie Thornwhistle'));
    expect(gate.owners.map((o) => o.id)).not.toContain(cp);
    expect(owners.find((b) => b.id === cp)?.present).toBe(false);
    const sylvie = entityNamed(world, 'Sylvie Thornwhistle').id;
    const defaults = settleDefaults(gate).active;
    const active = { ...defaults, owners: { ...defaults.owners, [cp]: [traitId(world, 'Halfling'), traitId(world, 'Rogue'), traitId(world, 'Lucky Step')] } };
    const states = gateStates({ ...gate, active });
    expect(gateOf(states, sylvie, traitId(world, 'Lucky Step'))?.unlocked).toBe(false);
    expect(gateOf(states, sylvie, traitId(world, 'Keen Senses'))?.unlocked).toBe(true);
    expect(switchTrait({ ...gate, active }, sylvie, traitId(world, 'Lucky Step'))).toBeNull();
  });

  it('locks Squire to Albus when Albus stops being a Paladin', () => {
    const { gate } = resolveOwners(ownerWorld(world), NONE);
    const albus = entityNamed(world, 'Albus').id;
    const squire = traitId(world, 'Squire to Albus');
    const start = settleDefaults(gate);
    expect(gateOf(gateStates({ ...gate, active: start.active }), null, squire)?.unlocked).toBe(true);
    const reclassed = switchTrait({ ...gate, active: start.active }, albus, traitId(world, 'Wizard'), start.cascadeOff)!;
    expect(gateOf(gateStates({ ...gate, active: reclassed.active }), null, squire)?.unlocked).toBe(false);
  });
});

describe('the Emberwatch Visibility rules', () => {
  // Play's gate input under `persona`, with one owner's stat at the given value on its effective max.
  const statAt = (persona: PersonaRef, ownerId: string, stat: { id: string; name: string }, value: number, max = 100): GateInput => {
    const { gate } = resolveOwners(ownerWorld(world), persona);
    const set: GateStatSet = { [stat.id]: { name: stat.name, value, min: 0, max } };
    return { ...gate, active: settleDefaults(gate).active, stats: scoped<GateStatSet>({}, { [ownerId]: set }) };
  };
  const faith = { id: 'faith', name: 'Faith' };
  const chapel = world.locations.find((l) => l.name === 'Chapel of the Ember')!;
  const chapelSlots = (persona: PersonaRef, ownerId: string, value: number, max?: number) =>
    visibleLocationImages(chapel, statAt(persona, ownerId, faith, value, max)).map((image) => image.slot);

  it("lights the Chapel's brazier once the played persona's Faith reaches 70 percent", () => {
    const wanderer = customPersonaId(world);
    expect(chapelSlots(NONE, wanderer, 69)).toEqual([0]);
    expect(chapelSlots(NONE, wanderer, 70)).toEqual([1]);
  });

  it("reads the Chapel's threshold as a share of a Paladin's larger Faith", () => {
    const albus = entityNamed(world, 'Albus').id;
    expect(chapelSlots(asEntity(world, 'Albus'), albus, 97, 140)).toEqual([0]);
    expect(chapelSlots(asEntity(world, 'Albus'), albus, 98, 140)).toEqual([1]);
  });

  it('shows Mother Hesk wounded once her own Health falls below 40 percent', () => {
    const hesk = entityNamed(world, 'Mother Hesk');
    const slots = (health: number) =>
      visibleImages(hesk, statAt(NONE, hesk.id, { id: 'health', name: 'Health' }, health)).map((image) => image.slot);
    expect(slots(40)).toEqual([0]);
    expect(slots(39)).toEqual([1]);
  });
});

describe('the Emberwatch items', () => {
  const items = world.items ?? [];
  const itemNamed = (name: string) => {
    const found = items.find((item) => item.name === name);
    if (!found) throw new Error(`no item ${name}`);
    return found;
  };
  const seeded = (persona: PersonaRef) => {
    let next = 0;
    return seedItemCopies(world, persona, () => `copy-${(next += 1)}`);
  };
  const copiesOf = (copies: readonly ItemCopy[], name: string) => copies.filter((copy) => copy.item.kind === 'item' && copy.item.itemId === itemNamed(name).id);

  it('lists a Blueprint stat once in the Currency stat picker', () => {
    const groups = currencyStatGroups({ stats: world.stats, statGroups: world.statGroups ?? [], entities: world.entities });
    const ids = groups.flatMap((group) => group.stats.map((stat) => stat.id));
    expect(ids.filter((id) => id === 'faith')).toEqual(['faith']);
    expect(new Set(ids).size).toBe(ids.length);
  });

  describe('its money', () => {
    const currencies = world.currencies ?? [];
    const coinCurrency = currencies[0];
    const albus = entityNamed(world, 'Albus');
    const jory = { kind: 'entity', id: entityNamed(world, 'Jory Pike').id } as const;
    const bram = { kind: 'entity', id: entityNamed(world, 'Bram Oakes').id } as const;
    const you = { kind: 'you' } as const;
    const amountAt = (copies: readonly ItemCopy[], owner: typeof you | typeof jory) =>
      balanceOf(coinCurrency, owner, { copies, placements: world.placements ?? [], globalStats: [], statsOf: () => [] });
    const quantityAt = (copies: readonly ItemCopy[], name: string, where: ItemCopy['where']) => copiesOf(copies, name)
      .filter((copy) => sameWhere(copy.where, where)).reduce((sum, copy) => sum + copy.quantity, 0);

    /** One Inventory pass reply over a game Albus plays. */
    const settle = (copies: ItemCopy[], op: Pick<InventoryPassOp, 'item' | 'owner' | 'to'> & Partial<InventoryPassOp>) => {
      let next = 0;
      return applyInventoryPass(copies, [{ op: 'buy', quantity: 1, ...op }], {
        items, runtimeItems: [], playerNames: [albus.name], owners: world.entities.map(({ id, name }) => ({ id, name })),
        location: { id: world.locations[0].id, name: world.locations[0].name },
        money: {
          currencies, placements: world.placements ?? [], stats: { globalStats: [], entityStats: {} }, playedIds: [albus.id], statsOn: (_owner, stats) => stats,
        },
      }, { world: { items }, newId: () => `bought-${(next += 1)}`, persona: asEntity(world, 'Albus') }).copies;
    };
    /** Albus's starting game, carrying one grave good to sell. */
    const withCup = (): ItemCopy[] => [
      ...seeded(asEntity(world, 'Albus')),
      { id: 'cup', item: { kind: 'item', itemId: itemNamed('Gold Burial Cup').id }, where: you, quantity: 1, visibility: 'visible' },
    ];

    it('has one coin Currency of Copper, Silver and Gold', () => {
      expect(currencies).toHaveLength(1);
      expect(coinCurrency.backing).toEqual({
        kind: 'coins',
        coins: [['Copper', 1], ['Silver', 10], ['Gold', 100]].map(([name, worth]) => ({ itemId: itemNamed(String(name)).id, worth })),
      });
      for (const name of ['Copper', 'Silver', 'Gold']) expect(itemNamed(name).stackable).toBe(true);
    });

    it('prices every priced item in the coin Currency, and reads a price as coins', () => {
      const priced = items.filter((item) => item.value !== undefined);
      expect(priced.length).toBeGreaterThan(0);
      for (const item of priced) expect(item.currencyId, item.name).toBe(coinCurrency.id);
      expect(worthText(itemNamed('Healing Draught'), currencies, items)).toBe('6 Silver');
      expect(worthText(itemNamed('Cold Iron Dagger'), currencies, items)).toBe('1 Gold, 5 Silver');
    });

    it('leaves no reference to a Gold stat', () => {
      const stored = JSON.parse(raw) as World;
      // Every string in the file: ids and descriptors by their value, and any script, Tool's included, by a read of the stat.
      const found: string[] = [];
      JSON.stringify(stored, (key, value: unknown) => {
        if (typeof value === 'string' && /^gold(_\d+)?$|stats(\.Gold|\[['"]Gold)/.test(value)) found.push(`${key}: ${value.slice(0, 80)}`);
        return value;
      });
      expect(found).toEqual([]);
      expect(stored.stats.map((stat) => stat.name)).not.toContain('Gold');
      const { readme, introReadme } = stored.worldOverview;
      for (const text of [readme, introReadme]) expect(text).not.toMatch(/\*\*Gold\*\* (and|pays)|more Gold|Gold stat/);
    });

    it('buys a real shop item from a starting purse, through the buy op', () => {
      const start = seeded(asEntity(world, 'Albus'));
      expect(amountAt(start, you)).toEqual({ tracked: true, amount: 300 });
      const after = settle(start, { item: 'Cold Iron Dagger', owner: 'Bram Oakes', to: 'you' });
      expect(amountAt(after, you)).toEqual({ tracked: true, amount: 150 });
      expect(quantityAt(after, 'Cold Iron Dagger', you)).toBe(1);
      expect(quantityAt(after, 'Cold Iron Dagger', bram)).toBe(1);
    });

    it('refuses a shop item past the purse, and moves nothing', () => {
      const start = seeded(asEntity(world, 'Albus'));
      expect(settle(start, { item: 'Cold Iron Sword', owner: 'Bram Oakes', to: 'you' })).toEqual(start);
    });

    it('lets Jory Pike buy within his purse', () => {
      const after = settle(withCup(), { item: 'Gold Burial Cup', owner: 'you', to: 'Jory Pike', price: '1 Gold' });
      expect(amountAt(after, you)).toEqual({ tracked: true, amount: 400 });
      expect(amountAt(after, jory)).toEqual({ tracked: true, amount: 3150 });
      expect(quantityAt(after, 'Gold Burial Cup', jory)).toBe(1);
    });

    it('refuses a sale to Jory Pike past his purse, and moves nothing', () => {
      const start = withCup();
      expect(amountAt(start, jory)).toEqual({ tracked: true, amount: 3250 });
      expect(settle(start, { item: 'Gold Burial Cup', owner: 'you', to: 'Jory Pike', price: '33 Gold' })).toEqual(start);
    });
  });

  it('points every effect, requirement, slot and placement at something the world has', () => {
    const slotIds = new Set((world.slots ?? []).map((slot) => slot.id));
    const statIds = new Set(world.stats.map((stat) => stat.id));
    const traitIds = new Set(world.traits.map((trait) => trait.id));
    for (const item of items) {
      for (const slotId of item.slotRule?.slotIds ?? []) expect(slotIds).toContain(slotId);
      if (item.currencyId !== undefined) expect((world.currencies ?? []).map((currency) => currency.id)).toContain(item.currencyId);
      for (const row of item.statEffects) expect(statIds).toContain(row.statId);
      for (const row of item.traitEffects) expect(traitIds).toContain(row.traitId);
      for (const row of item.equipRequires) for (const condition of row.all) expect(traitIds).toContain(condition.id);
    }
    const placed = new Set([...world.entities, ...world.locations].map((owner) => owner.id));
    for (const placement of world.placements ?? []) {
      expect(items.map((item) => item.id)).toContain(placement.source.itemId);
      if (placement.where.kind !== 'you') expect(placed).toContain(placement.where.id);
    }
  });

  it('starts the played persona with a draught and a full lantern, and hides the barrow finds', () => {
    const copies = seeded(asEntity(world, 'Albus'));
    expect(copiesOf(copies, 'Healing Draught').find((copy) => copy.where.kind === 'you')?.quantity).toBe(1);
    expect(copiesOf(copies, 'Hooded Lantern').filter((copy) => copy.where.kind === 'you')).toMatchObject([{ state: { uses: 3 } }]);
    expect(copiesOf(copies, 'Hooded Lantern').filter((copy) => copy.where.kind === 'location')).toHaveLength(2);
    expect(copiesOf(copies, 'Cold Iron Sword')).toHaveLength(2);
    const hall = world.locations.find((l) => l.name === 'The Hall of Shields')!.id;
    expect(copiesOf(copies, "Old King's Coin").filter((copy) => copy.where.kind === 'location' && copy.where.id === hall))
      .toMatchObject([{ quantity: 12, visibility: 'hidden' }]);
    expect(copiesOf(copies, "Haldren's Crown, Lower Half")).toMatchObject([{ visibility: 'hidden' }]);
    expect(copiesOf(copies, "Haldren's Crown, Upper Half")).toMatchObject([{ where: { kind: 'entity', id: entityNamed(world, 'The Barrow Wight').id } }]);
  });

  const carriedNames = (copies: readonly ItemCopy[], where: ItemCopy['where']) => copies
    .filter((copy) => copy.item.kind === 'item' && JSON.stringify(copy.where) === JSON.stringify(where))
    .map((copy) => items.find((item) => copy.item.kind === 'item' && item.id === copy.item.itemId)!.name);

  it("lands each hero's own gear on the player only while that hero is played", () => {
    const you = { kind: 'you' } as const;
    expect(carriedNames(seeded(asEntity(world, 'Albus')), you))
      .toEqual(expect.arrayContaining(["Oath-Keeper's Shield", 'Steel Longsword', 'Ember Holy Symbol']));
    expect(carriedNames(seeded(asEntity(world, 'Sylvie Thornwhistle')), you))
      .toEqual(expect.arrayContaining(['Elf-Steel Dagger', 'Lockpick Roll']));
    expect(carriedNames(seeded(NONE), you)).toEqual(expect.arrayContaining(['Walking Staff', 'Oilskin Cloak', 'Road Rations']));

    // Under Sylvie, Albus stays in the cast with his gear, and Wanderer's gear never enters the game.
    const asSylvie = seeded(asEntity(world, 'Sylvie Thornwhistle'));
    expect(carriedNames(asSylvie, you)).not.toContain("Oath-Keeper's Shield");
    expect(carriedNames(asSylvie, { kind: 'entity', id: entityNamed(world, 'Albus').id })).toContain("Oath-Keeper's Shield");
    expect(copiesOf(asSylvie, 'Walking Staff')).toEqual([]);
  });

  it('hides the finds the story must reveal, and leaves the plain ones in view', () => {
    const copies = seeded(NONE);
    for (const name of ['Brass Spyglass', 'Sealed Letter', 'Beer-Stained Barrow Map', "Oath Ring of the King's Guard", "Maelis's Ward Scroll", 'Gold Burial Cup']) {
      expect(copiesOf(copies, name).map((copy) => copy.visibility), name).toEqual(expect.arrayContaining(['hidden']));
      expect(copiesOf(copies, name).every((copy) => copy.where.kind === 'location'), name).toBe(true);
    }
    for (const name of ['Flask of Lamp Oil', "Rusted Guard's Shield"]) {
      expect(copiesOf(copies, name).every((copy) => copy.visibility === 'visible'), name).toBe(true);
    }
  });

  it('seeds the ring and the scroll unidentified, and the letter sealed', () => {
    const copies = seeded(NONE);
    expect(copiesOf(copies, "Oath Ring of the King's Guard")).toMatchObject([{ state: { unidentified: true } }]);
    expect(copiesOf(copies, "Maelis's Ward Scroll")).toMatchObject([{ state: { unidentified: true } }]);
    expect(copiesOf(copies, 'Sealed Letter')).toMatchObject([{ state: { state: 'sealed' } }]);
    expect(itemNamed('Sealed Letter').whenEmpty).toEqual({ kind: 'changesState', state: 'opened' });
  });

  it('gives a human Paladin Darkvision only while the lantern is equipped', () => {
    const persona = asEntity(world, 'Albus');
    const lantern = copiesOf(seeded(persona), 'Hooded Lantern')[0];
    const grantWorld = {
      items: new Map(items.map((item) => [item.id, item])), owners: resolveOwners(ownerWorld(world), persona).gate.owners,
      persona, entities: world.entities,
    };
    const darkvision = traitId(world, 'Darkvision');
    const albus = entityNamed(world, 'Albus').id;
    const equipped = { ...lantern, equipped: { slotId: itemNamed('Hooded Lantern').slotRule!.slotIds[0], order: 1 } };
    expect(wantedGrants([lantern], grantWorld).held[albus] ?? []).not.toContain(darkvision);
    expect(wantedGrants([equipped], grantWorld).held[albus]).toContain(darkvision);
  });

  describe('Bodies and starting gear', () => {
    const hands = (world.slots ?? []).filter((slot) => slot.name.endsWith('Hand'));
    it('splits hands into Main Hand and Off Hand on the Humanoid only', () => {
      expect(hands.map((slot) => slot.name)).toEqual(['Main Hand', 'Off Hand']);
      const entriesOf = (name: string) => world.bodies?.find((b) => b.name === name)?.entries ?? [];
      const [mainHand, offHand] = entriesOf('Humanoid').slice(0, 2);
      expect([mainHand, offHand].map((entry) => entry.slotId)).toEqual(hands.map((slot) => slot.id));
      expect(entriesOf('Hound').some((e) => hands.some((slot) => slot.id === e.slotId))).toBe(false);
    });

    it('lays every Body box on its outline, with the two hands mirrored around the midline', () => {
      const bodies = world.bodies ?? [];
      expect(bodies.map((body) => body.backdrop?.kind)).toEqual(['humanoid', 'quadruped']);
      const defaultCenter = (box: { x: number; y: number; w: number; h: number }) =>
        Math.abs(box.x + box.w / 2 - 0.5) < 1e-9 && Math.abs(box.y + box.h / 2 - 0.5) < 1e-9;
      expect(bodies.flatMap((body) => body.entries.flatMap((entry) => entry.boxes)).some(defaultCenter)).toBe(false);
      const [main, off] = bodies[0].entries.slice(0, 2).map((entry) => entry.boxes[0]);
      expect(main.x + main.w / 2 + (off.x + off.w / 2)).toBeCloseTo(1, 9);
      expect([off.y, off.w, off.h]).toEqual([main.y, main.w, main.h]);
    });

    it('takes both hands with the Spiral-Cut Staff, unequipping what they hold', () => {
      const staff = itemNamed('Spiral-Cut Staff');
      expect(staff.slotRule).toEqual({ mode: 'all', slotIds: hands.map((slot) => slot.id) });
      const owner = { kind: 'entity', id: entityNamed(world, 'Albus').id } as const;
      const copyOf = (id: string, itemId: string) => ({ id, item: { kind: 'item', itemId } as const, where: owner, quantity: 1, visibility: 'visible' as const });
      const { copies, diagnostics } = applyInventoryOps(
        [copyOf('sword', itemNamed('Steel Longsword').id), copyOf('shield', itemNamed("Oath-Keeper's Shield").id), copyOf('staff', staff.id)],
        [{ kind: 'equip', copyId: 'sword' }, { kind: 'equip', copyId: 'shield' }, { kind: 'equip', copyId: 'staff' }],
        { world: { items, slots: world.slots, bodies: world.bodies, entities: world.entities }, source: 'panel', newId: () => 'new' },
      );
      expect(diagnostics).toEqual([]);
      expect(copies.filter((c) => c.equipped).map((c) => c.id)).toEqual(['staff']);
    });

    it('prefers the off hand for a held light or shield, and the main hand for a blade', () => {
      const first = (name: string) => (world.slots ?? []).find((slot) => slot.id === itemNamed(name).slotRule?.slotIds[0])?.name;
      expect(first('Hooded Lantern')).toBe('Off Hand');
      expect(first("Oath-Keeper's Shield")).toBe('Off Hand');
      expect(first('Steel Longsword')).toBe('Main Hand');
    });

    /** A new game as Enter World leaves it: every owner on its settled default traits. */
    const opened = (persona: PersonaRef) => {
      const owned = Object.fromEntries(world.entities.map((entity) => [entity.id, settledDefaults(world, entity.id, persona)]));
      return openingFold(world, { traits: [], owned }, { ref: persona }).state.itemCopies ?? [];
    };
    /** What one owner wears; 'You' is the played persona, whose own gear lands on the player. */
    const wornBy = (copies: readonly ItemCopy[], ownerName: string) => copies
      .filter((copy) => copy.equipped && (ownerName === 'You'
        ? copy.where.kind === 'you'
        : copy.where.kind === 'entity' && copy.where.id === entityNamed(world, ownerName).id))
      .map((copy) => items.find((item) => copy.item.kind === 'item' && item.id === copy.item.itemId)!.name)
      .sort();

    it('gives the Grave Hounds the Hound Body and every other entity the Default', () => {
      const bodies = world.bodies ?? [];
      const hound = bodies.find((body) => body.name === 'Hound')!;
      expect(bodies[0].name).toBe('Humanoid');
      expect(hound.entries.map((entry) => world.slots!.find((slot) => slot.id === entry.slotId)!.name)).toEqual(['Neck', 'Body']);
      expect(entityNamed(world, 'Grave Hounds').body).toEqual({ kind: 'body', id: hound.id });
      expect(world.entities.filter((entity) => entity.body).map((entity) => entity.name)).toEqual(['Grave Hounds']);
    });

    it('opens with every marked placement worn, none refused, under Albus', () => {
      const copies = opened(asEntity(world, 'Albus'));
      expect(wornBy(copies, 'You')).toEqual(['Ember Holy Symbol', "Oath-Keeper's Shield", 'Steel Longsword']);
      expect(wornBy(copies, 'Mother Hesk')).toEqual(['Ember Holy Symbol']);
      expect(wornBy(copies, 'Corvin Vale')).toEqual(['Folding Cane-Staff']);
      expect(wornBy(copies, 'Sylvie Thornwhistle')).toEqual(['Elf-Steel Dagger']);
      expect(wornBy(copies, 'The Barrow Wight')).toEqual(["Haldren's Crown, Upper Half"]);
      // Every Equipped placement on a cast member ends up worn: the opening refused none.
      const marked = (world.placements ?? []).filter((placement) => placement.equipped && placement.where.kind === 'entity');
      for (const placement of marked) {
        const owner = world.entities.find((entity) => placement.where.kind === 'entity' && entity.id === placement.where.id)!;
        if (owner.name === 'Wanderer' || owner.name === 'Albus') continue;
        expect(wornBy(copies, owner.name), owner.name).toContain(items.find((item) => item.id === placement.source.itemId)!.name);
      }
    });

    it('opens the Wanderer in its staff and cloak, and leaves Bram Oakes carrying his stock', () => {
      const copies = opened(NONE);
      expect(wornBy(copies, 'You')).toEqual(['Oilskin Cloak', 'Walking Staff']);
      expect(wornBy(copies, 'Bram Oakes')).toEqual([]);
    });
  });
});
