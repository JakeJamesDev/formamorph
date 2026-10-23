/**
 * Scripts: one box of code with a timing, on a stat, a trait or the world. The one place that knows how a home
 * holds its list, the order a timing runs in, and how a stat's two old code boxes become scripts. Kept free of
 * the executor, so the editor, the readers and the migration can import it without pulling QuickJS in.
 */

import type { Script, ScriptTiming } from '@/types';

/** Every timing, in the order a playthrough first reaches them. */
export const SCRIPT_TIMINGS = ['before', 'after', 'output', 'start', 'switch'] as const satisfies readonly ScriptTiming[];

/** A timing's name wherever an author reads it. */
export const SCRIPT_TIMING_LABEL: Record<ScriptTiming, string> = {
  before: 'Before the AI',
  after: 'After the AI',
  output: 'During AI Output',
  start: 'At Game Start',
  switch: 'When a Trait Switches',
};

/** When a timing runs and what it is for, shown when an author selects the timing. */
export const SCRIPT_TIMING_DESCRIPTION: Record<ScriptTiming, string> = {
  before: 'Runs at the start of each turn, before the prompt is built. Use it to set values the AI reads this turn.',
  after: "Runs after the AI's stat changes and Regen apply. Use it to react to what the AI asked for, such as capping a value or switching a trait.",
  output: 'Runs once for each narration sentence as it completes. Use it to rewrite or filter the narration.',
  start: 'Runs once on the opening turn of a new game, before Before the AI. Use it to roll starting values or pin placeholders.',
  switch: 'Runs each time a trait turns on or off in play. Use it to apply or undo what the trait changes.',
};

/** Anything that holds scripts: a stat, a trait, the world. */
export interface ScriptHome {
  scripts?: readonly Script[];
}

/** A home's scripts in stored order; none when it lists none. */
export const scriptsOf = (home: ScriptHome): readonly Script[] => home.scripts ?? [];

/** A script's name, or its owner and timing where the name is blank (Q6), such as "Health · After the AI". */
export const scriptLabel = (script: Pick<Script, 'name' | 'timing'>, ownerName: string): string =>
  script.name?.trim() || `${ownerName} · ${SCRIPT_TIMING_LABEL[script.timing]}`;

/** Whether a script holds code to run. */
export const hasCode = (script: Pick<Script, 'code'>): boolean => script.code.trim() !== '';

/** A home's scripts that hold code, in stored order. */
export const filledScripts = (home: ScriptHome): Script[] => scriptsOf(home).filter(hasCode);

/** A home's scripts of one timing that hold code, in stored order. */
export const filledScriptsAt = (home: ScriptHome, timing: ScriptTiming): Script[] =>
  filledScripts(home).filter((script) => script.timing === timing);

/** The first script of `timing` on a home: the one a single box for that timing edits. */
export const firstScriptAt = (home: ScriptHome, timing: ScriptTiming): Script | undefined =>
  scriptsOf(home).find((script) => script.timing === timing);

/** One script edit: the fields that changed. A field set to `undefined` is dropped, such as a cleared name. */
export type ScriptPatch = Partial<Omit<Script, 'id'>>;

/** `scripts` with `patch` merged onto the script `id` names; the same list when the id is unknown or nothing changes. */
export function patchScript<T extends readonly Script[]>(scripts: T, id: string, patch: ScriptPatch): T | Script[] {
  const index = scripts.findIndex((script) => script.id === id);
  if (index < 0) return scripts;
  const current = scripts[index];
  const keys = Object.keys(patch) as (keyof ScriptPatch)[];
  // A cleared field already absent reads `undefined` too, so it changes nothing.
  if (keys.every((key) => current[key] === patch[key])) return scripts;
  const next: Script = { ...current, ...patch };
  for (const key of keys) if (patch[key] === undefined) delete (next as Partial<Script>)[key];
  return scripts.map((script, i) => (i === index ? next : script));
}

/** `scripts` with each script `codeById` names holding its new code; the rest as they are. */
export const withScriptCode = (scripts: readonly Script[], codeById: Readonly<Record<string, string>>): Script[] =>
  scripts.map((script) => (script.id in codeById ? { ...script, code: codeById[script.id] } : script));

/** `units` in run order: scripts with an `order` first, ascending; then the rest in the order given, which is
 *  owner order and stat order. Ties keep the order given. */
export function inRunOrder<T extends { script: Pick<Script, 'order'> }>(units: readonly T[]): T[] {
  const ordered = units.filter((unit) => typeof unit.script.order === 'number')
    .sort((a, b) => (a.script.order as number) - (b.script.order as number));
  return [...ordered, ...units.filter((unit) => typeof unit.script.order !== 'number')];
}

// ---- Migration from the two code boxes ----

/** The two code boxes a stat stored before scripts, by the timing each became. */
const BOX_FIELDS = { before: 'beforeCode', after: 'code' } as const;

type BoxTiming = keyof typeof BOX_FIELDS;

/** A stat record as files before scripts stored it. */
export type LegacyCodeBoxes = { beforeCode?: unknown; code?: unknown };

/** The id a migrated box's script takes, the same on every load of the same stat. */
export const migratedScriptId = (statId: string, timing: BoxTiming): string => `${statId}:${timing}`;

/** The scripts two boxes hold, blank boxes left out, the before box first. */
export function scriptsFromBoxes(statId: string, boxes: Partial<Record<BoxTiming, unknown>>): Script[] {
  return (Object.keys(BOX_FIELDS) as BoxTiming[]).flatMap((timing) => {
    const code = boxes[timing];
    return typeof code === 'string' && code.trim() ? [{ id: migratedScriptId(statId, timing), timing, code }] : [];
  });
}

/** What a stat's boxes held, from either shape: the old fields, or the first script of each timing. */
function boxesOf(stat: LegacyCodeBoxes & ScriptHome): Record<BoxTiming, unknown> {
  return {
    before: stat.beforeCode ?? firstScriptAt(stat, 'before')?.code,
    after: stat.code ?? firstScriptAt(stat, 'after')?.code,
  };
}

const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);

/** A raw stat with its two boxes rewritten as scripts, ahead of any scripts it already lists. The same object
 *  when it carries neither box. Idempotent. */
export function migrateStatBoxes<T>(raw: T): T {
  if (!isRecord(raw) || !('beforeCode' in raw || 'code' in raw)) return raw;
  const { beforeCode, code, ...rest } = raw;
  const migrated = scriptsFromBoxes(typeof raw.id === 'string' ? raw.id : '', { before: beforeCode, after: code });
  const kept = Array.isArray(rest.scripts) ? rest.scripts as Script[] : [];
  const scripts = [...migrated, ...kept.filter((script) => !migrated.some((m) => m.id === script?.id))];
  const { scripts: _old, ...fields } = rest;
  return (scripts.length ? { ...fields, scripts } : fields) as T;
}

/** A link's original stat in either shape, or undefined when it is out of reach. */
export type OriginalOf = (id: string) => (LegacyCodeBoxes & ScriptHome) | undefined;

/** A raw stat link with each original's two box overrides folded into one `scripts` override (Q32). The side a
 *  link left live reads from the original, which `originalOf` gives in either shape. An override whose original
 *  is out of reach stays unfolded until a world binds the link (Q36). Idempotent. */
export function migrateStatLinkBoxes<T>(raw: T, originalOf: OriginalOf): T {
  if (!isRecord(raw) || !isRecord(raw.overrides)) return raw;
  let changed = false;
  const overrides = Object.fromEntries(Object.entries(raw.overrides).map(([statId, map]) => {
    const original = originalOf(statId);
    if (!original || !isRecord(map) || !('beforeCode' in map || 'code' in map)) return [statId, map];
    changed = true;
    const { beforeCode, code, ...rest } = map;
    const live = boxesOf(original);
    const side = (override: unknown, key: 'value' | 'blueprint', timing: BoxTiming) =>
      (isRecord(override) && key in override ? override[key] : live[timing]);
    const sides = (key: 'value' | 'blueprint') =>
      scriptsFromBoxes(statId, { before: side(beforeCode, key, 'before'), after: side(code, key, 'after') });
    return [statId, { ...rest, scripts: { value: sides('value'), blueprint: sides('blueprint') } }];
  }));
  return changed ? { ...raw, overrides } as T : raw;
}
