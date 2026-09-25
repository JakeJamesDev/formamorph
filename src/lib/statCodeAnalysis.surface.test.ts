import { describe, it, expect } from 'vitest';
import { codeCompletions, codeDiagnostics, statCodeCompletions, statCodeDiagnostics } from './statCodeAnalysis';
import type { CodeSurface } from './codeSurface';
import { STAT_CODE_SURFACE } from './statCodeSurface';

/** A surface shaped like a Tool script's: its own globals, one typed object, no stat-code names at all. */
const SCRIPT: CodeSurface = {
  label: 'this script',
  globals: [
    { name: 'args', detail: '{ name }', info: 'The arguments the model sent.' },
    { name: 'world', detail: 'object', info: 'The world, read-only.' },
  ],
  hiddenGlobals: [],
  builtins: [{ name: 'Math', detail: 'object', info: 'min, max and the rest.' }],
  members: new Map([
    ['args', [{ name: 'name', detail: 'string', info: 'The name the model asked for.' }]],
    ['Math', [{ name: 'max', detail: '(...n) => number', info: 'The largest.' }]],
  ]),
  languageNames: ['JSON'],
  snippets: [{ label: 'An argument', text: 'args.name', select: 'name' }],
  missingReturn: 'This script never returns a result.',
};

function labelsAt(doc: string, surface: CodeSurface) {
  const pos = doc.indexOf('|');
  return (codeCompletions(doc.replace('|', ''), pos, { surface })?.options ?? []).map((option) => option.label);
}

const messages = (code: string, surface: CodeSurface) =>
  codeDiagnostics(code, { surface }).map((diagnostic) => diagnostic.message);

describe('a surface other than stat code', () => {
  it('offers its own globals and built-ins, and none of stat code’s', () => {
    const offered = labelsAt('return |', SCRIPT);
    expect(offered).toEqual(expect.arrayContaining(['args', 'world', 'Math']));
    for (const name of ['stats', 'self', 'placeholders', 'traits', 'elapsedHours', 'Date']) {
      expect(offered, name).not.toContain(name);
    }
  });

  it('offers the members it lists after a dot', () => {
    expect(labelsAt('return args.|', SCRIPT)).toEqual(['name']);
    expect(labelsAt('return Math.|', SCRIPT)).toEqual(['max']);
  });

  it('offers no stat fields after a name stat code would read as a stat', () => {
    expect(labelsAt('return self.|', SCRIPT)).toEqual([]);
    expect(labelsAt('return stats.|', SCRIPT)).toEqual([]);
  });

  it('flags stat-code names as unknown, in its own words', () => {
    expect(messages('return stats.Health.value;', SCRIPT)).toEqual(['“stats” isn’t available in this script.']);
  });

  it('suggests the nearest of its own names', () => {
    expect(messages('return arg.name;', SCRIPT)).toEqual(['“arg” isn’t available in this script. Did you mean “args”?']);
  });

  it('accepts its own names, built-ins and language names', () => {
    expect(messages('return JSON.stringify({ n: Math.max(1, 2), who: args.name, w: world });', SCRIPT)).toEqual([]);
  });

  it('warns about a missing return in its own words, and a write to self does not count', () => {
    expect(messages('const x = 1;', SCRIPT)).toEqual(['This script never returns a result.']);
    expect(messages('self.value = 3;', SCRIPT)).toEqual([
      '“self” isn’t available in this script.', 'This script never returns a result.',
    ]);
  });

  it('says nothing about a missing return when the surface does not ask for one', () => {
    expect(messages('const x = 1;', { ...SCRIPT, missingReturn: null })).toEqual([]);
  });
});

describe('the stat-code surface', () => {
  it('is what the stat-code entry points read', () => {
    const code = 'const x = stats.Health.value;';
    expect(codeDiagnostics(code, { surface: STAT_CODE_SURFACE, statNames: ['Health'] }))
      .toEqual(statCodeDiagnostics(code, { statNames: ['Health'] }));
    expect(codeCompletions('return se', 9, { surface: STAT_CODE_SURFACE }))
      .toEqual(statCodeCompletions('return se', 9));
  });
});
