// Pure helpers for the placeholder ownership tree. A placeholder's structure is already in its values: a
// value that is exactly one chip nests the placeholder it names underneath. Ownership adds who that nested
// placeholder *belongs* to — `Placeholder.ownerId` present means owned and private, absent means top level
// and shared by whoever holds it. Ownership is organizational; the resolver never reads it.
//
// Everything here is data in, data out: no dnd-kit, no layout, no React. The tree component is an adapter
// over the shared drag-tree scaffold, so the owned-versus-shared decision, the delete cascade and the
// release rule are testable directly.

import { arrayMove } from '@dnd-kit/sortable';
import { randomUUID } from '@/lib/uuid';
import { clamp } from '@/lib/utils';
import {
  PLACEHOLDER_PATH_SEPARATOR, SHARED_PATH_SEP, collectPlaceholderParts, decodePlaceholderToken,
  directChipTargets, encodePlaceholderToken, lonePlaceholderToken, mergePlaceholderWeights,
  newPlaceholderValue, parsePlaceholderText, placeholderChances, placeholderIsChoice, pruneSharedWeights,
} from './placeholders';
import type { Placeholder, PlaceholderValue } from '@/types';

/** Joins the placeholder ids a row's path walked through — the same separator an override key is built
 *  with, because a key is a row's path relative to its shared row. */
const ROW_SEP = SHARED_PATH_SEP;

/** The placeholder a value points at when the value is *exactly* one chip, or null for anything else. */
function chipTargetId(text: string): string | null {
  const lone = lonePlaceholderToken(text);
  return (lone && decodePlaceholderToken(lone)?.id) || null;
}

/** A fresh value holding nothing but a chip of `id` — what a drop writes to nest one placeholder under
 *  another, and what the resolver then reads as a structural child. */
export function chipValueFor(id: string): PlaceholderValue {
  return newPlaceholderValue(encodePlaceholderToken({ id, mode: 'world', placementId: randomUUID() }));
}

/** Every placeholder a holder nests, first mention first. A holder naming the same target twice nests it
 *  once — a second row for it would be the same placeholder in the same box. */
function chipTargetsOf(holder: Placeholder): string[] {
  const out: string[] = [];
  for (const value of holder.values ?? []) {
    const target = chipTargetId(value.text);
    if (target && target !== holder.id && !out.includes(target)) out.push(target);
  }
  return out;
}

/** True if `holder` holds `id` as one whole value — the shape that puts `id`'s row underneath it. */
export function holdsAsChip(holder: Placeholder, id: string): boolean {
  return chipTargetsOf(holder).includes(id);
}

/** The value a holder holds `id` through — the first mention, matching the one row {@link placeholderRows}
 *  draws for it. */
function chipValueHolding(holder: Placeholder, id: string): PlaceholderValue | undefined {
  return (holder.values ?? []).find((v) => chipTargetId(v.text) === id);
}

/**
 * Where a row's draw weights are written: the placeholder holding the outermost shared row above it, and
 * the key under that row — its chip value's id, then the id of every placeholder walked below. `null` where
 * no shared row encloses the path, whose weights are the placeholder's own.
 *
 * This is the authoring half of the rule the resolver walks (see `nextShare` in lib/placeholders): a row
 * opens a site where its holder does not own it, and every level below extends the same key. The two must
 * agree, or a bench set in the panel would apply to a different draw than the one it names.
 */
export function sharedWeightSite(
  placeholders: readonly Placeholder[], rowId: string,
): { ownerId: string; key: string } | null {
  const ids = rowId.split(ROW_SEP);
  const byId = new Map(placeholders.map((p) => [p.id, p]));
  let site: { ownerId: string; key: string } | null = null;
  for (let i = 1; i < ids.length; i++) {
    const holder = byId.get(ids[i - 1]);
    const target = byId.get(ids[i]);
    if (!holder || !target) return null;
    if (site) {
      site = { ownerId: site.ownerId, key: `${site.key}${ROW_SEP}${target.id}` };
      continue;
    }
    if (target.ownerId === holder.id) continue;
    const value = chipValueHolding(holder, target.id);
    if (!value) return null;
    site = { ownerId: holder.id, key: value.id };
  }
  return site;
}

/**
 * How likely the row at `rowId` is to be reached at all, as a percentage: the chance of every value walked
 * to get there, multiplied down the chain. A top-level row is always reached, so it reads 100. Crossing an
 * Object costs nothing — it applies every value — and crossing a Wildcard costs the chance of the value
 * holding the next step, under the weights in force for that row: the holder's own, or the shared row's
 * override laid over them, exactly as the panel reveals them.
 */
export function placeholderRowChance(placeholders: readonly Placeholder[], rowId: string): number {
  const ids = rowId.split(ROW_SEP);
  const byId = new Map(placeholders.map((p) => [p.id, p]));
  let chance = 100;
  for (let i = 1; i < ids.length; i++) {
    const holder = byId.get(ids[i - 1]);
    const target = byId.get(ids[i]);
    if (!holder || !target) break;
    if (!placeholderIsChoice(holder)) continue;
    const site = sharedWeightSite(placeholders, ids.slice(0, i).join(ROW_SEP));
    const override = site ? byId.get(site.ownerId)?.sharedWeights?.[site.key] : undefined;
    const chances = placeholderChances(holder, mergePlaceholderWeights(holder.weights, override));
    const value = chipValueHolding(holder, target.id);
    chance *= (value ? chances[value.id] ?? 0 : 0) / 100;
  }
  return chance;
}

/**
 * What a palette leaves out while a value of `id` is being edited: the placeholder itself and everything
 * that reaches it through a value, however far up. A chip of any of those, placed here, would close a loop
 * the resolver could only report. Every chip counts, composed into prose or standing alone — resolution
 * walks both.
 */
export function placeholderCycleExclusions(placeholders: readonly Placeholder[], id: string): Set<string> {
  const holders = new Map<string, string[]>();
  for (const holder of placeholders) {
    for (const target of directChipTargets((holder.values ?? []).map((v) => v.text))) {
      const list = holders.get(target);
      if (list) list.push(holder.id);
      else holders.set(target, [holder.id]);
    }
  }
  const out = new Set<string>([id]);
  const queue = [id];
  while (queue.length) {
    for (const holder of holders.get(queue.pop()!) ?? []) {
      if (!out.has(holder)) {
        out.add(holder);
        queue.push(holder);
      }
    }
  }
  return out;
}

/**
 * The box a placeholder actually sits in. An owner reference naming a placeholder that isn't here, or one
 * that no longer holds it as a value, holds nothing — so the placeholder reads as top level rather than
 * disappearing into a box nothing draws.
 */
export function holderOf(placeholders: readonly Placeholder[], placeholder: Placeholder): string | null {
  const ownerId = placeholder.ownerId ?? null;
  if (!ownerId) return null;
  const owner = placeholders.find((p) => p.id === ownerId);
  return owner && holdsAsChip(owner, placeholder.id) ? ownerId : null;
}

/** True when `id` belongs to another placeholder — what the palette and an insert menu's root leave out. */
export function isOwnedPlaceholder(placeholders: readonly Placeholder[], id: string): boolean {
  const placeholder = placeholders.find((p) => p.id === id);
  return !!placeholder && holderOf(placeholders, placeholder) !== null;
}

/** The placeholders an author places directly: everything nothing else owns. `all` is where holders are
 *  looked up when `placeholders` is one list of a larger world (an entity's own, beside the world's). */
export function topLevelPlaceholders(placeholders: readonly Placeholder[], all: readonly Placeholder[] = placeholders): Placeholder[] {
  return placeholders.filter((p) => holderOf(all, p) === null);
}

/** The owner chain above a placeholder, outermost first. Empty at the top level. */
export function placeholderOwnerPath(placeholders: readonly Placeholder[], id: string): Placeholder[] {
  const byId = new Map(placeholders.map((p) => [p.id, p]));
  const chain: Placeholder[] = [];
  const seen = new Set<string>([id]);
  let at = byId.get(id);
  while (at) {
    const ownerId = holderOf(placeholders, at);
    if (!ownerId || seen.has(ownerId)) break;
    seen.add(ownerId);
    const owner = byId.get(ownerId);
    if (!owner) break;
    chain.unshift(owner);
    at = owner;
  }
  return chain;
}

/**
 * A placeholder's name as it reads away from its owner — `Molly › Northern`, so a chip in a location
 * description says which Northern it means. Bare at the top level, and bare inside the tree, where the
 * indent already supplies the context.
 */
export function qualifiedPlaceholderName(
  placeholders: readonly Placeholder[], id: string,
  /** The placeholder the name is being read inside. Its own owned rows need no qualifying — the surface
   *  showing them already says whose they are. */
  relativeTo?: string | null,
): string | null {
  const placeholder = placeholders.find((p) => p.id === id);
  if (!placeholder) return null;
  const chain = placeholderOwnerPath(placeholders, id);
  const from = relativeTo ? chain.findIndex((p) => p.id === relativeTo) : -1;
  const shown = from === -1 ? chain : chain.slice(from + 1);
  return [...shown, placeholder].map((p) => p.name).join(PLACEHOLDER_PATH_SEPARATOR);
}

/** One drawn row. A shared placeholder appears under every holder that references it, so a row is keyed by
 *  the path that reached it rather than by the placeholder alone. */
export interface PlaceholderTreeRow {
  /** The chain of placeholder ids this row was reached through, joined — unique across the whole tree. */
  id: string;
  parentId: string | null;
  depth: number;
  placeholder: Placeholder;
  /** The placeholder holding this row, or null at the top level. */
  holderId: string | null;
  /** True when the row points at a placeholder that lives elsewhere rather than belonging to its holder. */
  shared: boolean;
}

/**
 * The whole tree as the rows a list draws: depth-first, top-level placeholders in array order and each
 * holder's nested rows in its own value order. A cycle draws its row and stops there rather than recursing,
 * so a world that references itself still opens. `all` is where a chip's target and a row's holder are
 * looked up when `placeholders` is one list of a larger world, so a scoped list still draws the shared
 * placeholder one of its values holds.
 */
export function placeholderRows(placeholders: readonly Placeholder[], all: readonly Placeholder[] = placeholders): PlaceholderTreeRow[] {
  const byId = new Map(all.map((p) => [p.id, p]));
  const out: PlaceholderTreeRow[] = [];
  const walk = (placeholder: Placeholder, parentId: string | null, holderId: string | null, depth: number, seen: ReadonlySet<string>) => {
    const id = parentId === null ? placeholder.id : `${parentId}${ROW_SEP}${placeholder.id}`;
    const owner = holderOf(all, placeholder);
    out.push({ id, parentId, depth, placeholder, holderId, shared: holderId !== null && owner !== holderId });
    if (seen.has(placeholder.id)) return;
    const next = new Set([...seen, placeholder.id]);
    for (const targetId of chipTargetsOf(placeholder)) {
      const target = byId.get(targetId);
      if (target) walk(target, id, placeholder.id, depth + 1, next);
    }
  };
  for (const placeholder of topLevelPlaceholders(placeholders, all)) walk(placeholder, null, null, 0, new Set());
  return out;
}

/**
 * The row a selection names, and where that row's draw weights are written. Selection speaks in **row ids**,
 * because one shared placeholder draws a row under every holder and each of those rows weights it
 * differently. A bare placeholder id still resolves — to that placeholder's first row — so anything naming a
 * placeholder rather than a row (a fresh duplicate, the jump to a shared row's original) still opens a panel.
 *
 * Both hosts of the placeholder panel read it through here: the World Editor's own tab, and the standalone
 * editor the library modals mount.
 */
export function placeholderSelection(
  placeholders: readonly Placeholder[], selectedId: string | null,
): { row: PlaceholderTreeRow; share?: { ownerId: string; key: string } } | null {
  if (!selectedId) return null;
  const rows = placeholderRows(placeholders);
  const row = rows.find((r) => r.id === selectedId) ?? rows.find((r) => r.placeholder.id === selectedId);
  return row ? { row, share: sharedWeightSite(placeholders, row.id) ?? undefined } : null;
}

/** Drop every row that descends from any id in `ids` (collapsed rows, the dragged subtree). */
export function removeCollapsedPlaceholderRows<N extends { id: string; parentId: string | null }>(
  rows: N[], ids: Iterable<string>,
): N[] {
  const exclude = new Set(ids);
  const out: N[] = [];
  for (const row of rows) {
    if (row.parentId !== null && exclude.has(row.parentId)) {
      exclude.add(row.id);
      continue;
    }
    out.push(row);
  }
  return out;
}

/** How many placeholders hold each one and which — the hint a top-level row carries, so an author knows
 *  before they drag whether a placeholder will be taken or shared. Built in one pass: a list draws a row per
 *  reference, and asking per row would rescan every value list once per row. */
export function placeholderUsedByMap(
  placeholders: readonly Placeholder[],
): Map<string, { count: number; names: string[] }> {
  const byId = new Map(placeholders.map((p) => [p.id, p]));
  const out = new Map<string, { count: number; names: string[] }>();
  for (const [id, holders] of collectPlaceholderParts([...placeholders])) {
    if (holders.length) out.set(id, { count: holders.length, names: holders.map((h) => byId.get(h)?.name ?? '?') });
  }
  return out;
}

/** One placeholder's holders — see {@link placeholderUsedByMap}. `null` where nothing holds it. */
export function placeholderUsedBy(
  placeholders: readonly Placeholder[], id: string,
): { count: number; names: string[] } | null {
  return placeholderUsedByMap(placeholders).get(id) ?? null;
}

/** Projected drop `{depth, parentId}` for the active row, given the pointer's horizontal drag offset. */
export function getPlaceholderDropProjection<N extends { id: string; parentId: string | null; depth: number }>(
  rows: N[], activeId: string, overId: string,
  dragOffset: number, indentationWidth: number,
): { depth: number; parentId: string | null } {
  const overIndex = rows.findIndex((i) => i.id === overId);
  const activeIndex = rows.findIndex((i) => i.id === activeId);
  if (overIndex === -1 || activeIndex === -1) return { depth: 0, parentId: null };

  const activeRow = rows[activeIndex];
  const moved = arrayMove(rows, activeIndex, overIndex);
  const prev = moved[overIndex - 1];
  const next = moved[overIndex + 1];

  const dragDepth = Math.round(dragOffset / indentationWidth);
  const projectedDepth = activeRow.depth + dragDepth;
  // Any placeholder can hold another, so a row may descend one level past the row above it.
  const maxDepth = prev ? prev.depth + 1 : 0;
  const minDepth = next ? next.depth : 0;
  const depth = clamp(projectedDepth, minDepth, maxDepth);

  const parentId = (() => {
    if (depth === 0 || !prev) return null;
    if (depth === prev.depth) return prev.parentId;
    if (depth > prev.depth) return prev.id;
    return moved.slice(0, overIndex).reverse().find((i) => i.depth === depth)?.parentId ?? null;
  })();

  return { depth, parentId };
}

/** What a drop needs to know beyond the placeholders themselves. */
export interface PlaceholderDropContext {
  /** Placeholder ids a chip places outside the placeholder list — world text, an entity description. */
  placedIds?: ReadonlySet<string>;
  /** Every placeholder the world has, when the list being dropped into is one list of several: a holder in
   *  another list still reaches a placeholder, and a shared row still names one. Defaults to the list. */
  all?: readonly Placeholder[];
}

/** Every placeholder id a chip reaches from inside a value that is *not* exactly one chip. Those chips
 *  compose into their value rather than nesting anything, so the placeholder they name stays public. */
function composedTargets(placeholders: readonly Placeholder[]): Set<string> {
  const out = new Set<string>();
  for (const holder of placeholders) {
    for (const value of holder.values ?? []) {
      if (chipTargetId(value.text)) continue;
      for (const segment of parsePlaceholderText(value.text)) {
        const id = segment.type === 'variable' ? decodePlaceholderToken(segment.token)?.id : undefined;
        if (id) out.add(id);
      }
    }
  }
  return out;
}

/**
 * Whether dropping `id` under `holderId` may take it privately, or must reference it instead. A placeholder
 * something else already reaches — another holder, a chip composed into a longer value, a chip placed in
 * world text — stays public, so the drag never silently takes it away from them.
 */
export function dropTakesOwnership(
  placeholders: readonly Placeholder[], id: string, holderId: string, { placedIds }: PlaceholderDropContext = {},
): boolean {
  if (placedIds?.has(id)) return false;
  if (composedTargets(placeholders).has(id)) return false;
  return !placeholders.some((p) => p.id !== holderId && p.id !== id && holdsAsChip(p, id));
}

/**
 * Drop the draw weights a holder set on the row it has just taken privately. An owned row opens no shared
 * site (see `nextShare` in lib/placeholders), so the override and every key extending it would apply to
 * nothing and still travel with the placeholder on export. Only this row's keys go: the holder's other
 * shared rows are no part of the gesture.
 */
function withoutSharedWeightsFor(holder: Placeholder, targetId: string): Placeholder {
  const value = chipValueHolding(holder, targetId);
  if (!value || !holder.sharedWeights) return holder;
  const kept = Object.entries(holder.sharedWeights).filter(([key]) => key.split(ROW_SEP)[0] !== value.id);
  if (kept.length === Object.keys(holder.sharedWeights).length) return holder;
  const { sharedWeights: _taken, ...rest } = holder;
  // An emptied map goes entirely — absent already means the original's own odds.
  return kept.length ? { ...rest, sharedWeights: Object.fromEntries(kept) } : rest;
}

/** Drop the owner reference, leaving the rest of the placeholder alone. */
function released(placeholder: Placeholder): Placeholder {
  if (placeholder.ownerId === undefined) return placeholder;
  const { ownerId: _ownerId, ...rest } = placeholder;
  return rest;
}

/** Send an owned placeholder back to the top level. The value holding it stays, so its row stays put —
 *  as a shared one, which is what a part decided worth reusing becomes. */
export function promotePlaceholder(placeholders: Placeholder[], id: string): Placeholder[] {
  if (!placeholders.some((p) => p.id === id && p.ownerId !== undefined)) return placeholders;
  return placeholders.map((p) => (p.id === id ? released(p) : p));
}

/**
 * Clear the owner reference wherever the owner no longer holds it as a value. Removing a chip from a value
 * list is what releases what it pointed at, so where a placeholder sits and what it belongs to can never
 * disagree. Idempotent, and returns its input untouched when nothing needs releasing.
 */
export function releasePlaceholderOwners(placeholders: Placeholder[]): Placeholder[] {
  const stale = placeholders.filter((p) => p.ownerId !== undefined && holderOf(placeholders, p) === null);
  if (!stale.length) return placeholders;
  const ids = new Set(stale.map((p) => p.id));
  return placeholders.map((p) => (ids.has(p.id) ? released(p) : p));
}

/** Everything a placeholder owns, transitively — what deleting it takes with it, in tree order. */
export function ownedDescendants(placeholders: readonly Placeholder[], id: string): Placeholder[] {
  const out: Placeholder[] = [];
  const seen = new Set<string>([id]);
  const walk = (ownerId: string) => {
    for (const p of placeholders) {
      if (seen.has(p.id) || holderOf(placeholders, p) !== ownerId) continue;
      seen.add(p.id);
      out.push(p);
      walk(p.id);
    }
  };
  walk(id);
  return out;
}

/**
 * Delete a placeholder and everything it owns. A shared row is a reference, never a possession, so the
 * originals it points at survive; the values pointing at what went are left dangling for the existing
 * red-`?` treatment to draw and the dangling rule to report.
 */
export function removePlaceholderCascade(placeholders: Placeholder[], id: string): Placeholder[] {
  const doomed = new Set([id, ...ownedDescendants(placeholders, id).map((p) => p.id)]);
  return placeholders.filter((p) => !doomed.has(p.id));
}

/**
 * Drop the value through which `holderId` holds `targetId`. This is how a *row* goes: a shared row is a
 * reference, so removing it removes the reference and leaves the original standing, and an owned row's
 * value goes with the placeholder rather than staying behind as a red `?` nobody asked for.
 */
export function removeChipValueFrom(
  placeholders: Placeholder[], holderId: string, targetId: string,
): Placeholder[] {
  return placeholders.map((p) => {
    if (p.id !== holderId) return p;
    const { sharedWeights: held, ...rest } = p;
    const values = p.values.filter((v) => chipTargetId(v.text) !== targetId);
    // The row is gone, so the weights it carried have nothing left to apply to.
    const sharedWeights = pruneSharedWeights(held, values);
    return { ...rest, values, ...(sharedWeights ? { sharedWeights } : {}) };
  });
}

/** Rewrite a holder's chip values so they read in `order`, leaving every other value exactly where it is.
 *  An order that disagrees with the list is ignored rather than guessed at. */
function orderChipValues(holder: Placeholder, order: readonly string[]): Placeholder {
  const slots: number[] = [];
  const byTarget = new Map<string, PlaceholderValue>();
  const wanted = new Set(order);
  (holder.values ?? []).forEach((value, i) => {
    const target = chipTargetId(value.text);
    if (!target || !wanted.has(target) || byTarget.has(target)) return;
    slots.push(i);
    byTarget.set(target, value);
  });
  const next = order.map((id) => byTarget.get(id)).filter((v): v is PlaceholderValue => !!v);
  if (next.length !== slots.length) return holder;
  const values = [...holder.values];
  slots.forEach((slot, i) => { values[slot] = next[i]; });
  return { ...holder, values };
}

/** Rebuild the array so top-level placeholders read in `order`, leaving owned ones beside their owners. */
function orderTopLevel(placeholders: Placeholder[], order: readonly string[]): Placeholder[] {
  const rank = new Map(order.map((id, i) => [id, i]));
  const top = placeholders.filter((p) => rank.has(p.id));
  if (top.length !== order.length) return placeholders;
  const sorted = [...top].sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0));
  let take = 0;
  return placeholders.map((p) => (rank.has(p.id) ? sorted[take++] : p));
}

/**
 * Resolve a drag into a new placeholder array.
 *
 * Dropping a row under another nests it: the holder gains a value holding nothing but that chip, and the
 * drop takes ownership unless something else already reaches the placeholder (see
 * {@link dropTakesOwnership}), in which case the new row is a shared reference instead. Dropping at the top
 * level releases ownership and reorders the array. Dropping inside the row's own holder only reorders.
 * A drop that would put a placeholder inside itself is a no-op. Never mutates its inputs.
 */
export function applyPlaceholderDrop(
  placeholders: Placeholder[], collapsedIds: Iterable<string>,
  activeId: string, overId: string, dragOffset: number, indentationWidth: number,
  context: PlaceholderDropContext = {},
): Placeholder[] {
  const full = placeholderRows(placeholders, context.all);
  const visible = removeCollapsedPlaceholderRows(full, [...collapsedIds, activeId]);
  if (!visible.some((i) => i.id === overId) || !visible.some((i) => i.id === activeId)) return placeholders;

  const activeIndex = full.findIndex((i) => i.id === activeId);
  const overIndex = full.findIndex((i) => i.id === overId);
  if (activeIndex === -1 || overIndex === -1) return placeholders;
  const active = full[activeIndex];

  const { parentId: parentRowId } = getPlaceholderDropProjection(visible, activeId, overId, dragOffset, indentationWidth);
  const parentRow = parentRowId === null ? null : full.find((i) => i.id === parentRowId) ?? null;
  if (parentRowId !== null && !parentRow) return placeholders;
  // A row's id is the chain of ids that reached it, so a chain already naming this placeholder would nest
  // it inside itself.
  if (parentRow?.id.split(ROW_SEP).includes(active.placeholder.id)) return placeholders;

  // Sibling order comes from the flat list moved the way the drop moves it, exactly as the location tree
  // reads it: whichever rows end up under a parent, in the order they end up there.
  const reParented = full.map((i) => (i.id === activeId ? { ...i, parentId: parentRowId } : i));
  const moved = arrayMove(reParented, activeIndex, overIndex);
  const siblingOrder = moved.filter((i) => i.parentId === parentRowId).map((i) => i.placeholder.id);

  return commitPlaceholderDrop(placeholders, {
    targetId: active.placeholder.id, activeHolderId: active.holderId, holderId: parentRow?.placeholder.id ?? null, siblingOrder,
  }, context);
}

/** A drop resolved to what the list has to do: which placeholder lands where, beside what. */
export interface PlaceholderDropPlan {
  /** The dragged placeholder. */
  targetId: string;
  /** The placeholder holding the dragged row before the drop, or null at the top level. */
  activeHolderId: string | null;
  /** The placeholder the row lands under, or null for the top level. */
  holderId: string | null;
  /** Every placeholder id under the new holder (or at the top level) after the drop, in order. */
  siblingOrder: readonly string[];
}

/**
 * Apply a resolved drop to one list — the second half of {@link applyPlaceholderDrop}, for a caller that
 * projected the drop over a larger tree (the world tab, whose rows span several lists). Never mutates.
 */
export function commitPlaceholderDrop(
  placeholders: Placeholder[], { targetId, activeHolderId, holderId, siblingOrder }: PlaceholderDropPlan,
  context: PlaceholderDropContext = {},
): Placeholder[] {
  const all = context.all ?? placeholders;
  let next = placeholders.map((p) => ({ ...p }));

  if (holderId === null) {
    next = next.map((p) => (p.id === targetId ? released(p) : p));
    return orderTopLevel(next, siblingOrder);
  }

  const holder = next.find((p) => p.id === holderId);
  if (!holder) return placeholders;
  if (!holdsAsChip(holder, targetId)) holder.values = [...(holder.values ?? []), chipValueFor(targetId)];
  // A row dragged inside the holder it already sits in is being reordered, not re-homed: taking ownership
  // here would turn a shared row private on a gesture that said nothing about ownership.
  if (holderId !== activeHolderId && dropTakesOwnership(all, targetId, holderId, context)) {
    next = next.map((p) => {
      if (p.id === targetId) return { ...p, ownerId: holderId };
      // The holder may already have been sharing this row and weighting it there; taking it privately
      // leaves those weights applying to nothing.
      return p.id === holderId ? withoutSharedWeightsFor(p, targetId) : p;
    });
  }
  return next.map((p) => (p.id === holderId ? orderChipValues(p, siblingOrder) : p));
}
