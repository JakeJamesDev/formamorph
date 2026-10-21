/**
 * The load-time rewrite of script text from a retired surface form to the one that replaced it, over every
 * script a world holds. Each rewrite is idempotent and leaves code it does not recognize byte for byte.
 */

import { javascriptLanguage } from '@codemirror/lang-javascript';
import type { SyntaxNode } from '@lezer/common';
import { spliced, type CodeSplice } from './statCodeRename';
import { memberStep } from './statCodePaths';
import { children } from './statLookupMigration';
import { statCodeName } from './statCodeNames';
import { allPlaceholders, type PlaceholderHomesWorld } from './placeholderHomes';
import type { Placeholder } from '@/types';

/** What a rewrite may read of the code's home: each entity's code name by its id. */
export interface ScriptTextContext {
  entityNames: ReadonlyMap<string, string>;
}

/** One rewrite of a script's text. Idempotent: a second run returns its input. */
export type ScriptTextRewrite = (code: string, context: ScriptTextContext) => string;

/** A string literal with no escape in it, and its text. */
const PLAIN_LITERAL = /^(['"])([^'"\\\n]*)\1$/;

/** The splice that turns one `diary(who, line)` call into `entities[who].diary(line)`, or null when the call is
 *  anything else: a member call, another argument count, a spread, a comment or a syntax error in its head. */
function diarySplice(call: SyntaxNode, code: string, { entityNames }: ScriptTextContext): CodeSplice | null {
  const [callee, args, ...rest] = children(call);
  if (rest.length || callee?.name !== 'VariableName' || args?.name !== 'ArgList' || code.slice(callee.from, callee.to) !== 'diary') return null;
  const parts = children(args);
  // `( who , line )`, a trailing comma allowed; a comment is a node of its own, so it fails the shape.
  const shape = parts.map((node, i) => (i === 1 || i === 3 ? 'value' : node.name)).join(' ');
  if (shape !== '( value , value )' && shape !== '( value , value , )') return null;
  const [who, line] = [parts[1], parts[3]];
  if (who.name === 'Spread' || line.name === 'Spread' || hasError(who)) return null;
  const whoText = code.slice(who.from, who.to);
  const literal = who.name === 'String' ? PLAIN_LITERAL.exec(whoText)?.[2] : undefined;
  // A literal id reads as its entity's name; a literal name reads dotted where it can.
  const name = literal === undefined ? undefined : entityNames.get(literal) ?? literal;
  const key = name === undefined ? `[${whoText}]` : name === literal && !/^[A-Za-z_$][\w$]*$/.test(name) ? `[${whoText}]` : memberStep(name);
  return { from: callee.from, to: line.from, insert: `entities${key}.diary(` };
}

const hasError = (node: SyntaxNode): boolean => {
  let found = false;
  node.cursor().iterate((ref) => {
    if (ref.type.isError) found = true;
    return !found;
  });
  return found;
};

/** One pass: the outermost `diary` calls rewritten. A call nested in a rewritten one waits for the next pass. */
function diaryPass(code: string, context: ScriptTextContext): string {
  const edits: CodeSplice[] = [];
  let declared = false;
  javascriptLanguage.parser.parse(code).iterate({
    enter: (ref) => {
      if (ref.name === 'VariableDefinition' && code.slice(ref.from, ref.to) === 'diary') declared = true;
      if (ref.name !== 'CallExpression') return true;
      const edit = diarySplice(ref.node, code, context);
      if (!edit) return true;
      edits.push(edit);
      return false;
    },
  });
  return declared || !edits.length ? code : spliced(code, edits);
}

export const NO_CONTEXT: ScriptTextContext = { entityNames: new Map() };

/** Rewrite the retired top-level `diary(who, line)` to the entity entry's `entities[who].diary(line)`. A literal that
 *  is an entity's id reads as that entity's name; a plain name literal reads dotted; anything else is bracketed. A
 *  script that declares `diary` keeps its text. */
export function migrateDiaryCalls(code: string, context: ScriptTextContext = NO_CONTEXT): string {
  if (!code.includes('diary')) return code;
  let out = code;
  for (let next = diaryPass(out, context); next !== out; next = diaryPass(out, context)) out = next;
  return out;
}

const MEMORY_VERBS = new Set(['add', 'pin']);

/** Rewrite the retired `memory.add` and `memory.pin` to `memories.add` and `memories.pin`. A script that declares
 *  `memory` keeps its text. */
export function migrateMemoryCalls(code: string): string {
  if (!code.includes('memory')) return code;
  const edits: CodeSplice[] = [];
  let declared = false;
  javascriptLanguage.parser.parse(code).iterate({
    enter: (ref) => {
      if (ref.name === 'VariableDefinition' && code.slice(ref.from, ref.to) === 'memory') declared = true;
      if (ref.name !== 'MemberExpression') return true;
      const [object, , property] = children(ref.node);
      if (object?.name === 'VariableName' && code.slice(object.from, object.to) === 'memory'
        && property?.name === 'PropertyName' && MEMORY_VERBS.has(code.slice(property.from, property.to))) {
        edits.push({ from: object.from, to: object.to, insert: 'memories' });
      }
      return true;
    },
  });
  return declared || !edits.length ? code : spliced(code, edits);
}

/** Rewrite the retired `player.askText` to `player.input`. A script that declares `player` keeps its text. */
export function migratePlayerInput(code: string): string {
  if (!code.includes('askText')) return code;
  const edits: CodeSplice[] = [];
  let declared = false;
  javascriptLanguage.parser.parse(code).iterate({
    enter: (ref) => {
      if (ref.name === 'VariableDefinition' && code.slice(ref.from, ref.to) === 'player') declared = true;
      if (ref.name !== 'MemberExpression') return true;
      const [object, , property] = children(ref.node);
      if (object?.name === 'VariableName' && code.slice(object.from, object.to) === 'player'
        && property?.name === 'PropertyName' && code.slice(property.from, property.to) === 'askText') {
        edits.push({ from: property.from, to: property.to, insert: 'input' });
      }
      return true;
    },
  });
  return declared || !edits.length ? code : spliced(code, edits);
}

/** Every script-text rewrite, in the order they run. */
export const SCRIPT_TEXT_REWRITES: readonly ScriptTextRewrite[] = [migrateDiaryCalls, migrateMemoryCalls, migratePlayerInput];

const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);

/** `list` with `each` applied to every item; the same array when no item changes. */
function mapped(list: unknown, each: (item: unknown) => unknown): unknown {
  if (!Array.isArray(list)) return list;
  const next = list.map(each);
  return next.some((item, i) => item !== list[i]) ? next : list;
}

/** `record` with the fields `edits` names replaced; the same record when none changes. */
function withFields(record: unknown, edits: Record<string, (value: unknown) => unknown>): unknown {
  if (!isRecord(record)) return record;
  const changed = Object.entries(edits).flatMap(([key, edit]) => {
    if (!(key in record)) return [];
    const next = edit(record[key]);
    return next === record[key] ? [] : [[key, next] as const];
  });
  return changed.length ? { ...record, ...Object.fromEntries(changed) } : record;
}

/** The field edits that apply `rewrites` to each script under a record. */
function scriptEdits(rewrites: readonly ScriptTextRewrite[], context: ScriptTextContext) {
  const text = (code: unknown) => (typeof code === 'string' ? rewrites.reduce((out, rewrite) => rewrite(out, context), code) : code);
  const scripts = (list: unknown) => mapped(list, (script) => withFields(script, { code: text }));
  const owned = (list: unknown) => mapped(list, (item) => withFields(item, { scripts }));
  const overridden = (list: unknown) => mapped(list, (link) => withFields(link, {
    overrides: (overrides) => {
      if (!isRecord(overrides)) return overrides;
      const next = Object.fromEntries(Object.entries(overrides).map(([id, fields]) =>
        [id, withFields(fields, { scripts: (override) => withFields(override, { value: scripts, blueprint: scripts }) })]));
      return Object.keys(next).some((id) => next[id] !== overrides[id]) ? next : overrides;
    },
  }));
  const entity = { stats: owned, traits: owned, statLinks: overridden, traitLinks: overridden };
  return { text, scripts, owned, entity };
}

/** Each entity's code name by its id, for a list as authored. */
const entityNamesOf = (entities: unknown, placeholders: readonly Placeholder[]): Map<string, string> =>
  new Map((Array.isArray(entities) ? entities : []).flatMap((entity) => (isRecord(entity) && typeof entity.id === 'string'
    && typeof entity.name === 'string' ? [[entity.id, statCodeName(entity.name, placeholders)] as const] : [])));

/** One entity with `rewrites` applied to its own stats', own traits' and link overrides' scripts. A library entity
 *  and an entity card never pass through `migrateWorld`, so their boundaries call this. It knows only its own id. */
export function migrateEntityScriptText<T>(entity: T, rewrites: readonly ScriptTextRewrite[] = SCRIPT_TEXT_REWRITES): T {
  const own = isRecord(entity) && Array.isArray(entity.placeholders) ? entity.placeholders as Placeholder[] : [];
  return withFields(entity, scriptEdits(rewrites, { entityNames: entityNamesOf([entity], own) }).entity) as T;
}

/**
 * Apply `rewrites` to every script of the world: the stats', the traits', the world's own, the World Tools' script
 * handlers, and each entity's own stats', own traits' and link overrides', the override's Blueprint side included.
 * A record whose text no rewrite changes keeps its reference. Not version-gated, since shipped worlds carry the old
 * forms under the current version.
 */
export function migrateWorldScriptText(world: Record<string, unknown>, rewrites: readonly ScriptTextRewrite[] = SCRIPT_TEXT_REWRITES): void {
  const placeholders = allPlaceholders(world as PlaceholderHomesWorld);
  const { text, scripts, owned, entity } = scriptEdits(rewrites, { entityNames: entityNamesOf(world.entities, placeholders) });
  Object.assign(world, withFields(world, {
    stats: owned,
    traits: owned,
    scripts,
    tools: (list) => mapped(list, (tool) => withFields(tool, {
      handler: (handler) => (isRecord(handler) && handler.kind === 'script' ? withFields(handler, { code: text }) : handler),
    })),
    entities: (list) => mapped(list, (item) => withFields(item, entity)),
  }));
}
