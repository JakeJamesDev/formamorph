import { describe, it, expect } from 'vitest';
import { bundledWorldText } from '@/test/bundledWorldFiles';
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
import type { Entity, PersonaRef, World } from '@/types';

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
