/**
 * What one kind of sandboxed code can reach, as one list. The code editor, its completions, its
 * diagnostics and its Variable menu read a surface and nothing else, so stat code and any other script
 * each describe their own sandbox in one place.
 *
 * A surface describes a sandbox; it never widens one. The exposure lives in each executor.
 */

import type { DocTarget } from '@/lib/docs/docsLinks';

/** Whether code can write a name: now, only from the next run on, or not at all. */
export type CodeAccess = 'writable' | 'afterRun' | 'readOnly';

/** The badge label for each access, in the card's AP title case. */
export const ACCESS_LABEL: Record<CodeAccess, string> = {
  writable: 'Writable',
  afterRun: 'Writable After This Run',
  readOnly: 'Read-Only',
};

/** `text` ended by a period, unless it already ends a sentence. */
export const closeSentence = (text: string): string => (/[.!?]$/.test(text) ? text : `${text}.`);

/** The access as a closing sentence, for a list that draws no badge. Prose keeps "read-only" in sentence case. */
const accessSentence = (access: CodeAccess): string => closeSentence(ACCESS_LABEL[access].charAt(0) + ACCESS_LABEL[access].slice(1).toLowerCase());

/** `info` closed by its access as a sentence. Info lines carry no access words, so the badge-less lists add them here. */
export function infoWithAccess({ info, access }: Pick<SurfaceEntry, 'info' | 'access'>): string {
  return access ? `${closeSentence(info)} ${accessSentence(access)}` : info;
}

/** One reachable name and what an author needs to know about it. */
export interface SurfaceEntry {
  name: string;
  /** The short right-hand hint — a type or a shape. */
  detail: string;
  /** The one-line explanation shown beside the entry. */
  info: string;
  /** Absent on a method, and on a map whose own entries carry the access. */
  access?: CodeAccess;
}

/** Whether an entry is a function, by the arrow its detail spells. */
export const isMethodEntry = (entry: Pick<SurfaceEntry, 'detail'>): boolean => /^\(.*\)\s*=>/.test(entry.detail);

/** `entries` with each field's access. A method and a name in `maps` carry none. */
const applyAccess = (entries: readonly SurfaceEntry[], accessOf: (name: string) => CodeAccess, maps: readonly string[]) =>
  entries.map((entry) => (isMethodEntry(entry) || maps.includes(entry.name) ? entry : { ...entry, access: accessOf(entry.name) }));

/** `entries` with each field's access, from an executor's own list of the fields a write reaches. */
export const withAccess = (
  entries: readonly SurfaceEntry[], writable: readonly string[], when: Exclude<CodeAccess, 'readOnly'>, maps: readonly string[] = [],
): SurfaceEntry[] => applyAccess(entries, (name) => (writable.includes(name) ? when : 'readOnly'), maps);

/** `entries` where no write reaches any field. */
export const readOnlyEntries = (entries: readonly SurfaceEntry[], maps: readonly string[] = []): SurfaceEntry[] =>
  applyAccess(entries, () => 'readOnly', maps);

/**
 * The names one kind of code can reach, their members, and how its reader talks about it.
 *
 * The rules for the `stats`, `self`, `placeholders` and `traits` maps apply only where a surface sets
 * `statMaps` and lists that name among its globals.
 */
export interface CodeSurface {
  /** What a message calls the code, as in “x” isn’t available in this script. */
  label: string;
  /** The names the sandbox injects, in the order an author meets them. Offered first. */
  globals: readonly SurfaceEntry[];
  /** Built-ins the VM already has that are worth offering. */
  builtins: readonly SurfaceEntry[];
  /** What to offer after an exact expression and a dot, like `Math` or `args`. An empty list offers
   *  nothing, which still stops a guess. */
  members: ReadonlyMap<string, readonly SurfaceEntry[]>;
  /** Language-level names a reference may use without being a typo. Never offered. */
  languageNames: readonly string[];
  /** The warning for code that neither returns nor writes anything, or null when that is fine. */
  missingReturn: string | null;
  /** True when `stats`, `self`, `placeholders` and `traits` are stat code's maps, with their rules. */
  statMaps: boolean;
  /** What `self` holds with `statMaps`: a trait's script reads its trait's entry, read-only; a world script's is
   *  empty. Absent = a stat. */
  selfIs?: 'trait' | 'empty';
  /** True when no write reaches anything and no method exists: a user Tool's script (Q24). */
  readOnly?: boolean;
  /** The Guide heading of each global that has one, for its card's Read in the Guide link. */
  guide?: Readonly<Record<string, DocTarget>>;
  /** Retired globals by name: each member read and the sentence naming its new form (Q28). */
  retired?: Readonly<Record<string, Readonly<Record<string, string>>>>;
}

const knownNames = new WeakMap<CodeSurface, ReadonlySet<string>>();

/** Every name a reference may resolve to without the author having declared it. */
export function surfaceKnownNames(surface: CodeSurface): ReadonlySet<string> {
  let names = knownNames.get(surface);
  if (!names) {
    names = new Set([
      ...surface.globals.map((entry) => entry.name),
      ...surface.builtins.map((entry) => entry.name),
      ...surface.languageNames,
    ]);
    knownNames.set(surface, names);
  }
  return names;
}

/** Whether the surface injects `name`. */
export const surfaceHasGlobal = (surface: CodeSurface, name: string): boolean =>
  surface.globals.some((entry) => entry.name === name);

/** How far apart two names may be and still read as the same one mistyped. Scaled to length so short
 *  names don't suggest each other and long ones tolerate a slip. */
const suggestionDistance = (name: string): number => (name.length <= 4 ? 1 : name.length <= 8 ? 2 : 3);

/** Levenshtein distance with transposition, capped implicitly by the short strings involved. Two letters
 *  swapped counts as one slip rather than two, because that is the typo an author actually makes. */
function editDistance(a: string, b: string): number {
  const rows: number[][] = [Array.from({ length: b.length + 1 }, (_, index) => index)];
  for (let i = 1; i <= a.length; i += 1) {
    const row = [i];
    for (let j = 1; j <= b.length; j += 1) {
      row[j] = Math.min(
        rows[i - 1][j] + 1,
        row[j - 1] + 1,
        rows[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        row[j] = Math.min(row[j], rows[i - 2][j - 2] + 1);
      }
    }
    rows.push(row);
  }
  return rows[a.length][b.length];
}

/** The candidate `name` was most likely meant to be, or null when nothing is close enough. Case-insensitive,
 *  so `Stats` still points at `stats`. */
export function nearestName(name: string, candidates: readonly string[]): string | null {
  const limit = suggestionDistance(name);
  let best: string | null = null;
  let bestDistance = Infinity;
  for (const candidate of candidates) {
    if (candidate === name) return null;
    const distance = editDistance(name.toLowerCase(), candidate.toLowerCase());
    if (distance <= limit && distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }
  return best;
}
