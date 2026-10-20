/** The Owner an editor box runs under, read through the Sandbox Snapshot's derivation. */

import type { Placeholder } from '@/types';
import type { CodeBoxOwner } from './codeWorldLookup';
import { ownerOfHome, type UnitHome, type UnitOwner } from './sandboxSnapshot';
import { statCodeName, statCodeNamed } from './statCodeNames';
import type { StatCodeBox, TraitCodeBox } from './statCodeTargets';

/** Where a box's Script lives, as the snapshot names homes. A Blueprint box sits on no entity and holds an owner. */
export function boxHomeOf(box: StatCodeBox | TraitCodeBox, placeholders: readonly Placeholder[]): UnitHome {
  const blueprint = !box.entity && box.owner !== null;
  if ('trait' in box) {
    return blueprint ? { kind: 'blueprintTrait', trait: box.trait } : { kind: 'trait', trait: box.trait, entityId: box.entity?.id ?? null };
  }
  const stat = { ...box.stat, name: statCodeName(box.stat.name, placeholders) };
  if (box.entity) return { kind: 'entityStat', entityId: box.entity.id, stat };
  return blueprint ? { kind: 'blueprintStat', stat, groupStats: statCodeNamed(box.owner?.stats ?? [], placeholders) } : { kind: 'globalStat', stat };
}

/** The Owner `box` runs under, its stats under their code names. */
export const boxOwnerOf = (box: StatCodeBox | TraitCodeBox, placeholders: readonly Placeholder[]): UnitOwner =>
  ownerOfHome(boxHomeOf(box, placeholders));

/** `owner` as the editor's lookups take it. Null for global scope. */
export function codeBoxOwnerOf(owner: UnitOwner): CodeBoxOwner | null {
  switch (owner.kind) {
    case 'none': return null;
    case 'entity': return { kind: 'entity', entityId: owner.entityId };
    case 'blueprintStat':
    case 'blueprintTrait': return { kind: 'blueprint' };
  }
}
