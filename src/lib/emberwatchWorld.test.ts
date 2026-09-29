import { describe, it, expect } from 'vitest';
import raw from '@/defaultworlds/emberwatch.json?raw';
import { migrateWorld } from './version';
import { DEFAULT_WORLDS } from './defaultWorlds';
import { runRules } from './testBench/rules';
import { PLAYER_BEARER, resolveBearers, type BearerWorld } from './bearers';
import { gateOf, gateStates, settleDefaults, switchTrait } from './traitGates';
import { syncBlueprintCopies } from './blueprintCopies';
import { copyLookup, effectiveCopy, readerFor } from './blueprints';
import { buildPlaceholderPreview, resolvePlaceholders } from './placeholders';
import { bearerPreview } from './ownedTraitsInPlay';
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

  it('carries every copy its bearers need, so the reconcile has nothing to add or take', () => {
    expect(syncBlueprintCopies({ ...bearerWorld(world), placeholders: world.placeholders ?? [], placeholderGroups: world.placeholderGroups ?? [] }))
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

  it("reads each bearer's own garb from the Class Garb chip in a class's text", () => {
    const garb = world.placeholders!.find((p) => p.name === 'Class Garb')!;
    const classText = (bearer: string, className: string) => {
      const cls = world.traits.find((t) => t.name === className)!;
      const pinned = cls.placeholderPins![0].valueId;
      return resolvePlaceholders(cls.aiDescription ?? '', {
        placeholders: [...world.placeholders!, ...world.entities.flatMap((e) => e.placeholders ?? [])],
        rolls: {}, pick: (values) => values.find((v) => v.id === pinned)!.text,
        copies: copyLookup({ placeholders: world.placeholders!, entities: world.entities }, readerFor(undefined, entityNamed(world, bearer), false)),
      });
    };
    expect(classText('Mother Hesk', 'Cleric')).toMatch(/wears scorched gray vestments/);
    expect(classText('Albus', 'Paladin')).toContain(`wears ${garb.values[0].text}`);
  });

  it("previews a class's text as each bearer's: its name, its copy and its class's pin", () => {
    const shared = world.placeholders ?? [];
    const all = [...shared, ...world.entities.flatMap((e) => e.placeholders ?? [])];
    const previewAs = (bearer: string, trait: string) => {
      const entity = entityNamed(world, bearer);
      const text = world.traits.find((t) => t.name === trait)!.aiDescription!;
      const as = bearerPreview(bearerWorld(world), shared, all, entity.id, traitId(world, trait))!;
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
      'Custom Persona', 'Persona-only', 'Same-bearer gates', 'Any-of gates', 'Named-scope gates', 'Gated defaults']) {
      expect(readme, label).toContain(`**${label}`);
    }
  });
});

describe('bearers on Emberwatch', () => {
  it('makes Wanderer the Custom Persona entity, out of the cast either way', () => {
    expect(customPersonaId(world)).toBe(entityNamed(world, 'Wanderer').id);
    expect(resolveBearers(bearerWorld(world), NONE).cast.map((e) => e.name)).not.toContain('Wanderer');
    expect(resolveBearers(bearerWorld(world), asEntity(world, 'Albus')).cast.map((e) => e.name)).not.toContain('Wanderer');
  });

  it("gives Albus's Paladin more Faith than the blueprint's, and nobody else's", () => {
    const faith = (persona: PersonaRef, bearer: string) => resolveBearers(bearerWorld(world), persona).bearers
      .find((b) => b.name === bearer)!.traits.find((t) => t.name === 'Paladin')!.statChanges;
    expect(faith(NONE, 'Albus')).toEqual([{ statId: 'faith', value: 40, type: 'max' }]);
    expect(faith(NONE, 'Sylvie Thornwhistle')).toEqual([{ statId: 'faith', value: 30, type: 'max' }]);
    expect(faith(NONE, 'Wanderer')).toEqual([{ statId: 'faith', value: 30, type: 'max' }]);
  });

  it('starts Albus as a Human Paladin with his racial ability on', () => {
    const albus = entityNamed(world, 'Albus');
    expect(names(world, settledDefaults(world, albus.id, NONE)).sort()).toEqual(['Human', 'Paladin', 'Stubborn Heart']);
    expect(names(world, settledDefaults(world, albus.id, asEntity(world, 'Albus'))).sort()).toEqual(['Human', 'Paladin', 'Stubborn Heart']);
  });

  it('starts Sylvie as an Elf Rogue and Hesk as a Dwarf Cleric', () => {
    expect(names(world, settledDefaults(world, entityNamed(world, 'Sylvie Thornwhistle').id, NONE)).sort())
      .toEqual(['Elf', 'Keen Senses', 'Rogue']);
    expect(names(world, settledDefaults(world, entityNamed(world, 'Mother Hesk').id, NONE)).sort()).toEqual(['Cleric', 'Darkvision', 'Dwarf']);
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
    expect(names(world, settledDefaults(world, cp, NONE)).sort()).toEqual(['Halfling', 'Lucky Step', 'Wizard']);

    const played = resolveBearers(bearerWorld(world), asEntity(world, 'Albus'));
    expect(played.bearers.find((b) => b.id === PLAYER_BEARER)!.groups.map((g) => g.name)).toEqual(['Bonds']);
    expect(played.bearers.find((b) => b.id === cp)!.present).toBe(false);
    expect(played.playerBearerIds).toEqual([PLAYER_BEARER, entityNamed(world, 'Albus').id]);
  });

  it('switches a racial ability off and on with the race', () => {
    const { gate } = resolveBearers(bearerWorld(world), NONE);
    const wanderer = entityNamed(world, 'Wanderer').id;
    const start = settleDefaults(gate);
    expect(names(world, start.active[wanderer]).sort()).toEqual(['Halfling', 'Lucky Step', 'Wizard']);
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
