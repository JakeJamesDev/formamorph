/**
 * @vitest-environment node
 * (No DOM needed; node keeps the QuickJS WASM engine loading through its filesystem path.)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runStatCodeTurn, type StatCodeTurn } from './statCodeTurn';
import type { Placeholder, PlaceholderRolls, PlayerStat } from '@/types';
import { encodePlaceholderToken, type PlaceholderPick } from './placeholders';
import { phValueId, phValues } from '@/test/placeholderValues';

const stat = (over: Partial<PlayerStat>): PlayerStat => ({
  id: 'x', name: 'Stat', type: 'number', description: '', min: 0, max: 100, value: 50, regen: 0, descriptors: [],
  ...over,
});

/** A turn where nothing happened unless a case says so: no asks, no regen, previous equal to now. */
const turn = (over: Partial<StatCodeTurn> & Pick<StatCodeTurn, 'stats'>): StatCodeTurn => ({
  enabled: {}, previous: over.stats, asks: [], regenApplied: {}, clock: {}, ...over,
});

const valueOf = (stats: readonly PlayerStat[], id: string) => stats.find(s => s.id === id)?.value;

describe('runStatCodeTurn', () => {
  beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}));
  afterEach(() => vi.restoreAllMocks());

  it('sets the value from a number return, as stat code always has', async () => {
    const out = await runStatCodeTurn(turn({ stats: [stat({ id: 'a', code: 'return 42;' })] }));
    expect(valueOf(out.stats, 'a')).toBe(42);
    expect(out.moved).toEqual(['a']);
  });

  it('sets the value from a self.value write with no return', async () => {
    const out = await runStatCodeTurn(turn({ stats: [stat({ id: 'a', code: 'self.value = 7;' })] }));
    expect(valueOf(out.stats, 'a')).toBe(7);
    expect(out.moved).toEqual(['a']);
  });

  it('keeps the pipeline result for a value the code leaves alone', async () => {
    const stats = [stat({ id: 'a', value: 63, code: 'const seen = self.value;' })];
    const out = await runStatCodeTurn(turn({ stats }));
    expect(valueOf(out.stats, 'a')).toBe(63);
    expect(out.moved).toEqual([]);
    expect(out.stats).toBe(stats);
  });

  it('lets code halve an AI gain it reads from requested and previous', async () => {
    // The AI asked +20 onto 50, so the pipeline already shows 70; the code keeps half of the ask.
    const code = 'self.value = self.previous.value + self.requested.value / 2;';
    const out = await runStatCodeTurn(turn({
      stats: [stat({ id: 'a', value: 70, code })],
      previous: [stat({ id: 'a', value: 50 })],
      asks: [{ id: 'a', value: 20, max: 0 }],
    }));
    expect(valueOf(out.stats, 'a')).toBe(60);
  });

  it('hands code the raw ask, before the flags and the clamp shaped it', async () => {
    // noIncrease blocked the +30 and the pipeline value stayed 50, but the ask itself reaches the code.
    const out = await runStatCodeTurn(turn({
      stats: [stat({ id: 'a', value: 50, noIncrease: true, code: 'return self.requested.value;' })],
      asks: [{ id: 'a', value: 30, max: 5 }],
    }));
    expect(valueOf(out.stats, 'a')).toBe(30);
  });

  it('exposes the regen this turn applied', async () => {
    const out = await runStatCodeTurn(turn({
      stats: [stat({ id: 'a', value: 55, code: 'return self.value - self.regenApplied;' })],
      regenApplied: { a: 5 },
    }));
    expect(valueOf(out.stats, 'a')).toBe(50);
  });

  it('matches previous by id, and reads a stat missing from it as unmoved', async () => {
    const out = await runStatCodeTurn(turn({
      stats: [
        stat({ id: 'a', value: 70, max: 120, code: 'return self.previous.max;' }),
        stat({ id: 'b', value: 30, code: 'return self.previous.value + 1;' }),
      ],
      previous: [stat({ id: 'a', value: 50, max: 90 })],
    }));
    expect(valueOf(out.stats, 'a')).toBe(90);
    expect(valueOf(out.stats, 'b')).toBe(31);
  });

  it('discards a write when the code throws after making it', async () => {
    const out = await runStatCodeTurn(turn({
      stats: [stat({ id: 'a', value: 50, code: 'self.value = 9; throw new Error("late");' })],
    }));
    expect(valueOf(out.stats, 'a')).toBe(50);
    expect(out.moved).toEqual([]);
  });

  it('discards a write when the code times out after making it', async () => {
    const out = await runStatCodeTurn(turn({
      stats: [stat({ id: 'a', value: 50, code: 'self.value = 9; while (true) {}' })],
    }));
    expect(valueOf(out.stats, 'a')).toBe(50);
  }, 15_000);

  it('never writes a stat other than the one the code belongs to', async () => {
    const out = await runStatCodeTurn(turn({
      stats: [
        stat({ id: 'a', value: 50, code: 'stats.find(s => s.id === "b").value = 1; return 10;' }),
        stat({ id: 'b', value: 80 }),
      ],
    }));
    expect(valueOf(out.stats, 'b')).toBe(80);
    expect(out.moved).toEqual(['a']);
  });

  it('keeps a disabled stat inert and hides it from every other stat', async () => {
    const out = await runStatCodeTurn(turn({
      stats: [
        stat({ id: 'a', value: 50, code: 'return stats.length * 10 + (stats.some(s => s.id === "off") ? 1 : 0);' }),
        stat({ id: 'off', value: 5, code: 'return 99;' }),
      ],
      enabled: { off: false },
    }));
    expect(valueOf(out.stats, 'a')).toBe(10);
    expect(valueOf(out.stats, 'off')).toBe(5);
    expect(out.moved).toEqual(['a']);
  });

  it('reads zero asks on a clock-only run, with the clock still ticking', async () => {
    const out = await runStatCodeTurn(turn({
      stats: [stat({ id: 'a', value: 50, max: 1000, code: 'return self.requested.value + self.requested.max + deltaHours * 100;' })],
      asks: [],
      clock: { deltaHours: 3, elapsedHours: 10 },
    }));
    expect(valueOf(out.stats, 'a')).toBe(300);
  });

  it('gives the same result for the same turn, so a re-roll does not stack', async () => {
    const input = turn({
      stats: [stat({ id: 'a', value: 70, code: 'self.value = self.previous.value + self.requested.value / 2;' })],
      previous: [stat({ id: 'a', value: 50 })],
      asks: [{ id: 'a', value: 20, max: 0 }],
    });
    const first = await runStatCodeTurn(input);
    const second = await runStatCodeTurn(input);
    expect(valueOf(second.stats, 'a')).toBe(valueOf(first.stats, 'a'));
    expect(valueOf(second.stats, 'a')).toBe(60);
  });
});

describe('runStatCodeTurn placeholders', () => {
  beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}));
  afterEach(() => vi.restoreAllMocks());

  const ph = (id: string, name: string, texts: string[], over: Partial<Placeholder> = {}): Placeholder => ({
    id, name, values: phValues(texts), ...over,
  });
  const mood = ph('mood', 'Mood', ['calm', 'angry', 'sad']);

  /** One stat running `code`, over `placeholders` with `rolls` and `pins`. */
  const run = (code: string, placeholders: Placeholder[], rolls: PlaceholderRolls = {}, extra: { pins?: Record<string, string>; pick?: PlaceholderPick } = {}) =>
    runStatCodeTurn(turn({
      stats: [stat({ id: 'a', value: 0, code })],
      placeholders: { placeholders, rolls, ...extra },
    })).then((out) => valueOf(out.stats, 'a'));

  it('reads a placeholder’s current value under the playthrough’s roll', async () => {
    const code = 'return { calm: 1, angry: 2, sad: 3 }[placeholders.Mood.value];';
    await expect(run(code, [mood], { world: { mood: 'angry' } })).resolves.toBe(2);
  });

  it('reads a pin over the roll', async () => {
    const code = 'return { calm: 1, angry: 2, sad: 3 }[placeholders.Mood.value];';
    await expect(run(code, [mood], { world: { mood: 'angry' } }, { pins: { mood: 'sad' } })).resolves.toBe(3);
  });

  it('lists every authored value as text, benched values and chip values included', async () => {
    const name = ph('name', 'Name', ['Ada']);
    const chip = encodePlaceholderToken({ id: 'name', mode: 'world', placementId: 'p1' });
    const benched = ph('mood', 'Mood', ['calm', chip], { weights: { [phValueId('calm')]: 0 } });
    const code = 'return placeholders.Mood.values.join("|") === "calm|Ada" ? 1 : 0;';
    await expect(run(code, [benched, name])).resolves.toBe(1);
  });

  it('draws roll() with the author’s weights through the picker', async () => {
    const weighted = ph('mood', 'Mood', ['calm', 'angry'], { weights: { [phValueId('calm')]: 3 } });
    const pick = vi.fn<PlaceholderPick>((values) => values[1].text);
    await expect(run('return placeholders.Mood.roll() === "angry" ? 1 : 0;', [weighted], {}, { pick })).resolves.toBe(1);
    expect(pick).toHaveBeenCalledWith(weighted.values, weighted.weights);
  });

  it('never rolls a benched value', async () => {
    const weighted = ph('mood', 'Mood', ['calm', 'angry'], { weights: { [phValueId('calm')]: 0 } });
    const code = 'let n = 0; for (let i = 0; i < 200; i++) if (placeholders.Mood.roll() === "calm") n++; return n + 10;';
    // Offset from the stat's 0, so a run that failed outright cannot pass as zero draws.
    await expect(run(code, [weighted], { world: { mood: 'angry' } })).resolves.toBe(10);
  });

  it('rolls a chip value as its resolved chain', async () => {
    const name = ph('name', 'Name', ['Ada']);
    const chip = encodePlaceholderToken({ id: 'name', mode: 'world', placementId: 'p1' });
    const pick: PlaceholderPick = (values) => values[0].text;
    await expect(run('return placeholders.Who.roll() === "Ada" ? 1 : 0;', [ph('who', 'Who', [chip, 'Bo']), name], {}, { pick }))
      .resolves.toBe(1);
  });

  it('persists neither a roll() nor a read of an unrolled placeholder', async () => {
    const rolls: PlaceholderRolls = { world: {} };
    const code = 'placeholders.Mood.roll(); const seen = placeholders.Mood.value; return 1;';
    await expect(run(code, [mood], rolls)).resolves.toBe(1);
    expect(rolls).toEqual({ world: {} });
  });

  it('reads a placeholder with no values as empty text, and rolls it as empty text', async () => {
    const code = 'const e = placeholders.Empty; return e.value === "" && e.values.length === 0 && e.roll() === "" ? 1 : 0;';
    await expect(run(code, [ph('empty', 'Empty', [])])).resolves.toBe(1);
  });

  it('reaches a name that is not an identifier with bracket syntax', async () => {
    const eyes = ph('eyes', 'Eye Color', ['green']);
    await expect(run('return placeholders["Eye Color"].value === "green" ? 1 : 0;', [eyes])).resolves.toBe(1);
  });

  it('reads an unknown name as undefined', async () => {
    await expect(run('return placeholders.Nope === undefined ? 1 : 0;', [mood])).resolves.toBe(1);
  });

  it('lets the last authored of two same-named placeholders win', async () => {
    const first = ph('m1', 'Mood', ['calm']);
    const last = ph('m2', 'Mood', ['angry']);
    await expect(run('return placeholders.Mood.value === "angry" && placeholders.Mood.roll() === "angry" ? 1 : 0;', [first, last]))
      .resolves.toBe(1);
  });

  it('offers an empty map when the turn carries no placeholders', async () => {
    const out = await runStatCodeTurn(turn({ stats: [stat({ id: 'a', value: 0, code: 'return Object.keys(placeholders).length + 1;' })] }));
    expect(valueOf(out.stats, 'a')).toBe(1);
  });
});
