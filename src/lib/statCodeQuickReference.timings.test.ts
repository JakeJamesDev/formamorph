/**
 * @vitest-environment node
 * (No DOM needed; node keeps the QuickJS WASM engines loading through their filesystem paths.)
 */
import { describe, expect, it } from 'vitest';
import type { ScriptTiming, Stat } from '@/types';
import { bundledDocsIndex } from '@/lib/docs/bundledDocsIndex';
import { codeDiagnostics } from './statCodeAnalysis';
import { executeStatCode, type StatCodeRunOptions } from './statCodeExecutor';
import { PromptCanceled, type ScriptPromptHost } from './scriptPrompts';
import {
  NARRATION_FIELDS, PLAYER_CALL_ENTRIES, scriptSurface, STAT_CODE_SURFACE, SWITCHED_TRAIT_FIELDS,
} from './statCodeSurface';
import type { SurfaceEntry } from './codeSurface';

/**
 * The Scripts Guide's second Quick Reference table names what a timing adds: `narration`, `player` and `trait`.
 * Its members are held to the surface lists, and its code forms run in the sandbox of the timing that adds the
 * name and read clean in that timing's editor. `statCodeQuickReference.test.ts` holds the first table.
 */
const SECTION_ID = 'ScriptsGuide#quick-reference';

interface TimingRow { name: string; timing: ScriptTiming; members: string[]; read: string; write: string }

const codeOf = (cell: string) => [...cell.matchAll(/`([^`]+)`/g)].map((match) => match[1]);

const [section] = bundledDocsIndex().get([SECTION_ID]);
if (!section) throw new Error(`${SECTION_ID} is missing`);

const TIMING_OF: Record<string, ScriptTiming> = { narration: 'output', player: 'before', trait: 'switch' };

const rows: TimingRow[] = section.markdown.split('\n')
  .filter((line) => line.startsWith('| **`'))
  .map((line) => {
    const [name, , members, read, write] = line.split('|').slice(1, -1).map((cell) => cell.trim());
    const key = codeOf(name)[0];
    return {
      name: key, timing: TIMING_OF[key], members: codeOf(members).map((member) => member.replace(/\(\)$/, '')),
      read: codeOf(read)[0] ?? '', write: codeOf(write)[0] ?? write,
    };
  });

const SURFACE_MEMBERS: Record<string, readonly SurfaceEntry[]> = {
  narration: NARRATION_FIELDS, player: PLAYER_CALL_ENTRIES, trait: SWITCHED_TRAIT_FIELDS,
};

const stat: Stat = { id: 's', name: 'Self', type: 'number', description: '', min: 0, max: 100, value: 50, regen: 0, descriptors: [] };

/** Answers a confirm with yes and takes a notice, so a form that prompts can run to its end. Any other question is closed.
 *  The host's answer type follows the request kind, which a generic method can't narrow, so each answer is cast. */
const host: ScriptPromptHost = {
  prompt: (request) => {
    if (request.kind === 'confirm') return Promise.resolve(true as never);
    if (request.kind === 'tell' || request.kind === 'toast') return Promise.resolve(undefined as never);
    return Promise.reject(new PromptCanceled());
  },
};

/** The run options of the timing that adds `name`: the name's own input, or a prompt host. */
const optionsOf = (name: string): StatCodeRunOptions => {
  if (name === 'narration') return { narration: { sentence: 'The door creaks.', full: 'The door creaks.', index: 0, sent: [], buffered: [] } };
  if (name === 'trait') return { switchedTrait: { name: 'Brave', enabled: true, acquired: true, id: 'brave', mode: 'optional', owner: '' } };
  return { prompts: host };
};

const runnable = (form: string) => form.replaceAll('<n>', '1').replaceAll('<text>', '"x"');
const editorFindings = (code: string, timing: ScriptTiming) =>
  codeDiagnostics(code, { surface: scriptSurface(STAT_CODE_SURFACE, timing), statNames: [stat.name], selfName: stat.name }).map((d) => d.message);

describe('the Scripts Guide’s table of names a timing adds', () => {
  it('has one row for each name a timing adds, and no other', () => {
    expect(rows.map((row) => row.name).sort()).toEqual(['narration', 'player', 'trait']);
  });

  it.each(rows)('lists every member of $name, and no other', ({ name, members }) => {
    expect([...members].sort()).toEqual(SURFACE_MEMBERS[name].map((entry) => entry.name).sort());
  });

  it.each(rows)('reads $name through a form its timing’s sandbox answers', async ({ name, read }) => {
    const result = await executeStatCode(`const read = ${runnable(read)}; return read === undefined ? 0 : 1;`, [stat], stat, optionsOf(name));
    expect(result).toMatchObject({ value: 1, error: null });
  });

  it.each(rows)('reads $name in a form its timing’s editor raises nothing on', ({ read, timing }) => {
    expect(editorFindings(`return ${runnable(read)} ? 1 : 0;`, timing)).toEqual([]);
  });

  it('writes narration.sentence through a form that lands', async () => {
    const row = rows.find((candidate) => candidate.name === 'narration')!;
    const result = await executeStatCode(`${runnable(row.write)};`, [stat], stat, optionsOf('narration'));
    expect(result).toMatchObject({ error: null, sentence: 'x' });
    expect(editorFindings(`${runnable(row.write)};\nreturn 1;`, row.timing)).toEqual([]);
  });

  it('marks trait read-only, which the sandbox drops a write to', async () => {
    const row = rows.find((candidate) => candidate.name === 'trait')!;
    expect(row.write).toBe('Read-only');
    const result = await executeStatCode(`${runnable(row.read)} = false;`, [stat], stat, optionsOf('trait'));
    expect(result.error).toBeNull();
    expect(result.traits).toBeUndefined();
  });

  it('gives player calls, not writes, and its calls run on the engine', async () => {
    const row = rows.find((candidate) => candidate.name === 'player')!;
    expect(row.write).toBe('Calls, not writes');
    const calls = await executeStatCode(
      'player.tell("a"); player.toast("b"); const sure = player.confirm("c"); return sure ? 1 : 0;', [stat], stat, optionsOf('player'),
    );
    expect(calls).toMatchObject({ value: 1, error: null });
  });
});
