/**
 * @vitest-environment node
 * (No DOM needed; node keeps the QuickJS WASM engine loading through its filesystem path.)
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Placeholder, Stat } from '@/types';
import { bundledDocsIndex } from '@/lib/docs/bundledDocsIndex';
import { phMap } from '@/test/sandboxPlaceholders';
import { phValues } from '@/test/placeholderValues';
import { statCodeDiagnostics, type AnalysisOptions } from './statCodeAnalysis';
import { executeStatCode, type StatCodeResult } from './statCodeExecutor';
import {
  CLOCK_MEMBERS, SELF_WRITABLE_FIELDS, DICTIONARY_FIELDS, ENTITY_FIELDS, PERSONA_FIELDS, placeholderEntryFields, SANDBOX_GLOBALS, STAT_FIELDS,
  TRAIT_ENTRY_FIELDS,
} from './statCodeSurface';
import type { SurfaceEntry } from './codeSurface';

/**
 * The Stat Code Guide's Quick Reference states the whole sandbox API in one section. Its objects and members
 * are held to the surface lists, which `statCodeSurface.test.ts` holds to the sandbox; its code forms run in
 * the sandbox and in the editor's checks.
 */
const SECTION_ID = 'StatCodeGuide#quick-reference';

interface Row { object: string; members: string[]; read: string; write: string }

const codeOf = (cell: string) => [...cell.matchAll(/`([^`]+)`/g)].map((match) => match[1]);

function quickReferenceMarkdown(): string {
  const [section] = bundledDocsIndex().get([SECTION_ID]);
  if (!section) throw new Error(`${SECTION_ID} is missing`);
  return section.markdown;
}

/** The code in the bold lead of the rule bullet that starts with `start`. */
function ruleLeadCode(start: string): string[] {
  const lead = quickReferenceMarkdown().split('\n').find((line) => line.startsWith(`- **${start}`));
  return codeOf(/\*\*(.+?)\*\*/.exec(lead ?? '')?.[1] ?? '');
}

function quickReferenceRows(): Row[] {
  return quickReferenceMarkdown().split('\n')
    .filter((line) => line.startsWith('| `'))
    .map((line) => {
      const [object, members, read, write] = line.split('|').slice(1, -1).map((cell) => cell.trim());
      return {
        object: codeOf(object)[0],
        members: codeOf(members).map((name) => name.replace(/\(\)$/, '')),
        read: codeOf(read)[0] ?? '',
        write: codeOf(write)[0] ?? write,
      };
    });
}

/** A form as the sandbox runs it: each name slot filled with its own word, which the fixture below defines. */
const runnable = (form: string) => form.replaceAll('<n>', '1').replaceAll('<text>', '"x"').replace(/<(\w+)>/g, '$1');

const stat = (over: Partial<Stat>): Stat => ({
  id: 'self', name: 'Self', type: 'number', description: '', min: 0, max: 100, value: 50, regen: 0, ...over,
} as Stat);
const stats = [stat({}), stat({ id: 'other', name: 'Stat' })];
const trait = () => ({ name: 'Trait', enabled: false, acquired: false, mode: 'optional' as const });
const [entityOwns, dictionaryOwns] = phMap([
  { name: 'Entity', children: [{ name: 'Placeholder', value: 'a' }] },
  { name: 'Dictionary', children: [{ name: 'Placeholder', value: 'a' }] },
]);
const world = {
  placeholders: phMap([{ name: 'Placeholder', value: 'a' }]),
  traits: [trait()],
  entities: [{ name: 'Entity', traits: [trait()], placeholders: entityOwns }],
  persona: { name: 'Hero', traits: [trait()], inScene: true },
  dictionaries: [{ name: 'Dictionary', id: 'dictionary', placeholders: dictionaryOwns }],
};
const run = (code: string) => executeStatCode(code, stats, stats[0], world);

/** The same names as the editor knows them. The entity can be played, so `persona.traits` reaches its set. */
const ownedPlaceholder = (id: string): Placeholder => ({ id, name: 'Placeholder', values: phValues(['a']) });
const editorNames: AnalysisOptions = {
  statNames: stats.map((entry) => entry.name),
  selfName: stats[0].name,
  traits: ['Trait'],
  entities: [{ id: 'entity', name: 'Entity', traits: [{ id: 'trait', name: 'Trait', path: [] }], persona: true }],
  placeholders: {
    list: [ownedPlaceholder('world'), ownedPlaceholder('of-entity'), ownedPlaceholder('of-dictionary')],
    owners: new Map([
      ['of-entity', { kind: 'entity', id: 'entity', name: 'Entity' }],
      ['of-dictionary', { kind: 'dictionary', id: 'dictionary', name: 'Dictionary' }],
    ]),
    dictionaries: [{ id: 'dictionary', name: 'Dictionary' }],
  },
};
const editorFindings = (code: string) => statCodeDiagnostics(code, editorNames).map((finding) => finding.message);

/** The result fields a run that changed only what it meant to fills. Any other field reports a dropped write. */
const APPLIED_FIELDS = new Set(['value', 'error', 'bounds', 'placeholders', 'traits', 'entities']);
const APPLIED_ENTITY_FIELDS = new Set(['entity', 'traits']);

/** The fields of a run's result that report a dropped write, an entity's own included. */
const dropped = (result: StatCodeResult) => [
  ...Object.entries(result).filter(([field, value]) => value !== undefined && !APPLIED_FIELDS.has(field)).map(([field]) => field),
  ...(result.entities ?? []).flatMap((entity) => Object.keys(entity).filter((field) => !APPLIED_ENTITY_FIELDS.has(field))),
];

/** Whether a run left anything for the turn to apply. */
const landed = (result: StatCodeResult) => result.value !== null || !!result.bounds || !!result.placeholders?.length
  || !!result.traits?.length || !!result.entities?.some((entity) => entity.traits?.length);

/** Each object's members as the surface lists them. `console` has no list; the sandbox answers for it below. */
const SURFACE_MEMBERS: Record<string, readonly SurfaceEntry[]> = {
  self: STAT_FIELDS,
  stats: STAT_FIELDS,
  clock: CLOCK_MEMBERS,
  traits: TRAIT_ENTRY_FIELDS,
  persona: PERSONA_FIELDS,
  entities: ENTITY_FIELDS,
  placeholders: placeholderEntryFields('Wildcard'),
  dictionaries: DICTIONARY_FIELDS,
};

const rows = quickReferenceRows();

afterEach(() => vi.restoreAllMocks());

describe('the Stat Code Guide’s Quick Reference', () => {
  it('has one row for each object the sandbox injects', () => {
    expect(rows.map((row) => row.object).sort()).toEqual(SANDBOX_GLOBALS.map((entry) => entry.name).sort());
  });

  it('lists the same members for an Object placeholder as for a Wildcard', () => {
    expect(placeholderEntryFields('Object').map((entry) => entry.name)).toEqual(SURFACE_MEMBERS.placeholders.map((entry) => entry.name));
  });

  it.each(rows.filter((row) => row.object !== 'console'))('lists every member of $object, and no other', ({ object, members }) => {
    expect([...members].sort()).toEqual(SURFACE_MEMBERS[object].map((entry) => entry.name).sort());
  });

  it('lists every member of console, and no other', async () => {
    const { members } = rows.find((row) => row.object === 'console')!;
    const expected = JSON.stringify([...members].sort().join(','));
    await expect(run(`return Object.keys(console).sort().join(',') === ${expected} ? 1 : 0;`)).resolves.toEqual({ value: 1, error: null });
  });

  it.each(rows.filter((row) => row.read))('reads $object through a form the sandbox answers', async ({ read }) => {
    const result = await run(`const read = ${runnable(read)}; return read === undefined ? 0 : 1;`);
    expect(result).toEqual({ value: 1, error: null });
  });

  it.each(rows.filter((row) => row.write !== 'Read-only'))('writes $object through a form that lands', async ({ object, write }) => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const result = await run(`${runnable(write)};`);
    expect(result.error).toBeNull();
    expect(dropped(result)).toEqual([]);
    expect(object === 'console' ? log.mock.calls.length > 0 : landed(result)).toBe(true);
  });

  it.each(rows.filter((row) => row.read).map((row) => row.read))('reads %s in a form the editor raises nothing on', (read) => {
    expect(editorFindings(`return ${runnable(read)} ? 1 : 0;`)).toEqual([]);
  });

  it.each(rows.filter((row) => row.write !== 'Read-only').map((row) => row.write))('writes %s in a form the editor raises nothing on', (write) => {
    expect(editorFindings(`${runnable(write)};\nreturn 1;`)).toEqual([]);
  });

  it('names every field self takes a write to, and no other', () => {
    expect(ruleLeadCode('`self` takes writes').slice(1)).toEqual(SELF_WRITABLE_FIELDS);
  });

  it('underlines the whole-trait write the rules warn against', () => {
    expect(ruleLeadCode('A trait switches')).toEqual(['.enabled']);
    expect(editorFindings('traits.Trait = true;\nreturn 1;')).not.toEqual([]);
  });

  it.each(rows.filter((row) => row.write === 'Read-only'))('marks $object read-only, which the sandbox drops a write to', async ({ read }) => {
    const result = await run(`${runnable(read)} = 1;`);
    expect(result.error).toBeNull();
    expect(landed(result)).toBe(false);
    expect(dropped(result)).not.toEqual([]);
  });
});
