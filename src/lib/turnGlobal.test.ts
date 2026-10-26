/**
 * @vitest-environment node
 * (No DOM needed; node keeps the QuickJS WASM engine loading through its filesystem path.)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { snapshotOf } from './sandboxSnapshot';
import { openingStateOf } from './openingState';
import { runStatCodeTurn } from './statCodeTurn';
import { runTestCode, type StatCodeWorld } from './statCodeTestRun';
import { checkScripts } from './testBench/scriptCheck';
import { SAMPLE_ACTION, SAMPLE_CHOICES, SAMPLE_PAGE, sampleTurn } from './scriptTestSamples';
import { DEFAULT_OPENING, heaviestWorldOpening } from './openings';
import { runToolScript } from './tools/toolScript';
import { sampleToolSnapshot } from './tools/sampleToolSnapshot';
import { buildToolSnapshot } from './tools/toolSnapshot';
import { sampleChipScene } from './chipValues/sampleScene';
import { statCodeTurnOf } from '@/test/statCodeTurnFixture';
import type { Opening, PlayerStat, Stat, Trait, WorldOverview } from '@/types';
import type { RuleWorld } from './testBench/rules';

/** `turn` on every run path: play's snapshot, a switch inside a turn, Tools, Test Code and the Test Bench. */

const counter: Stat = { id: 'c', name: 'Count', type: 'number', description: '', min: -1, max: 999999, value: -1, regen: 0, descriptors: [] };
const READ = 'stats.Count.value = turn.number * 1000 + turn.action.length;';
const LIVE = { action: '[OOC: brief] I wait.', number: 3, narration: 'Rain taps the glass.', choices: ['Open the door.', 'Sit down.'] };

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

const written = (result: { statWrites?: readonly { id: string; value?: number }[] }) => result.statWrites?.find((w) => w.id === 'c')?.value;
const stateWith = (turn?: typeof LIVE) => ({ ...openingStateOf({ stats: [counter] }), clock: {}, ...(turn ? { turn } : {}) });

describe('turn in a run', () => {
  it('reads the state’s action and number', async () => {
    const result = await snapshotOf(stateWith(LIVE)).run({ home: { kind: 'world' }, timing: 'before', code: READ });
    expect(written(result)).toBe(3000 + LIVE.action.length);
  });

  it('reads an empty action at turn 0 when the state holds no turn', async () => {
    const result = await snapshotOf(stateWith()).run({ home: { kind: 'world' }, timing: 'before', code: READ });
    expect(written(result)).toBe(0);
  });

  it('lists a write to turn.action or turn.number as read-only and keeps the read', async () => {
    const code = 'turn.action = "x"; turn.number = 9; stats.Count.value = turn.number;';
    const result = await snapshotOf(stateWith(LIVE)).run({ home: { kind: 'world' }, timing: 'after', code });
    expect(written(result)).toBe(3);
    expect(result.readOnlyWrites).toEqual(expect.arrayContaining(['turn.action', 'turn.number']));
  });

  it('reads turn in an On Call World Tool’s run', async () => {
    const result = await snapshotOf(stateWith(LIVE)).run({ home: { kind: 'tool' }, timing: 'before', code: 'return turn.action;', args: {} });
    expect(result.reply).toBe(LIVE.action);
  });
});

describe('turn in a user Tool', () => {
  const toolSnapshot = () => buildToolSnapshot(sampleChipScene(), [], null, { state: stateWith(LIVE), authored: null });

  it('reads the turn the snapshot’s state holds', async () => {
    expect(await runToolScript('return [turn.action, turn.number];', {}, toolSnapshot())).toEqual({ text: JSON.stringify([LIVE.action, 3]) });
  });

  it('lists a write to turn.action as dropped', async () => {
    const result = await runToolScript('turn.action = "x"; return turn.action;', {}, toolSnapshot());
    expect(result).toEqual({ text: LIVE.action, dropped: ['turn.action'] });
  });

  it('reads the sample action at turn 4 in the Settings sample world', async () => {
    expect(await runToolScript('return [turn.action, turn.number];', {}, sampleToolSnapshot())).toEqual({ text: JSON.stringify([SAMPLE_ACTION, 4]) });
  });
});

describe('turn in a switch run inside a turn', () => {
  const brave: Trait = { id: 'brave', name: 'Brave', statChanges: [], scripts: [{ id: 'sw', timing: 'switch', code: READ }] };
  const stat = (over: Partial<PlayerStat>): PlayerStat => ({
    ...counter, baseMin: -1, baseMax: 999999, baseRegen: 0, aiMaxDelta: 0, ...over, value: over.value ?? -1,
  });

  it('reads the turn the script that fired it ran in', async () => {
    const switcher = stat({ id: 's', name: 'Switcher', scripts: [{ id: 'on', timing: 'after', code: 'traits.Brave.enabled = true; return 0;' }] });
    const out = await runStatCodeTurn(statCodeTurnOf({
      stats: [stat({}), switcher], enabled: {}, previous: [], asks: [], regenApplied: {}, clock: {}, turn: LIVE,
      ownerTraits: { acquired: [], disabledTraitIds: [], appliedValues: {}, entities: [], library: [], world: { traits: [{ ...brave, playerToggle: true }], groups: [] } },
      statNameOf: (s) => s.name, traitNameOf: (t) => t.name,
    }));
    expect(out.stats.find((s) => s.id === 'c')?.value).toBe(3000 + LIVE.action.length);
  });
});

const action = (id: string, text: string, kind: Opening['kind'] = 'action'): Opening => ({ id, text, kind });
const overview = (over: Partial<WorldOverview>) => ({ name: 'W', ...over } as WorldOverview);

describe('the opening an editor run reads', () => {
  it('picks the heaviest world Opening Action, the first on a tie', () => {
    const openings = [action('a', 'Light.'), action('b', 'Heavy.'), action('c', 'Also heavy.')];
    expect(heaviestWorldOpening(overview({ openings, openingWeights: { b: 3, c: 3 } }))?.text).toBe('Heavy.');
  });

  it('skips benched and blank rows', () => {
    const openings = [action('a', 'Benched.'), action('b', '  '), action('c', 'Drawn.')];
    expect(heaviestWorldOpening(overview({ openings, openingWeights: { a: 0, b: 9 } }))?.text).toBe('Drawn.');
  });

  it('reads none when every drawable row is a narration', () => {
    expect(heaviestWorldOpening(overview({ openings: [action('n', 'Page one.', 'narration')] }))).toBeNull();
  });

  it('reads the default opening when the list is off or empty', () => {
    expect(heaviestWorldOpening(overview({ openings: [action('a', 'Off.')], openingsEnabled: false }))).toBe(DEFAULT_OPENING);
    expect(heaviestWorldOpening(overview({}))).toBe(DEFAULT_OPENING);
  });

  it('gives At Game Start the opening at turn 1, a narration one empty, and every other timing the sample at turn 2', () => {
    const world = overview({ openings: [action('a', ' Dock. ')] });
    const empty = { narration: '', choices: [] };
    expect(sampleTurn(world, 'start')).toEqual({ action: 'Dock.', number: 1, ...empty });
    expect(sampleTurn(overview({ openings: [action('n', 'Page.', 'narration')] }), 'start')).toEqual({ action: '', number: 1, ...empty });
    for (const timing of ['before', 'output', 'switch'] as const) expect(sampleTurn(world, timing)).toEqual({ action: SAMPLE_ACTION, number: 2, ...empty });
    expect(sampleTurn(world, 'after')).toEqual({ action: SAMPLE_ACTION, number: 2, narration: SAMPLE_PAGE, choices: SAMPLE_CHOICES });
  });
});

describe('turn in Test Code and the Test Bench', () => {
  const world: StatCodeWorld & Pick<RuleWorld, 'worldOverview'> = {
    stats: [counter], statGroups: [], traits: [], traitGroups: [], entities: [], entityGroups: [], placeholders: [], placeholderGroups: [], dictionaries: [],
    worldOverview: overview({ openings: [action('a', 'I walk the pier.')] }),
  };

  it('reads the sample action at turn 2', async () => {
    const report = await runTestCode(READ, 'before', { kind: 'world' }, world);
    expect(report.writes).toEqual([`stats.Count.value = ${2000 + SAMPLE_ACTION.length}`]);
  });

  it('reads the world’s heaviest Opening Action at turn 1 in At Game Start', async () => {
    const report = await runTestCode(READ, 'start', { kind: 'world' }, world);
    expect(report.writes).toEqual([`stats.Count.value = ${1000 + 'I walk the pier.'.length}`]);
  });

  it('reads the same sample on the Test Bench', async () => {
    const rule = { ...world, locations: [], scripts: [{ id: 'b', timing: 'before' as const, code: 'if (turn.number !== 2 || turn.action !== "Look around.") throw new Error("off");' }] };
    expect(await checkScripts(rule as unknown as RuleWorld)).toEqual([]);
  });
});

/** `turn.narration` and `turn.choices`: filled at After the AI and between turns, empty before the reply. */
describe('turn.narration and turn.choices', () => {
  const REPLY = 'return JSON.stringify([turn.narration, turn.choices]);';
  const replyAt = async (timing: 'start' | 'before' | 'output' | 'after' | 'switch') =>
    (await snapshotOf(stateWith(LIVE)).run({ home: { kind: 'tool' }, timing, code: REPLY, args: {} })).reply;

  it('reads the state’s page and choices at After the AI and in a switch run', async () => {
    const filled = JSON.stringify([LIVE.narration, LIVE.choices]);
    expect(await replyAt('after')).toBe(filled);
    expect(await replyAt('switch')).toBe(filled);
  });

  it('reads both empty at At Game Start, Before the AI and During AI Output on the same state', async () => {
    for (const timing of ['start', 'before', 'output'] as const) expect(await replyAt(timing)).toBe(JSON.stringify(['', []]));
  });

  it('reads both empty when the state holds no turn', async () => {
    const result = await snapshotOf(stateWith()).run({ home: { kind: 'tool' }, timing: 'after', code: REPLY, args: {} });
    expect(result.reply).toBe(JSON.stringify(['', []]));
  });

  it('lists a write to either as read-only and lands nothing, where choices take no write', async () => {
    const code = [
      'turn.narration = "x"; turn.choices = ["y"];',
      'turn.choices[0] = "z";',
      'turn.choices.push("w");',
      'return JSON.stringify([turn.narration, turn.choices]);',
    ].join('\n');
    const result = await snapshotOf(stateWith(LIVE)).run({ home: { kind: 'tool' }, timing: 'after', code, args: {} });
    // The page keeps its text; the choices read the run's own edit, which lands nothing (Q25).
    expect(result.reply).toBe(JSON.stringify([LIVE.narration, ['z', 'w']]));
    expect(result.choices).toBeUndefined();
    expect(result.readOnlyWrites).toEqual(expect.arrayContaining(['turn.narration', 'turn.choices']));
  });

  it('reads both in a user Tool, and lists a write as dropped', async () => {
    const snapshot = buildToolSnapshot(sampleChipScene(), [], null, { state: stateWith(LIVE), authored: null });
    expect(await runToolScript('return [turn.narration, turn.choices];', {}, snapshot)).toEqual({ text: JSON.stringify([LIVE.narration, LIVE.choices]) });
    expect(await runToolScript('turn.choices = []; return turn.choices.length;', {}, snapshot)).toEqual({ text: '2', dropped: ['turn.choices'] });
  });

  it('reads both empty in the Settings sample world, an in-turn call', async () => {
    expect(await runToolScript('return [turn.narration, turn.choices];', {}, sampleToolSnapshot())).toEqual({ text: JSON.stringify(['', []]) });
  });

  it('reads the sample page and three choices in Test Code at After the AI, and empty elsewhere', async () => {
    const world: StatCodeWorld = { stats: [counter], statGroups: [], traits: [], traitGroups: [], entities: [], entityGroups: [], placeholders: [], placeholderGroups: [], dictionaries: [] };
    const code = 'stats.Count.value = turn.narration.length * 10 + turn.choices.length;';
    expect((await runTestCode(code, 'after', { kind: 'world' }, world)).writes).toEqual([`stats.Count.value = ${SAMPLE_PAGE.length * 10 + 3}`]);
    for (const timing of ['start', 'before', 'output', 'switch'] as const) {
      expect((await runTestCode(code, timing, { kind: 'world' }, world)).writes).toEqual(['stats.Count.value = 0']);
    }
  });

  it('reads the same sample on the Test Bench', async () => {
    const expected = JSON.stringify([SAMPLE_PAGE, SAMPLE_CHOICES]);
    const check = (timing: 'before' | 'after', want: string) =>
      `if (JSON.stringify([turn.narration, turn.choices]) !== ${JSON.stringify(want)}) throw new Error("off");`;
    const rule = {
      stats: [counter], statGroups: [], traits: [], traitGroups: [], entities: [], entityGroups: [], placeholders: [], placeholderGroups: [], dictionaries: [],
      worldOverview: overview({}), locations: [],
      scripts: [
        { id: 'a', timing: 'after' as const, code: check('after', expected) },
        { id: 'b', timing: 'before' as const, code: check('before', JSON.stringify(['', []])) },
      ],
    };
    expect(await checkScripts(rule as unknown as RuleWorld)).toEqual([]);
  });
});
