/**
 * @vitest-environment node
 *
 * The copy of every code surface's info lines: the Writing Guide's help-line shape, and no access words, which
 * the badge and the badge-less lists carry from the entry's access field.
 */
import { describe, it, expect } from 'vitest';
import { sentenceShapeViolation } from '@/test/copyShape';
import { phValues } from '@/test/placeholderValues';
import type { Placeholder, ToolParam } from '@/types';
import { statCodeCompletions, type AnalysisOptions } from './statCodeAnalysis';
import { infoWithAccess, type CodeSurface, type SurfaceEntry } from './codeSurface';
import {
  BUILTIN_MEMBERS, CLOCK_MEMBERS, CLOCK_PREVIOUS_FIELDS, DELTA_FIELDS, DELTA_MEMBERS, DICTIONARY_FIELDS, ENTITY_FIELDS,
  PERSONA_FIELDS, PREVIOUS_FIELDS, SANDBOX_BUILTINS, SANDBOX_GLOBALS, STAT_CODE_SURFACE, STAT_FIELDS, TRAIT_ENTRY_FIELDS,
  placeholderEntryFields,
} from './statCodeSurface';
import { toolScriptSurface } from './tools/toolScriptSurface';
import { buildVariableTree, variableTreeLeaves, type VariableNode } from './statCodeVariableTree';

const param = (over: Partial<ToolParam>): ToolParam => ({
  name: 'p', type: 'string', description: '', required: true, options: [], ...over,
});

/** A Tool with every shape of argument line: required, optional, with and without a closing period, an enum. */
const toolSurface = toolScriptSurface([
  param({ name: 'plain' }),
  param({ name: 'said', description: 'Who spoke', required: false }),
  param({ name: 'ended', description: 'Who spoke.', required: false }),
  param({ name: 'kind', type: 'enum', options: ['a', 'b'], description: 'Which kind' }),
]);

const surfaceEntries = (surface: CodeSurface): SurfaceEntry[] => [
  ...surface.globals, ...surface.builtins, ...[...surface.members.values()].flat(),
];

const mood: Placeholder = { id: 'mood', name: 'Mood', values: phValues(['calm']) };
const rank: Placeholder = { id: 'rank', name: 'Rank', values: phValues(['low']) };
const lore: Placeholder = { id: 'lore', name: 'Lore', values: phValues(['old']) };
const names: AnalysisOptions = {
  statNames: ['Health'],
  traits: ['Brave'],
  entities: [{ id: 'mara', name: 'Mara', traits: [{ id: 'brave', name: 'Brave', path: [] }], persona: true, stats: ['Grit'] }],
  placeholders: {
    list: [mood, rank, lore],
    owners: new Map([['rank', { kind: 'entity', id: 'mara', name: 'Mara' }], ['lore', { kind: 'dictionary', id: 'fauna', name: 'Fauna' }]]),
    dictionaries: [{ id: 'fauna', name: 'Fauna' }],
  },
  slots: true,
};

/** The info lines the editor builds from the world's own names, one completion list per path. */
function completionLines(): [string, string][] {
  return [
    'return stats.', 'return traits.', 'return persona.traits.', 'return placeholders.', 'return entities.Mara.placeholders.',
    'return dictionaries.Fauna.placeholders.', 'return persona.placeholders.', 'const mine = 1;\nreturn m', '{{Name}} {{',
  ].flatMap((code) => (statCodeCompletions(code, code.length, names)?.options ?? [])
    .flatMap((option): [string, string][] => (option.info === undefined ? [] : [[`completion ${JSON.stringify(code)}.${option.label}`, option.info]])));
}

/** Every info line the surfaces, their member lists and the Variable menu show, with where it came from. */
function lines(): [string, string][] {
  const named = (where: string, entries: readonly SurfaceEntry[]): [string, string][] =>
    entries.map((entry) => [`${where}.${entry.name}`, entry.info]);
  const menu = (nodes: readonly VariableNode[], where = 'menu'): [string, string][] => nodes.flatMap((node): [string, string][] => {
    if (node.kind === 'empty') return [];
    const own: [string, string][] = node.info ? [[`${where}.${node.label}`, node.info]] : [];
    if (node.kind === 'field') return own;
    if (node.kind === 'group') return [...own, ...menu(node.children, `${where}.${node.label}`)];
    return [...own, ...node.rows.flatMap((row) => menu(row.children, `${where}.${node.label}.${row.name}`))];
  });
  return [
    ...named('stat code', surfaceEntries(STAT_CODE_SURFACE)),
    ...named('tool script', surfaceEntries(toolSurface)),
    ...named('stat fields', [
      ...STAT_FIELDS, ...PREVIOUS_FIELDS, ...DELTA_FIELDS, ...DELTA_MEMBERS, ...CLOCK_MEMBERS, ...CLOCK_PREVIOUS_FIELDS,
      ...TRAIT_ENTRY_FIELDS, ...PERSONA_FIELDS, ...ENTITY_FIELDS, ...DICTIONARY_FIELDS,
      ...placeholderEntryFields('Wildcard'), ...placeholderEntryFields('Object'),
      ...SANDBOX_GLOBALS, ...SANDBOX_BUILTINS, ...[...BUILTIN_MEMBERS.values()].flat(),
    ]),
    ...menu(buildVariableTree(undefined, { kind: 'entity', entity: null })),
    ...completionLines(),
  ];
}

describe('every code surface info line', () => {
  // One case per distinct text: the surfaces share their lists.
  const all = [...new Map(lines().map(([where, info]) => [info, [where, info] as [string, string]])).values()];

  // A floor, not a count: it catches a source that stops contributing, such as an empty completion list.
  it('reads the whole surface', () => {
    expect(all.length).toBeGreaterThan(150);
    expect(all.filter(([where]) => where.startsWith('completion')).length).toBeGreaterThan(8);
  });

  it.each(all)('%s takes the help-line period rule', (_where, info) => {
    expect(sentenceShapeViolation(info), info).toBeNull();
  });

  it.each(all)('%s carries no access word', (_where, info) => {
    expect(info).not.toMatch(/\b(writable|read-only)\b/i);
  });

  it.each(all)('%s has no em dash', (_where, info) => {
    expect(info).not.toContain('—');
  });

  // `fromCharCode` names JavaScript's own character codes, which are no entity.
  it('never says "character" for an entity', () => {
    expect(all.filter(([, info]) => /\bcharacters?\b(?! codes)/i.test(info)).map(([where]) => where)).toEqual([]);
  });

  // The technical register's rejected words for a defined term: `holds`, `kept`, `frozen`, `dropped`, `toggle`, `lands`.
  it.each(all)('%s uses the register’s defined terms', (_where, info) => {
    expect(info).not.toMatch(/\b(holds|kept|frozen|dropped|toggles?|lands)\b/i);
  });
});

describe('infoWithAccess', () => {
  it.each([
    ['writable', 'Lower bound', 'Lower bound. Writable.'],
    ['afterRun', 'True when the trait is held. Assign a boolean to switch it.', 'True when the trait is held. Assign a boolean to switch it. Writable after this run.'],
    ['readOnly', 'Day number', 'Day number. Read-only.'],
  ] as const)('closes %s info with its access sentence', (access, info, expected) => {
    expect(infoWithAccess({ info, access })).toBe(expected);
  });

  it('leaves a method’s info alone', () => {
    expect(infoWithAccess({ info: 'Draws one value' })).toBe('Draws one value');
  });

  it('leaves a line that follows the period rule when it adds the access', () => {
    const closed = surfaceEntries(STAT_CODE_SURFACE).map((entry) => infoWithAccess(entry));
    expect(closed.map(sentenceShapeViolation).filter(Boolean)).toEqual([]);
  });
});

describe('the lists without a badge state the access as text', () => {
  it('gives each Variable menu leaf the access of its surface entry', () => {
    const leaves = variableTreeLeaves(buildVariableTree(undefined, { kind: 'entity', entity: null }));
    const byInsert = new Map(leaves.map((leaf) => [leaf.insert, leaf.access]));
    expect(byInsert.get('self.value')).toBe('writable');
    expect(byInsert.get('self.name')).toBe('readOnly');
    expect(byInsert.get('clock.day')).toBe('readOnly');
    expect(byInsert.get('placeholders["Name"].value')).toBe('afterRun');
    expect(byInsert.get('placeholders["Name"].roll()')).toBeUndefined();
  });

  it('gives the Tool script’s globals their access', () => {
    const access = Object.fromEntries(toolSurface.globals.map((entry) => [entry.name, entry.access]));
    // A map's own entries carry the access, read-only on this surface.
    expect(access).toEqual({
      args: 'readOnly', clock: 'readOnly', location: 'readOnly', memories: 'readOnly', notes: 'readOnly',
      stats: undefined, locations: undefined, placeholders: undefined, traits: undefined, entities: undefined, persona: undefined,
      dictionaries: undefined, console: undefined,
    });
  });

  it('closes an optional argument’s line with its own period before the absent sentence', () => {
    const args = toolSurface.members.get('args') ?? [];
    expect(args.find((entry) => entry.name === 'said')?.info).toBe('Who spoke. Absent when the AI leaves it out.');
    expect(args.find((entry) => entry.name === 'ended')?.info).toBe('Who spoke. Absent when the AI leaves it out.');
    expect(args.find((entry) => entry.name === 'plain')?.info).toBe('What the AI passed');
  });
});
