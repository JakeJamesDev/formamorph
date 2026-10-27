/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import raw from '@/defaultworlds/veilwood.json?raw';
import { migrateWorld } from './version';
import { resolveOwners, type OwnerWorld } from './owners';
import { settleDefaults, switchTrait, underfills, type SettleResult } from './traitGates';
import { inPlayOwners } from './ownedTraitsInPlay';
import {
  applyGlobalRowTraits, applyOwnedStatTraits, seedNewGameStats, settleTraits, switchPlayerTrait, type TraitRuntimeState, type TraitWorld,
} from './traitRuntime';
import { ownedTraitStatesFrom } from './ownedTraitState';
import { seedEntityStats } from './entityStats';
import { DAYPARTS } from './gameClock';
import { primeRolls, resolvePlaceholders, type PlaceholderPick } from './placeholders';
import { canvasRects } from './locationCanvas';
import { isDescendantLocation } from './locationTree';
import { bundledWorldHarness } from '@/test/bundledWorldHarness';
import type { Daypart, Entity, PersonaRef, World } from '@/types';

// Loaded the way the seeder loads it: raw text through the world migration.
const world: World = migrateWorld(JSON.parse(raw));
const NONE: PersonaRef = { source: 'none' };
const wanderer: Entity = world.entities.find((e) => e.customPersona)!;
const ownerWorld: OwnerWorld = { traits: world.traits, traitGroups: world.traitGroups ?? [], entities: world.entities };
const { gate } = resolveOwners(ownerWorld, NONE);

const idOf = (name: string): string => {
  const found = wanderer.traits!.find((t) => t.name === name);
  if (!found) throw new Error(`no trait ${name}`);
  return found.id;
};
const names = (ids: readonly string[] = []) => ids.map((id) => wanderer.traits!.find((t) => t.id === id)?.name ?? id).sort();
const activeOf = (result: SettleResult) => names(result.active.owners[wanderer.id]);

/** Switch each named trait on in turn from the default build, as the creator does. */
function build(...picks: string[]): SettleResult {
  let state = settleDefaults(gate);
  for (const pick of picks) {
    if (state.active.owners[wanderer.id]?.includes(idOf(pick))) continue;
    const next = switchTrait({ ...gate, active: state.active }, wanderer.id, idOf(pick), state.cascadeOff);
    if (!next) throw new Error(`${pick} would not switch on`);
    state = next;
  }
  return state;
}

describe('the wanderer build', () => {
  it('starts with the curse on and Veil Sight off', () => {
    expect(activeOf(settleDefaults(gate))).toEqual(['Iron Constitution', "The Veil's Hold", 'Zen Master']);
  });

  it('always holds exactly one Constitution and one Temperament', () => {
    const start = settleDefaults(gate);
    expect(activeOf(build('Survivalist', 'Stress Eater'))).toEqual(['Stress Eater', 'Survivalist', "The Veil's Hold"]);
    expect(underfills({ ...gate, active: start.active }, wanderer.id, idOf('Iron Constitution'))).toBe(true);
    expect(underfills({ ...gate, active: start.active }, wanderer.id, idOf('Zen Master'))).toBe(true);
  });

  it('takes any number of Instincts', () => {
    expect(activeOf(build('Iron Stomach', 'Hearty Appetite', 'Keen Eye'))).toEqual(
      ['Hearty Appetite', 'Iron Constitution', 'Iron Stomach', 'Keen Eye', "The Veil's Hold", 'Zen Master'],
    );
  });
});

const traitWorld: TraitWorld = {
  traits: world.traits, groups: world.traitGroups ?? [], entities: world.entities, persona: NONE, ...inPlayOwners(ownerWorld, NONE),
};

/** A game started on `picks`, with each named Wanderer stat then set to a raw value. */
function inPlay(picks: SettleResult, values: Record<string, number> = {}): TraitRuntimeState {
  const seeded: TraitRuntimeState = {
    stats: seedNewGameStats(world.stats), traits: [], disabledTraitIds: [], appliedValues: {},
    ownedTraits: ownedTraitStatesFrom({ [wanderer.id]: picks.active.owners[wanderer.id] ?? [] }),
    entityStats: seedEntityStats(world.entities),
  };
  // A persona trait moves its own stats and, by its global rows, the world's Predator Attention.
  return withStats(applyGlobalRowTraits(applyOwnedStatTraits(seeded, traitWorld), traitWorld).state, values);
}

/** `state` with each named Wanderer stat set to a raw value. */
function withStats(state: TraitRuntimeState, values: Record<string, number>): TraitRuntimeState {
  const stats = state.entityStats![wanderer.id];
  return {
    ...state,
    entityStats: { ...state.entityStats, [wanderer.id]: stats.map((s) => (s.name in values ? { ...s, value: values[s.name] } : s)) },
  };
}

const owned = (state: TraitRuntimeState) => {
  const own = state.ownedTraits?.[wanderer.id];
  return names((own?.chosen ?? []).filter((id) => !own?.disabled?.includes(id)));
};
const settled = (state: TraitRuntimeState) => settleTraits(state, traitWorld).state;

describe("the Veil's Hold", () => {
  it('stays on: the player cannot switch it off', () => {
    expect(switchPlayerTrait(inPlay(settleDefaults(gate)), idOf("The Veil's Hold"), false, traitWorld)).toBeNull();
  });

  it('carries the hunters\' rise: Predator Attention climbs only through the curse', () => {
    const state = inPlay(settleDefaults(gate));
    expect(world.stats.find((s) => s.name === 'Predator Attention')?.regen).toBe(0);
    expect(state.stats.find((s) => s.name === 'Predator Attention')?.regen).toBe(2);
  });
});

describe('Veil Sight', () => {
  it('switches on at 75% Toxin and off again below it', () => {
    const poisoned = settled(inPlay(settleDefaults(gate), { Toxin: 75 }));
    expect(owned(poisoned)).toContain('Veil Sight');
    expect(owned(settled(inPlay(settleDefaults(gate), { Toxin: 74 })))).not.toContain('Veil Sight');
  });

  it('reads Toxin as a share of an Iron Stomach\'s higher max', () => {
    // Iron Stomach raises Toxin's max to 125, so 90 is 72%: not yet poisoned enough.
    expect(owned(settled(inPlay(build('Iron Stomach'), { Toxin: 90 })))).not.toContain('Veil Sight');
    expect(owned(settled(inPlay(build('Iron Stomach'), { Toxin: 94 })))).toContain('Veil Sight');
  });
});

describe('Night Hunt', () => {
  const hunters = ['Shadow Raptor', 'Dread Crawler'].map((name) => world.entities.find((e) => e.name === name)!);
  const huntsAt = (hunter: Entity, daypart: Daypart) => {
    const trait = hunter.traits!.find((t) => t.name === 'Night Hunt')!;
    return (settleDefaults({ ...gate, daypart }).active.owners[hunter.id] ?? []).includes(trait.id);
  };
  const isNightPart = (daypart: Daypart) => daypart === 'evening' || daypart === 'night';

  it.each(hunters.flatMap((hunter) => DAYPARTS.map((daypart) => [hunter.name, daypart, hunter] as const)))(
    'holds for the %s only in the evening and at night (%s)',
    (_name, daypart, hunter) => {
      expect(huntsAt(hunter, daypart)).toBe(isNightPart(daypart));
    },
  );

  it('doubles the climb of Predator Attention after dusk, and lets it fall back at dawn', () => {
    const attentionRegen = (state: TraitRuntimeState) => state.stats.find((s) => s.name === 'Predator Attention')?.regen;
    const day = inPlay(settleDefaults(gate));
    const night = settleTraits(day, { ...traitWorld, daypart: 'night' }).state;
    const dawn = settleTraits(night, { ...traitWorld, daypart: 'dawn' }).state;
    expect(attentionRegen(day)).toBe(2);
    expect(attentionRegen(night)).toBe(4);
    expect(attentionRegen(dawn)).toBe(2);
  });
});

describe('the blazes chip', () => {
  it('rolls one surveyor for both legs of the fig road, the cache, the blazes and their lore', () => {
    const surveyor = world.placeholders!.find((p) => p.name === 'Lost Surveyor')!;
    const aiTextOf = (list: { name: string; aiDescription?: string }[], name: string) => list.find((item) => item.name === name)!.aiDescription!;
    const road = world.connections!.find((c) => (c.aToB?.hint ?? '').includes(surveyor.id))!;
    const lore = world.dictionaries![0].entries.find((e) => e.name === 'The Eastern Edge')!;
    const texts = [
      road.aToB!.hint!, road.bToA!.hint!, aiTextOf(world.locations, "The Surveyor's Cache"), aiTextOf(world.entities, "The Surveyor's Blazes"), lore.value,
    ];
    // Each fresh roll draws the next value, so two separate rolls would name different surveyors.
    let draws = 0;
    const nextValue: PlaceholderPick = (values) => values[draws++ % values.length].text;
    const rolls = primeRolls(world.placeholders!, texts, {}, nextValue);
    const resolved = texts.map((text) => resolvePlaceholders(text, { placeholders: world.placeholders!, rolls }));
    const rolledName = surveyor.values.map((value) => value.text).find((text) => resolved[0].includes(text))!;
    expect(rolledName).toBeDefined();
    for (const text of resolved) expect(text).toContain(rolledName);
  });
});

describe('the Veilwood canvas', () => {
  const rects = canvasRects(world.locations);
  const centerOf = (id: string) => {
    const rect = rects.get(id)!;
    return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  };
  const veilbreakParent = world.locations.find((l) => l.name === 'The Veilbreak')!.parentId;

  it('places every location by hand', () => {
    expect(world.locations.filter((l) => !l.canvasPosition).map((l) => l.name)).toEqual([]);
  });

  it('keeps every node clear of every other node but the boxes that hold it', () => {
    const nested = (one: string, other: string) => isDescendantLocation(world.locations, one, other) || isDescendantLocation(world.locations, other, one);
    const overlaps: string[] = [];
    for (const first of world.locations) {
      for (const second of world.locations) {
        if (first.id >= second.id || nested(first.id, second.id)) continue;
        const [one, other] = [rects.get(first.id)!, rects.get(second.id)!];
        const apart = one.x >= other.x + other.width || other.x >= one.x + one.width || one.y >= other.y + other.height || other.y >= one.y + one.height;
        if (!apart) overlaps.push(`${first.name} / ${second.name}`);
      }
    }
    expect(overlaps).toEqual([]);
  });

  // The eight-point compass word for the way from one node's center to another's, north up.
  const POINTS = ['east', 'northeast', 'north', 'northwest', 'west', 'southwest', 'south', 'southeast'];
  const compass = (fromId: string, toId: string) => {
    const [from, to] = [centerOf(fromId), centerOf(toId)];
    const degrees = (Math.atan2(from.y - to.y, to.x - from.x) * 180) / Math.PI;
    return POINTS[(Math.round(degrees / 45) + 8) % 8];
  };
  const idOfPlace = (name: string) => world.locations.find((l) => l.name === name)!.id;

  // [place, the way the text gives it, from where], taken from the locations' AI descriptions.
  const LORE: [string, string, string][] = [
    ['Gloomcap Thicket', 'northeast', 'The Drowned Hollow'],
    ['Gloomcap Thicket', 'northwest', 'The Hollow Fig'],
    ['The Gloam Cathedral', 'north', 'Gloomcap Thicket'],
    ['The Predator Dens', 'east', 'The Gloam Cathedral'],
    ['The Predator Dens', 'northeast', 'The Hollow Fig'],
    ['The Drowned Hollow', 'west', 'The Hollow Fig'],
    ['Blackwater Channels', 'southeast', 'The Drowned Hollow'],
    ['Blackwater Channels', 'south', 'The Hollow Fig'],
    ['Sunkwater', 'south', 'Blackwater Channels'],
    ['The Eastern Edge', 'southeast', 'The Hollow Fig'],
    ['The Eastern Edge', 'northeast', 'Sunkwater'],
    ['The Veilbreak', 'east', 'The Hollow Fig'],
    ['The Veilbreak', 'northeast', 'The Eastern Edge'],
  ];

  it.each(LORE)('puts %s %s of %s', (place, way, from) => {
    expect(compass(idOfPlace(from), idOfPlace(place))).toBe(way);
  });

  it('points every Travel Hint that opens with a compass word the way the canvas runs', () => {
    const wrong: string[] = [];
    for (const connection of world.connections ?? []) {
      for (const [from, to, hint] of [[connection.a, connection.b, connection.aToB?.hint], [connection.b, connection.a, connection.bToA?.hint]]) {
        const way = /^(northeast|northwest|southeast|southwest|north|south|east|west)\b/.exec(hint ?? '')?.[1];
        if (way && way !== compass(from!, to!)) wrong.push(`${hint} (canvas: ${compass(from!, to!)})`);
      }
    }
    expect(wrong).toEqual([]);
  });

  it('puts the Veilbreak east of everything', () => {
    const veilbreak = centerOf(idOfPlace('The Veilbreak'));
    const others = world.locations.filter((l) => l.parentId === veilbreakParent && l.name !== 'The Veilbreak');
    for (const other of others) expect(centerOf(other.id).x).toBeLessThan(veilbreak.x);
  });
});

describe('Move Quietly', () => {
  const switchedOn = (stress: number) =>
    switchPlayerTrait(inPlay(settleDefaults(gate), { Stress: stress }), idOf('Move Quietly'), true, traitWorld);

  it('switches on while Stress is below 75%', () => {
    expect(owned(switchedOn(74)!.state)).toContain('Move Quietly');
  });

  it('is locked while Stress is at 75% or more', () => {
    expect(switchedOn(75)).toBeNull();
  });

  it('switches off when panic rises, and back on once Stress falls', () => {
    const sneaking = switchedOn(40)!.state;
    const panicked = settled(withStats(sneaking, { Stress: 80 }));
    expect(owned(panicked)).not.toContain('Move Quietly');
    expect(owned(settled(withStats(panicked, { Stress: 30 })))).toContain('Move Quietly');
  });
});

describe('the Visibility rules', () => {
  const { statAt, atDaypart, entitySlots, locationSlots } = bundledWorldHarness(raw);
  const hollow = world.locations.find((l) => l.name === 'The Drowned Hollow')!;

  it('shows the Wanderer running once Predator Attention reaches Stalked (46)', () => {
    const slots = (value: number) => entitySlots(wanderer, statAt('Predator Attention', value));
    expect(slots(45)).toEqual([0]);
    expect(slots(46)).toEqual([1]);
  });

  it.each(DAYPARTS)('shows the Drowned Hollow with eyes in the dark in the evening and at night (%s)', (daypart) => {
    expect(locationSlots(hollow, atDaypart(daypart))).toEqual(daypart === 'evening' || daypart === 'night' ? [1] : [0]);
  });
});
