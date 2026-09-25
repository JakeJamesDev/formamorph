/**
 * What one kind of sandboxed code can reach, as one list. The code editor, its completions, its
 * diagnostics and its Variable menu read a surface and nothing else, so stat code and any other script
 * each describe their own sandbox in one place.
 *
 * A surface describes a sandbox; it never widens one. The exposure lives in each executor.
 */

import type { InsertSnippet } from '@/lib/codeSnippets';

/** One reachable name and what an author needs to know about it. */
export interface SurfaceEntry {
  name: string;
  /** The short right-hand hint — a type or a shape. */
  detail: string;
  /** The one-line explanation shown beside the entry. */
  info: string;
}

/**
 * The names one kind of code can reach, their members, and how its reader talks about it.
 *
 * The rules for the `stats`, `self`, `placeholders` and `traits` maps apply only where a surface lists
 * that name among its globals.
 */
export interface CodeSurface {
  /** What a message calls the code, as in “x” isn’t available in stat code. */
  label: string;
  /** The names the sandbox injects, in the order an author meets them. Offered first. */
  globals: readonly SurfaceEntry[];
  /** Names the sandbox injects for older code but never offers or documents. */
  hiddenGlobals: readonly string[];
  /** Built-ins the VM already has that are worth offering. */
  builtins: readonly SurfaceEntry[];
  /** What to offer after an exact expression and a dot, like `Math` or `args`. An empty list offers
   *  nothing, which still stops a guess. */
  members: ReadonlyMap<string, readonly SurfaceEntry[]>;
  /** Language-level names a reference may use without being a typo. Never offered. */
  languageNames: readonly string[];
  /** The Variable menu. */
  snippets: readonly InsertSnippet[];
  /** The warning for code that neither returns nor writes anything, or null when that is fine. */
  missingReturn: string | null;
}

const knownNames = new WeakMap<CodeSurface, ReadonlySet<string>>();

/** Every name a reference may resolve to without the author having declared it. */
export function surfaceKnownNames(surface: CodeSurface): ReadonlySet<string> {
  let names = knownNames.get(surface);
  if (!names) {
    names = new Set([
      ...surface.globals.map((entry) => entry.name),
      ...surface.hiddenGlobals,
      ...surface.builtins.map((entry) => entry.name),
      ...surface.languageNames,
    ]);
    knownNames.set(surface, names);
  }
  return names;
}

/** Whether the surface injects `name`. */
export const surfaceHasGlobal = (surface: CodeSurface, name: string): boolean =>
  surface.globals.some((entry) => entry.name === name) || surface.hiddenGlobals.includes(name);

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
