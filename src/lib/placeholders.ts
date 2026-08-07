import { randomUUID } from "@/lib/uuid";
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

/** Chooses one of a Wildcard's values. `weights` is the def's per-value weight map (see `placeholderWeight`);
 *  tests pass a deterministic chooser that ignores it. */
export type PlaceholderPick = (values: string[], weights?: Record<string, number>) => string;

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
  pick: PlaceholderPick = weightedPick,
): PlaceholderRolls {
  const byId = new Map(placeholders.map((p) => [p.id, p]));
  const isWild = (id: string) => (byId.get(id)?.values.length ?? 0) >= 2;
  const roll = (id: string) => { const p = byId.get(id)!; return pick(p.values, p.weights); };
  const { worldIds, unique } = collectPlaceholderPlacements(texts);

  const world = { ...(existing.world ?? {}) };
  for (const id of worldIds) {
    if (isWild(id) && world[id] == null) world[id] = roll(id);
  }
  const uniqueRolls = { ...(existing.unique ?? {}) };
  for (const { id, placementId } of unique) {
    if (isWild(id) && uniqueRolls[placementId] == null) uniqueRolls[placementId] = roll(id);
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
  // Two defs sharing a name and values but weighted differently are different defs — matching on values
  // alone would silently re-point the import's chips at the host world's distribution.
  const sameWeights = (a: Placeholder, b: Placeholder) =>
    a.values.every((v) => placeholderWeight(a, v) === placeholderWeight(b, v));
  const toAdd: Placeholder[] = [];
  const idMap: Record<string, string> = {};
  // Match against the world's list plus anything added so far this pass (so two carried copies of the same def
  // collapse to one).
  const pool = [...worldPlaceholders];
  for (const c of carried) {
    const match = pool.find((p) => p.name === c.name && sameValues(p.values, c.values) && sameWeights(p, c));
    if (match) {
      idMap[c.id] = match.id;
    } else {
      const fresh: Placeholder = {
        id: randomUUID(),
        name: c.name,
        values: [...c.values],
        ...(c.weights ? { weights: { ...c.weights } } : {}),
      };
      toAdd.push(fresh);
      pool.push(fresh);
      idMap[c.id] = fresh.id;
    }
  }
  return { toAdd, idMap };
}

/**
 * Author-time preview: a `token → resolved value` map for every distinct chip in `text`, so a design-time
 * Preview pane can swap chips for values without any save/rolls. Mirrors {@link resolvePlaceholders} exactly —
 * Variable → its value, Wildcard rolled with World shared per placeholder id / Unique per placement id, and a
 * missing/empty placeholder → "". `pick` is injectable (tests pass a deterministic chooser).
 */
export function buildPlaceholderPreview(
  text: string,
  placeholders: Placeholder[],
  pick: PlaceholderPick = weightedPick,
): Record<string, string> {
  const out: Record<string, string> = {};
  if (!text || !hasPlaceholders(text)) return out;
  // Roll once (respecting World/Unique) so shared World chips agree; then map each distinct token to its value.
  const rolls = primeRolls(placeholders, [text], {}, pick);
  const byId = new Map(placeholders.map((p) => [p.id, p]));
  TOKEN_RE.lastIndex = 0;
  for (const m of text.matchAll(TOKEN_RE)) {
    const token = m[0];
    if (token in out) continue;
    const [, id, mode, placementId] = m;
    const ph = byId.get(id);
    if (!ph || ph.values.length === 0) { out[token] = ''; continue; }
    if (ph.values.length === 1) { out[token] = ph.values[0]; continue; }
    const scope: PlaceholderMode = mode === 'unique' ? 'unique' : 'world';
    const key = scope === 'world' ? id : placementId;
    out[token] = rolls[scope]?.[key] ?? '';
  }
  return out;
}

/**
 * Display-only chip rendering for surfaces with no world or rolls behind them — a library card, a community
 * listing blurb. A Variable shows its value; a Wildcard shows its options as `{a|b}` (first 3, then `…`);
 * a chip whose def is missing or empty shows nothing. Never rolls, so the same text always reads the same.
 */
export function describePlaceholders(text: string, placeholders: Placeholder[] = []): string {
  if (!text || !hasPlaceholders(text)) return text;
  const byId = new Map(placeholders.map((p) => [p.id, p]));
  TOKEN_RE.lastIndex = 0;
  return text.replace(TOKEN_RE, (_full, id: string) => {
    const values = byId.get(id)?.values ?? [];
    if (values.length === 0) return '';
    if (values.length === 1) return values[0];
    const shown = values.slice(0, 3).join('|');
    return `{${shown}${values.length > 3 ? '|…' : ''}}`;
  });
}

export interface ResolveOptions {
  placeholders: Placeholder[];
  /** Frozen rolls for this playthrough. Not mutated — new rolls are reported via `setRoll`. */
  rolls: PlaceholderRolls;
  /** Persist a freshly-minted Wildcard roll (`world` keyed by placeholder id, `unique` by placement id).
   *  Omit in read-only/design-time contexts; then a not-yet-rolled Wildcard picks a value without persisting. */
  setRoll?: (scope: PlaceholderMode, key: string, value: string) => void;
  /** Injectable chooser (tests pass a deterministic pick). Defaults to a weighted random draw. */
  pick?: PlaceholderPick;
  /** Placeholder id → value forced by an active trait. Masks the roll for as long as the trait is on; the
   *  roll itself is never overwritten, so switching the trait off reveals it again. */
  pins?: Record<string, string>;
}

/** A value's relative draw weight — 1 unless the author set one. Negatives are treated as 0 (benched). */
export function placeholderWeight(ph: Placeholder, value: string): number {
  const w = ph.weights?.[value];
  return typeof w === 'number' && Number.isFinite(w) ? Math.max(0, w) : 1;
}

/** True if any value carries a non-default weight — what gates the editor's percentage reveal. */
export function isWeighted(ph: Placeholder): boolean {
  return ph.values.some((v) => placeholderWeight(ph, v) !== 1);
}

/**
 * Each value's chance of being drawn, as a percentage keyed by value. Mirrors {@link weightedPick} exactly,
 * including its all-zero fallback to a uniform draw, so the editor's reveal never disagrees with the roll.
 */
export function placeholderChances(ph: Placeholder): Record<string, number> {
  const out: Record<string, number> = {};
  const total = ph.values.reduce((sum, v) => sum + placeholderWeight(ph, v), 0);
  for (const v of ph.values) {
    out[v] = total > 0 ? (placeholderWeight(ph, v) / total) * 100 : 100 / ph.values.length;
  }
  return out;
}

/** Draw a value honoring per-value weights. Weights that sum to 0 (every value benched) fall back to a
 *  uniform draw rather than resolving to nothing — an author zeroing everything still gets a value. */
const weightedPick = (values: string[], weights?: Record<string, number>): string => {
  const uniform = () => values[Math.floor(Math.random() * values.length)];
  if (!weights) return uniform();
  const w = values.map((v) => {
    const n = weights[v];
    return typeof n === 'number' && Number.isFinite(n) ? Math.max(0, n) : 1;
  });
  const total = w.reduce((a, b) => a + b, 0);
  if (total <= 0) return uniform();
  let r = Math.random() * total;
  for (let i = 0; i < values.length; i++) {
    r -= w[i];
    if (r < 0) return values[i];
  }
  return values[values.length - 1];
};

/**
 * Replace every placeholder chip in `text` with its resolved value. Single pass — a resolved value is never
 * re-scanned, so nested chips are not expanded (v1: flat values only). A token whose placeholder is missing or
 * has no values resolves to "".
 */
export function resolvePlaceholders(text: string, opts: ResolveOptions): string {
  if (!text || !hasPlaceholders(text)) return text;
  const { placeholders, rolls, setRoll, pick = weightedPick, pins } = opts;
  const byId = new Map(placeholders.map((p) => [p.id, p]));
  // Rolls minted during THIS pass — so two chips sharing a key agree even before `setRoll`'s (async) state
  // update lands back in `rolls`.
  const minted: Record<PlaceholderMode, Record<string, string>> = { world: {}, unique: {} };

  TOKEN_RE.lastIndex = 0;
  return text.replace(TOKEN_RE, (_full, id: string, mode: string, placementId: string) => {
    const ph = byId.get(id);
    if (!ph) return ''; // missing → nothing
    // An active trait's pin masks every chip of this placeholder, Unique ones included — the intent is a
    // fact about the character, not about one sentence.
    const pinned = pins?.[id];
    if (pinned != null) return pinned;
    if (ph.values.length === 0) return ''; // empty → nothing
    if (ph.values.length === 1) return ph.values[0]; // Variable (fixed)

    // Wildcard: World shares one value per placeholder id; Unique rolls per placement id.
    const scope: PlaceholderMode = mode === 'unique' ? 'unique' : 'world';
    const key = scope === 'world' ? id : placementId;
    const existing = rolls[scope]?.[key] ?? minted[scope][key];
    if (existing != null) return existing;

    const rolled = pick(ph.values, ph.weights);
    minted[scope][key] = rolled;
    setRoll?.(scope, key, rolled);
    return rolled;
  });
}
