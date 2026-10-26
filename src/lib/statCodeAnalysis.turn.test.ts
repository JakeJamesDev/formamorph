import { describe, expect, it } from 'vitest';
import { codeDiagnostics } from './statCodeAnalysis';
import { scriptSurface, SCRIPT_SURFACES } from './statCodeSurface';
import type { ScriptTiming } from '@/types';

/** The editor's checks on a write into `turn`: only `turn.choices` at After the AI takes one (Q21, Q26). */

const messages = (code: string, timing: ScriptTiming) =>
  codeDiagnostics(code, { surface: scriptSurface(SCRIPT_SURFACES.world, timing) }).map((diagnostic) => diagnostic.message);

describe('a write into turn', () => {
  it.each([
    'turn.choices = ["Run."];',
    'turn.choices[0] = "Run.";',
    'turn["choices"] = [];',
  ])('gives no diagnostic to %s at After the AI', (code) => {
    expect(messages(code, 'after')).toEqual([]);
  });

  it.each(['start', 'before', 'output', 'switch'] as const)('lists an assignment and an element assignment to turn.choices as read-only at %s', (timing) => {
    expect(messages('turn.choices = ["Run."];', timing)).toEqual(['turn.choices is read-only.']);
    expect(messages('turn.choices[0] = "Run.";', timing)).toEqual(['turn.choices is read-only.']);
  });

  it.each([
    ['turn.action = "";', 'turn.action is read-only.'],
    ['turn.number++;', 'turn.number is read-only.'],
    ['turn.narration += "!";', 'turn.narration is read-only.'],
  ])('lists %s as read-only at After the AI', (code, message) => {
    expect(messages(code, 'after')).toEqual([message]);
  });

  it('marks the field the write names', () => {
    const [diagnostic] = codeDiagnostics('turn.action = "";', { surface: scriptSurface(SCRIPT_SURFACES.world, 'after') });
    expect(diagnostic).toMatchObject({ from: 5, to: 11, severity: 'error' });
  });

  it('leaves a local named turn alone', () => {
    expect(messages('const turn = { action: "" }; turn.action = "x";', 'before')).toEqual([]);
  });

  it('lists a mutating call as read-only outside After the AI', () => {
    expect(messages('turn.choices.push("Run.");', 'before')).toEqual(['turn.choices is read-only.']);
    expect(messages('turn.choices.push("Run.");', 'after')).toEqual([]);
  });
});
