import { randomUUID } from "@/lib/uuid";
import type { Placeholder, PlaceholderRolls, PlaceholderValue } from '@/types';
import type { PromptSegment } from './promptTemplate';

/**
 * Placeholders — resolve author-defined named values embedded in world text as inline chips. A placeholder
 * either draws one value (a choice) or joins them all (a record); `roll` decides, and without it the value
 * count does — 1 value = a fixed Variable, 2+ = a random Wildcard. A value carries a stable id beside the
 * author's text, so weights and trait pins key by identity and a rename cannot orphan either. Values are
 * chip-capable themselves, so a value whose text is exactly one chip is a structural child a chip's drill
 * path can address by name or by id.
 * This module is the deterministic core: the in-text token codec and one pure recursive resolution pass
 * applied wherever authored text surfaces (player display + AI context). Rolling is lazy — the first
 * resolution of a choice mints and persists its value via `setRoll`; later ones reuse it.
 *
 * The name/token never reaches runtime — the resolved value is what both the player and the AI see.
 */

export type PlaceholderMode = 'world' | 'unique';

/** Chooses one of a Wildcard's values and returns its text — which is what a roll stores. `weights` is the
 *  def's map, keyed by value id (see `placeholderWeight`); tests pass a deterministic chooser that ignores
 *  it. */
export type PlaceholderPick = (values: PlaceholderValue[], weights?: Record<string, number>) => string;

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
// The same token with nothing around it: "is this string one whole chip?". Built once — both readers of it
// run per value on render paths. Ungreedy of state: no `g`, so `exec` never carries a `lastIndex`.
const WHOLE_TOKEN_RE = new RegExp(`^${TOKEN_RE.source}$`);

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
  const m = WHOLE_TOKEN_RE.exec(token);
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

/** Reads a chain of placeholder names as one name — a drill path, a breadcrumb, or a name qualified by its
 *  owner. One separator serves all of them, and it matches the trait groups' and the location canvas'. */
export const PLACEHOLDER_PATH_SEPARATOR = ' › ';

/** A freshly minted value record. The id is the value's identity from here on — nothing re-mints it. */
export function newPlaceholderValue(text: string): PlaceholderValue {
  return { id: randomUUID(), text };
}

/**
 * The value list a set of author-typed texts stands for, keeping each unchanged value's id. A text the
 * previous list already held keeps its own record; the texts left over take the ids left over, in order, so
 * an in-place rename keeps its weight and its pins; anything past that is a fresh value. This is the only
 * place a value's identity is decided, which is why the editor no longer carries weights across an edit.
 */
export function reconcilePlaceholderValues(
  prev: readonly PlaceholderValue[],
  nextTexts: readonly string[],
): PlaceholderValue[] {
  const byText = new Map(prev.map((v) => [v.text, v]));
  const kept = new Set<string>();
  const matched = nextTexts.map((text) => {
    const hit = byText.get(text);
    if (!hit || kept.has(hit.id)) return null;
    kept.add(hit.id);
    return hit;
  });
  const spare = prev.filter((v) => !kept.has(v.id));
  let take = 0;
  return matched.map((hit, i) => {
    if (hit) return hit;
    const reused = spare[take++];
    return reused ? { ...reused, text: nextTexts[i] } : newPlaceholderValue(nextTexts[i]);
  });
}

/** Joins a shared row's chip value to the placeholder ids walked below it, making one override key. Ids are
 *  UUIDs, so nothing can carry one itself. */
export const SHARED_PATH_SEP = '/';

/** The weights in force for a placeholder reached through a shared row: the original's own map with the
 *  row's override laid over it. Deny-list — a value in neither weighs 1, so a value added to the original
 *  afterwards rolls under the row too. */
export function mergePlaceholderWeights(
  own: Record<string, number> | undefined,
  override: Record<string, number> | undefined,
): Record<string, number> | undefined {
  return override ? { ...own, ...override } : own;
}

/** Drop override entries whose chip value is gone — what removing a shared row leaves behind. Only the key's
 *  first segment is checked: the rest names placeholders, whose own deletion is already reported as a
 *  dangling reference rather than silently repaired. */
export function pruneSharedWeights(
  sharedWeights: Record<string, Record<string, number>> | undefined,
  values: readonly PlaceholderValue[],
): Record<string, Record<string, number>> | undefined {
  if (!sharedWeights) return undefined;
  const live = new Set(values.map((v) => v.id));
  const out = Object.fromEntries(
    Object.entries(sharedWeights).filter(([key]) => live.has(key.split(SHARED_PATH_SEP)[0])),
  );
  return Object.keys(out).length ? out : undefined;
}

/** Drop weights naming no value in `values` — what an edit that removes a value leaves behind. Returns
 *  `undefined` for an empty result, since an absent map already means a uniform draw. */
export function prunePlaceholderWeights(
  weights: Record<string, number> | undefined,
  values: readonly PlaceholderValue[],
): Record<string, number> | undefined {
  if (!weights) return undefined;
  const live = new Set(values.map((v) => v.id));
  const out = Object.fromEntries(Object.entries(weights).filter(([id]) => live.has(id)));
  return Object.keys(out).length ? out : undefined;
}

/** The token string of a value that is *exactly* one chip — the shape that makes a value a structural child
 *  of the placeholder holding it. A chip with text around it composes into the value instead, and is not
 *  addressable. */
export function lonePlaceholderToken(value: string): string | null {
  const m = WHOLE_TOKEN_RE.exec(value ?? '');
  return m ? m[0] : null;
}

/**
 * Who holds each placeholder as a **part** — {@link lonePlaceholderToken} read across a whole set. Keyed by
 * the part's id, valued by the ids holding it in list order; a holder is named once however many of its
 * values point there, and a placeholder is never its own part. A chip *inside* a longer value composes into
 * that value rather than becoming a part, so it names nobody here.
 */
export function collectPlaceholderParts(placeholders: Placeholder[]): Map<string, string[]> {
  const parts = new Map<string, string[]>();
  for (const holder of placeholders) {
    for (const value of holder.values) {
      const lone = lonePlaceholderToken(value.text);
      const id = lone ? decodePlaceholderToken(lone)?.id : undefined;
      if (!id || id === holder.id) continue;
      const holders = parts.get(id);
      if (!holders) parts.set(id, [holder.id]);
      else if (!holders.includes(holder.id)) holders.push(holder.id);
    }
  }
  return parts;
}

/**
 * A freshly authored placeholder. Born a Wildcard, stated rather than inferred: the flat workflow is
 * unchanged, and the kind is the author's from the first keystroke instead of shifting as the second value
 * lands. Every surface that creates one goes through here, so no path can quietly leave the kind unsaid.
 * Import and absorb do not — those carry the kind the exporting world declared.
 */
export function newPlaceholder(name: string, values: string[] = []): Placeholder {
  return { id: randomUUID(), name, values: values.map(newPlaceholderValue), roll: true };
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
 * Roll every choice a fresh playthrough would reach across `texts`, keeping any `existing` rolls (so a loaded
 * save's frozen values are preserved). Pure: the caller persists the result.
 *
 * Priming *is* a resolution pass with its minted rolls collected, rather than a second walk. Values are
 * chip-capable, so a nested choice's key depends on the value its parent drew — only resolution knows which
 * keys a render will read, and a key priming misses is a value that redraws on every render. Pins are
 * deliberately absent: a pin masks a roll at resolve time, so the roll under it still has to be drawn.
 */
export function primeRolls(
  placeholders: Placeholder[],
  texts: string[],
  existing: PlaceholderRolls = {},
  pick: PlaceholderPick = weightedPick,
): PlaceholderRolls {
  const ctx = createResolveCtx({ placeholders, rolls: existing, pick });
  for (const text of texts) if (text) resolveText(text, ctx);
  return {
    world: { ...(existing.world ?? {}), ...ctx.minted.world },
    unique: { ...(existing.unique ?? {}), ...ctx.minted.unique },
  };
}

// --- portability (export bundle / import absorb) ---------------------------------------------------------

/** Every placeholder id one text's chips name: each chip's root, plus the target of any explicit-pick segment
 *  in its drill path. A malformed token names nothing. */
function chipIdsIn(text: string): string[] {
  const ids: string[] = [];
  if (!text || !hasPlaceholders(text)) return ids;
  TOKEN_RE.lastIndex = 0;
  for (const m of text.matchAll(TOKEN_RE)) {
    const token = decodePlaceholderToken(m[0]);
    if (!token) continue;
    ids.push(token.id);
    for (const seg of token.path ?? []) if (seg.kind === 'val') ids.push(seg.ref);
  }
  return ids;
}

/** Every placeholder the chips in `texts` name directly — each chip's root plus any explicit-pick target.
 *  Deliberately not transitive: what one of those placeholders reaches through its own values is its
 *  structure, not a placement of it. */
export function directChipTargets(texts: readonly string[]): Set<string> {
  const out = new Set<string>();
  for (const text of texts) for (const id of chipIdsIn(text)) out.add(id);
  return out;
}

/**
 * The subset of `available` defs a standalone export has to bundle for `texts` to resolve elsewhere. Values
 * are chip-capable, so this is the *transitive* closure: a character chip is useless without the defs its own
 * values reach. Order follows `available`; each def appears at most once, and a reference cycle terminates.
 */
export function collectUsedPlaceholders(texts: string[], available: Placeholder[]): Placeholder[] {
  const byId = new Map(available.map((p) => [p.id, p]));
  const used = new Set<string>();
  const queue = texts.flatMap((text) => chipIdsIn(text));
  while (queue.length) {
    const id = queue.pop()!;
    if (used.has(id)) continue;
    used.add(id);
    for (const value of byId.get(id)?.values ?? []) queue.push(...chipIdsIn(value.text));
  }
  return available.filter((p) => used.has(p.id));
}

/**
 * Re-mint every chip's placement id — for text copied by a duplicate action or a paste, where the copy would
 * otherwise share the source's Unique rolls forever. `minted` maps old id → new id, so one map passed across
 * a whole copied record keeps its internally-shared placements shared with each other while cutting them
 * loose from the source. Placeholder id, mode, and drill path are untouched.
 */
export function remintPlaceholderPlacements(text: string, minted: Map<string, string> = new Map()): string {
  if (!text || !hasPlaceholders(text)) return text;
  TOKEN_RE.lastIndex = 0;
  return text.replace(TOKEN_RE, (_full, id: string, mode: string, placementId: string, path?: string) => {
    let fresh = minted.get(placementId);
    if (!fresh) {
      fresh = randomUUID();
      minted.set(placementId, fresh);
    }
    return `{{ph:${id}:${mode}:${fresh}${path ? `:${path}` : ''}}}`;
  });
}

/** {@link remintPlaceholderPlacements} over every string in a plain record (a `structuredClone`d world item),
 *  arrays and nested objects included. Pure. Not for placeholder defs — a def's values carry ids of their
 *  own, which a copy has to re-mint in step with its weight map. */
export function remintPlaceholdersDeep<T>(value: T, minted: Map<string, string> = new Map()): T {
  // The three casts narrow back to T after a structure-preserving map; the shape never changes.
  if (typeof value === 'string') return remintPlaceholderPlacements(value, minted) as unknown as T;
  if (Array.isArray(value)) return value.map((v) => remintPlaceholdersDeep(v, minted)) as unknown as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, remintPlaceholdersDeep(v, minted)]),
    ) as unknown as T;
  }
  return value;
}

/** A duplicate-ready copy of a placeholder def: every value's chip placements re-minted, its values given
 *  ids of their own (a copy's values are new values), and `weights` plus the shared-row overrides re-keyed
 *  in step so no weight silently detaches from the value it was set on. */
export function remintPlaceholderDef(ph: Placeholder): Placeholder {
  const minted = new Map<string, string>();
  const idMap = new Map<string, string>();
  const values = (ph.values ?? []).map((v) => {
    const fresh = newPlaceholderValue(remintPlaceholderPlacements(v.text, minted));
    idMap.set(v.id, fresh.id);
    return fresh;
  });
  const weights = ph.weights
    ? Object.fromEntries(
      Object.entries(ph.weights).flatMap(([id, w]) => (idMap.has(id) ? [[idMap.get(id)!, w] as const] : [])),
    )
    : undefined;
  // Only the key's first segment names one of these values; the rest names placeholders the copy still
  // points at, so those ride along as written.
  const sharedWeights = ph.sharedWeights
    ? Object.fromEntries(Object.entries(ph.sharedWeights).flatMap(([key, map]) => {
      const [root, ...under] = key.split(SHARED_PATH_SEP);
      const fresh = idMap.get(root);
      return fresh ? [[[fresh, ...under].join(SHARED_PATH_SEP), map] as const] : [];
    }))
    : undefined;
  const { weights: _old, sharedWeights: _oldShared, ...rest } = ph;
  return {
    ...rest,
    values,
    ...(weights && Object.keys(weights).length ? { weights } : {}),
    ...(sharedWeights && Object.keys(sharedWeights).length ? { sharedWeights } : {}),
  };
}

/** Rewrite chip tokens' placeholder ids via `idMap` — the chip's root, and the target of every explicit-pick
 *  segment in its drill path, which names its placeholder the same way the root does. Mode and placement id
 *  are untouched, and a token nothing in the map applies to comes back byte-identical. */
export function remapPlaceholderIds(text: string, idMap: Record<string, string>): string {
  if (!text || !hasPlaceholders(text)) return text;
  TOKEN_RE.lastIndex = 0;
  return text.replace(TOKEN_RE, (full, id: string, mode: string, placementId: string, path?: string) => {
    const segs = path ? decodePlaceholderPath(path) : [];
    if (!segs) return full; // an unreadable path is left exactly as the author's JSON has it
    const moved = segs.map((s) => (s.kind === 'val' && idMap[s.ref] ? { kind: 'val' as const, ref: idMap[s.ref] } : s));
    if (!idMap[id] && moved.every((s, i) => s === segs[i])) return full;
    const tail = moved.length ? `:${encodePlaceholderPath(moved)}` : '';
    return `{{ph:${idMap[id] ?? id}:${mode}:${placementId}${tail}}}`;
  });
}

/**
 * Carried defs ordered so each one comes after the defs its own values reference. A def whose values carry
 * chips can only be compared against the world once those chips point at the world's ids, and that needs its
 * children resolved first. A reference cycle keeps its authored order rather than looping.
 */
function inReferenceOrder(carried: Placeholder[]): Placeholder[] {
  const byId = new Map(carried.map((p) => [p.id, p]));
  const out: Placeholder[] = [];
  const done = new Set<string>();
  const onStack = new Set<string>();
  const visit = (p: Placeholder) => {
    if (done.has(p.id) || onStack.has(p.id)) return;
    onStack.add(p.id);
    for (const value of p.values ?? []) {
      for (const id of chipIdsIn(value.text)) {
        const child = byId.get(id);
        if (child) visit(child);
      }
    }
    onStack.delete(p.id);
    done.add(p.id);
    out.push(p);
  };
  for (const p of carried) visit(p);
  return out;
}

/**
 * Merge an imported item's carried placeholder defs into a world's list. A **perfect match** — same name,
 * same values, same weights, same roll flag — reuses the existing def's id; anything else becomes a fresh-id
 * def (collision-proof). Pure: returns the defs to add and an id map (every carried id → its resolved world
 * id) for the caller to remap tokens with.
 *
 * A carried def's values are remapped before they are compared, so a structured def matches the world's copy
 * on what its chips *mean* rather than on the ids the exporting world happened to give them. Value ids ride
 * along untouched: they are scoped to their own placeholder, so no host id can collide with one.
 */
export function absorbPlaceholders(
  carried: Placeholder[],
  worldPlaceholders: Placeholder[],
): { toAdd: Placeholder[]; idMap: Record<string, string> } {
  const sameValues = (a: PlaceholderValue[], b: PlaceholderValue[]) =>
    a.length === b.length && a.every((v, i) => v.text === b[i].text);
  // Two defs sharing a name and values but weighted differently are different defs — matching on values
  // alone would silently re-point the import's chips at the host world's distribution. Their value ids
  // differ, so the comparison pairs by position, which `sameValues` has already lined up.
  const sameWeights = (a: Placeholder, b: Placeholder) =>
    (a.values ?? []).every((v, i) => {
      const other = (b.values ?? [])[i];
      return !!other && placeholderWeight(a, v) === placeholderWeight(b, other);
    });
  // Shared-row overrides make two otherwise identical defs behave differently, so they part the same way
  // weights do. Their keys are already remapped when this runs, so the comparison is like for like.
  const sameMap = (x: Record<string, number> = {}, y: Record<string, number> = {}) =>
    [...new Set([...Object.keys(x), ...Object.keys(y)])].every((k) => (x[k] ?? 1) === (y[k] ?? 1));
  const sameShared = (a: Placeholder, b: Placeholder) => {
    const [x, y] = [a.sharedWeights ?? {}, b.sharedWeights ?? {}];
    return [...new Set([...Object.keys(x), ...Object.keys(y)])].every((k) => sameMap(x[k], y[k]));
  };
  const toAdd: Placeholder[] = [];
  const idMap: Record<string, string> = {};
  // Match against the world's list plus anything added so far this pass (so two carried copies of the same def
  // collapse to one).
  const pool = [...worldPlaceholders];
  for (const c of inReferenceOrder(carried)) {
    const values = (c.values ?? []).map((v) => ({ ...v, text: remapPlaceholderIds(v.text, idMap) }));
    // Weights key by value id, which the remap leaves alone, so the map carries across as written. An
    // override key opens on a value id too, but every segment below it names a placeholder, which the
    // children-first order has already resolved.
    const weights = c.weights;
    const sharedWeights = c.sharedWeights && Object.fromEntries(
      Object.entries(c.sharedWeights).map(([key, map]) => {
        const [root, ...under] = key.split(SHARED_PATH_SEP);
        return [[root, ...under.map((id) => idMap[id] ?? id)].join(SHARED_PATH_SEP), map] as const;
      }),
    );
    const resolved: Placeholder = {
      ...c, values, ...(weights ? { weights } : {}), ...(sharedWeights ? { sharedWeights } : {}),
    };
    // Compared by what the flag does, not by whether it is written: a 2-value def with `roll: true` is the
    // same def as one that infers the same choice from its value count, and must not duplicate it.
    const match = pool.find((p) => p.name === c.name
      && sameValues(p.values ?? [], values)
      && placeholderIsChoice(p) === placeholderIsChoice(resolved)
      && sameWeights(resolved, p)
      && sameShared(resolved, p));
    if (match) {
      idMap[c.id] = match.id;
    } else {
      const fresh: Placeholder = {
        id: randomUUID(),
        name: c.name,
        values,
        ...(weights ? { weights } : {}),
        ...(sharedWeights ? { sharedWeights } : {}),
        ...(c.roll !== undefined ? { roll: c.roll } : {}),
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
  // One context across every token, so a structured chip resolves the way play resolves it and the sharing
  // rules still hold: World chips of one placeholder agree, Unique placements stay apart. The rolls are
  // minted into the context and thrown away with it — a preview never writes a save.
  const ctx = createResolveCtx({ placeholders, rolls: {}, pick });
  TOKEN_RE.lastIndex = 0;
  for (const m of text.matchAll(TOKEN_RE)) {
    if (m[0] in out) continue;
    out[m[0]] = resolveText(m[0], ctx);
  }
  return out;
}

/**
 * Display-only chip rendering for surfaces with no world or rolls behind them — a library card, a community
 * listing blurb. Mirrors the shape of {@link resolvePlaceholders} without ever drawing: a choice shows its
 * options as `{a|b}` (first 3, then `…`), a record joins its values, and a chip whose def is missing or empty
 * shows nothing. The same text always reads the same.
 *
 * Values are chip-capable, so this recurses — capped at {@link DESCRIBE_DEPTH_CAP} levels, because a card's
 * blurb has to stay a blurb. Past the cap, and on a reference cycle, a chip reads as nothing.
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
  return describeText(text, { byId: new Map(placeholders.map((p) => [p.id, p])), pins, depth: 0, seen: new Set() });
}

/** How many levels of nested chips a describe pass walks. Deep enough to show a character's parts, shallow
 *  enough that one chip cannot turn a card blurb into the whole world. */
const DESCRIBE_DEPTH_CAP = 2;

/** One describe pass. No rolls and no scope: nothing here draws, so a chip's mode and placement id do not
 *  change what it reads. */
interface DescribeCtx {
  byId: Map<string, Placeholder>;
  pins?: Record<string, string>;
  /** The shared row this pass is inside — what decides which values read as benched here. */
  share?: ShareCtx;
  depth: number;
  seen: ReadonlySet<string>;
}

/** Describe every chip in a text, leaving its literal runs alone. A chip that is the whole text nests a row
 *  and carries the crossing; one with prose around it does not. */
function describeText(text: string, ctx: DescribeCtx, crossing?: Crossing): string {
  if (!text || !hasPlaceholders(text)) return text;
  const lone = crossing ? lonePlaceholderToken(text) : null;
  TOKEN_RE.lastIndex = 0;
  return text.replace(TOKEN_RE, (full) => {
    const token = decodePlaceholderToken(full);
    return token ? describeChip(token, ctx, [], full === lone ? crossing : undefined) : '';
  });
}

/** A set of candidate descriptions as one line: first three joined by `|` and braced, `…` for the rest. One
 *  surviving candidate reads bare, since there is no choice left to show. */
function describeChoice(candidates: string[]): string {
  const shown = candidates.map(placeholderValueLine).filter((s) => s !== '');
  if (shown.length <= 1) return shown[0] ?? '';
  const head = shown.slice(0, 3).join('|');
  return `{${shown.length > 3 ? `${head}|…` : head}}`;
}

/** Enter a chip: its own drill path first, then whatever the caller still has left to walk. */
function describeChip(
  token: PlaceholderToken, ctx: DescribeCtx, tail: PlaceholderSegment[], crossing?: Crossing,
): string {
  const ph = ctx.byId.get(token.id);
  if (!ph) return '';
  const share = nextShare(ctx.share, crossing, ph);
  return describePh(ph, [...(token.path ?? []), ...tail], share === ctx.share ? ctx : { ...ctx, share });
}

/** Describe a placeholder, optionally through a drill path. With no roll to route through, a slot that no
 *  child answers directly reads as the choice of what each variant offers. */
function describePh(ph: Placeholder, segs: PlaceholderSegment[], ctx: DescribeCtx): string {
  if (ctx.depth > DESCRIBE_DEPTH_CAP || ctx.seen.has(ph.id)) return '';
  // Same order resolution uses: a pin applies before the values are looked at, so a pin on an emptied
  // placeholder is still the author's word.
  const pinned = ctx.pins?.[ph.id];
  // A pin is text the author typed, not a value of this placeholder, so it stands in under a name rather
  // than an id. Nothing on this path reads the id — describing never weighs, and `childChips` reads text.
  const values = pinned != null ? [{ id: 'pin', text: pinned }] : ph.values ?? [];
  if (!values.length) return '';
  const inner: DescribeCtx = { ...ctx, depth: ctx.depth + 1, seen: new Set(ctx.seen).add(ph.id) };
  /** Only a lone-chip value nests a row, and only the pass over the placeholder's own values crosses one. */
  const crossing = (value: PlaceholderValue): Crossing =>
    (pinned == null ? { holder: ph, value } : undefined);

  if (!segs.length) {
    // A benched value can never be drawn, so it is left out of what this advertises — under the active
    // shared row's weights, which are the ones a draw here would read.
    const shown = pinned == null ? drawablePlaceholderValues(ph, weightsUnder(ph, ctx.share)) : values;
    // Every surface reading this takes one line, so a paragraph value is clipped on both branches.
    const described = shown.map((v) => placeholderValueLine(describeText(v.text, inner, crossing(v))));
    // A pin names one value, so the placeholder reads as that value whatever its roll flag says.
    return pinned == null && placeholderIsChoice(ph)
      ? describeChoice(described)
      : described.filter((s) => s !== '').join(', ');
  }

  const [seg, ...rest] = segs;
  const children = childChips(values, ctx.byId);
  if (seg.kind === 'val') {
    const hit = children.find((c) => c.target.id === seg.ref);
    return hit ? describeChip(hit.token, inner, rest, crossing(hit.value)) : '';
  }
  const direct = children.find((c) => c.target.name === seg.name);
  if (direct) return describeChip(direct.token, inner, rest, crossing(direct.value));
  return describeChoice(children.map((c) => describeChip(c.token, inner, segs, crossing(c.value))));
}

/** One value as a single line — a paragraph-length value becomes its first line plus `…`. Every one-line
 *  surface reads a value through this; resolution never does, so what the AI and the player get is verbatim. */
export function placeholderValueLine(value: string): string {
  const nl = value.indexOf('\n');
  if (nl === -1) return value;
  const head = value.slice(0, nl).trimEnd();
  return head ? `${head} …` : '…';
}

/**
 * A Wildcard's options as one short line — first three, then `…`. The shared form behind the braces in
 * {@link describePlaceholders}, the *tooltip* of an in-editor chip, and the *label* of a read-only pill.
 *
 * Values are chip-capable, so pass `placeholders` wherever the list is at hand: a value holding a chip then
 * reads as what that chip will become rather than as the token behind it, and a value that would read as
 * nothing is left out instead of leaving a bare `|` in the line. So is a value benched to zero, which no
 * draw can land on.
 */
export function placeholderValueSummary(ph: Placeholder, placeholders?: Placeholder[]): string {
  const values = drawablePlaceholderValues(ph)
    .map(({ text }) => placeholderValueLine(placeholders ? describePlaceholders(text, placeholders) : text))
    .filter((v) => v !== '');
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
  /** Which kind of segment asked, on a `slot-miss`. A `slot` routes by name and a `val` picks by id, so the
   *  two miss for different reasons and the Bench has different things to say about them. */
  segment?: PlaceholderSegment['kind'];
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

/**
 * A value's relative draw weight — 1 unless the author set one. Negatives are treated as 0 (benched).
 *
 * `weights` is the map in force, which is the placeholder's own everywhere except under a shared row: there
 * it is the merged map (see {@link mergePlaceholderWeights}), so one helper serves both.
 */
export function placeholderWeight(
  ph: Placeholder, value: PlaceholderValue, weights: Record<string, number> | undefined = ph.weights,
): number {
  const w = weights?.[value.id];
  return typeof w === 'number' && Number.isFinite(w) ? Math.max(0, w) : 1;
}

/** True if any value carries a non-default weight — what gates the editor's percentage reveal. */
export function isWeighted(ph: Placeholder, weights?: Record<string, number>): boolean {
  const map = weights ?? ph.weights;
  return (ph.values ?? []).some((v) => placeholderWeight(ph, v, map) !== 1);
}

/**
 * Each value's chance of being drawn, as a percentage keyed by value id. Mirrors {@link weightedPick}
 * exactly, including its all-zero fallback to a uniform draw, so the editor's reveal never disagrees with
 * the roll.
 */
export function placeholderChances(ph: Placeholder, weights?: Record<string, number>): Record<string, number> {
  const map = weights ?? ph.weights;
  const out: Record<string, number> = {};
  const values = ph.values ?? [];
  const total = values.reduce((sum, v) => sum + placeholderWeight(ph, v, map), 0);
  for (const v of values) {
    out[v.id] = total > 0 ? (placeholderWeight(ph, v, map) / total) * 100 : 100 / values.length;
  }
  return out;
}

/**
 * The values a display surface may show: everything a draw could actually land on. A benched value is left
 * out, since a preview must never advertise what can never happen; every value benched is the uniform
 * fallback {@link weightedPick} takes, so the list comes back whole rather than empty. An Object joins all
 * of its values and never draws, so nothing is held back from one.
 */
export function drawablePlaceholderValues(
  ph: Placeholder, weights?: Record<string, number>,
): PlaceholderValue[] {
  const values = ph.values ?? [];
  if (!placeholderIsChoice(ph)) return values;
  const live = values.filter((v) => placeholderWeight(ph, v, weights ?? ph.weights) > 0);
  return live.length ? live : values;
}

/** Draw a value honoring per-value weights. Weights that sum to 0 (every value benched) fall back to a
 *  uniform draw rather than resolving to nothing — an author zeroing everything still gets a value. */
const weightedPick = (values: PlaceholderValue[], weights?: Record<string, number>): string => {
  const uniform = () => values[Math.floor(Math.random() * values.length)].text;
  if (!weights) return uniform();
  const w = values.map((v) => {
    const n = weights[v.id];
    return typeof n === 'number' && Number.isFinite(n) ? Math.max(0, n) : 1;
  });
  const total = w.reduce((a, b) => a + b, 0);
  if (total <= 0) return uniform();
  let r = Math.random() * total;
  for (let i = 0; i < values.length; i++) {
    r -= w[i];
    if (r < 0) return values[i].text;
  }
  return values[values.length - 1].text;
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
  /** The shared row this walk is inside, whose override the draw reads. Absent outside one. */
  share?: ShareCtx;
  seen: ReadonlySet<string>;
  depth: number;
}

/** Every structural child in a value list: its lone-chip values, paired with the placeholder each one roots
 *  at. Shared by the resolve and describe walks, which disagree about rolls but not about structure. The
 *  value comes back too — it is what a shared row's override is keyed by. */
function childChips(
  values: PlaceholderValue[],
  byId: Map<string, Placeholder>,
): Array<{ value: PlaceholderValue; token: PlaceholderToken; target: Placeholder }> {
  const out: Array<{ value: PlaceholderValue; token: PlaceholderToken; target: Placeholder }> = [];
  for (const value of values) {
    const raw = lonePlaceholderToken(value.text);
    const token = raw ? decodePlaceholderToken(raw) : null;
    const target = token ? byId.get(token.id) : undefined;
    if (token && target) out.push({ value, token, target });
  }
  return out;
}

/**
 * How a walk entered a chip: the value it sat in and the placeholder holding that value, when the value was
 * exactly that chip. Absent for a chip typed into world text or composed into a longer value — neither
 * nests a row, so neither can carry an override.
 */
type Crossing = { holder: Placeholder; value: PlaceholderValue } | undefined;

/** The shared row a walk is inside: the placeholder whose override map applies, and the key under it. */
interface ShareCtx {
  owner: Placeholder;
  key: string;
}

/** The value a holder holds `targetId` through, as the tree draws it: the first of its values that is
 *  exactly a chip of it. A holder naming one target twice still draws one row, so every crossing into that
 *  target has to key by the same value the row was authored against. */
function rowValueId(holder: Placeholder, targetId: string): string | undefined {
  for (const value of holder.values ?? []) {
    const raw = lonePlaceholderToken(value.text);
    if (raw && decodePlaceholderToken(raw)?.id === targetId) return value.id;
  }
  return undefined;
}

/**
 * The shared row in force after crossing into `target`. A row opens where a holder reaches a placeholder it
 * does not own — that is exactly the row the list draws with the link icon — and every level below extends
 * its key, the same shape as the placement chain a Unique roll is keyed by. Crossing anything that nests no
 * row leaves the shared row behind, since no key below it could be authored.
 */
function nextShare(share: ShareCtx | undefined, crossing: Crossing, target: Placeholder): ShareCtx | undefined {
  if (!crossing) return undefined;
  if (share) return { owner: share.owner, key: `${share.key}${SHARED_PATH_SEP}${target.id}` };
  if (target.ownerId === crossing.holder.id) return undefined;
  return { owner: crossing.holder, key: rowValueId(crossing.holder, target.id) ?? crossing.value.id };
}

/** The weights a placeholder draws by right now: its own, with the active shared row's override over them. */
function weightsUnder(ph: Placeholder, share: ShareCtx | undefined): Record<string, number> | undefined {
  return mergePlaceholderWeights(ph.weights, share?.owner.sharedWeights?.[share.key]);
}

/**
 * A placeholder's structural children — the same lone-chip reading the resolver's own walk uses, so a
 * diagnostic that talks about slots agrees with what routing actually does. A value with text around its
 * chip composes into that value instead and is no child; a chip whose target is gone is no child either.
 */
export function placeholderChildren(
  ph: Placeholder,
  placeholders: readonly Placeholder[],
): Array<{ token: PlaceholderToken; target: Placeholder }> {
  return childChips(ph.values ?? [], new Map(placeholders.map((p) => [p.id, p])));
}

/**
 * How far a chip's drill path can be walked, and where it got to. A `val` step is followed the way
 * {@link walkSegs} follows it; a `slot` names no one target until a roll picks it, so the walk stops in
 * front of one — `depth` says how many segments it got through, which is the deepest ancestor a picker can
 * still show. `null` only when the root itself is gone.
 */
function walkDeepest(
  token: PlaceholderToken,
  byId: Map<string, Placeholder>,
): { at: Placeholder; depth: number } | null {
  const root = byId.get(token.id);
  if (!root) return null;
  let at: Placeholder = root;
  const path = token.path ?? [];
  for (const [i, seg] of path.entries()) {
    if (seg.kind !== 'val') return { at, depth: i };
    const next = childChips(at.values ?? [], byId).find((c) => c.target.id === seg.ref)?.target;
    if (!next) return { at, depth: i };
    at = next;
  }
  return { at, depth: path.length };
}

/** The placeholder a chip's whole path lands on, or `undefined` where any segment names no one target. */
function walkToPath(token: PlaceholderToken, byId: Map<string, Placeholder>): Placeholder | undefined {
  const walk = walkDeepest(token, byId);
  return walk && walk.depth === (token.path?.length ?? 0) ? walk.at : undefined;
}

/** What a placeholder is, in the words every surface uses for it. One value is a Variable whichever kind it
 *  declares — the two coincide there — and past that `roll` decides. */
export type PlaceholderKindNoun = 'Variable' | 'Wildcard' | 'Object';

/** What to call a placeholder, for any surface that names its kind. One word per thing, so a picker heading
 *  and a Test Bench finding never disagree about what a placeholder is. */
export function placeholderKindNoun(ph: Placeholder): PlaceholderKindNoun {
  if ((ph.values?.length ?? 0) === 1) return 'Variable';
  return (ph.roll ?? true) ? 'Wildcard' : 'Object';
}

/** One level as a picker shows it. Its parts come from {@link placeholderPathChildren}; this adds what only
 *  a picker says about them. */
export interface PlaceholderLevel {
  kind: PlaceholderKindNoun;
  /** How many of the chip's path segments the walk got through — the level is that prefix, not the whole
   *  path, wherever a segment named no one target. */
  depth: number;
  /** Names reachable through whichever value rolls. `partial` marks one some value cannot supply. */
  slots: Array<{ name: string; partial: boolean }>;
  /** Values that are not exactly one chip, so no path addresses them. */
  plain: number;
}

/**
 * Where a chip's path lands, read as a picker shows it. Slots come from the variants' own parts, because
 * that is the route {@link walkSegs} takes when a name is no direct part: whichever value rolls is entered
 * and the name tried inside it. A name missing from one value is marked, since the roll that lands there
 * resolves to nothing. Only a placeholder that rolls has slots — an Object applies every value, so a name
 * under it is a part, not a route.
 *
 * A path the walk cannot finish reads as the deepest ancestor it reached, which is the level that offered
 * the segment it stopped on: re-picking a slot chip belongs where that slot was chosen.
 */
export function placeholderPathLevel(
  token: PlaceholderToken,
  placeholders: readonly Placeholder[],
): PlaceholderLevel | null {
  const byId = new Map(placeholders.map((p) => [p.id, p]));
  const walk = walkDeepest(token, byId);
  if (!walk) return null;
  const { at, depth } = walk;
  const values = at.values ?? [];
  const slots = new Map<string, number>();
  if (placeholderIsChoice(at)) {
    for (const { target } of childChips(values, byId)) {
      const seen = new Set<string>();
      for (const { target: part } of childChips(target.values ?? [], byId)) {
        if (seen.has(part.name)) continue;
        seen.add(part.name);
        slots.set(part.name, (slots.get(part.name) ?? 0) + 1);
      }
    }
  }
  return {
    kind: placeholderKindNoun(at),
    depth,
    // Counted against every value, prose ones included: a value with no part of that name is a roll the
    // slot misses on, whether it is another variant or a plain string.
    slots: [...slots].map(([name, held]) => ({ name, partial: held < values.length })),
    plain: values.filter((v) => !lonePlaceholderToken(v.text)).length,
  };
}

/**
 * The parts one level under a chip, following the drill path it already carries — what a picker offers as
 * the next step down. Matching a `val` by the target it names is the same step {@link walkSegs} takes, so a
 * path built by clicking through this addresses what the resolver would walk to. A `slot` names no one
 * target until a roll picks it, so a path holding one has nothing further to offer; nor does a part named
 * twice appear twice.
 */
export function placeholderPathChildren(
  token: PlaceholderToken,
  placeholders: readonly Placeholder[],
): Placeholder[] {
  const byId = new Map(placeholders.map((p) => [p.id, p]));
  const at = walkToPath(token, byId);
  if (!at) return [];
  const seen = new Set<string>();
  return childChips(at.values ?? [], byId)
    .map((c) => c.target)
    .filter((target) => !seen.has(target.id) && seen.add(target.id));
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
  const rolled = ctx.pick(ph.values, weightsUnder(ph, ctx.share));
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
  // A pin is text the author typed, not one of these values, so it crosses into nothing this row could
  // weight.
  if (pinned != null) return resolveValue(pinned, inner);
  const values = ph.values ?? [];
  if (!values.length) return '';
  if (placeholderIsChoice(ph)) {
    const drawn = selectValue(ph, inner);
    return resolveValue(drawn, inner, valueCrossing(ph, drawn));
  }
  return values.map((v) => resolveValue(v.text, inner, { holder: ph, value: v }))
    .filter((s) => s !== '').join(', ');
}

/** Where a drawn text sits in its placeholder's own list — values are unique by text, so one lookup names
 *  the value the roll landed on. Nothing for a pin, which is not a value of this placeholder. */
function valueCrossing(ph: Placeholder, text: string): Crossing {
  const value = (ph.values ?? []).find((v) => v.text === text);
  return value ? { holder: ph, value } : undefined;
}

/** Resolve one value's text: literal runs stay, and every chip inside it walks as an authored one. A chip
 *  that is the whole text nests a row, so it carries the crossing; one with prose around it does not. */
function resolveValue(value: string, ctx: ResolveCtx, crossing?: Crossing): string {
  if (!value || !hasPlaceholders(value)) return value;
  const lone = crossing ? lonePlaceholderToken(value) : null;
  TOKEN_RE.lastIndex = 0;
  return value.replace(TOKEN_RE, (full, id: string) => {
    const token = decodePlaceholderToken(full);
    if (!token) {
      ctx.report({ kind: 'malformed', placeholderId: id });
      return '';
    }
    return resolveChip(token, ctx, [], true, full === lone ? crossing : undefined);
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
function resolveChip(
  token: PlaceholderToken, ctx: ResolveCtx, tail: WalkSegment[], authored: boolean, crossing?: Crossing,
): string {
  const ph = ctx.byId.get(token.id);
  if (!ph) {
    ctx.report({ kind: 'dangling', asked: token.id });
    return '';
  }
  const drill: WalkSegment[] = (token.path ?? []).map((s) => ({ ...s, authored }));
  const inner = chipCtx(token, ctx);
  const share = nextShare(ctx.share, crossing, ph);
  return walkSegs(ph, [...drill, ...tail], share === inner.share ? inner : { ...inner, share });
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
  const intoChild = (token: PlaceholderToken, tail: WalkSegment[], crossing?: Crossing) =>
    resolveChip(token, next, tail, true, crossing);

  if (seg.kind === 'val') {
    // An authored drill is a pre-selection, so a pin overrides it; a path typed into world text names the
    // branch it says and stays pin-immune.
    const pinned = seg.authored ? ctx.pins?.[ph.id] : undefined;
    if (pinned != null) {
      if (!rest.length) return resolveValue(pinned, next);
      const raw = lonePlaceholderToken(pinned);
      const token = raw ? decodePlaceholderToken(raw) : null;
      if (!token) {
        ctx.report({ kind: 'slot-miss', placeholderId: ph.id, asked: seg.ref, segment: 'val' });
        return '';
      }
      return intoChild(token, rest);
    }
    const hit = childChips(ph.values ?? [], ctx.byId).find((c) => c.target.id === seg.ref);
    if (!hit) {
      ctx.report({ kind: 'slot-miss', placeholderId: ph.id, asked: seg.ref, segment: 'val' });
      return '';
    }
    return intoChild(hit.token, rest, { holder: ph, value: hit.value });
  }

  // A slot takes a child of this placeholder by name; failing that, a choice routes through whichever value
  // it drew and the same slot is tried inside that variant.
  const direct = childChips(ph.values ?? [], ctx.byId).find((c) => c.target.name === seg.name);
  if (direct) return intoChild(direct.token, rest, { holder: ph, value: direct.value });
  if (placeholderIsChoice(ph)) {
    const drawn = selectValue(ph, next);
    const raw = lonePlaceholderToken(drawn);
    const token = raw ? decodePlaceholderToken(raw) : null;
    if (token) return intoChild(token, segs, valueCrossing(ph, drawn));
  }
  ctx.report({ kind: 'slot-miss', placeholderId: ph.id, asked: seg.name, segment: 'slot' });
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
  return resolveText(text, createResolveCtx(opts));
}

/** A fresh root context. Held across several texts by the priming and preview passes, so their `minted` rolls
 *  accumulate and every text after the first reads what the ones before it drew. */
function createResolveCtx(opts: ResolveOptions): ResolveCtx {
  const { placeholders, rolls, setRoll, pick = weightedPick, pins, onFinding } = opts;
  return {
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
}

/** One text, resolved from a root context. Chips here are typed into world text, so their path segments are
 *  pin-immune. */
function resolveText(text: string, ctx: ResolveCtx): string {
  if (!text || !hasPlaceholders(text)) return text;
  TOKEN_RE.lastIndex = 0;
  return text.replace(TOKEN_RE, (full, id: string) => {
    const token = decodePlaceholderToken(full);
    if (!token) {
      ctx.report({ kind: 'malformed', placeholderId: id });
      return '';
    }
    return resolveChip(token, ctx, [], false);
  });
}
