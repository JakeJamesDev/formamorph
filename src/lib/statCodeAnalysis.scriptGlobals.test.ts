/**
 * @vitest-environment node
 * (No DOM needed; node keeps the QuickJS WASM engines loading through their filesystem paths.)
 */
import { describe, expect, it } from 'vitest';
import { codeCompletions, codeDiagnostics, type SurfaceAnalysisOptions } from './statCodeAnalysis';
import { codeCard } from './codeCards';
import { executeStatCode } from './statCodeExecutor';
import {
  NARRATION_FIELDS, PLAYER_CALL_ENTRIES, scriptSurface, STAT_CODE_SURFACE, TRAIT_SCRIPT_SURFACE, WORLD_SCRIPT_SURFACE,
} from './statCodeSurface';
import type { ScriptTiming, Stat } from '@/types';

const TIMINGS: readonly ScriptTiming[] = ['before', 'after', 'output', 'start', 'switch'];
const NOT_OUTPUT = TIMINGS.filter((timing) => timing !== 'output');

const SURFACES = { stat: STAT_CODE_SURFACE, trait: TRAIT_SCRIPT_SURFACE, world: WORLD_SCRIPT_SURFACE } as const;

/** A script box of `home` at `timing`, as the box builds its options. */
const box = (home: keyof typeof SURFACES, timing: ScriptTiming): SurfaceAnalysisOptions => ({
  surface: scriptSurface(SURFACES[home], timing), statNames: ['Health'], traits: ['Brave'], selfName: 'Health',
});

const labelsAt = (doc: string, options: SurfaceAnalysisOptions) => {
  const pos = doc.indexOf('|');
  return (codeCompletions(doc.replace('|', ''), pos, options)?.options ?? []).map((option) => option.label);
};
/** The error underlines only. A warning, such as a stat script that returns nothing, is another rule's. */
const errors = (code: string, options: SurfaceAnalysisOptions) =>
  codeDiagnostics(code, options).filter((d) => d.severity === 'error').map((d) => d.message);
const cardAt = (doc: string, options: SurfaceAnalysisOptions) => codeCard(doc.replace('|', ''), doc.indexOf('|'), options);

const HOMES = ['stat', 'trait', 'world'] as const;

describe.each(HOMES)('narration in a %s script', (home) => {
  it('completes as a global, and its fields after the dot, in During AI Output only', () => {
    expect(labelsAt('narr|', box(home, 'output'))).toContain('narration');
    expect(labelsAt('narration.|', box(home, 'output'))).toEqual(NARRATION_FIELDS.map((field) => field.name));
  });

  it('reads clean in During AI Output', () => {
    expect(errors('narration.sentence = narration.sentence.trim();', box(home, 'output'))).toEqual([]);
  });

  it.each(NOT_OUTPUT)('is unknown in %s: not offered, flagged and with no card', (timing) => {
    expect(labelsAt('narr|', box(home, timing))).not.toContain('narration');
    expect(errors('const s = narration.sentence;', box(home, timing))).toHaveLength(1);
    expect(cardAt('narr|ation', box(home, timing))).toBeNull();
    expect(cardAt('narration.sent|ence', box(home, timing))).toBeNull();
  });

  it('shows a card for narration and each field, with the access badge', () => {
    const options = box(home, 'output');
    expect(cardAt('narr|ation.sentence', options)?.description).toMatch(/narration/i);
    expect(cardAt('narration.sent|ence', options)?.access).toBe('writable');
    for (const field of NARRATION_FIELDS.filter((entry) => entry.name !== 'sentence')) {
      expect(cardAt(`narration.${field.name.slice(0, 2)}|${field.name.slice(2)}`, options)?.access).toBe('readOnly');
    }
  });
});

describe.each(HOMES)('player in a %s script', (home) => {
  it.each(NOT_OUTPUT)('completes in %s as a global, with its five calls after the dot', (timing) => {
    expect(labelsAt('play|', box(home, timing))).toContain('player');
    expect(labelsAt('player.|', box(home, timing))).toEqual(['tell', 'toast', 'confirm', 'ask', 'input']);
  });

  it.each(NOT_OUTPUT)('reads clean in %s', (timing) => {
    expect(errors('player.tell("Hi"); const ok = player.confirm("Sure?");', box(home, timing))).toEqual([]);
  });

  it('is unknown in During AI Output: not offered, flagged and with no card', () => {
    const options = box(home, 'output');
    expect(labelsAt('play|', options)).not.toContain('player');
    expect(errors('player.tell("Hi");', options)).toHaveLength(1);
    expect(cardAt('play|er.tell', options)).toBeNull();
  });

  it('shows a card for player and a method card for a call', () => {
    const options = box(home, 'after');
    expect(cardAt('play|er.tell', options)?.description).toMatch(/human playing/);
    const ask = cardAt('player.as|k', options);
    expect(ask?.signature.kind).toBe('method');
    expect(ask?.signature.path).toBe('player.ask');
  });
});

describe('the described names against the sandbox that provides them', () => {
  const health: Stat = {
    id: 'h', name: 'Health', type: 'number', description: '', min: 0, max: 100, value: 10, regen: 0, descriptors: [],
  };

  it('describes every field of narration, and no field it does not', async () => {
    const expected = NARRATION_FIELDS.map((field) => field.name).sort().join(',');
    const result = await executeStatCode(
      'return Object.keys(narration).sort().join(",");', [health], health,
      { narration: { sentence: 'A.', full: 'A.', index: 0, sent: [], buffered: [] } },
    );
    expect(result.sentence).toBe(expected);
  });

  it('describes every call on player, and no call it does not', async () => {
    const expected = PLAYER_CALL_ENTRIES.map((call) => call.name).sort().join(',');
    const result = await executeStatCode(
      'player.tell; return Object.keys(player).sort().join(",") === ' + JSON.stringify(expected) + ' ? 1 : 0;', [health], health,
    );
    expect(result).toEqual({ value: 1, error: null });
  });

  it('writes narration.sentence back out, the one field a write reaches', async () => {
    const written = await executeStatCode(
      'narration.sentence = "Done.";', [health], health,
      { narration: { sentence: 'A.', full: 'A.', index: 0, sent: [], buffered: [] } },
    );
    expect(written.sentence).toBe('Done.');
  });
});
