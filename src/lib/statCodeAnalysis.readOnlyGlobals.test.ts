import { describe, expect, it } from 'vitest';
import { codeDiagnostics } from './statCodeAnalysis';
import { scriptSurface, SCRIPT_SURFACES, STAT_CODE_SURFACE } from './statCodeSurface';
import { toolScriptSurface } from './tools/toolScriptSurface';
import { worldToolSurface } from './tools/worldToolSurface';
import type { CodeSurface } from './codeSurface';
import type { ScriptTiming } from '@/types';

/** The editor's checks on a write that run time drops: a mutating call on `turn.choices`, and writes to
 *  `clock`, `location` and `notes` (Q25). */

const TIMINGS = ['start', 'before', 'output', 'after', 'switch'] as const satisfies readonly ScriptTiming[];
const at = (timing: ScriptTiming) => scriptSurface(SCRIPT_SURFACES.world, timing);
const messages = (code: string, surface: CodeSurface) => codeDiagnostics(code, { surface }).map((diagnostic) => diagnostic.message);

const MUTATORS = ['push("x")', 'pop()', 'shift()', 'unshift("x")', 'splice(0, 1)', 'sort()', 'reverse()', 'fill("x")', 'copyWithin(0, 1)'];

describe('a mutating call on turn.choices', () => {
  it.each(['start', 'before', 'output', 'switch'] as const)('lists every mutating call as read-only at %s', (timing) => {
    for (const call of MUTATORS) expect(messages(`turn.choices.${call};`, at(timing))).toEqual(['turn.choices is read-only.']);
  });

  it('gives no diagnostic at After the AI', () => {
    for (const call of MUTATORS) expect(messages(`turn.choices.${call};`, at('after'))).toEqual([]);
  });

  it('lists the call as read-only in a user Tool and in a World Tool at every timing', () => {
    expect(messages('turn.choices.push("x"); return "";', toolScriptSurface([]))).toEqual(['turn.choices is read-only.']);
    for (const timing of ['call', 'output', 'after'] as const) {
      expect(messages('turn.choices.push("x"); return "";', worldToolSurface([], timing))).toEqual(['turn.choices is read-only.']);
    }
  });

  it('reads a bracket key and an optional call', () => {
    expect(messages('turn["choices"].push("x");', at('before'))).toEqual(['turn.choices is read-only.']);
    expect(messages('turn.choices?.push("x");', at('before'))).toEqual(['turn.choices is read-only.']);
  });

  it('marks choices', () => {
    const [diagnostic] = codeDiagnostics('turn.choices.push("x");', { surface: at('before') });
    expect(diagnostic).toMatchObject({ from: 5, to: 12, severity: 'error' });
  });

  it('leaves a read and a non-mutating call alone', () => {
    expect(messages('const n = turn.choices.slice(0).length; turn.choices.includes("x"); turn.choices.map((c) => c);', at('before'))).toEqual([]);
  });

  it('leaves a call through an alias out of reach, as the stat write check does', () => {
    expect(messages('const t = turn; t.choices.push("x");', at('before'))).toEqual([]);
  });

  it('leaves a local named turn alone', () => {
    expect(messages('const turn = { choices: [] }; turn.choices.push("x");', at('before'))).toEqual([]);
  });
});

describe('a write to clock, location or notes', () => {
  it.each(TIMINGS)('lists each write as read-only at %s', (timing) => {
    expect(messages('clock.hour = 1;', at(timing))).toEqual(['clock.hour is read-only.']);
    expect(messages('location.name = "x";', at(timing))).toEqual(['location.name is read-only.']);
    expect(messages('notes = "x";', at(timing))).toEqual(['notes is read-only.']);
  });

  it('lists each write as read-only in a user Tool', () => {
    expect(messages('clock.hour = 1; return "";', toolScriptSurface([]))).toEqual(['clock.hour is read-only.']);
    expect(messages('location.name = "x"; return "";', toolScriptSurface([]))).toEqual(['location.name is read-only.']);
    expect(messages('notes = "x"; return "";', toolScriptSurface([]))).toEqual(['notes is read-only.']);
  });

  it.each([
    ['clock.previous.day = 1;', 'clock.previous is read-only.'],
    ['location.exits[0] = "x";', 'location.exits is read-only.'],
    ['location["name"] = "x";', 'location.name is read-only.'],
    ['clock.hour++;', 'clock.hour is read-only.'],
    ['notes += "!";', 'notes is read-only.'],
    ['clock = {};', 'clock is read-only.'],
    ['location = {};', 'location is read-only.'],
    ['turn = {};', 'turn is read-only.'],
  ])('lists %s with the first name off the global', (code, message) => {
    expect(messages(code, at('before'))).toEqual([message]);
  });

  it('marks the member the write names, and the name of a whole-global write', () => {
    expect(codeDiagnostics('clock.hour = 1;', { surface: at('before') })[0]).toMatchObject({ from: 6, to: 10, severity: 'error' });
    expect(codeDiagnostics('notes = "x";', { surface: at('before') })[0]).toMatchObject({ from: 0, to: 5, severity: 'error' });
  });

  it('lists each write as read-only in stat code', () => {
    expect(messages('clock.hour = 1; location.name = "x"; notes = "x"; return 0;', STAT_CODE_SURFACE))
      .toEqual(['clock.hour is read-only.', 'location.name is read-only.', 'notes is read-only.']);
  });

  it('leaves an unknown clock field to the field check, with one diagnostic', () => {
    expect(messages('clock.bogus = 1;', at('before'))).toEqual(['clock has no field “bogus”.']);
  });

  it('leaves the verbs alone', () => {
    expect(messages('location.move(location.name); clock.advance(30);', at('before'))).toEqual([]);
  });

  it('leaves a local of the same name alone', () => {
    expect(messages('let notes = ""; notes = "x"; const clock = { hour: 0 }; clock.hour = 1;', at('before'))).toEqual([]);
  });

  it('leaves a write through an alias out of reach', () => {
    expect(messages('const c = clock; c.hour = 1;', at('before'))).toEqual([]);
  });
});
