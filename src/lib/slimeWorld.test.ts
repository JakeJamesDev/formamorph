/**
 * @vitest-environment node
 * (No DOM needed; node keeps the QuickJS WASM engine loading through its filesystem path.)
 */
import { describe, it, expect } from 'vitest';
import raw from '@/defaultworlds/slime.json?raw';
import { resolveOwners } from './owners';
import { settleDefaults, type SettleResult } from './traitGates';
import { runStatCodeTurn } from './statCodeTurn';
import { resolveEntityText, resolvePlaceholders } from './placeholders';
import { openingPool } from './openings';
import { bundledWorldHarness, withValues } from '@/test/bundledWorldHarness';
import { readWorldTools } from './tools/worldTools';
import { openWorldToolTurn } from './tools/worldToolTurn';
import { onCallRunner } from './tools/onCallRunner';
import { withLoreWrites } from './loreToggles';
import { openingFold } from './openingState';
import { resolveEntityTexts } from './resolveWorldNames';
import { relationshipLines } from './entityRelationships';
import { DAYPARTS } from './gameClock';
import { canvasRects } from './locationCanvas';
import type { StatCodeTurn, StatCodeTurnResult } from './statCodeTurn';
import type { Daypart, LoreToggles } from '@/types';

const { world, persona: resident, gate, ownerWorld, none: NONE, traitNamed, activeNames, build, personaStats, turn, personaStatsOut, activeIds,
  statAt, atDaypart, entitySlots, locationSlots,
} = bundledWorldHarness(raw);
const allPlaceholders = [...world.placeholders!, ...world.entities.flatMap((e) => e.placeholders ?? []), ...world.dictionaries!.flatMap((d) => d.placeholders ?? [])];

interface Turn {
  /** Assimilation at the start of the turn. */
  from: number;
  /** The AI's change this turn: slime contact, or a remedy. */
  aiChange?: number;
  hours: number;
  panic?: number;
}

/** Assimilation after one After the AI run of the Resident's scripts. */
async function spread(state: SettleResult, { from, aiChange = 0, hours, panic = 0 }: Turn): Promise<number | undefined> {
  const previous = withValues(personaStats(state), { Assimilation: from, Panic: panic });
  const stats = withValues(previous, { Assimilation: from + aiChange });
  const out = await runStatCodeTurn(turn(state, { stats, previous, clock: { deltaHours: hours } }));
  return personaStatsOut(out).find((s) => s.name === 'Assimilation')?.value;
}

// The default picks: Night-Shift Nurse, Steady Hands, and the Hidden strain.
const DEFAULT = settleDefaults(gate);
const DOCK_WORKER = build('Dock Worker');

describe('the infection spread script', () => {
  it('spreads two points for each story hour', async () => {
    expect(await spread(DOCK_WORKER, { from: 10, hours: 1 })).toBe(12);
    expect(await spread(DOCK_WORKER, { from: 10, hours: 3 })).toBe(16);
  });

  it('spreads nothing on a turn that takes no time', async () => {
    expect(await spread(DOCK_WORKER, { from: 10, hours: 0 })).toBe(10);
  });

  it("keeps the AI's change for the turn and spreads on top of it", async () => {
    expect(await spread(DOCK_WORKER, { from: 10, aiChange: 15, hours: 1 })).toBe(27);
    expect(await spread(DOCK_WORKER, { from: 30, aiChange: -10, hours: 1 })).toBe(22);
  });

  it('spreads faster once the skin is translucent at the start of the turn', async () => {
    expect(await spread(DOCK_WORKER, { from: 40, hours: 1 })).toBe(43);
    // A splash that crosses 40 this turn does not also speed up this turn.
    expect(await spread(DOCK_WORKER, { from: 30, aiChange: 15, hours: 1 })).toBe(47);
  });

  it('spreads faster at half of max Panic or more', async () => {
    expect(await spread(DOCK_WORKER, { from: 10, hours: 1, panic: 50 })).toBe(13);
    expect(await spread(DOCK_WORKER, { from: 10, hours: 1, panic: 49 })).toBe(12);
  });

  it('reads Panic against its max, which Morbid Curiosity raises', async () => {
    // Morbid Curiosity takes Panic's max to 125, so 60 is under half.
    expect(await spread(build('Dock Worker', 'Morbid Curiosity'), { from: 10, hours: 1, panic: 60 })).toBe(12);
    expect(await spread(build('Dock Worker', 'Morbid Curiosity'), { from: 10, hours: 1, panic: 63 })).toBe(13);
  });

  it("slows a point an hour for the Night-Shift Nurse", async () => {
    expect(activeNames(DEFAULT)).toContain('Night-Shift Nurse');
    expect(await spread(DEFAULT, { from: 10, hours: 2 })).toBe(12);
  });

  it('slows two points an hour while Fight It is on', async () => {
    expect(await spread(build('Dock Worker', 'Fight It'), { from: 40, hours: 1 })).toBe(41);
  });

  it('stops the spread, never reverses it, for a nurse who fights it', async () => {
    expect(await spread(build('Fight It'), { from: 20, hours: 4 })).toBe(20);
  });
});

describe('the hidden strain', () => {
  const strain = traitNamed('Strain');

  it('is a Hidden trait the Resident always carries', () => {
    expect(strain.mode).toBe('hidden');
    expect(activeNames(DEFAULT)).toContain('Strain');
    expect(activeNames(build('Dock Worker', 'Runner\'s Instinct', 'Fight It'))).toContain('Strain');
  });

  it('rolls one strain from its placeholder into the text the AI reads', () => {
    const values = resident.placeholders!.find((p) => p.name === 'Strain')!.values;
    expect(values.length).toBeGreaterThan(1);
    for (const value of values) {
      const text = resolvePlaceholders(strain.aiDescription ?? '', { placeholders: allPlaceholders, rolls: {}, pick: () => value.text });
      expect(text).toContain(value.text);
      expect(text).not.toContain('{{');
    }
  });
});

describe('the rolled neighbor', () => {
  const neighbor = world.entities.find((e) => e.aliases?.includes('neighbor'))!;
  const variants = allPlaceholders.find((p) => p.name === 'Neighbor')!.values;

  it.each(variants.map((_, i) => i))('names neighbor %i and their habit through the renamed slots', (index) => {
    // Pick this variant from the Neighbor list, and the first value of any other list.
    const pick = (values: { id: string; text: string }[]) => (values[0].id === variants[0].id ? values[index] : values[0]).text;
    const resolve = (text: string) => resolvePlaceholders(text, { placeholders: allPlaceholders, rolls: {}, pick });
    const name = resolve(neighbor.name);
    expect(name).toMatch(/^(Mr\.|Mrs\.|Ms\.|Old) [A-Z]\w+$/);
    // Each variant owns one Habit; its slot chips must land that text.
    const variantId = variants[index].text.match(/\{\{ph:([^:]+):/)![1];
    const habit = allPlaceholders.find((p) => p.name === 'Habit' && p.ownerId === variantId)!.values[0].text;
    for (const text of [neighbor.aiDescription ?? '', neighbor.playerDescription ?? '']) {
      const resolved = resolve(text);
      expect(resolved).not.toContain('{{');
      expect(resolved).toContain(habit);
    }
    expect(resolve(neighbor.aiDescription ?? '')).toContain(name);
  });
});

describe('openings on Slime Outbreak', () => {
  it('draws from several world openings at the start', () => {
    const pool = openingPool({
      overview: world.worldOverview,
      entities: resolveOwners(ownerWorld, NONE).cast,
      locations: world.locations,
      startingLocationId: world.locations.find((l) => l.isStarting)!.id,
      persona: null,
      customPersona: resident,
    });
    expect(pool.length).toBeGreaterThan(1);
    expect(pool.every((e) => e.ownerId === null)).toBe(true);
  });
});

const bulletin = world.dictionaries!.find((d) => d.name === 'The Ashburn Bulletin')!;
const reports = world.dictionaries!.find((d) => d.name === 'Block Reports')!;
const loreSource = { placeholders: world.placeholders ?? [], dictionaries: world.dictionaries!, rolls: { world: {} } };
/** `codeTurn` with the world's books in reach, as scripts switched their entries so far. */
const withLore = (codeTurn: StatCodeTurn, loreToggles: LoreToggles): StatCodeTurn =>
  ({ ...codeTurn, state: { ...codeTurn.state, placeholders: loreSource, loreToggles } });

describe('the mark_overrun World Tool', () => {
  const { tools, dropped } = readWorldTools((JSON.parse(raw) as { tools?: unknown }).tools);
  const markOverrun = tools.find((tool) => tool.name === 'mark_overrun')!;
  const blocks = markOverrun.params[0].options;
  const failIfFallback = () => { throw new Error('mark_overrun is a World Tool.'); };

  /** One On Call run of mark_overrun for `block`, over the lore as earlier calls left it. */
  async function mark(block: string, loreToggles: LoreToggles = {}) {
    let landed: StatCodeTurnResult | undefined;
    const runner = onCallRunner(() => ({
      turn: withLore(turn(DEFAULT, { stats: personaStats(DEFAULT) }), loreToggles),
      land: (result) => { landed = result; },
    }));
    const execute = openWorldToolTurn(tools, runner).executor(failIfFallback);
    const reply = await execute(markOverrun, JSON.stringify({ block }), new AbortController().signal);
    return { reply: reply.text, writes: landed?.loreWrites ?? [], memories: landed?.worldWrites?.memory ?? [], toggles: withLoreWrites(loreToggles, landed?.loreWrites) };
  }

  it('loads as an On Call Tool offered to narration, with a report for every block it offers', () => {
    expect(dropped).toEqual([]);
    expect(markOverrun.handler).toMatchObject({ kind: 'script', timing: 'call' });
    expect(markOverrun.offeredTo).toEqual(['narration']);
    expect(blocks.map((block) => reports.entries.find((e) => e.name === `${block} Overrun`)?.enabled)).toEqual(blocks.map(() => false));
  });

  it.each(blocks)('switches on the report for %s and logs one memory', async (block) => {
    const report = reports.entries.find((e) => e.name === `${block} Overrun`)!;
    const { reply, writes, memories } = await mark(block);
    expect(writes).toEqual([{ book: reports.id, entry: report.id, field: 'enabled', value: true }]);
    expect(memories).toHaveLength(1);
    expect(memories[0]).toContain(block);
    expect(reply).toContain('marked overrun');
  });

  it('leaves an overrun block as it is on a second call, and says so', async () => {
    const first = await mark('Harborfront');
    const second = await mark('Harborfront', first.toggles);
    expect(second.writes).toEqual([]);
    expect(second.memories).toEqual([]);
    expect(second.reply).toContain('already overrun');
  });

  it('marks a second block after the first has fallen', async () => {
    const first = await mark('Crescent Row');
    const second = await mark("St. Anselm's", first.toggles);
    expect(second.writes).toEqual([{ book: reports.id, entry: reports.entries.find((e) => e.name === "St. Anselm's Overrun")!.id, field: 'enabled', value: true }]);
  });
});

describe('the Wanted Notice script', () => {
  const notice = bulletin.entries.find((e) => e.name === 'Wanted Notice')!;
  const ON: LoreToggles = withLoreWrites({}, [{ book: bulletin.id, entry: notice.id, field: 'enabled', value: true }]);

  /** The lore writes of one After the AI turn that ends at `suspicion`, on the world's stats as a new game opens on the build. */
  async function noticeWrites(state: SettleResult, suspicion: number, loreToggles: LoreToggles = {}) {
    const opened = openingFold(world, { traits: [], owned: { [resident.id]: activeIds(state) } }).state;
    const globals = withValues(opened.stats, { Suspicion: suspicion });
    const out = await runStatCodeTurn({ ...withLore(turn(state, { stats: personaStats(state), globals }), loreToggles), worldScripts: world.scripts });
    return out.loreWrites ?? [];
  }
  const switchTo = (value: boolean) => [{ book: bulletin.id, entry: notice.id, field: 'enabled', value }];

  it('starts off, and comes in on every turn once on', () => {
    expect(notice.enabled).toBe(false);
    expect(notice.constant).toBe(true);
  });

  it('switches the notice on at 75% Suspicion, and not below', async () => {
    expect(await noticeWrites(DEFAULT, 75)).toEqual(switchTo(true));
    expect(await noticeWrites(DEFAULT, 74)).toEqual([]);
  });

  it('reads Suspicion as a share of the max the Long Coat & Gloves raise', async () => {
    // The coat takes Suspicion's max to 125, so 93 is 74.4%.
    const coat = build('Long Coat & Gloves');
    expect(await noticeWrites(coat, 93)).toEqual([]);
    expect(await noticeWrites(coat, 94)).toEqual(switchTo(true));
  });

  it('switches it off again below 75%, and writes nothing while it holds', async () => {
    expect(await noticeWrites(DEFAULT, 80, ON)).toEqual([]);
    expect(await noticeWrites(DEFAULT, 50, ON)).toEqual(switchTo(false));
  });
});

describe("Hollis Pratt's night hours", () => {
  const hollis = world.entities.find((e) => e.name === 'Hollis Pratt')!;
  const counterOpen = hollis.traits!.find((t) => t.name === 'Counter Open')!;
  const openAt = (daypart: Daypart) => (settleDefaults({ ...gate, daypart }).active.owners[hollis.id] ?? []).includes(counterOpen.id);

  it.each(DAYPARTS)('opens the counter only in the evening and at night (%s)', (daypart) => {
    expect(openAt(daypart)).toBe(daypart === 'evening' || daypart === 'night');
  });
});

describe('the Ashburn canvas', () => {
  it('places every location by hand', () => {
    expect(world.locations.filter((l) => !l.canvasPosition).map((l) => l.name)).toEqual([]);
  });

  it('keeps every node clear of every other node but the boxes that hold it', () => {
    const rects = canvasRects(world.locations);
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
});

describe("Sergeant Okonjo's missing partner", () => {
  const okonjo = world.entities.find((e) => e.name === 'Sergeant Abena Okonjo')!;
  const partner = okonjo.placeholders!.find((p) => p.name === 'Missing Partner')!;
  const watch = world.entities.find((e) => e.name === 'Quarantine Watch')!;

  it.each(partner.values.map((v) => v.text))('names %s in her Relationship label and her description alike', (name) => {
    const rolls = { world: { [partner.id]: name } };
    const [resolved, resolvedWatch] = resolveEntityTexts([okonjo, watch], (owner, text) => resolveEntityText(owner, text, { placeholders: allPlaceholders, rolls }));
    expect(relationshipLines([resolved, resolvedWatch], [okonjo.id])[okonjo.id])
      .toEqual([`Quarantine Watch is Sergeant Abena Okonjo's unit, one short since ${name} went down the storm drains`]);
    expect(resolved.aiDescription).toContain(name);
  });
});

describe('the Visibility rules', () => {
  const pharmacy = world.locations.find((l) => l.name === 'The Night Pharmacy')!;

  it('swaps the Resident to translucent skin once Assimilation reaches 40', () => {
    const slots = (value: number) => entitySlots(resident, statAt('Assimilation', value, resident.id));
    expect(slots(39)).toEqual([0]);
    expect(slots(40)).toEqual([1]);
  });

  it.each(DAYPARTS)('shows the Night Pharmacy open only in the evening and at night (%s)', (daypart) => {
    expect(locationSlots(pharmacy, atDaypart(daypart))).toEqual(daypart === 'evening' || daypart === 'night' ? [0] : [1]);
  });
});
