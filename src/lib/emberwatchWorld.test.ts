import { describe, it, expect } from 'vitest';
import raw from '@/defaultworlds/emberwatch.json?raw';
import { migrateWorld } from './version';
import { DEFAULT_WORLDS } from './defaultWorlds';
import { runRules } from './testBench/rules';
import { PLAYER_BEARER, resolveBearers, type BearerWorld } from './bearers';
import { gateOf, gateStates, settleDefaults, switchTrait } from './traitGates';
import type { Entity, PersonaRef, World } from '@/types';

// Loaded the way the seeder loads it: raw text through the world migration.
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

const bearerWorld = (w: World): BearerWorld => ({ traits: w.traits, traitGroups: w.traitGroups ?? [], entities: w.entities });
const customPersonaId = (w: World): string => {
  const marked = w.entities.find((e) => e.customPersona);
  if (!marked) throw new Error('no Custom Persona entity');
  return marked.id;
};

/** The settled default active set of one bearer under a persona choice. */
const settledDefaults = (w: World, ownerId: string, persona: PersonaRef): string[] => {
  const { gate } = resolveBearers(bearerWorld(w), persona);
  return settleDefaults(gate).active[ownerId] ?? [];
};

const names = (w: World, ids: readonly string[]) => ids.map((id) => w.traits.find((t) => t.id === id)?.name ?? id);

describe('the Emberwatch default world', () => {
  it('is listed as a bundled default before Open Chat', () => {
    const ids = DEFAULT_WORLDS.map((d) => d.id);
    expect(ids.indexOf('emberwatch')).toBeGreaterThanOrEqual(0);
    expect(ids.indexOf('emberwatch')).toBeLessThan(ids.indexOf('open-chat'));
    expect(world.worldOverview.name).toBe('Emberwatch');
    expect(world.worldOverview.tags).toContain('example');
  });

  it('runs clean on the Test Bench', () => {
    expect(runRules(world).map((f) => `${f.ruleId}: ${f.message}`)).toEqual([]);
  });

  it('teaches each feature in the readme by naming its example', () => {
    const readme = world.worldOverview.readme ?? '';
    expect(readme).toContain('## How this world is built');
    for (const label of ['Blueprints', 'Group links', 'Trait links', 'Per-link defaults', 'Blueprint pins',
      'Custom Persona', 'Persona-only', 'Same-bearer gates', 'Any-of gates', 'Named-scope gates', 'Gated defaults']) {
      expect(readme, label).toContain(`**${label}`);
    }
  });
});

describe('bearers on Emberwatch', () => {
  it('leaves Wanderer out of the cast unless picked', () => {
    const wanderer = entityNamed(world, 'Wanderer');
    expect(resolveBearers(bearerWorld(world), NONE).cast.map((e) => e.name)).not.toContain('Wanderer');
    expect(resolveBearers(bearerWorld(world), asEntity(world, 'Albus')).cast.map((e) => e.name)).not.toContain('Wanderer');
    const picked = resolveBearers(bearerWorld(world), { source: 'world', entityId: wanderer.id });
    expect(picked.bearers.find((b) => b.id === wanderer.id)?.present).toBe(true);
  });

  it('starts Albus as a Human Paladin with his racial ability on', () => {
    const albus = entityNamed(world, 'Albus');
    expect(names(world, settledDefaults(world, albus.id, NONE)).sort()).toEqual(['Human', 'Paladin', 'Stubborn Heart']);
    expect(names(world, settledDefaults(world, albus.id, asEntity(world, 'Albus'))).sort()).toEqual(['Human', 'Paladin', 'Stubborn Heart']);
  });

  it('starts Sylvie as an Elf Rogue and Hesk as a Dwarf Cleric', () => {
    expect(names(world, settledDefaults(world, entityNamed(world, 'Sylvie Thornwhistle').id, NONE)).sort())
      .toEqual(['Elf', 'Keen Senses', 'Rogue']);
    expect(names(world, settledDefaults(world, entityNamed(world, 'Mother Hesk').id, NONE)).sort()).toEqual(['Cleric', 'Dwarf']);
  });

  it("gives the player the Custom Persona entity's links under None, and a persona's own tree when played", () => {
    const cp = customPersonaId(world);
    const none = resolveBearers(bearerWorld(world), NONE);
    const root = none.bearers.find((b) => b.id === PLAYER_BEARER)!;
    expect(root.groups.map((g) => g.name)).toEqual(['Bonds']);
    expect(root.linkOf.size).toBe(0);
    const custom = none.bearers.find((b) => b.id === cp)!;
    expect(custom.isPlayer).toBe(true);
    expect(custom.present).toBe(true);
    expect(none.cast.map((e) => e.id)).not.toContain(cp);
    expect(custom.groups.map((g) => g.name)).toEqual(expect.arrayContaining(['Races', 'Classes', 'Racial Abilities', 'Class Abilities']));
    expect(custom.groups.map((g) => g.name)).not.toContain('Blueprints');
    expect(names(world, settledDefaults(world, cp, NONE)).sort()).toEqual(['Halfling', 'Lucky Step', 'Rogue']);

    const played = resolveBearers(bearerWorld(world), asEntity(world, 'Albus'));
    expect(played.bearers.find((b) => b.id === PLAYER_BEARER)!.groups.map((g) => g.name)).toEqual(['Bonds']);
    expect(played.bearers.find((b) => b.id === cp)!.present).toBe(false);
    expect(played.playerBearerIds).toEqual([PLAYER_BEARER, entityNamed(world, 'Albus').id]);
  });

  it('switches a racial ability off and on with the race', () => {
    const { gate } = resolveBearers(bearerWorld(world), asEntity(world, 'Wanderer'));
    const wanderer = entityNamed(world, 'Wanderer').id;
    const start = settleDefaults(gate);
    expect(names(world, start.active[wanderer]).sort()).toEqual(['Darkvision', 'Dwarf', 'Wizard']);
    const asElf = switchTrait({ ...gate, active: start.active }, wanderer, traitId(world, 'Elf'), start.cascadeOff)!;
    expect(names(world, asElf.active[wanderer]).sort()).toEqual(['Elf', 'Keen Senses', 'Wizard']);
  });

  it('unlocks a class ability only on a bearer whose class it names', () => {
    const { gate } = resolveBearers(bearerWorld(world), asEntity(world, 'Albus'));
    const albus = entityNamed(world, 'Albus').id;
    const states = gateStates({ ...gate, active: settleDefaults(gate).active });
    expect(gateOf(states, albus, traitId(world, 'Smite'))?.unlocked).toBe(true);
    expect(gateOf(states, albus, traitId(world, 'Firebolt'))?.unlocked).toBe(false);
    expect(gateOf(states, albus, traitId(world, 'Blessed Light'))?.unlocked).toBe(true);
    expect(gateOf(states, entityNamed(world, 'Mother Hesk').id, traitId(world, 'Blessed Light'))).toBeUndefined();
  });

  it('never offers Squire to Albus to Albus himself', () => {
    const player = (persona: PersonaRef) => resolveBearers(bearerWorld(world), persona).bearers.find((b) => b.id === PLAYER_BEARER)!;
    expect(names(world, player(asEntity(world, 'Sylvie Thornwhistle')).traits.map((t) => t.id))).toContain('Squire to Albus');
    expect(names(world, player(asEntity(world, 'Albus')).traits.map((t) => t.id))).not.toContain('Squire to Albus');
  });

  it('keeps a Custom Persona pick from unlocking a racial ability on the played persona', () => {
    // The Custom Persona entity is absent under Sylvie, so its picks (Halfling among them) gate nothing on her.
    const cp = customPersonaId(world);
    const { gate, bearers } = resolveBearers(bearerWorld(world), asEntity(world, 'Sylvie Thornwhistle'));
    expect(gate.owners.map((o) => o.id)).not.toContain(cp);
    expect(bearers.find((b) => b.id === cp)?.present).toBe(false);
    const sylvie = entityNamed(world, 'Sylvie Thornwhistle').id;
    const defaults = settleDefaults(gate).active;
    const active = { ...defaults, [cp]: [traitId(world, 'Halfling'), traitId(world, 'Rogue'), traitId(world, 'Lucky Step')] };
    const states = gateStates({ ...gate, active });
    expect(gateOf(states, sylvie, traitId(world, 'Lucky Step'))?.unlocked).toBe(false);
    expect(gateOf(states, sylvie, traitId(world, 'Keen Senses'))?.unlocked).toBe(true);
    expect(switchTrait({ ...gate, active }, sylvie, traitId(world, 'Lucky Step'))).toBeNull();
  });

  it('locks Squire to Albus when Albus stops being a Paladin', () => {
    const { gate } = resolveBearers(bearerWorld(world), NONE);
    const albus = entityNamed(world, 'Albus').id;
    const squire = traitId(world, 'Squire to Albus');
    const start = settleDefaults(gate);
    expect(gateOf(gateStates({ ...gate, active: start.active }), PLAYER_BEARER, squire)?.unlocked).toBe(true);
    const reclassed = switchTrait({ ...gate, active: start.active }, albus, traitId(world, 'Wizard'), start.cascadeOff)!;
    expect(gateOf(gateStates({ ...gate, active: reclassed.active }), PLAYER_BEARER, squire)?.unlocked).toBe(false);
  });
});
