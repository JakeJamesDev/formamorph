/**
 * Item trait grants: which owner traits the Item Copies hold on (Q52). A grant reaches only the owner's own
 * tree: an entity's, or for `you` the played entity's (Q117). Pure.
 */
import { faceName, foldSighting, isUnidentified } from '@/lib/items';
import { playedEntityIds } from '@/lib/scope';
import { isAlwaysOn } from '@/lib/traitEffects';
import type { GateOwner } from '@/lib/traitGates';
import type { Item, ItemCopy, ItemCopyWhere, ItemTraitEffect, PersonaRef, TimedItemEffect } from '@/types';
import { timedKey, timedTraitRow, type Dose } from './effects';

/** The slice the grants read. */
export interface GrantWorld {
  items: ReadonlyMap<string, Item>;
  /** The owners in play, whose trees a grant reaches. */
  owners: readonly Pick<GateOwner, 'id' | 'traits'>[];
  persona?: PersonaRef;
  entities?: readonly { id: string; customPersona?: boolean }[];
}

export interface WantedGrants {
  /** Owner id → the trait ids grants hold, in copy order. */
  held: Record<string, string[]>;
  /** `<owner id>:<trait id>` → the first item holding it, and whether every Item Copy behind it is hidden. */
  sources: Map<string, { item: Item; hidden: boolean; unidentified: boolean }>;
  /** Owner id → the traits On First Obtain and Permanent After Use rows granted for good, this settle's included. */
  firstObtainTraits: Record<string, string[]>;
  /** The trait rows still running after this settle's expiry and doses, keyed as the ledger keys them. */
  timedTraits: Record<string, TimedItemEffect>;
  diagnostics: string[];
}

/** The running After Use trait rows a settle reads, and the uses it starts. */
export interface TimedGrants {
  entries?: Readonly<Record<string, TimedItemEffect>>;
  doses?: readonly Dose[];
  /** The story clock's `gameTime`. Absent: no timed grant ends. */
  now?: number;
}

export const grantKey = (ownerId: string, traitId: string): string => `${ownerId}:${traitId}`;

const rowsOf = (item: Item, timing: ItemTraitEffect['timing']) => (item.traitEffects ?? []).filter((row) => row.timing === timing);

/** The owner whose tree holds `traitId` for a copy at `where`, or null. */
function treeOwnerOf(where: ItemCopyWhere, traitId: string, world: GrantWorld): string | null {
  const holds = (id: string) => !!world.owners.find((o) => o.id === id)?.traits.some((t) => t.id === traitId);
  if (where.kind === 'location') return null;
  if (where.kind === 'entity') return holds(where.id) ? where.id : null;
  const played = world.persona ? playedEntityIds(world.persona, world.entities) : [];
  return played.find(holds) ?? null;
}

const whereText = (where: ItemCopyWhere): string => (where.kind === 'you' ? 'you' : where.id);

/**
 * The grants the Item Copies put in force: While Owned rows once per owner and item, While Equipped rows per
 * equipped Item Copy, and every trait an On First Obtain row ever granted (Q121). A row whose owner lacks the
 * trait, or names an Automatic trait, is skipped with a diagnostic. Hidden Item Copies count (Q63).
 */
export function wantedGrants(
  copies: readonly ItemCopy[], world: GrantWorld, firstObtained: Readonly<Record<string, readonly string[]>> = {}, timed: TimedGrants = {},
): WantedGrants {
  const held: Record<string, string[]> = {};
  const sources = new Map<string, { item: Item; hidden: boolean; unidentified: boolean }>();
  const firstObtainTraits: Record<string, string[]> = Object.fromEntries(Object.entries(firstObtained).map(([id, ids]) => [id, [...ids]]));
  const diagnostics = new Set<string>();
  const hold = (ownerId: string, traitId: string, item: Item | null, hidden: boolean, unidentified: boolean) => {
    if (!(held[ownerId] ??= []).includes(traitId)) held[ownerId].push(traitId);
    if (!item) return;
    const key = grantKey(ownerId, traitId);
    const seen = sources.get(key);
    if (!seen) sources.set(key, { item, hidden, unidentified });
    else if (seen.item === item) foldSighting(seen, hidden, unidentified);
  };
  const traitOf = (ownerId: string, traitId: string) => world.owners.find((o) => o.id === ownerId)?.traits.find((t) => t.id === traitId);
  // A timed grant ends once the clock reaches its end, or once its item, row or trait is gone.
  const timedTraits: Record<string, TimedItemEffect> = {};
  for (const [key, entry] of Object.entries(timed.entries ?? {})) {
    if (entry.row !== 'trait') continue;
    const row = timedTraitRow(entry, world.items);
    const ended = timed.now !== undefined && timed.now >= entry.endsAt;
    if (row && traitOf(entry.ownerId, row.traitId) && !ended) timedTraits[key] = entry;
  }
  for (const dose of timed.doses ?? []) {
    const item = world.items.get(dose.itemId);
    if (!item) continue;
    for (const row of rowsOf(item, 'used')) {
      const ownerId = treeOwnerOf(dose.where, row.traitId, world);
      const trait = ownerId === null ? undefined : traitOf(ownerId, row.traitId);
      if (ownerId === null || !trait) {
        diagnostics.add(`Item ${faceName(item, !!dose.unidentified)}: owner ${whereText(dose.where)} has no trait ${row.traitId}`);
        continue;
      }
      if (isAlwaysOn(trait)) {
        diagnostics.add(`Item ${faceName(item, !!dose.unidentified)}: trait ${trait.name} is Automatic`);
        continue;
      }
      if (row.duration?.kind !== 'time') {
        const forGood = (firstObtainTraits[ownerId] ??= []);
        if (!forGood.includes(trait.id)) forGood.push(trait.id);
        continue;
      }
      // A second dose restarts the timer (Q64).
      const key = timedKey(ownerId, item.id, row.id);
      const endsAt = (timed.now ?? 0) + row.duration.hours;
      timedTraits[key] = timedTraits[key]
        ? { ...timedTraits[key], endsAt }
        : {
          row: 'trait', ownerId, itemId: item.id, rowId: row.id, endsAt,
          ...(dose.hidden && { hidden: true }), ...(dose.unidentified && { unidentified: true }),
        };
    }
  }
  for (const [ownerId, ids] of Object.entries(firstObtainTraits)) for (const id of ids) hold(ownerId, id, null, true, false);
  for (const entry of Object.values(timedTraits)) {
    const item = world.items.get(entry.itemId);
    const row = timedTraitRow(entry, world.items);
    if (item && row) hold(entry.ownerId, row.traitId, item, !!entry.hidden, !!entry.unidentified);
  }
  for (const copy of copies) {
    if (copy.item.kind !== 'item' || !(copy.quantity > 0) || copy.where.kind === 'location') continue;
    const item = world.items.get(copy.item.itemId);
    if (!item) continue;
    const rows = [...rowsOf(item, 'owned'), ...(copy.equipped ? rowsOf(item, 'equipped') : []), ...rowsOf(item, 'firstObtain')];
    for (const row of rows) {
      const ownerId = treeOwnerOf(copy.where, row.traitId, world);
      const trait = ownerId === null ? undefined : world.owners.find((o) => o.id === ownerId)?.traits.find((t) => t.id === row.traitId);
      if (ownerId === null || !trait) {
        diagnostics.add(`Item ${faceName(item, isUnidentified(copy))}: owner ${whereText(copy.where)} has no trait ${row.traitId}`);
        continue;
      }
      if (isAlwaysOn(trait)) {
        diagnostics.add(`Item ${faceName(item, isUnidentified(copy))}: trait ${trait.name} is Automatic`);
        continue;
      }
      if (row.timing === 'firstObtain') {
        const forGood = (firstObtainTraits[ownerId] ??= []);
        if (!forGood.includes(trait.id)) forGood.push(trait.id);
      }
      hold(ownerId, trait.id, item, copy.visibility === 'hidden', isUnidentified(copy));
    }
  }
  return { held, sources, firstObtainTraits, timedTraits, diagnostics: [...diagnostics] };
}
