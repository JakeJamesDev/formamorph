/**
 * @vitest-environment node
 * (No DOM needed; node keeps the QuickJS WASM engine loading through its filesystem path.)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { snapshotOf, type UnitHome } from './sandboxSnapshot';
import { openingStateOf } from './openingState';
import { runStatCodeTurn, type StatCodeTurn } from './statCodeTurn';
import type { ScriptPromptHost, ScriptPromptRequest } from './scriptPrompts';
import { runTestCode, type StatCodeWorld } from './statCodeTestRun';
import { SAMPLE_CHOICES } from './scriptTestSamples';
import { runToolScript } from './tools/toolScript';
import { buildToolSnapshot } from './tools/toolSnapshot';
import { sampleChipScene } from './chipValues/sampleScene';
import type { RunTiming } from './statCodeTiming';
import type { SandboxTurn } from './statCodeExecutor';
import { statCodeTurnOf } from '@/test/statCodeTurnFixture';
import type { PlayerStat, Script, Stat, Trait } from '@/types';

/** `turn.choices` takes a write at After the AI only, as one array the batch's scripts share in run order. */

const counter: Stat = { id: 'c', name: 'Count', type: 'number', description: '', min: -1, max: 999999, value: -1, regen: 0, descriptors: [] };
const LIVE: SandboxTurn = { action: 'I wait.', number: 3, narration: 'Rain taps the glass.', choices: ['Open the door.', 'Sit down.'] };

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

const stateWith = (turn: SandboxTurn = LIVE) => ({ ...openingStateOf({ stats: [counter] }), clock: {}, turn });
const WORLD: UnitHome = { kind: 'world' };
const run = (code: string, timing: RunTiming = 'after', turn: SandboxTurn = LIVE) =>
  snapshotOf(stateWith(turn)).run({ home: WORLD, timing, code });
const counted = (result: { statWrites?: readonly { id: string; value?: number }[] }) => result.statWrites?.find((w) => w.id === 'c')?.value;

describe('a turn.choices write at After the AI', () => {
  it.each([
    ['an assignment', 'turn.choices = ["Run.", "Hide."];', ['Run.', 'Hide.']],
    ['a push', 'turn.choices.push("Shout.");', [...LIVE.choices, 'Shout.']],
    ['a splice', 'turn.choices.splice(0, 1);', ['Sit down.']],
    ['an element edit', 'turn.choices[1] = "Stand up.";', ['Open the door.', 'Stand up.']],
    ['a filter then assign', 'turn.choices = turn.choices.filter((choice) => choice !== "Sit down.");', ['Open the door.']],
    ['an edit through an alias', 'const { choices } = turn; choices.reverse();', [...LIVE.choices].reverse()],
  ])('lands %s as the run’s choices', async (_kind, code, expected) => {
    const result = await run(code);
    expect(result.error).toBeNull();
    expect(result.choices).toEqual(expected);
    expect(result.readOnlyWrites).toBeUndefined();
  });

  it('reads its own edit for the rest of the run', async () => {
    expect(counted(await run('turn.choices.push("Shout."); stats.Count.value = turn.choices.length;'))).toBe(3);
  });

  it('takes an empty list', async () => {
    expect((await run('turn.choices = [];')).choices).toEqual([]);
  });

  it('is no write when the list ends as it started', async () => {
    const result = await run('turn.choices = [...turn.choices]; turn.choices.push("x"); turn.choices.pop();');
    expect(result.choices).toBeUndefined();
    expect(result.readOnlyWrites).toBeUndefined();
  });

  it.each([
    ['a number item', 'turn.choices.push(1);'],
    ['a blank item', 'turn.choices.push("   ");'],
    ['a hole', 'turn.choices[3] = "Late.";'],
    ['text in place of a list', 'turn.choices = "Run.";'],
    ['no list', 'turn.choices = undefined;'],
  ])('fails as a bad write on %s, and lands none of the run', async (_kind, code) => {
    const result = await run(`stats.Count.value = 5; ${code}`);
    expect(result).toMatchObject({ kind: 'bad-write', error: expect.stringMatching(/turn\.choices must be a list of text with no blank item/) });
    expect(result.statWrites).toBeUndefined();
    expect(result.choices).toBeUndefined();
  });
});

describe('a turn.choices write where it drops', () => {
  const WRITE = 'turn.choices.push("Shout."); turn.choices = ["Run."]; stats.Count.value = turn.choices.length;';
  const dropped = (result: Awaited<ReturnType<typeof run>>) => {
    expect(result.error).toBeNull();
    expect(result.choices).toBeUndefined();
    expect(result.readOnlyWrites).toContain('turn.choices');
    // The run keeps its other writes, and reads its own edit while it runs.
    expect(counted(result)).toBe(1);
  };

  it.each(['start', 'before', 'output', 'switch'] as const)('lists it as dropped at %s', async (timing) => {
    dropped(await run(WRITE, timing));
  });

  it('lists it as dropped in an After the AI World Tool', async () => {
    const result = await snapshotOf(stateWith()).run({ home: { kind: 'tool' }, timing: 'after', code: WRITE, args: {} });
    expect(result.choices).toBeUndefined();
    expect(result.readOnlyWrites).toContain('turn.choices');
  });

  it('lists it as dropped at After the AI with the player’s choices off', async () => {
    dropped(await run(WRITE, 'after', { ...LIVE, choices: [], choicesOff: true }));
  });

  it('lists it as dropped in a user Tool', async () => {
    const snapshot = buildToolSnapshot(sampleChipScene(), [], null, { state: stateWith(), authored: null });
    expect(await runToolScript('turn.choices = ["Run."]; return turn.choices;', {}, snapshot))
      .toEqual({ text: JSON.stringify(LIVE.choices), dropped: ['turn.choices'] });
  });
});

describe('the After the AI batch’s choices', () => {
  const stat = (over: Partial<PlayerStat>): PlayerStat => ({
    ...counter, baseMin: -1, baseMax: 999999, baseRegen: 0, aiMaxDelta: 0, ...over, value: over.value ?? -1,
  });
  const after = (id: string, code: string): Script => ({ id, timing: 'after', code });
  const batch = (worldScripts: Script[], traits: Trait[] = [], mode: Partial<StatCodeTurn> = {}) => runStatCodeTurn(statCodeTurnOf({
    stats: [stat({})], enabled: {}, previous: [], asks: [], regenApplied: {}, clock: {}, turn: LIVE, worldScripts,
    ownerTraits: { acquired: [], disabledTraitIds: [], appliedValues: {}, entities: [], library: [], world: { traits, groups: [] } },
    statNameOf: (s) => s.name, traitNameOf: (t) => t.name, ...mode,
  }));

  it('hands each script the list the scripts before it left', async () => {
    const out = await batch([
      after('a', 'turn.choices.push("Shout.");'),
      after('b', 'turn.choices = turn.choices.map((choice) => choice.toUpperCase());'),
    ]);
    expect(out.choices).toEqual(['OPEN THE DOOR.', 'SIT DOWN.', 'SHOUT.']);
  });

  it('keeps the list the earlier scripts left when a later run fails as a bad write', async () => {
    const out = await batch([after('a', 'turn.choices.push("Shout.");'), after('b', 'turn.choices.push("");')]);
    expect(out.choices).toEqual([...LIVE.choices, 'Shout.']);
  });

  it('is absent when no script changed the list', async () => {
    expect((await batch([after('a', 'stats.Count.value = turn.choices.length;')])).choices).toBeUndefined();
  });

  it('is absent when a later script puts back what an earlier one changed', async () => {
    expect((await batch([after('a', 'turn.choices.push("Shout.");'), after('b', 'turn.choices.pop();')])).choices).toBeUndefined();
  });

  it('reaches the switch runs it fires, whose own choices writes drop', async () => {
    const brave: Trait = {
      id: 'brave', name: 'Brave', statChanges: [], playerToggle: true,
      scripts: [{ id: 'sw', timing: 'switch', code: 'stats.Count.value = turn.choices.length * 10 + (turn.choices[0] === "Only." ? 1 : 0); turn.choices = [];' }],
    };
    const out = await batch([after('a', 'turn.choices = ["Only."]; traits.Brave.enabled = true;')], [brave]);
    expect(out.choices).toEqual(['Only.']);
    expect(out.stats.find((s) => s.id === 'c')?.value).toBe(11);
  });

  describe('in the choices-only mode', () => {
    const brave: Trait = { id: 'brave', name: 'Brave', statChanges: [], playerToggle: true };
    const choicesOnly = { choicesOnly: true };

    it('lands the choices write and drops a stat write, a trait switch, a discover and a memory', async () => {
      const out = await batch([
        after('a', 'stats.Count.value = 7; traits.Brave.enabled = true; discover("Stranger"); memories.add("Seen.");'),
        after('b', 'turn.choices.splice(0, 1);'),
      ], [brave], choicesOnly);
      expect(out.choices).toEqual(['Sit down.']);
      expect(out.stats.find((s) => s.id === 'c')?.value).toBe(-1);
      expect(out.moved).toEqual([]);
      expect(out.traits).toBeUndefined();
      expect(out.worldWrites).toBeUndefined();
      expect(out.pinWrites).toEqual({});
    });

    it('answers every player call at once and shows nothing, and the script runs on', async () => {
      const asked: ScriptPromptRequest[] = [];
      const prompts: ScriptPromptHost = {
        prompt: (request) => { asked.push(request); return new Promise(() => {}); },
      };
      const out = await batch([after('a', [
        'player.tell("Told."); player.toast("Toasted.");',
        'const one = player.ask("Which?", ["x", "y"]); const many = player.ask("Many?", ["x"], { multiple: true });',
        'turn.choices = [String(player.confirm("Go?")), String(one), JSON.stringify(many), "[" + player.input("Name?") + "]"];',
      ].join('\n'))], [], { ...choicesOnly, prompts });
      expect(out.choices).toEqual(['false', 'null', '[]', '[]']);
      expect(asked).toEqual([]);
    });

    it('runs no World Tool call, saved or armed', async () => {
      const out = await batch([], [], {
        ...choicesOnly,
        triggers: [{ name: 'Bell', code: 'stats.Count.value = 3;', args: {} }],
        replayed: [{ name: 'Bell', writes: { stats: [{ owner: null, writes: [{ id: 'c', value: 4 }] }] } }],
      });
      expect(out.stats.find((s) => s.id === 'c')?.value).toBe(-1);
      expect(out.reply).toBeUndefined();
    });
  });
});

describe('a turn.choices write in Test Code', () => {
  const world: StatCodeWorld = { stats: [counter], statGroups: [], traits: [], traitGroups: [], entities: [], entityGroups: [], placeholders: [], placeholderGroups: [], dictionaries: [] };

  it('lists the After the AI write with the list it leaves', async () => {
    const report = await runTestCode('turn.choices.push("Shout.");', 'after', { kind: 'world' }, world);
    expect(report.writes).toEqual([`turn.choices = ${JSON.stringify([...SAMPLE_CHOICES, 'Shout.'])}`]);
  });

  it('lists the write at Before the AI as a read-only field', async () => {
    const report = await runTestCode('turn.choices = ["Run."];', 'before', { kind: 'world' }, world);
    expect(report.writes).toEqual([]);
    expect(report.dropped).toEqual(['Read-only fields. Writes ignored: turn.choices.']);
  });
});
