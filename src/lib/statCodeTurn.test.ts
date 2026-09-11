/**
 * @vitest-environment node
 * (No DOM needed; node keeps the QuickJS WASM engine loading through its filesystem path.)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { overlayStatCodeResult, runStatCodeTurn, withPinWrites, type StatCodeTurn } from './statCodeTurn';
import type { StatCodeTraits } from './statCodeTraits';
import type { Placeholder, PlaceholderRolls, PlayerStat, Trait, TraitGroup } from '@/types';
import { encodePlaceholderToken, resolvePlaceholders, type PlaceholderPick } from './placeholders';
import { collectPins } from './placeholderPins';
import { phValueId, phValues } from '@/test/placeholderValues';

const stat = (over: Partial<PlayerStat>): PlayerStat => ({
  id: 'x', name: 'Stat', type: 'number', description: '', min: 0, max: 100, value: 50, regen: 0, descriptors: [],
  ...over,
});

/** `active` acquired and on, as the only traits the world authors. */
const inForce = (active: Trait[]): StatCodeTraits => ({
  acquired: active, disabledTraitIds: [], appliedValues: {}, world: { traits: active, groups: [] },
});

/** A turn where nothing happened unless a case says so: no asks, no regen, previous equal to now, no traits. */
const turn = (over: Partial<StatCodeTurn> & Pick<StatCodeTurn, 'stats'>): StatCodeTurn => ({
  enabled: {}, previous: over.stats, asks: [], regenApplied: {}, clock: {}, traits: inForce([]), ...over,
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

  it('lets code halve an AI gain it reads from delta.ai and previous', async () => {
    // The AI asked +20 onto 50, so the pipeline already shows 70; the code keeps half of the ask.
    const code = 'self.value = self.previous.value + self.delta.ai.value / 2;';
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
      stats: [stat({ id: 'a', value: 50, noIncrease: true, code: 'return self.delta.ai.value;' })],
      asks: [{ id: 'a', value: 30, max: 5 }],
    }));
    expect(valueOf(out.stats, 'a')).toBe(30);
  });

  it('exposes the regen this turn applied', async () => {
    const out = await runStatCodeTurn(turn({
      stats: [stat({ id: 'a', value: 55, code: 'return self.value - self.delta.regen.value;' })],
      regenApplied: { a: 5 },
    }));
    expect(valueOf(out.stats, 'a')).toBe(50);
  });

  it('reads a capped ask as actual short of total, total being the ai and regen asks added up', async () => {
    // 90 with +20 asked and +5 regen against a cap of 100: the range took 15.
    const out = await runStatCodeTurn(turn({
      stats: [
        stat({ id: 'a', name: 'A', value: 100, code: 'return self.delta.total.value - self.delta.actual.value;' }),
        stat({ id: 'b', name: 'B', max: 1000, code: 'const d = stats.A.delta; '
          + 'return d.total.value === d.ai.value + d.regen.value ? d.total.value * 10 + d.actual.value : -1;' }),
      ],
      previous: [stat({ id: 'a', name: 'A', value: 90 }), stat({ id: 'b', name: 'B' })],
      asks: [{ id: 'a', value: 20, max: 0 }],
      regenApplied: { a: 5 },
    }));
    expect(valueOf(out.stats, 'a')).toBe(15);
    expect(valueOf(out.stats, 'b')).toBe(260);
  });

  it('keeps an ask a flag zeroed in total, and the loss in total minus actual', async () => {
    const out = await runStatCodeTurn(turn({
      stats: [stat({ id: 'a', value: 50, noIncrease: true, code: 'return self.delta.total.value * 10 + self.delta.actual.value;' })],
      asks: [{ id: 'a', value: 3, max: 0 }],
    }));
    expect(valueOf(out.stats, 'a')).toBe(30);
  });

  it('reads an AI max change that landed in actual.max', async () => {
    const out = await runStatCodeTurn(turn({
      stats: [stat({ id: 'a', value: 50, max: 120, code: 'return self.delta.actual.max * 2 + self.delta.ai.max;' })],
      previous: [stat({ id: 'a', value: 50, max: 100 })],
      asks: [{ id: 'a', value: 0, max: 20 }],
    }));
    expect(valueOf(out.stats, 'a')).toBe(60);
  });

  it('reads a bound a trait moved since turn start in actual.min, and not in total', async () => {
    const out = await runStatCodeTurn(turn({
      stats: [stat({ id: 'a', value: 50, min: 10, regen: 3, code: 'return self.delta.actual.min * 2 + self.delta.actual.regen + self.delta.total.min;' })],
      previous: [stat({ id: 'a', value: 50, min: 0, regen: 0 })],
    }));
    expect(valueOf(out.stats, 'a')).toBe(23);
  });

  it('ignores a write to delta', async () => {
    const out = await runStatCodeTurn(turn({
      stats: [stat({ id: 'a', value: 70, code: 'self.delta.ai.value = 5; self.delta.actual = { value: 1 }; return self.delta.ai.value + self.delta.actual.value;' })],
      previous: [stat({ id: 'a', value: 50 })],
      asks: [{ id: 'a', value: 20, max: 0 }],
    }));
    expect(valueOf(out.stats, 'a')).toBe(40);
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
        stat({ id: 'a', value: 50, code: 'stats.B.value = 1; stats.B.max = 1; return 10;' }),
        stat({ id: 'b', name: 'B', value: 80 }),
      ],
    }));
    expect(valueOf(out.stats, 'b')).toBe(80);
    expect(out.moved).toEqual(['a']);
  });

  it('keeps a disabled stat inert and hides it from every other stat', async () => {
    const out = await runStatCodeTurn(turn({
      stats: [
        stat({ id: 'a', name: 'A', value: 50, code: 'return Object.keys(stats).length * 10 + ("Off" in stats ? 1 : 0);' }),
        stat({ id: 'off', name: 'Off', value: 5, code: 'return 99;' }),
      ],
      enabled: { off: false },
    }));
    expect(valueOf(out.stats, 'a')).toBe(10);
    expect(valueOf(out.stats, 'off')).toBe(5);
    expect(out.moved).toEqual(['a']);
  });

  it('reads another stat by name, the last authored winning a shared name and an unknown name reading zero', async () => {
    const out = await runStatCodeTurn(turn({
      stats: [
        stat({ id: 'a', name: 'A', max: 1000, code: 'return stats.Health.value + stats["Night Vision"].value + stats.Gone.value;' }),
        stat({ id: 'h1', name: 'Health', value: 10 }),
        stat({ id: 'h2', name: 'Health', value: 20 }),
        stat({ id: 'nv', name: 'Night Vision', value: 3 }),
      ],
    }));
    expect(valueOf(out.stats, 'a')).toBe(23);
  });

  it('reads a disabled stat’s name as a blank entry', async () => {
    const out = await runStatCodeTurn(turn({
      stats: [
        stat({ id: 'a', name: 'A', value: 50, code: 'return stats.Off.value;' }),
        stat({ id: 'off', name: 'Off', value: 5 }),
      ],
      enabled: { off: false },
    }));
    expect(valueOf(out.stats, 'a')).toBe(0);
    expect(valueOf(out.stats, 'off')).toBe(5);
    expect(out.moved).toEqual(['a']);
  });

  it('reads zero asks on a clock-only run, with the clock still ticking', async () => {
    const out = await runStatCodeTurn(turn({
      stats: [stat({ id: 'a', value: 50, max: 1000, code: 'return self.delta.ai.value + self.delta.ai.max + deltaHours * 100;' })],
      asks: [],
      clock: { deltaHours: 3, elapsedHours: 10 },
    }));
    expect(valueOf(out.stats, 'a')).toBe(300);
  });

  it('gives the same result for the same turn, so a re-roll does not stack', async () => {
    const input = turn({
      stats: [stat({ id: 'a', value: 70, code: 'self.value = self.previous.value + self.delta.ai.value / 2;' })],
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

  it('reads an unknown name as a placeholder with no text, so a write to it is dropped rather than thrown', async () => {
    await expect(run('return placeholders.Nope.value === "" ? 1 : 0;', [mood])).resolves.toBe(1);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(run('placeholders.Nope.value = "x"; return 1;', [mood])).resolves.toBe(1);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Nope'));
    warn.mockRestore();
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

describe('runStatCodeTurn placeholder writes', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  const mood: Placeholder = { id: 'mood', name: 'Mood', values: phValues(['calm', 'angry', 'sad']) };
  const rolls: PlaceholderRolls = { world: { mood: 'calm' } };
  /** Stats running `codes` in order, over Mood rolled calm and the Code Pins already in force. */
  const run = (codes: string[], { placeholders = [mood], codePins = {} }: { placeholders?: Placeholder[]; codePins?: Record<string, string> } = {}) =>
    runStatCodeTurn(turn({
      stats: codes.map((code, i) => stat({ id: `s${i}`, value: 0, code })),
      placeholders: { placeholders, rolls, pins: collectPins({ traits: [], placeholders, rolls, codePins }) },
    }));
  const chip = encodePlaceholderToken({ id: 'mood', mode: 'world', placementId: 'p' });
  /** The narration text the next prompt sends, under the Code Pins a turn leaves. */
  const nextPrompt = (codePins: Record<string, string>) =>
    resolvePlaceholders(`She is ${chip}.`, { placeholders: [mood], rolls, pins: collectPins({ traits: [], placeholders: [mood], rolls, codePins }) });

  it('turns a value write into a Code Pin the next prompt reads', async () => {
    const { pinWrites } = await run(['placeholders.Mood.value = "angry";']);
    expect(pinWrites).toEqual({ mood: 'angry' });
    expect(nextPrompt(withPinWrites({}, pinWrites))).toBe('She is angry.');
  });

  it('turns a pin() call into the same Code Pin a value write makes', async () => {
    const { pinWrites } = await run(['placeholders.Mood.pin("angry");']);
    expect(pinWrites).toEqual({ mood: 'angry' });
    expect(nextPrompt(withPinWrites({}, pinWrites))).toBe('She is angry.');
  });

  it('pins text that is not on the authored list', async () => {
    const { pinWrites } = await run(['placeholders.Mood.value = "incandescent";']);
    expect(nextPrompt(withPinWrites({}, pinWrites))).toBe('She is incandescent.');
  });

  it('takes a bare string assigned to the entry as a value write', async () => {
    await expect(run(['placeholders.Mood = "sad";'])).resolves.toMatchObject({ pinWrites: { mood: 'sad' } });
  });

  it('drops and reports a write to a name no placeholder has, keeping the run’s other writes', async () => {
    const { pinWrites, stats } = await run(['placeholders.Nope = "x"; placeholders.Mood.value = "sad"; return 7;']);
    expect(pinWrites).toEqual({ mood: 'sad' });
    expect(valueOf(stats, 's0')).toBe(7);
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('Nope'));
  });

  it('applies two stats’ writes to one placeholder in stat order, the last winning', async () => {
    const angry = 'placeholders.Mood.value = "angry";';
    const sad = 'placeholders.Mood.value = "sad";';
    await expect(run([sad, angry])).resolves.toMatchObject({ pinWrites: { mood: 'angry' } });
    await expect(run([angry, sad])).resolves.toMatchObject({ pinWrites: { mood: 'sad' } });
  });

  it('lets the later stat win with the text the placeholder started the run at', async () => {
    const angry = 'placeholders.Mood.value = "angry";';
    const calm = 'placeholders.Mood.value = "calm";';
    await expect(run([angry, calm])).resolves.toMatchObject({ pinWrites: { mood: 'calm' } });
  });

  it('pins a written text that an authored pin already shows, so it outlasts that pin', async () => {
    const band = stat({ id: 'band', value: 10, descriptors: [{ id: 'low', threshold: 50, description: 'low', placeholderPins: [{ placeholderId: 'mood', value: 'angry' }] }] });
    const pins = collectPins({ traits: [], stats: [band], placeholders: [mood], rolls });
    const out = await runStatCodeTurn(turn({
      stats: [band, stat({ id: 's0', value: 0, code: 'placeholders.Mood.value = "angry";' })],
      placeholders: { placeholders: [mood], rolls, pins },
    }));
    expect(out.pinWrites).toEqual({ mood: 'angry' });
  });

  it('holds a Code Pin across turns while code writes the same text again', async () => {
    const pins = { mood: 'angry' };
    const { pinWrites } = await run(['placeholders.Mood.value = "angry";'], { codePins: pins });
    expect(withPinWrites(pins, pinWrites)).toBe(pins);
  });

  it('releases a Code Pin on unpin(), bringing the Roll back', async () => {
    const { pinWrites } = await run(['placeholders.Mood.unpin();'], { codePins: { mood: 'angry' } });
    expect(pinWrites).toEqual({ mood: null });
    expect(nextPrompt(withPinWrites({ mood: 'angry' }, pinWrites))).toBe('She is calm.');
  });

  it('leaves the Code Pins alone when unpin() hits a placeholder code never pinned', async () => {
    const pins = { other: 'x' };
    const { pinWrites } = await run(['placeholders.Mood.unpin();']);
    expect(withPinWrites(pins, pinWrites)).toBe(pins);
  });

  it('pins the last authored of two same-named placeholders', async () => {
    const twin: Placeholder = { id: 'mood-2', name: 'Mood', values: phValues(['calm']) };
    await expect(run(['placeholders.Mood.value = "sad";'], { placeholders: [mood, twin] }))
      .resolves.toMatchObject({ pinWrites: { 'mood-2': 'sad' } });
  });

  it('discards the writes of a run that fails, and of a disabled stat', async () => {
    await expect(run(['placeholders.Mood.value = "sad"; throw new Error("late");'])).resolves.toMatchObject({ pinWrites: {} });
    const out = await runStatCodeTurn(turn({
      stats: [stat({ id: 'off', value: 0, code: 'placeholders.Mood.value = "sad";' })],
      enabled: { off: false },
      placeholders: { placeholders: [mood], rolls },
    }));
    expect(out.pinWrites).toEqual({});
  });
});

describe('runStatCodeTurn bound writes', () => {
  beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}));
  afterEach(() => vi.restoreAllMocks());

  /** A stat as a playthrough carries it: bases seeded, AI delta booked, bounds derived from them. */
  const seeded = (over: Partial<PlayerStat>): PlayerStat => stat({
    id: 'a', min: 0, max: 100, regen: 0, baseMin: 0, baseMax: 100, baseRegen: 0, aiMaxDelta: 0, ...over,
  });
  const only = (out: { stats: readonly PlayerStat[] }) => out.stats[0];
  const raiseCap: Trait = { id: 't', name: 'Robust', statChanges: [{ statId: 'a', value: 20, type: 'max' }] };

  it.each([
    ['min', 'self.min = 10;', { min: 10 }],
    ['max', 'self.max = 80;', { max: 80 }],
    ['regen', 'self.regen = 3;', { regen: 3 }],
  ] as const)('lands a self.%s write as a code bound and the effective bound', async (_field, code, expected) => {
    const out = await runStatCodeTurn(turn({ stats: [seeded({ code })] }));
    expect(only(out)).toMatchObject(expected);
    expect(only(out).codeBounds).toEqual(expected);
    expect(out.boundsChanged).toEqual(['a']);
    expect(out.moved).toEqual([]);
  });

  it('leaves a bound the code did not write to the pipeline, and a code bound it did not rewrite in place', async () => {
    const out = await runStatCodeTurn(turn({
      stats: [seeded({ min: 5, codeBounds: { min: 5 }, regen: 2, baseRegen: 2, code: 'self.max = 80;' })],
    }));
    expect(only(out)).toMatchObject({ min: 5, max: 80, regen: 2 });
    expect(only(out).codeBounds).toEqual({ min: 5, max: 80 });
  });

  it('clamps a value write in the same run to the range it just wrote', async () => {
    const out = await runStatCodeTurn(turn({ stats: [seeded({ value: 50, code: 'self.max = 30; self.value = 90;' })] }));
    expect(only(out)).toMatchObject({ max: 30, value: 30 });
    expect(out.moved).toEqual(['a']);
  });

  it('settles an untouched value into a range the code shrank', async () => {
    const out = await runStatCodeTurn(turn({ stats: [seeded({ value: 70, code: 'self.max = 40;' })] }));
    expect(only(out)).toMatchObject({ max: 40, value: 40 });
    expect(out.moved).toEqual(['a']);
  });

  it('keeps the active traits under a bound the code did not write', async () => {
    const out = await runStatCodeTurn(turn({
      stats: [seeded({ max: 120, code: 'self.min = 10;' })],
      traits: inForce([raiseCap]),
    }));
    expect(only(out)).toMatchObject({ min: 10, max: 120 });
  });

  it('clears every code bound of a stat with empty code, and the derived cap with its AI delta returns', async () => {
    const out = await runStatCodeTurn(turn({
      stats: [seeded({ value: 30, min: 20, max: 40, regen: 5, aiMaxDelta: 15, codeBounds: { min: 20, max: 40, regen: 5 }, code: '  ' })],
    }));
    expect(only(out)).toMatchObject({ min: 0, max: 115, regen: 0, value: 30 });
    expect('codeBounds' in only(out)).toBe(false);
    expect(out.boundsChanged).toEqual(['a']);
  });

  it('keeps the code bounds of a disabled stat, whose code never runs', async () => {
    const stats = [seeded({ max: 40, codeBounds: { max: 40 }, code: '' })];
    const out = await runStatCodeTurn(turn({ stats, enabled: { a: false } }));
    expect(out.stats).toBe(stats);
  });

  it('discards a bound write when the code throws after making it', async () => {
    const stats = [seeded({ code: 'self.max = 30; throw new Error("late");' })];
    const out = await runStatCodeTurn(turn({ stats }));
    expect(out.stats).toBe(stats);
    expect(out.boundsChanged).toEqual([]);
  });

  it('writes nothing for code that sets a bound to the number it already has', async () => {
    const stats = [seeded({ max: 40, codeBounds: { max: 40 }, code: 'self.max = 40;' })];
    expect((await runStatCodeTurn(turn({ stats }))).stats).toBe(stats);
  });
});

describe('runStatCodeTurn traits', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  const seeded = (over: Partial<PlayerStat>): PlayerStat => stat({
    min: 0, max: 100, regen: 0, baseMin: 0, baseMax: 100, baseRegen: 0, aiMaxDelta: 0, ...over,
  });
  const group: TraitGroup = { id: 'g', name: 'Origin', parentId: null, exclusive: true };
  // Brave is acquired and on, Timid acquired and off, Cursed never acquired; Brave and Cursed share a group.
  const brave: Trait = { id: 'brave', name: 'Brave', groupId: 'g', statChanges: [{ statId: 'h', value: 10, type: 'starting' }] };
  const timid: Trait = { id: 'timid', name: 'Timid', statChanges: [{ statId: 'h', value: -20, type: 'starting' }] };
  const cursed: Trait = { id: 'cursed', name: 'Cursed', groupId: 'g', statChanges: [{ statId: 'h', value: 50, type: 'max' }] };
  const world = { traits: [brave, timid, cursed], groups: [group] };
  const held = (over: Partial<StatCodeTraits> = {}): StatCodeTraits => ({
    acquired: [brave, timid], disabledTraitIds: ['timid'], appliedValues: { brave: { h: 10 }, timid: { h: 20 } }, world, ...over,
  });
  /** Health at 60 under Brave, plus one stat per piece of code, in order. */
  const run = (codes: string[], traits: StatCodeTraits = held()) =>
    runStatCodeTurn(turn({
      stats: [seeded({ id: 'h', name: 'Health', value: 60 }), ...codes.map((code, i) => seeded({ id: `s${i}`, name: `S${i}`, code }))],
      traits,
    }));
  const health = (out: { stats: readonly PlayerStat[] }) => out.stats.find((s) => s.id === 'h')!;

  it('reads enabled and acquired for an enabled, a switched-off, and an unacquired trait', async () => {
    const code = 'return [traits.Brave, traits.Timid, traits.Cursed].map(e => (e.enabled ? 2 : 0) + (e.acquired ? 1 : 0)).join("") * 1;';
    const out = await runStatCodeTurn(turn({ stats: [seeded({ id: 'a', max: 1000, code })], traits: held() }));
    expect(valueOf(out.stats, 'a')).toBe(310);
  });

  it('re-enables an acquired trait, reversing the movement its switch-off recorded', async () => {
    const out = await run(['traits.Timid.enabled = true;']);
    expect(out.traits).toMatchObject({ disabledTraitIds: [] });
    expect(health(out).value).toBe(40);
    expect(out.traits?.log).toEqual(['Trait switched on: Timid (by S0)']);
  });

  it.each([[false], [true]])('acquires an unacquired trait on switch-on, Player Can Toggle In-Game %s', async (playerToggle) => {
    const out = await run(['traits.Cursed.enabled = true;'], held({ world: { ...world, traits: [brave, timid, { ...cursed, playerToggle }] } }));
    expect(out.traits?.acquired.map((t) => t.id)).toEqual(['brave', 'timid', 'cursed']);
    expect(health(out).max).toBe(150);
  });

  it('switches an acquired trait off, handing back what it moved', async () => {
    const out = await run(['traits.Brave.enabled = false;']);
    expect(out.traits).toMatchObject({ disabledTraitIds: ['timid', 'brave'], log: ['Trait switched off: Brave (by S0)'] });
    expect(health(out).value).toBe(50);
  });

  it('does nothing for a switch-off of a trait the player never acquired', async () => {
    const out = await run(['traits.Cursed.enabled = false; traits.Cursed = false;']);
    expect(out.traits).toBeUndefined();
    expect(health(out).value).toBe(60);
  });

  it('retires an exclusive sibling on a code switch-on and logs both, attributed to the stat', async () => {
    const out = await run(['traits.Cursed.enabled = true;']);
    expect(out.traits?.disabledTraitIds).toContain('brave');
    expect(out.traits?.log).toEqual(['Trait switched off: Brave (by S0)', 'Acquired trait: Cursed (by S0)']);
    expect(health(out)).toMatchObject({ max: 150, value: 50 });
  });

  it('lands the switch after the run: every stat reads the pre-switch traits and bounds', async () => {
    const out = await run([
      'traits.Cursed.enabled = true;',
      'return (traits.Cursed.enabled ? 1 : 0) + stats.Health.max / 10;',
    ]);
    // Read after the switch, this would be 1 + 150 / 10.
    expect(valueOf(out.stats, 's1')).toBe(10);
    expect(health(out).max).toBe(150);
  });

  it('keeps a bound the code wrote this run over the bound its trait switch moved', async () => {
    const out = await runStatCodeTurn(turn({
      stats: [seeded({ id: 'h', name: 'Health', value: 60, code: 'traits.Cursed.enabled = true; self.max = 80;' })],
      traits: held(),
    }));
    expect(health(out)).toMatchObject({ max: 80, codeBounds: { max: 80 } });
  });

  it('applies two stats switching one trait once, the later stat winning', async () => {
    const off = 'traits.Brave.enabled = false;';
    const on = 'traits.Brave.enabled = true;';
    const twice = await run([off, off]);
    expect(twice.traits?.log).toEqual(['Trait switched off: Brave (by S1)']);
    expect(health(twice).value).toBe(50);
    await expect(run([on, off])).resolves.toMatchObject({ traits: { log: ['Trait switched off: Brave (by S1)'] } });
    // The later stat asks for the state Brave already holds, so Brave stays on and nothing switches.
    const keptOn = await run([off, on]);
    expect(keptOn.traits).toBeUndefined();
    expect(health(keptOn).value).toBe(60);
  });

  it('applies switches of different traits in stat order', async () => {
    const braveFirst = await run(['traits.Brave.enabled = false;', 'traits.Cursed.enabled = true;']);
    expect(braveFirst.traits?.log).toEqual(['Trait switched off: Brave (by S0)', 'Acquired trait: Cursed (by S1)']);
    // Cursed retires Brave first, which leaves the later switch-off nothing to do.
    const cursedFirst = await run(['traits.Cursed.enabled = true;', 'traits.Brave.enabled = false;']);
    expect(cursedFirst.traits?.log).toEqual(['Trait switched off: Brave (by S0)', 'Acquired trait: Cursed (by S0)']);
  });

  it('lands a later stat’s switch after the earlier stat’s, so it wins an exclusive group', async () => {
    const blessed: Trait = { id: 'blessed', name: 'Blessed', groupId: 'g', statChanges: [] };
    const traits = held({ world: { ...world, traits: [brave, timid, cursed, blessed] } });
    // Alone, the first stat's two switch-ons land in map order and Blessed retires Cursed.
    const out = await run(['traits.Cursed.enabled = true; traits.Blessed.enabled = true;', 'traits.Cursed.enabled = true;'], traits);
    expect(out.traits?.disabledTraitIds).toContain('blessed');
    expect(out.traits?.disabledTraitIds).not.toContain('cursed');
  });

  it('clamps a value the code wrote into the range its trait switch left', async () => {
    const frail: Trait = { id: 'frail', name: 'Frail', statChanges: [{ statId: 'h', value: -50, type: 'max' }] };
    const out = await runStatCodeTurn(turn({
      stats: [seeded({ id: 'h', name: 'Health', value: 60, code: 'traits.Frail.enabled = true; self.value = 90;' })],
      traits: held({ world: { ...world, traits: [brave, timid, cursed, frail] } }),
    }));
    expect(health(out)).toMatchObject({ max: 50, value: 50 });
  });

  it('drops and reports a switch of an unknown name and a write to acquired, keeping the run’s other writes', async () => {
    const out = await run(['traits.Nope.enabled = true; traits.Cursed.acquired = true; traits.Timid.enabled = true; return 7;']);
    expect(out.traits?.log).toEqual(['Trait switched on: Timid (by S0)']);
    expect(valueOf(out.stats, 's0')).toBe(7);
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('Nope'));
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('Cursed'));
  });

  it('discards the switches of a run that fails, and of a disabled stat', async () => {
    expect((await run(['traits.Timid.enabled = true; throw new Error("late");'])).traits).toBeUndefined();
    const out = await runStatCodeTurn(turn({
      stats: [seeded({ id: 'h', value: 60 }), seeded({ id: 'off', code: 'traits.Timid.enabled = true;' })],
      enabled: { off: false },
      traits: held(),
    }));
    expect(out.traits).toBeUndefined();
  });

  it('reads and logs a trait by the name it is given', async () => {
    const out = await run(['traits.BRAVE.enabled = false;'], held({ nameOf: (t) => t.name.toUpperCase() }));
    expect(out.traits?.log).toEqual(['Trait switched off: BRAVE (by S0)']);
  });

  it('carries a switch onto the latest stats, re-derived under the traits now in force', async () => {
    const result = await run(['traits.Cursed.enabled = true;']);
    // An AI max ask landed on the latest Health while the run was in flight.
    const latest = [seeded({ id: 'h', value: 60, max: 110, aiMaxDelta: 10 }), seeded({ id: 's0' })];
    expect(overlayStatCodeResult(latest, result, [brave])[0]).toMatchObject({ max: 160, value: 50 });
  });
});

describe('overlayStatCodeResult', () => {
  const seeded = (over: Partial<PlayerStat>): PlayerStat => stat({
    id: 'a', min: 0, max: 100, baseMin: 0, baseMax: 100, baseRegen: 0, aiMaxDelta: 0, ...over,
  });

  it('carries a code bound onto the latest stat, re-derived from its own AI delta', async () => {
    const result = await runStatCodeTurn(turn({ stats: [seeded({ value: 50, code: 'self.min = 10;' })] }));
    // An AI max ask landed on the latest copy while the run was in flight.
    const [latest] = overlayStatCodeResult([seeded({ value: 70, max: 120, aiMaxDelta: 20 })], result, []);
    expect(latest).toMatchObject({ min: 10, max: 120, value: 70, codeBounds: { min: 10 } });
  });

  it('carries only the value the code moved, and leaves an untouched stat as it is', async () => {
    const result = await runStatCodeTurn(turn({
      stats: [seeded({ value: 50, code: 'return 20;' }), seeded({ id: 'b', value: 50 })],
    }));
    const latest = [seeded({ value: 45 }), seeded({ id: 'b', value: 44 })];
    const out = overlayStatCodeResult(latest, result, []);
    expect(out[0].value).toBe(20);
    expect(out[1]).toBe(latest[1]);
  });

  it('keeps the latest value of a stat whose bounds alone changed, settled into the new range', async () => {
    const result = await runStatCodeTurn(turn({ stats: [seeded({ value: 30, code: 'self.max = 60;' })] }));
    expect(overlayStatCodeResult([seeded({ value: 90 })], result, [])[0]).toMatchObject({ max: 60, value: 60 });
    expect(overlayStatCodeResult([seeded({ value: 25 })], result, [])[0]).toMatchObject({ max: 60, value: 25 });
  });
});
