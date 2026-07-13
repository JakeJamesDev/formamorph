import type { Placeholder, PlaceholderRolls } from '@/types';
import type { PromptSegment } from './promptTemplate';

/**
 * Placeholders — resolve author-defined named values embedded in world text as inline chips. The type is
 * inferred from the placeholder's value count: 1 value = a fixed Variable, 2+ = a random Wildcard whose chips
 * carry a World/Unique mode. This module is the deterministic core: the in-text token codec and a single pure
 * resolution pass applied wherever authored text surfaces (player display + AI context). Rolling is lazy —
 * the first resolution of a Wildcard mints and persists its value via `setRoll`; later ones reuse it.
 *
 * The name/token never reaches runtime — the resolved value is what both the player and the AI see.
 */

export type PlaceholderMode = 'world' | 'unique';

/** A decoded in-text chip: which placeholder, the roll mode, and the per-placement id (keys Unique rolls). */
export interface PlaceholderToken {
  id: string; // Placeholder.id
  mode: PlaceholderMode;
  placementId: string;
}

// {{ph:<placeholderId>:<world|unique>:<placementId>}} — double-brace keeps it clear of prompt `<...>` tokens,
// and ids are UUIDs (no colons), so `:` is a safe separator. Chips are inserted by the editor, not typed, so
// a stray literal that happens to match still resolves to "" unless its id names a real placeholder.
const TOKEN_RE = /\{\{ph:([^:{}]+):(world|unique):([^:{}]+)\}\}/g;

/** Encode a chip placement to its stored token string. */
export function encodePlaceholderToken(t: PlaceholderToken): string {
  return `{{ph:${t.id}:${t.mode}:${t.placementId}}}`;
}

/** Decode a single token string, or `null` if it isn't a well-formed placeholder token. */
export function decodePlaceholderToken(token: string): PlaceholderToken | null {
  const m = new RegExp(`^${TOKEN_RE.source}$`).exec(token);
  return m ? { id: m[1], mode: m[2] as PlaceholderMode, placementId: m[3] } : null;
}

/** True if `text` contains at least one placeholder chip (cheap pre-check to skip resolution work). */
export function hasPlaceholders(text: string): boolean {
  TOKEN_RE.lastIndex = 0;
  return TOKEN_RE.test(text);
}

/** Split text into literal runs and placeholder-chip tokens (mirrors parsePromptTemplate for the `{{ph}}`
 *  token, so the same Lexical chip editor can render placeholder fields). Non-token text stays literal. */
export function parsePlaceholderText(text: string): PromptSegment[] {
  const segments: PromptSegment[] = [];
  let last = 0;
  TOKEN_RE.lastIndex = 0;
  for (const match of text.matchAll(TOKEN_RE)) {
    const idx = match.index;
    if (idx > last) segments.push({ type: 'text', value: text.slice(last, idx) });
    segments.push({ type: 'variable', token: match[0] });
    last = idx + match[0].length;
  }
  if (last < text.length) segments.push({ type: 'text', value: text.slice(last) });
  return segments;
}

/** Every placeholder chip found across `texts`, split by mode: `worldIds` (dedup placeholder ids of World
 *  chips) and `unique` (per-placement id + its placeholder id). Drives eager roll priming. */
export function collectPlaceholderPlacements(texts: string[]): {
  worldIds: Set<string>;
  unique: Array<{ id: string; placementId: string }>;
} {
  const worldIds = new Set<string>();
  const unique = new Map<string, { id: string; placementId: string }>();
  for (const text of texts) {
    if (!text) continue;
    TOKEN_RE.lastIndex = 0;
    for (const m of text.matchAll(TOKEN_RE)) {
      const [, id, mode, placementId] = m;
      if (mode === 'unique') unique.set(placementId, { id, placementId });
      else worldIds.add(id);
    }
  }
  return { worldIds, unique: [...unique.values()] };
}

/**
 * Roll every Wildcard placement referenced across `texts`, keeping any `existing` rolls (so a loaded save's
 * frozen values are preserved). Only 2+-value placeholders roll — a Variable resolves from its single value,
 * and a missing/empty placeholder is skipped (resolves to ""). Pure: the caller persists the result.
 */
export function primeRolls(
  placeholders: Placeholder[],
  texts: string[],
  existing: PlaceholderRolls = {},
  pick: (values: string[]) => string = uniform,
): PlaceholderRolls {
  const byId = new Map(placeholders.map((p) => [p.id, p]));
  const isWild = (id: string) => (byId.get(id)?.values.length ?? 0) >= 2;
  const { worldIds, unique } = collectPlaceholderPlacements(texts);

  const world = { ...(existing.world ?? {}) };
  for (const id of worldIds) {
    if (isWild(id) && world[id] == null) world[id] = pick(byId.get(id)!.values);
  }
  const uniqueRolls = { ...(existing.unique ?? {}) };
  for (const { id, placementId } of unique) {
    if (isWild(id) && uniqueRolls[placementId] == null) uniqueRolls[placementId] = pick(byId.get(id)!.values);
  }
  return { world, unique: uniqueRolls };
}

// --- portability (export bundle / import absorb) ---------------------------------------------------------

/** The subset of `available` defs actually referenced by chips in `texts` — what a standalone export bundles
 *  so its chips resolve elsewhere. Order follows `available`; each def appears at most once. */
export function collectUsedPlaceholders(texts: string[], available: Placeholder[]): Placeholder[] {
  const used = new Set<string>();
  for (const text of texts) {
    if (!text) continue;
    TOKEN_RE.lastIndex = 0;
    for (const m of text.matchAll(TOKEN_RE)) used.add(m[1]);
  }
  return available.filter((p) => used.has(p.id));
}

/** Rewrite chip tokens' placeholder id via `idMap` (`{{ph:<old>:<mode>:<pid>}}` → new id; mode + placement id
 *  preserved). Ids absent from the map are left as-is. Used when absorbing an imported item's placeholders. */
export function remapPlaceholderIds(text: string, idMap: Record<string, string>): string {
  if (!text || !hasPlaceholders(text)) return text;
  TOKEN_RE.lastIndex = 0;
  return text.replace(TOKEN_RE, (full, id: string, mode: string, placementId: string) => {
    const next = idMap[id];
    return next ? `{{ph:${next}:${mode}:${placementId}}}` : full;
  });
}

/**
 * Merge an imported item's carried placeholder defs into a world's list. A **perfect match** (same name AND
 * values) reuses the existing def's id; anything else becomes a fresh-id def (collision-proof). Pure: returns
 * the defs to add and an id map (every carried id → its resolved world id) for the caller to remap tokens with.
 */
export function absorbPlaceholders(
  carried: Placeholder[],
  worldPlaceholders: Placeholder[],
): { toAdd: Placeholder[]; idMap: Record<string, string> } {
  const sameValues = (a: string[], b: string[]) => a.length === b.length && a.every((v, i) => v === b[i]);
  const toAdd: Placeholder[] = [];
  const idMap: Record<string, string> = {};
  // Match against the world's list plus anything added so far this pass (so two carried copies of the same def
  // collapse to one).
  const pool = [...worldPlaceholders];
  for (const c of carried) {
    const match = pool.find((p) => p.name === c.name && sameValues(p.values, c.values));
    if (match) {
      idMap[c.id] = match.id;
    } else {
      const fresh: Placeholder = { id: crypto.randomUUID(), name: c.name, values: [...c.values] };
      toAdd.push(fresh);
      pool.push(fresh);
      idMap[c.id] = fresh.id;
    }
  }
  return { toAdd, idMap };
}

export interface ResolveOptions {
  placeholders: Placeholder[];
  /** Frozen rolls for this playthrough. Not mutated — new rolls are reported via `setRoll`. */
  rolls: PlaceholderRolls;
  /** Persist a freshly-minted Wildcard roll (`world` keyed by placeholder id, `unique` by placement id).
   *  Omit in read-only/design-time contexts; then a not-yet-rolled Wildcard picks a value without persisting. */
  setRoll?: (scope: PlaceholderMode, key: string, value: string) => void;
  /** Injectable chooser (tests pass a deterministic pick). Defaults to a uniform random draw. */
  pick?: (values: string[]) => string;
}

const uniform = (values: string[]): string => values[Math.floor(Math.random() * values.length)];

/**
 * Replace every placeholder chip in `text` with its resolved value. Single pass — a resolved value is never
 * re-scanned, so nested chips are not expanded (v1: flat values only). A token whose placeholder is missing or
 * has no values resolves to "".
 */
export function resolvePlaceholders(text: string, opts: ResolveOptions): string {
  if (!text || !hasPlaceholders(text)) return text;
  const { placeholders, rolls, setRoll, pick = uniform } = opts;
  const byId = new Map(placeholders.map((p) => [p.id, p]));
  // Rolls minted during THIS pass — so two chips sharing a key agree even before `setRoll`'s (async) state
  // update lands back in `rolls`.
  const minted: Record<PlaceholderMode, Record<string, string>> = { world: {}, unique: {} };

  TOKEN_RE.lastIndex = 0;
  return text.replace(TOKEN_RE, (_full, id: string, mode: string, placementId: string) => {
    const ph = byId.get(id);
    if (!ph || ph.values.length === 0) return ''; // missing or empty → nothing
    if (ph.values.length === 1) return ph.values[0]; // Variable (fixed)

    // Wildcard: World shares one value per placeholder id; Unique rolls per placement id.
    const scope: PlaceholderMode = mode === 'unique' ? 'unique' : 'world';
    const key = scope === 'world' ? id : placementId;
    const existing = rolls[scope]?.[key] ?? minted[scope][key];
    if (existing != null) return existing;

    const rolled = pick(ph.values);
    minted[scope][key] = rolled;
    setRoll?.(scope, key, rolled);
    return rolled;
  });
}
