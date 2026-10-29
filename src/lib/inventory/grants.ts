/**
 * Item trait grants: which owner traits the Item Copies hold on (Q52). A grant reaches only the owner's own
 * tree: an entity's, or for `you` the played entity's (Q117). Pure.
 */
import { playedEntityIds } from '@/lib/scope';
import { isAlwaysOn } from '@/lib/traitEffects';
import type { GateOwner } from '@/lib/traitGates';
import type { Item, ItemCopy, ItemCopyWhere, ItemTraitEffect, PersonaRef } from '@/types';

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
  sources: Map<string, { item: Item; hidden: boolean }>;
  /** Owner id → the traits On First Obtain rows granted for good, this settle's included. */
  firstObtainTraits: Record<string, string[]>;
  diagnostics: string[];
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
export function wantedGrants(copies: readonly ItemCopy[], world: GrantWorld, firstObtained: Readonly<Record<string, readonly string[]>> = {}): WantedGrants {
  const held: Record<string, string[]> = {};
  const sources = new Map<string, { item: Item; hidden: boolean }>();
  const firstObtainTraits: Record<string, string[]> = Object.fromEntries(Object.entries(firstObtained).map(([id, ids]) => [id, [...ids]]));
  const diagnostics = new Set<string>();
  const hold = (ownerId: string, traitId: string, item: Item | null, hidden: boolean) => {
    if (!(held[ownerId] ??= []).includes(traitId)) held[ownerId].push(traitId);
    if (!item) return;
    const key = grantKey(ownerId, traitId);
    const seen = sources.get(key);
    if (!seen) sources.set(key, { item, hidden });
    else if (seen.item === item) seen.hidden &&= hidden;
  };
  for (const [ownerId, ids] of Object.entries(firstObtainTraits)) for (const id of ids) hold(ownerId, id, null, true);
  for (const copy of copies) {
    if (copy.item.kind !== 'item' || !(copy.quantity > 0) || copy.where.kind === 'location') continue;
    const item = world.items.get(copy.item.itemId);
    if (!item) continue;
    const rows = [...rowsOf(item, 'owned'), ...(copy.equipped ? rowsOf(item, 'equipped') : []), ...rowsOf(item, 'firstObtain')];
    for (const row of rows) {
      const ownerId = treeOwnerOf(copy.where, row.traitId, world);
      const trait = ownerId === null ? undefined : world.owners.find((o) => o.id === ownerId)?.traits.find((t) => t.id === row.traitId);
      if (ownerId === null || !trait) {
        diagnostics.add(`Item ${item.name}: owner ${whereText(copy.where)} has no trait ${row.traitId}`);
        continue;
      }
      if (isAlwaysOn(trait)) {
        diagnostics.add(`Item ${item.name}: trait ${trait.name} is Automatic`);
        continue;
      }
      if (row.timing === 'firstObtain') {
        const forGood = (firstObtainTraits[ownerId] ??= []);
        if (!forGood.includes(trait.id)) forGood.push(trait.id);
      }
      hold(ownerId, trait.id, item, copy.visibility === 'hidden');
    }
  }
  return { held, sources, firstObtainTraits, diagnostics: [...diagnostics] };
}
