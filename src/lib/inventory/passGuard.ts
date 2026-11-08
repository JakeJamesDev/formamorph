/**
 * The Inventory pass's guard against repeating the player's panel actions: a reply operation that reports a
 * shown Listed Action is dropped, unit by unit, up to what that entry did (Q7, Q21, Q44, Q45). Pure.
 */
import { toldInventoryActions, type InventoryActionFacts } from '@/lib/actionList';
import { sameWhere } from '@/lib/items';
import type { InventoryPassOp, ItemCopyWhere } from '@/types';
import { actionKeyNamed, ownerOf, skip, type PassRun } from './passRun';

const at = (where: ItemCopyWhere | null, place: ItemCopyWhere) => !!where && sameWhere(where, place);
const isYou = (where: ItemCopyWhere | null) => at(where, { kind: 'you' });
const isEntity = (where: ItemCopyWhere | null, id: string) => at(where, { kind: 'entity', id });
const isPlace = (where: ItemCopyWhere | null, id: string) => at(where, { kind: 'location', id });

/** Whether `op` has the shape that reports `facts` (Q44). The item is checked apart. */
function reports(pass: PassRun, op: InventoryPassOp, facts: InventoryActionFacts): boolean {
  const owner = ownerOf(pass, op.owner);
  const to = op.to ? ownerOf(pass, op.to) : null;
  switch (facts.kind) {
    case 'use':
    case 'equip':
    case 'unequip':
      return op.op === facts.kind && isYou(owner);
    case 'give':
      return ((op.op === 'transfer' || op.op === 'gain') && isYou(owner) && isEntity(to, facts.to.id)) || (op.op === 'lose' && isYou(owner));
    case 'drop':
      return (op.op === 'transfer' && isYou(owner) && isPlace(to, facts.place)) || (op.op === 'lose' && isYou(owner));
    case 'pickup': {
      if (op.op === 'transfer') return isPlace(owner, facts.place) && isYou(to);
      if (op.op !== 'gain') return false;
      // A gain with no `to` names its recipient as the owner, and then has no source.
      if (!op.to) return isYou(owner);
      return isYou(to) && (owner === null || isPlace(owner, facts.place));
    }
  }
}

/** `ops` less what the shown inventory entries already did. Each drop is logged as a skip. */
export function guardTold(pass: PassRun, ops: readonly InventoryPassOp[]): InventoryPassOp[] {
  const budgets = toldInventoryActions(pass.scene.told ?? [])
    .map(({ facts, count }) => ({ facts, left: count * ('quantity' in facts ? facts.quantity : 1) }));
  if (!budgets.length) return [...ops];
  return ops.flatMap((op) => {
    let left = op.quantity;
    for (const budget of budgets) {
      if (!left) break;
      if (!budget.left || !reports(pass, op, budget.facts) || actionKeyNamed(pass, op.item) !== budget.facts.item.key) continue;
      const taken = Math.min(left, budget.left);
      budget.left -= taken;
      left -= taken;
    }
    if (left === op.quantity) return [op];
    const label = `${op.op} "${op.item}"`;
    skip(pass, `${left ? `${op.quantity - left} of ${op.quantity} of ` : ''}${label}: the player already did it`);
    return left ? [{ ...op, quantity: left }] : [];
  });
}
