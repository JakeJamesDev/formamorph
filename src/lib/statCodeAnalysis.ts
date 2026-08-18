/**
 * Reading stat code without running it: what a caret can be completed with, and what looks wrong.
 *
 * Both halves are plain functions over a code string — the editor's autocomplete source and linter are
 * thin adapters over these, so the behavior is testable without an editor mounted. Everything they know
 * about the sandbox comes from `statCodeSurface`; nothing here widens what QuickJS exposes.
 */

import { javascriptLanguage } from '@codemirror/lang-javascript';
import type { Tree } from '@lezer/common';
import { findSlotRanges, parseTemplateSlots } from '@/lib/statCodeTemplates';
import {
  BUILTIN_MEMBERS, SANDBOX_BUILTINS, SANDBOX_GLOBALS, SANDBOX_KNOWN_NAMES, STATS_MEMBERS, STAT_FIELDS,
  nearestSurfaceName, type SurfaceEntry,
} from '@/lib/statCodeSurface';

export type DiagnosticSeverity = 'error' | 'warning';

export interface CodeDiagnostic {
  from: number;
  to: number;
  severity: DiagnosticSeverity;
  message: string;
}

/** Which list a completion came from, so the popup can badge it. Mirrors CodeMirror's own vocabulary. */
export type CompletionKind = 'variable' | 'property' | 'text' | 'keyword';

export interface CodeCompletion {
  label: string;
  detail?: string;
  info?: string;
  type: CompletionKind;
  /** Higher sorts nearer the top. Left off for the ordinary case. */
  boost?: number;
}

export interface CompletionResult {
  /** Start of the text being replaced — the word already typed. */
  from: number;
  to: number;
  options: CodeCompletion[];
}

export interface AnalysisOptions {
  /** Treat `{{name:type=default}}` spans as opaque. Template editing only. */
  slots?: boolean;
}

export interface CompletionOptions extends AnalysisOptions {
  /** The world's stat names, offered inside string literals. */
  statNames?: readonly string[];
}

const parse = (code: string): Tree => javascriptLanguage.parser.parse(code);

const isWordChar = (character: string) => /[A-Za-z0-9_$]/.test(character);

/** Where the word under `pos` starts, so a completion replaces what has been typed rather than doubling it. */
function wordStart(code: string, pos: number): number {
  let start = pos;
  while (start > 0 && isWordChar(code[start - 1])) start -= 1;
  return start;
}

/** The slot spans to leave alone, or none when the surface has no slots. */
const slotRanges = (code: string, options?: AnalysisOptions) =>
  options?.slots ? findSlotRanges(code) : [];

const overlapsAny = (from: number, to: number, ranges: { from: number; to: number }[]) =>
  ranges.some((range) => from <= range.to && to >= range.from);

/**
 * Every name the author declared anywhere in the code. Whole-document rather than block-scoped on
 * purpose: the only consumer that could be stricter is the unknown-identifier check, and a false "this
 * doesn't exist" on an advisory squiggle costs more than a missed one.
 */
function declaredNames(code: string, tree: Tree = parse(code)): Set<string> {
  const names = new Set<string>();
  const cursor = tree.cursor();
  do {
    if (cursor.type.name === 'VariableDefinition') {
      names.add(code.slice(cursor.from, cursor.to));
    } else if (cursor.type.name === 'PatternProperty') {
      // `const {min, max} = stat` binds the property names themselves unless renamed.
      const child = cursor.node.firstChild;
      if (child) names.add(code.slice(child.from, child.to));
    }
  } while (cursor.next());
  return names;
}

/** Identifiers holding something that came out of `stats` — the objects whose fields we can name. */
function statLikeNames(code: string, tree: Tree): Set<string> {
  const names = new Set<string>();
  const cursor = tree.cursor();
  do {
    if (cursor.type.name === 'VariableDeclaration' || cursor.type.name === 'ArrowFunction') {
      const text = code.slice(cursor.from, cursor.to);
      if (!/\bstats\b/.test(text)) continue;
      const inner = cursor.node.cursor();
      do {
        if (inner.type.name === 'VariableDefinition') names.add(code.slice(inner.from, inner.to));
      } while (inner.next() && inner.from < cursor.to);
    }
  } while (cursor.next());
  return names;
}

/**
 * The source of the expression a `.` hangs off, scanned backwards over the member chain. Read from the
 * text rather than the tree because the tree can't shape the case that matters most: half-typed code like
 * `stats.find(s => …).` parses as an unclosed argument list, whose "object" is the open paren.
 */
function expressionBeforeDot(code: string, dotPos: number): string | null {
  let end = dotPos;
  while (end > 0 && /\s/.test(code[end - 1])) end -= 1;
  let start = end;
  while (start > 0) {
    const char = code[start - 1];
    if (char === ')' || char === ']') {
      const open = char === ')' ? '(' : '[';
      let depth = 0;
      let index = start - 1;
      for (; index >= 0; index -= 1) {
        if (code[index] === char) depth += 1;
        else if (code[index] === open && (depth -= 1) === 0) break;
      }
      // Nothing opened it, so the caret is somewhere the chain can't be read.
      if (index < 0) return null;
      start = index;
      // `?` rides along for optional chaining; anything else in front of a name — `!`, `(`, an operator —
      // ends the chain, so `if (!me.` still names `me`.
    } else if (isWordChar(char) || char === '.' || char === '?') {
      start -= 1;
    } else break;
  }
  // A trailing `?` belongs to the optional-chaining dot, not to the expression being named.
  const text = code.slice(start, end).trim().replace(/\?+$/, '');
  return text.length > 0 ? text : null;
}

/** Whether the expression before a `.` is recognizably a stat, so its fields are the honest list. The
 *  calls named are the ones that hand back a single stat; `filter` hands back another array, so a chain
 *  ending in it is one of the shapes that stays quiet. */
function looksLikeStat(code: string, tree: Tree, expression: string): boolean {
  if (/^stats\b/.test(expression)) return /\.(find|at|pop|shift)\b|\[/.test(expression);
  return statLikeNames(code, tree).has(expression);
}

/**
 * What the expression before a dot can be shown to carry, or null where nothing can be. The order is the
 * order of certainty: a named built-in, then the one array the sandbox injects, then anything that reads
 * as a stat — and silence for everything else, because a wrong list reads as the editor asserting the
 * sandbox holds something it never has.
 */
function membersAfterDot(code: string, tree: Tree, dotPos: number): readonly SurfaceEntry[] | null {
  const expression = expressionBeforeDot(code, dotPos);
  if (expression === null) return null;
  if (expression === 'stats') return STATS_MEMBERS;
  return BUILTIN_MEMBERS.get(expression)
    ?? (looksLikeStat(code, tree, expression) ? STAT_FIELDS : null);
}

const asCompletion = (entry: SurfaceEntry, type: CompletionKind, boost?: number): CodeCompletion => ({
  label: entry.name, detail: entry.detail, info: entry.info, type, ...(boost === undefined ? {} : { boost }),
});

/** The keywords worth offering: what a function body of a few lines actually uses. */
const KEYWORDS = ['return', 'const', 'let', 'if', 'else', 'for', 'of', 'function', 'true', 'false', 'null'];

/**
 * What the caret at `pos` can be completed with, or null where nothing sensible applies. Synchronous and
 * pure: doc and cursor in, options out, with no editor and no network involved.
 */
export function statCodeCompletions(
  code: string,
  pos: number,
  options: CompletionOptions = {},
): CompletionResult | null {
  const tree = parse(code);
  const node = tree.resolveInner(pos, -1);
  const from = wordStart(code, pos);
  const ranges = slotRanges(code, options);

  // Inside a string literal the useful list is the world's own stat names — the one place a typo fails
  // silently rather than throwing.
  if (node.name === 'String') {
    const quote = code[node.from];
    const innerFrom = node.from + 1;
    const innerTo = code[node.to - 1] === quote && node.to - 1 > node.from ? node.to - 1 : node.to;
    if (pos < innerFrom) return null;
    // The whole literal is replaced, not the part before the caret — a name half-typed in the middle of
    // an old one would otherwise leave its tail behind.
    return {
      from: innerFrom,
      to: innerTo,
      options: (options.statNames ?? []).map((name) => ({
        label: name, type: 'text', detail: 'stat', info: `The “${name}” stat in this world.`,
      })),
    };
  }

  // `{{` in the template editor offers the slots the template already declares, so a second reference to
  // one is spelled the same as the first.
  const beforeWord = code.slice(0, from);
  if (options.slots && /\{\{\s*$/.test(beforeWord)) {
    // The slot being named is itself a declaration, so offering it back to the author is noise.
    const partial = code.slice(from, pos);
    const names = parseTemplateSlots(code).slots.map((slot) => slot.name).filter((name) => name !== partial);
    if (names.length === 0) return null;
    return {
      from,
      to: pos,
      options: names.map((name) => ({
        label: name, type: 'variable', detail: 'slot', info: `The “${name}” slot declared in this template.`,
      })),
    };
  }

  // A completion inside a slot would be filling in template syntax with sandbox names.
  if (overlapsAny(from, pos, ranges)) return null;

  // After a dot the list is only ever as good as what the expression can be shown to be. A wrong guess
  // here is worse than silence: it reads as the editor asserting the sandbox has something it doesn't.
  if (/\.\s*$/.test(beforeWord)) {
    const members = membersAfterDot(code, tree, beforeWord.replace(/\s+$/, '').length - 1);
    if (!members) return null;
    return { from, to: pos, options: members.map((member) => asCompletion(member, 'property')) };
  }

  const declared = declaredNames(code, tree);
  // The word being typed is itself a definition while it's being typed; offering it back is noise.
  const typed = code.slice(from, pos);
  return {
    from,
    to: pos,
    options: [
      ...SANDBOX_GLOBALS.map((entry) => asCompletion(entry, 'variable', 1)),
      ...[...declared]
        .filter((name) => name !== typed && !SANDBOX_KNOWN_NAMES.has(name))
        .map((name) => ({ label: name, type: 'variable' as const, detail: 'yours', info: 'Declared in this code.' })),
      ...SANDBOX_BUILTINS.map((entry) => asCompletion(entry, 'variable')),
      ...KEYWORDS.map((keyword) => ({ label: keyword, type: 'keyword' as const })),
    ],
  };
}

/**
 * What the reader found, as one line. Running the code reports what it returned, which says nothing
 * about a typo on a branch the run never took — so a successful test carries this rather than reading
 * as a clean bill of health. Null when there is nothing to report.
 */
export function summarizeProblems(diagnostics: readonly CodeDiagnostic[]): string | null {
  const errors = diagnostics.filter((diagnostic) => diagnostic.severity === 'error').length;
  const warnings = diagnostics.filter((diagnostic) => diagnostic.severity === 'warning').length;
  if (errors === 0 && warnings === 0) return null;
  const parts: string[] = [];
  if (errors > 0) parts.push(`${errors} error${errors === 1 ? '' : 's'}`);
  if (warnings > 0) parts.push(`${warnings} warning${warnings === 1 ? '' : 's'}`);
  return `${parts.join(', ')} in this code`;
}

/**
 * What looks wrong with a piece of stat code: syntax the grammar can't read, references to names the
 * sandbox never provides, and code that can never hand a number back. Advisory — the Test button remains
 * the ground truth, and nothing here blocks saving.
 */
export function statCodeDiagnostics(code: string, options: AnalysisOptions = {}): CodeDiagnostic[] {
  if (!code.trim()) return [];

  const tree = parse(code);
  const ranges = slotRanges(code, options);
  const diagnostics: CodeDiagnostic[] = [];
  const declared = declaredNames(code, tree);
  let sawReturn = false;
  let sawSyntaxError = false;

  const cursor = tree.cursor();
  do {
    const { from, to } = cursor;
    if (cursor.type.isError) {
      sawSyntaxError = true;
      // A slot stands where an expression, an operator or a whole clause will be, so a template is only
      // valid JavaScript once filled. The parser's complaint can land anywhere after the slot rather than
      // inside it, which makes position-based skipping useless — a template gets no syntax check at all.
      if (ranges.length > 0) continue;
      // Error nodes are usually empty — they mark where the parser gave up, so widen to a character the
      // author can actually see underlined.
      const end = to > from ? to : Math.min(code.length, from + 1);
      const start = end > from ? from : Math.max(0, from - 1);
      diagnostics.push({ from: start, to: end, severity: 'error', message: 'Syntax error — the code can’t be read as JavaScript.' });
      continue;
    }
    if (cursor.type.name === 'ReturnStatement') { sawReturn = true; continue; }
    if (cursor.type.name !== 'VariableName') continue;

    const name = code.slice(from, to);
    if (declared.has(name) || SANDBOX_KNOWN_NAMES.has(name)) continue;
    if (overlapsAny(from, to, ranges)) continue;
    const suggestion = nearestSurfaceName(name, [...declared]);
    diagnostics.push({
      from,
      to,
      severity: 'error',
      message: suggestion
        ? `“${name}” isn’t available in stat code. Did you mean “${suggestion}”?`
        : `“${name}” isn’t available in stat code.`,
    });
  } while (cursor.next());

  // A missing return on code the parser couldn't finish reading is a guess about half-typed code.
  if (!sawReturn && !sawSyntaxError) {
    diagnostics.push({
      from: 0,
      to: Math.min(code.length, code.indexOf('\n') === -1 ? code.length : code.indexOf('\n')),
      severity: 'warning',
      message: 'This code never returns. Stat code has to return a number, or the stat keeps its manual value.',
    });
  }

  // One complaint per span: nested error nodes report the same spot more than once.
  const seen = new Set<string>();
  return diagnostics
    .filter((diagnostic) => {
      const key = `${diagnostic.from}:${diagnostic.to}:${diagnostic.message}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.from - b.from);
}
