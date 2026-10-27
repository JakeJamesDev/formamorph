/**
 * @vitest-environment node
 * (No DOM needed; node keeps the QuickJS WASM engine loading through its filesystem path.)
 */
import { describe, it, expect } from 'vitest';
import raw from '@/defaultworlds/valentines.json?raw';
import { runStatCodeTurn } from './statCodeTurn';
import { settleDefaults, type GateInput, type GateStatSet, type SettleResult } from './traitGates';
import { visibleImages, visibleLocationImages } from './imageVisibility';
import { scoped } from './scope';
import type { Entity, PlayerStat } from '@/types';
import { bundledWorldHarness, withValues, type StatValues } from '@/test/bundledWorldHarness';
import { canvasRects, GROUP_HEADER, type CanvasRect } from './locationCanvas';
import { effectiveDestinations, reachableFromStarts } from './locationGraph';
import { relationshipCast, relationshipLines } from './entityRelationships';
import { resolveEntityText } from './placeholders';
import { resolveEntityTexts } from './resolveWorldNames';

const { world, persona: student, gate, build, personaStats, turn, personaStatsOut } = bundledWorldHarness(raw);
const place = (name: string) => world.locations.find((l) => l.name === name)!;
const entity = (name: string) => world.entities.find((e) => e.name === name)!;

/** The student's stats after its build's stat changes, with each named stat set to a raw value. */
const studentStats = (state: SettleResult, values: StatValues) => withValues(personaStats(state), values);

const statOf = (stats: readonly PlayerStat[], name: string) => stats.find((s) => s.name === name)!;

/** Agility after one After the AI run of its script. */
async function agilityAfter(state: SettleResult, values: StatValues) {
  const out = await runStatCodeTurn(turn(state, { stats: studentStats(state, values) }));
  return statOf(personaStatsOut(out), 'Agility').value;
}

// Iron Stomach is the default Constitution, so Sugar tops out at 100. The other builds change one max each.
const PLAIN = () => build('Class Idol');

describe('the Agility script', () => {
  it('reads full Stamina and an empty stomach as full speed', async () => {
    expect(await agilityAfter(PLAIN(), { Stamina: 100, Sugar: 0 })).toBe(100);
  });

  it('starts an exhausted student at a base of 30', async () => {
    expect(await agilityAfter(PLAIN(), { Stamina: 0, Sugar: 0 })).toBe(30);
  });

  it('slows the student as Sugar climbs', async () => {
    expect(await agilityAfter(PLAIN(), { Stamina: 50, Sugar: 50 })).toBe(45);
  });

  it("reads Stamina as a share of the Star Athlete's bigger tank", async () => {
    // Star Athlete's Stamina tops out at 120, so 60 is half: the same speed as 50 for everyone else.
    expect(statOf(studentStats(build('Star Athlete'), {}), 'Stamina').max).toBe(120);
    expect(await agilityAfter(build('Star Athlete'), { Stamina: 60, Sugar: 0 })).toBe(65);
  });

  it('reads Sugar as a share of the stomach each Constitution gives', async () => {
    // Sweet Tooth holds 125, so 100 is 80% full; Dainty Appetite holds 80, so 80 is completely full.
    expect(await agilityAfter(build('Class Idol', 'Sweet Tooth'), { Stamina: 100, Sugar: 100 })).toBe(68);
    expect(await agilityAfter(build('Class Idol', 'Dainty Appetite'), { Stamina: 100, Sugar: 80 })).toBe(60);
  });

  it('adds a burst while All-Out Sprint is on', async () => {
    expect(await agilityAfter(build('Class Idol', 'All-Out Sprint'), { Stamina: 50, Sugar: 0 })).toBe(85);
  });

  it('stays inside the stat range', async () => {
    expect(await agilityAfter(build('Class Idol', 'All-Out Sprint'), { Stamina: 100, Sugar: 0 })).toBe(100);
    expect(await agilityAfter(build('Class Idol', 'Dainty Appetite'), { Stamina: 0, Sugar: 80 })).toBe(0);
  });

  it("replaces whatever the AI wrote, since Agility is a readout of the body", async () => {
    expect(await agilityAfter(PLAIN(), { Stamina: 100, Sugar: 0, Agility: 12 })).toBe(100);
  });
});

describe('All-Out Sprint', () => {
  it('drains Stamina each turn, even for the fastest-recovering build', () => {
    const regenOf = (state: SettleResult) => statOf(studentStats(state, {}), 'Stamina').regen;
    expect(regenOf(build('Star Athlete', 'Running Shoes'))).toBeGreaterThan(0);
    expect(regenOf(build('Star Athlete', 'Running Shoes', 'All-Out Sprint'))).toBeLessThan(0);
  });
});

describe('the Ashburn High map', () => {
  const connections = world.connections ?? [];

  it('reaches every place from the classroom', () => {
    const reached = reachableFromStarts(world.locations, connections);
    expect(world.locations.filter((l) => !reached.has(l.id)).map((l) => l.name)).toEqual([]);
  });

  it('leads from the Bus Loop to the Front Gate along the fence, with a hint each way', () => {
    const toGate = effectiveDestinations(place('Bus Loop').id, world.locations, connections).get(place('Front Gate').id);
    const back = effectiveDestinations(place('Front Gate').id, world.locations, connections).get(place('Bus Loop').id);
    expect(toGate?.via === 'connection' && toGate.leg.hint).toMatch(/fence/);
    expect(back?.via === 'connection' && back.leg.hint).toMatch(/fence/);
  });
});

describe('the Ashburn High canvas', () => {
  const rects = canvasRects(world.locations);
  const box = (name: string): CanvasRect => rects.get(place(name).id)!;
  const centerX = (name: string) => box(name).x + box(name).width / 2;
  const centerY = (name: string) => box(name).y + box(name).height / 2;

  it('places every location by hand', () => {
    expect(world.locations.filter((l) => !l.canvasPosition).map((l) => l.name)).toEqual([]);
  });

  it('keeps every node clear of every other node but the boxes that hold it', () => {
    const holds = (outer: string, inner: string): boolean => {
      const parent = world.locations.find((l) => l.id === inner)?.parentId;
      return !!parent && (parent === outer || holds(outer, parent));
    };
    const overlaps: string[] = [];
    for (const first of world.locations) {
      for (const second of world.locations) {
        if (first.id >= second.id || holds(first.id, second.id) || holds(second.id, first.id)) continue;
        const [one, other] = [rects.get(first.id)!, rects.get(second.id)!];
        const apart = one.x >= other.x + other.width || other.x >= one.x + one.width || one.y >= other.y + other.height || other.y >= one.y + one.height;
        if (!apart) overlaps.push(`${first.name} / ${second.name}`);
      }
    }
    expect(overlaps).toEqual([]);
  });

  it('runs the hallway west to east: the art wing, the classroom, then the library', () => {
    expect(centerX('Art Wing')).toBeLessThan(centerX('Classroom 2-B'));
    expect(centerX('Classroom 2-B')).toBeLessThan(centerX('Library'));
    expect(centerY('Rooftop')).toBeLessThan(centerY('Classroom 2-B'));
  });

  it('puts the courtyard and gate south of the main building, the gym east, and the bus loop west', () => {
    const building = box('Second-Floor Hallway');
    expect(box('Courtyard').y).toBeGreaterThanOrEqual(box('Cafeteria').y + box('Cafeteria').height);
    expect(centerY('Front Gate')).toBeGreaterThan(centerY('Courtyard'));
    expect(box('Gymnasium').x).toBeGreaterThanOrEqual(building.x + building.width);
    expect(box('Bus Loop').x + box('Bus Loop').width).toBeLessThanOrEqual(building.x);
    expect(centerX('Bus Loop')).toBeLessThan(centerX('Cafeteria'));
    // The gym's one child sizes its box, so the north end is the top of the frame, under its title.
    expect(box('Locker Rooms').y).toBe(box('Gymnasium').y + GROUP_HEADER);
  });
});

describe('Relationship labels', () => {
  const hana = entity('Hana Sakuragi');
  const swarm = entity('The Swarm');
  const vicePresident = hana.placeholders!.find((p) => p.name === 'Vice President')!;
  const placeholders = [...world.placeholders!, ...world.entities.flatMap((e) => e.placeholders ?? [])];

  it.each(vicePresident.values.map((v) => v.text))('names %s in Hana\'s label to the swarm and in her description alike', (name) => {
    const rolls = { world: { [vicePresident.id]: name } };
    const [resolved, resolvedSwarm] = resolveEntityTexts([hana, swarm], (owner, text) => resolveEntityText(owner, text, { placeholders, rolls }));
    const [line, ...rest] = relationshipLines([resolved, resolvedSwarm], [hana.id])[hana.id] ?? [];
    expect(rest).toEqual([]);
    expect(line).toMatch(/^The Swarm is Hana Sakuragi's /);
    expect(line).toContain(name);
    expect(resolved.aiDescription).toContain(name);
  });

  it.each<[string, Entity]>([
    ['the Custom Persona', student],
    ['a library persona', { id: 'library-persona', name: 'Akira' }],
  ])('prints the ties that end on you with %s', (_, persona) => {
    // Only these two end on you: each one makes its owner known in every scene.
    const cast = relationshipCast(world.entities, persona);
    const lines = relationshipLines(cast, [], persona.id)[persona.id] ?? [];
    const owners = cast.filter((owner) => owner.id !== persona.id && lines.some((line) => line.startsWith(`${persona.name} is ${owner.name}'s `)));
    const friend = world.entities.find((e) => e.aliases?.includes('best friend'))!;
    expect(owners.map((owner) => owner.id).sort()).toEqual([friend.id, entity('Mr. Kuroda').id].sort());
  });
});

describe('the Visibility rules', () => {
  it('fills the Second-Floor Hallway with the swarm once Pursuit reaches 60', () => {
    // Pursuit is a world stat, so the owner-less rule reads the global scope.
    const pursuitAt = (value: number): GateInput => ({
      ...gate,
      active: settleDefaults(gate).active,
      stats: scoped<GateStatSet>({ pursuit: { name: 'Pursuit', value, min: 0, max: 100 } }),
    });
    const slots = (value: number) => visibleLocationImages(place('Second-Floor Hallway'), pursuitAt(value)).map((image) => image.slot);
    expect(slots(59)).toEqual([0]);
    expect(slots(60)).toEqual([1]);
  });

  it.each([
    // Sugar's max follows the Constitution, so the swap sits at 70% of each build's stomach.
    ['Iron Stomach', 69, 70],
    ['Sweet Tooth', 87, 88],
    ['Dainty Appetite', 55, 56],
  ])('shows the sugar-high Student at 70%% of the Sugar a %s build holds', (constitution, below, at) => {
    const state = build('Class Idol', constitution);
    const { max } = statOf(studentStats(state, {}), 'Sugar');
    const sugarAt = (value: number): GateInput => ({
      ...gate,
      active: state.active,
      stats: scoped<GateStatSet>({}, { [student.id]: { stomach: { name: 'Sugar', value, min: 0, max } } }),
    });
    const slots = (value: number) => visibleImages(student, sugarAt(value)).map((image) => image.slot);
    expect(slots(below)).toEqual([0]);
    expect(slots(at)).toEqual([1]);
  });
});
