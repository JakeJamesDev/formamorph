import { describe, it, expect } from 'vitest';
import type { Daypart, Entity, GalleryImage, TimeRequirement, Trait } from '@/types';
import {
  NO_ACTIVE, complementary, deadRows, gateStates, gateOf, neverUnlockable, ruleStates, sameRequirement, type GateInput,
} from './traitGates';
import { DAYPARTS, daypart, daypartAt, formatAbsolute, type WorldCalendar } from './gameClock';
import { shownWhileLine, gateLine } from './traitGateLine';
import { settleTraits, activeTraits, type TraitRuntimeState, type TraitWorld } from './traitRuntime';
import { visibleImages } from './imageVisibility';
import { buildEntityCardData, parseEntityCardData } from './entityFile';
import { conditionsOf } from './requirementRows';
import { scoped } from './scope';

const time = (...dayparts: Daypart[]): TimeRequirement => ({ kind: 'time', dayparts });
const T = (id: string, extra: Partial<Trait> = {}): Trait => ({ id, name: id, statChanges: [], ...extra });

const input = (traits: Trait[], at?: Daypart): GateInput => ({
  global: { traits, groups: [] },
  owners: [],
  active: NO_ACTIVE,
  entities: [],
  persona: { source: 'none' },
  ...(at ? { daypart: at } : {}),
});
const unlocked = (req: TimeRequirement, at?: Daypart) =>
  gateOf(gateStates(input([T('a', { requires: [{ all: [req] }] })], at)), null, 'a')!.unlocked;

describe('a time Condition', () => {
  it('holds while the clock’s daypart is in its set, and only then', () => {
    expect(unlocked(time('evening', 'night'), 'evening')).toBe(true);
    expect(unlocked(time('evening', 'night'), 'night')).toBe(true);
    expect(unlocked(time('evening', 'night'), 'midday')).toBe(false);
  });

  it('reads the opening hour, morning, when the input carries no clock', () => {
    expect(unlocked(time('morning'))).toBe(true);
    expect(unlocked(time('night'))).toBe(false);
  });

  it('never holds with no daypart, and reads as unresolved', () => {
    const states = ruleStates(input([], 'night'), null, [{ all: [time()] }]);
    expect(states[0].holds).toBe(false);
    expect(states[0].conditions[0]).toMatchObject({ unresolved: true, hidden: false });
  });

  it('reads its dayparts in words, each run from the daypart after a gap', () => {
    const line = (...dayparts: Daypart[]) => shownWhileLine(ruleStates(input([]), null, [{ all: [time(...dayparts)] }]));
    expect(line('night', 'evening')).toBe('Shown while evening or night');
    expect(line(...DAYPARTS)).toBe('Shown while night, dawn, morning, midday, afternoon, or evening');
    expect(line('dawn', 'morning', 'midday')).toBe('Shown while dawn, morning, or midday');
    expect(line('evening', 'dawn')).toBe('Shown while dawn or evening');
    const gate = gateStates(input([T('a', { requires: [{ all: [time('midday')] }] })], 'night'));
    expect(gateLine(gateOf(gate, null, 'a'))).toBe('Requires midday');
  });

  it('compares by its set, whatever the stored order', () => {
    expect(sameRequirement(time('night', 'evening'), time('evening', 'night'))).toBe(true);
    expect(sameRequirement(time('night'), time('night', 'dawn'))).toBe(false);
    expect(complementary(time('night', 'dawn', 'morning'), time('midday', 'afternoon', 'evening'))).toBe(true);
    expect(complementary(time('night'), time('midday'))).toBe(false);
  });

  it('kills a row whose two time Conditions share no daypart', () => {
    const traits = [T('a', { requires: [{ all: [time('night'), time('midday')] }] }), T('b', { requires: [{ all: [time('night'), time('night', 'dawn')] }] })];
    expect(deadRows(input(traits))).toEqual([{ ownerId: null, traitId: 'a', row: 0 }]);
  });

  it('counts as reachable for the never-unlockable check, since the clock reaches every daypart', () => {
    expect(neverUnlockable(input([T('a', { requires: [{ all: [time('night')] }] })]))).toEqual([]);
  });
});

describe('dayparts on a non-24-hour day', () => {
  // A 30-hour day: the split is by fraction, so the hours shift but the narration and the gate agree.
  const calendar: WorldCalendar = { hoursPerDay: 30, startHour: 0 };

  it('match the daypart the narration reads at every hour', () => {
    for (let elapsed = 0; elapsed < 30; elapsed += 1) {
      expect(formatAbsolute(elapsed, calendar)).toBe(`Day 1, ${daypartAt(elapsed, calendar)}`);
    }
  });

  it('divide the day by fraction rather than by the 24-hour clock', () => {
    // Hour 22 is evening on a 30-hour day (0.73), where it is night on a 24-hour one.
    expect(daypart(22, calendar)).toBe('evening');
    expect(daypart(22)).toBe('night');
    expect(unlocked(time('evening'), daypartAt(22, calendar))).toBe(true);
  });
});

describe('the per-turn settle with a time gate', () => {
  // Lantern holds while it is evening or night; the player chose it.
  const lantern = T('lantern', { playerToggle: true, requires: [{ all: [time('evening', 'night')] }] });
  const world = (at: Daypart): TraitWorld => ({ traits: [lantern], groups: [], daypart: at });
  const chosen: TraitRuntimeState = { stats: [], traits: [lantern], disabledTraitIds: [], appliedValues: {} };
  const on = (s: TraitRuntimeState) => activeTraits(s.traits, s.disabledTraitIds).map((t) => t.id);

  it('turns the trait off at midday and back on at the commit that reaches evening', () => {
    const midday = settleTraits(chosen, world('midday')).state;
    expect(on(midday)).toEqual([]);
    expect(settleTraits(midday, world('afternoon')).state).toBe(midday);
    const evening = settleTraits(midday, world('evening'));
    expect(on(evening.state)).toEqual(['lantern']);
    expect(evening.log).toEqual(['Trait switched on: lantern']);
  });

  it('reads the flat hour per turn with the AI clock off: ten turns from 8:00 reach evening', () => {
    // The flat clock advances one hour per turn; 18:00 is the first evening hour on a 24-hour day.
    const turns = (n: number) => daypartAt(n);
    expect(turns(9)).toBe('afternoon');
    expect(turns(10)).toBe('evening');
    const midday = settleTraits(chosen, world(turns(4))).state;
    expect(on(midday)).toEqual([]);
    expect(on(settleTraits(midday, world(turns(10))).state)).toEqual(['lantern']);
  });
});

describe('an entity image ruled on night', () => {
  const ash = { id: 'ash', images: [{ data: 'night', requires: [{ all: [time('night')] }] }, { data: 'day' }] as GalleryImage[] };
  const shown = (at: Daypart) => visibleImages(ash, { ...input([], at), entities: [{ id: 'ash', name: 'Ash' }], stats: scoped({}) }).map((v) => v.data);

  it('shows at night and not at midday', () => {
    expect(shown('night')).toEqual(['night', 'day']);
    expect(shown('midday')).toEqual(['day']);
  });
});

describe('a time Condition on a character card', () => {
  const PIXELS = 'data:image/webp;base64,AAAA';
  const wren = (requires = [{ all: [time('night', 'evening')] }]): Entity => ({
    id: 'wren', name: 'Wren',
    traits: [T('t-sleepy', { name: 'Sleepy', requires })],
    images: [{ data: PIXELS, requires }],
  });
  const throughCard = (entity: Entity): Entity =>
    parseEntityCardData(JSON.parse(JSON.stringify(buildEntityCardData(entity, [], {}, undefined, { traits: [], traitGroups: [], entities: [] }))), PIXELS);

  it('round-trips on a trait gate and an image rule', () => {
    const back = throughCard(wren());
    expect(conditionsOf(back.traits?.[0].requires)).toEqual([time('night', 'evening')]);
    expect(conditionsOf(back.images?.[0].requires)).toEqual([time('night', 'evening')]);
  });

  it('keeps known dayparts in clock order and drops a Condition left with none', () => {
    const odd = { kind: 'time', dayparts: ['evening', 'teatime', 'night', 'night'] } as unknown as TimeRequirement;
    expect(conditionsOf(throughCard(wren([{ all: [odd] }])).traits?.[0].requires)).toEqual([time('night', 'evening')]);
    const none = { kind: 'time', dayparts: ['teatime'] } as unknown as TimeRequirement;
    expect(throughCard(wren([{ all: [none] }])).traits?.[0].requires).toBeUndefined();
  });
});
