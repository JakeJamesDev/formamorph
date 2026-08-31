import { randomUUID } from "@/lib/uuid";
import type { Placeholder, PlaceholderRolls } from '@/types';
import type { PromptSegment } from './promptTemplate';

/**
 * Placeholders — resolve author-defined named values embedded in world text as inline chips. A placeholder
 * either draws one value (a choice) or joins them all (a record); `roll` decides, and without it the value
 * count does — 1 value = a fixed Variable, 2+ = a random Wildcard. Values are chip-capable themselves, so a
 * value that is exactly one chip is a structural child a chip's drill path can address by name or by id.
 * This module is the deterministic core: the in-text token codec and one pure recursive resolution pass
 * applied wherever authored text surfaces (player display + AI context). Rolling is lazy — the first
 * resolution of a choice mints and persists its value via `setRoll`; later ones reuse it.
 *
 * The name/token never reaches runtime — the resolved value is what both the player and the AI see.
 */

export type PlaceholderMode = 'world' | 'unique';

/** Chooses one of a Wildcard's values. `weights` is the def's per-value weight map (see `placeholderWeight`);
 *  tests pass a deterministic chooser that ignores it. */
export type PlaceholderPick = (values: string[], weights?: Record<string, number>) => string;

/**
 * One step of a chip's drill path under its root placeholder. `val` names an explicit pick by the target
 * placeholder's id — the value that is exactly that chip. `slot` names a target by name and routes through
 * whichever value a choice placeholder drew, so two chips describing one rolled character agree.
 */
export type PlaceholderSegment =
  | { kind: 'val'; ref: string }
  | { kind: 'slot'; name: string };

/** A decoded in-text chip: which placeholder, the roll mode, the per-placement id (keys Unique rolls), and
 *  the optional drill path under the root. Every shipped token has no path. */
export interface PlaceholderToken {
  id: string; // Placeholder.id
  mode: PlaceholderMode;
  placementId: string;
  path?: PlaceholderSegment[];
}

// {{ph:<placeholderId>:<world|unique>:<placementId>[:<path>]}} — double-brace keeps it clear of prompt
// `<...>` tokens, and ids are UUIDs (no colons), so `:` is a safe separator. Chips are inserted by the
// editor, not typed, so a stray literal that happens to match still resolves to "" unless its id names a
// real placeholder. The path group is optional, so a token written before this feature parses unchanged.
const TOKEN_RE = /\{\{ph:([^:{}]+):(world|unique):([^:{}]+)(?::([^:{}]+))?\}\}/g;

// Path grammar: segments joined by `>`, each `v<targetId>` (explicit pick) or `s<name>` (slot). Slot names
// are author text, so the four characters the grammar owns are percent-escaped.
const SEG_SEP = '>';
const escapeSeg = (s: string) => s.replace(/[%:{}>]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
const unescapeSeg = (s: string) => s.replace(/%([0-9A-F]{2})/g, (_m, hex: string) => String.fromCharCode(parseInt(hex, 16)));

/** Encode a drill path to its in-token form. An empty path encodes to `''` (no path segment in the token). */
export function encodePlaceholderPath(path: PlaceholderSegment[]): string {
  return path.map((s) => (s.kind === 'val' ? `v${escapeSeg(s.ref)}` : `s${escapeSeg(s.name)}`)).join(SEG_SEP);
}

/** Decode a path's token form, or `null` if any segment is malformed (an unknown kind prefix). */
export function decodePlaceholderPath(raw: string): PlaceholderSegment[] | null {
  const out: PlaceholderSegment[] = [];
  for (const part of raw.split(SEG_SEP)) {
    const body = unescapeSeg(part.slice(1));
    if (part.startsWith('v')) out.push({ kind: 'val', ref: body });
    else if (part.startsWith('s')) out.push({ kind: 'slot', name: body });
    else return null;
  }
  return out;
}

/** Encode a chip placement to its stored token string. */
export function encodePlaceholderToken(t: PlaceholderToken): string {
  const path = t.path?.length ? `:${encodePlaceholderPath(t.path)}` : '';
  return `{{ph:${t.id}:${t.mode}:${t.placementId}${path}}}`;
}

/** Decode a single token string, or `null` if it isn't a well-formed placeholder token. */
export function decodePlaceholderToken(token: string): PlaceholderToken | null {
  const m = new RegExp(`^${TOKEN_RE.source}$`).exec(token);
  if (!m) return null;
  const base = { id: m[1], mode: m[2] as PlaceholderMode, placementId: m[3] };
  if (!m[4]) return base;
  const path = decodePlaceholderPath(m[4]);
  return path ? { ...base, path } : null;
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
  // Module-wide: `values` is read as `?? []` — hand-edited world JSON can omit it, and a def without a
  // list is an empty placeholder, not a crash.
  const isWild = (id: string) => (byId.get(id)?.values?.length ?? 0) >= 2;
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

/** Rewrite chip tokens' placeholder id via `idMap` (`{{ph:<old>:<mode>:<pid>}}` → new id; mode, placement id
 *  and drill path preserved). Ids absent from the map are left as-is. Used when absorbing an imported item's
 *  placeholders. */
export function remapPlaceholderIds(text: string, idMap: Record<string, string>): string {
  if (!text || !hasPlaceholders(text)) return text;
  TOKEN_RE.lastIndex = 0;
  return text.replace(TOKEN_RE, (full, id: string, mode: string, placementId: string, path?: string) => {
    const next = idMap[id];
    return next ? `{{ph:${next}:${mode}:${placementId}${path ? `:${path}` : ''}}}` : full;
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
    (a.values ?? []).every((v) => placeholderWeight(a, v) === placeholderWeight(b, v));
  const toAdd: Placeholder[] = [];
  const idMap: Record<string, string> = {};
  // Match against the world's list plus anything added so far this pass (so two carried copies of the same def
  // collapse to one).
  const pool = [...worldPlaceholders];
  for (const c of carried) {
    const match = pool.find((p) => p.name === c.name && sameValues(p.values ?? [], c.values ?? []) && sameWeights(p, c));
    if (match) {
      idMap[c.id] = match.id;
    } else {
      const fresh: Placeholder = {
        id: randomUUID(),
        name: c.name,
        values: [...(c.values ?? [])],
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
    if (!ph?.values?.length) { out[token] = ''; continue; }
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
 *
 * `pins` mask chips the way an active trait's do in {@link resolvePlaceholders}, in the same order: a chip
 * whose placeholder the world doesn't have still shows nothing, since play can't pin what it can't find.
 * That is what lets a design-time surface show a pinned character's text without inventing a roll.
 */
export function describePlaceholders(
  text: string,
  placeholders: Placeholder[] = [],
  pins?: Record<string, string>,
): string {
  if (!text || !hasPlaceholders(text)) return text;
  const byId = new Map(placeholders.map((p) => [p.id, p]));
  TOKEN_RE.lastIndex = 0;
  return text.replace(TOKEN_RE, (_full, id: string) => {
    const ph = byId.get(id);
    if (!ph) return '';
    const pinned = pins?.[id];
    if (pinned != null) return pinned;
    if (!ph.values?.length) return '';
    return ph.values.length === 1 ? ph.values[0] : `{${placeholderValueSummary(ph)}}`;
  });
}

/** One value as a single line — a paragraph-length value becomes its first line plus `…`. Every one-line
 *  surface reads a value through this; resolution never does, so what the AI and the player get is verbatim. */
export function placeholderValueLine(value: string): string {
  const nl = value.indexOf('\n');
  if (nl === -1) return value;
  const head = value.slice(0, nl).trimEnd();
  return head ? `${head} …` : '…';
}

/** A Wildcard's options as one short line — first three, then `…`. The shared form behind the braces in
 *  {@link describePlaceholders}, the *tooltip* of an in-editor chip, and the *label* of a read-only pill. */
export function placeholderValueSummary(ph: Placeholder): string {
  const values = (ph.values ?? []).map(placeholderValueLine);
  const shown = values.slice(0, 3).join('|');
  return values.length > 3 ? `${shown}|…` : shown;
}

/** What went wrong on one step of a walk. Resolution always yields text — a finding is the diagnostic the
 *  Test Bench reads, never a break in play. */
export type PlaceholderFindingKind =
  /** A placed path names a slot the value it routed through does not carry. */
  | 'slot-miss'
  /** A chip whose placeholder no longer exists. */
  | 'dangling'
  /** A chip whose drill path is not readable — only hand-edited world JSON produces one. */
  | 'malformed'
  /** A placeholder reached itself through its own values. */
  | 'cycle'
  /** The walk ran past {@link PLACEHOLDER_DEPTH_CAP} levels. */
  | 'depth';

export interface PlaceholderFinding {
  kind: PlaceholderFindingKind;
  /** The placeholder the walk stood on, when there was one. */
  placeholderId?: string;
  /** What the path asked for — a slot name, or a target id for an explicit pick. */
  asked?: string;
}

export interface ResolveOptions {
  placeholders: Placeholder[];
  /** Frozen rolls for this playthrough. Not mutated — new rolls are reported via `setRoll`. */
  rolls: PlaceholderRolls;
  /** Persist a freshly-minted roll (`world` keyed by placeholder id, `unique` by the placement chain).
   *  Omit in read-only/design-time contexts; then a not-yet-rolled choice picks a value without persisting. */
  setRoll?: (scope: PlaceholderMode, key: string, value: string) => void;
  /** Injectable chooser (tests pass a deterministic pick). Defaults to a weighted random draw. */
  pick?: PlaceholderPick;
  /** Placeholder id → value forced by an active trait. Masks the roll for as long as the trait is on; the
   *  roll itself is never overwritten, so switching the trait off reveals it again. */
  pins?: Record<string, string>;
  /** Called once per structural problem met while resolving. */
  onFinding?: (finding: PlaceholderFinding) => void;
}

/** A value's relative draw weight — 1 unless the author set one. Negatives are treated as 0 (benched). */
export function placeholderWeight(ph: Placeholder, value: string): number {
  const w = ph.weights?.[value];
  return typeof w === 'number' && Number.isFinite(w) ? Math.max(0, w) : 1;
}

/** True if any value carries a non-default weight — what gates the editor's percentage reveal. */
export function isWeighted(ph: Placeholder): boolean {
  return (ph.values ?? []).some((v) => placeholderWeight(ph, v) !== 1);
}

/**
 * Each value's chance of being drawn, as a percentage keyed by value. Mirrors {@link weightedPick} exactly,
 * including its all-zero fallback to a uniform draw, so the editor's reveal never disagrees with the roll.
 */
export function placeholderChances(ph: Placeholder): Record<string, number> {
  const out: Record<string, number> = {};
  const values = ph.values ?? [];
  const total = values.reduce((sum, v) => sum + placeholderWeight(ph, v), 0);
  for (const v of values) {
    out[v] = total > 0 ? (placeholderWeight(ph, v) / total) * 100 : 100 / values.length;
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

/** How many levels the walk descends before it gives up and reports a `depth` finding. */
export const PLACEHOLDER_DEPTH_CAP = 16;

/** True if a placeholder draws one of its values rather than joining all of them. `roll` decides when the
 *  author set it; otherwise the value count does, exactly as it always has. */
export function placeholderIsChoice(ph: Placeholder): boolean {
  return (ph.values?.length ?? 0) > 1 && (ph.roll ?? true);
}

/** A path segment as the walk carries it. `authored` marks a segment that came from a chip sitting inside a
 *  value — an author's pre-selection, which a trait pin overrides. Segments typed into world text are not
 *  authored, so they name the branch they say and no pin moves them. */
type WalkSegment = PlaceholderSegment & { authored?: boolean };

/** One resolution pass. `scope`/`chain` decide which rolls a placeholder reads: World shares a value per
 *  placeholder id; Unique keys the whole subtree under the placement chain that led into it. */
interface ResolveCtx {
  byId: Map<string, Placeholder>;
  rolls: PlaceholderRolls;
  /** Rolls minted during THIS pass — so two chips sharing a key agree even before `setRoll`'s (async) state
   *  update lands back in `rolls`. Shared by reference across the whole walk. */
  minted: Record<PlaceholderMode, Record<string, string>>;
  setRoll?: (scope: PlaceholderMode, key: string, value: string) => void;
  pick: PlaceholderPick;
  pins?: Record<string, string>;
  report: (finding: PlaceholderFinding) => void;
  scope: PlaceholderMode;
  /** Placement chain keying Unique rolls; `''` under World. */
  chain: string;
  /** The placeholder whose Unique roll keeps the bare chain as its key — the chain's own root. */
  chainRootId: string;
  seen: ReadonlySet<string>;
  depth: number;
}

/** The token string of a value that is *exactly* one chip — the shape that makes a value a structural child.
 *  A chip with text around it composes into the value instead, and is not addressable. */
function loneChipToken(value: string): string | null {
  const m = new RegExp(`^${TOKEN_RE.source}$`).exec(value ?? '');
  return m ? m[0] : null;
}

/** Every structural child of `ph`: its lone-chip values, paired with the placeholder each one roots at. */
function childChips(ph: Placeholder, ctx: ResolveCtx): Array<{ token: PlaceholderToken; target: Placeholder }> {
  const out: Array<{ token: PlaceholderToken; target: Placeholder }> = [];
  for (const value of ph.values ?? []) {
    const raw = loneChipToken(value);
    const token = raw ? decodePlaceholderToken(raw) : null;
    const target = token ? ctx.byId.get(token.id) : undefined;
    if (token && target) out.push({ token, target });
  }
  return out;
}

/** Where a placeholder's roll is stored under the current scope. */
function rollKey(ph: Placeholder, ctx: ResolveCtx): string {
  if (ctx.scope === 'world') return ph.id;
  // The chain's root keeps the bare placement id, so a save written before drill paths existed still reads.
  return ph.id === ctx.chainRootId ? ctx.chain : `${ctx.chain}/${ph.id}`;
}

/** The value a choice placeholder shows: a pin masks it, else the frozen roll, else a fresh weighted draw. */
function selectValue(ph: Placeholder, ctx: ResolveCtx): string {
  const pinned = ctx.pins?.[ph.id];
  if (pinned != null) return pinned;
  const key = rollKey(ph, ctx);
  const existing = ctx.rolls[ctx.scope]?.[key] ?? ctx.minted[ctx.scope][key];
  if (existing != null) return existing;
  const rolled = ctx.pick(ph.values, ph.weights);
  ctx.minted[ctx.scope][key] = rolled;
  ctx.setRoll?.(ctx.scope, key, rolled);
  return rolled;
}

/** Resolve a whole placeholder: a choice shows one value, a record joins them all. */
function resolvePh(ph: Placeholder, ctx: ResolveCtx): string {
  if (ctx.depth > PLACEHOLDER_DEPTH_CAP) {
    ctx.report({ kind: 'depth', placeholderId: ph.id });
    return '';
  }
  if (ctx.seen.has(ph.id)) {
    ctx.report({ kind: 'cycle', placeholderId: ph.id });
    return '';
  }
  const inner: ResolveCtx = { ...ctx, seen: new Set(ctx.seen).add(ph.id), depth: ctx.depth + 1 };
  // An active trait's pin masks every chip of this placeholder, Unique ones included — the intent is a fact
  // about the character, not about one sentence. A broken pin still applies, so it is checked before the
  // values are: a pin on an emptied placeholder is still the author's word.
  const pinned = ctx.pins?.[ph.id];
  if (pinned != null) return resolveValue(pinned, inner);
  const values = ph.values ?? [];
  if (!values.length) return '';
  if (placeholderIsChoice(ph)) return resolveValue(selectValue(ph, inner), inner);
  return values.map((v) => resolveValue(v, inner)).filter((s) => s !== '').join(', ');
}

/** Resolve one value's text: literal runs stay, and every chip inside it walks as an authored one. */
function resolveValue(value: string, ctx: ResolveCtx): string {
  if (!value || !hasPlaceholders(value)) return value;
  TOKEN_RE.lastIndex = 0;
  return value.replace(TOKEN_RE, (full, id: string) => {
    const token = decodePlaceholderToken(full);
    if (!token) {
      ctx.report({ kind: 'malformed', placeholderId: id });
      return '';
    }
    return resolveChip(token, ctx, [], true);
  });
}

/** The context a chip's target resolves under. A Unique chip opens (or extends) a placement chain; every
 *  other chip inherits, so a Unique placement's whole subtree rolls per placement. */
function chipCtx(token: PlaceholderToken, ctx: ResolveCtx): ResolveCtx {
  if (token.mode !== 'unique') return ctx;
  const chain = ctx.chain ? `${ctx.chain}/${token.placementId}` : token.placementId;
  return { ...ctx, scope: 'unique', chain, chainRootId: token.id };
}

/** Enter a chip: its own path drills first, then whatever the caller still has left to walk. */
function resolveChip(token: PlaceholderToken, ctx: ResolveCtx, tail: WalkSegment[], authored: boolean): string {
  const ph = ctx.byId.get(token.id);
  if (!ph) {
    ctx.report({ kind: 'dangling', asked: token.id });
    return '';
  }
  const drill: WalkSegment[] = (token.path ?? []).map((s) => ({ ...s, authored }));
  return walkSegs(ph, [...drill, ...tail], chipCtx(token, ctx));
}

/** Walk a drill path from `ph`. With nothing left to walk, the placeholder itself resolves. */
function walkSegs(ph: Placeholder, segs: WalkSegment[], ctx: ResolveCtx): string {
  if (ctx.depth > PLACEHOLDER_DEPTH_CAP) {
    ctx.report({ kind: 'depth', placeholderId: ph.id });
    return '';
  }
  if (!segs.length) return resolvePh(ph, ctx);
  const [seg, ...rest] = segs;
  const next: ResolveCtx = { ...ctx, depth: ctx.depth + 1 };
  const intoChild = (token: PlaceholderToken, tail: WalkSegment[]) => resolveChip(token, next, tail, true);

  if (seg.kind === 'val') {
    // An authored drill is a pre-selection, so a pin overrides it; a path typed into world text names the
    // branch it says and stays pin-immune.
    const pinned = seg.authored ? ctx.pins?.[ph.id] : undefined;
    if (pinned != null) {
      if (!rest.length) return resolveValue(pinned, next);
      const raw = loneChipToken(pinned);
      const token = raw ? decodePlaceholderToken(raw) : null;
      if (!token) {
        ctx.report({ kind: 'slot-miss', placeholderId: ph.id, asked: seg.ref });
        return '';
      }
      return intoChild(token, rest);
    }
    const hit = childChips(ph, ctx).find((c) => c.target.id === seg.ref);
    if (!hit) {
      ctx.report({ kind: 'slot-miss', placeholderId: ph.id, asked: seg.ref });
      return '';
    }
    return intoChild(hit.token, rest);
  }

  // A slot takes a child of this placeholder by name; failing that, a choice routes through whichever value
  // it drew and the same slot is tried inside that variant.
  const direct = childChips(ph, ctx).find((c) => c.target.name === seg.name);
  if (direct) return intoChild(direct.token, rest);
  if (placeholderIsChoice(ph)) {
    const raw = loneChipToken(selectValue(ph, next));
    const token = raw ? decodePlaceholderToken(raw) : null;
    if (token) return intoChild(token, segs);
  }
  ctx.report({ kind: 'slot-miss', placeholderId: ph.id, asked: seg.name });
  return '';
}

/**
 * Replace every placeholder chip in `text` with its resolved value. Values are themselves chip-capable, so
 * this recurses: a chip inside a value composes into it, and a value that is exactly one chip is a
 * structural child a path can address. A token whose placeholder is missing or has no values resolves to "",
 * as do a cycle and an over-deep walk — each with a finding for the caller.
 */
export function resolvePlaceholders(text: string, opts: ResolveOptions): string {
  if (!text || !hasPlaceholders(text)) return text;
  const { placeholders, rolls, setRoll, pick = weightedPick, pins, onFinding } = opts;
  const ctx: ResolveCtx = {
    byId: new Map(placeholders.map((p) => [p.id, p])),
    rolls,
    minted: { world: {}, unique: {} },
    setRoll,
    pick,
    pins,
    report: onFinding ?? (() => {}),
    scope: 'world',
    chain: '',
    chainRootId: '',
    seen: new Set(),
    depth: 0,
  };

  TOKEN_RE.lastIndex = 0;
  return text.replace(TOKEN_RE, (full, id: string) => {
    const token = decodePlaceholderToken(full);
    if (!token) {
      ctx.report({ kind: 'malformed', placeholderId: id });
      return '';
    }
    return resolveChip(token, ctx, [], false); // typed in world text → its segments are pin-immune
  });
}
