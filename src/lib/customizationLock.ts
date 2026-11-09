// What Character Customization locks in the new-game flow: the sliders and colors the checked traits pin.

import type { BodyTraitOn, ColorChannel, Trait } from "@/types";
import { avatarLookTraits, resolveAvatarLook, type AvatarLook, type LookTraits } from "./avatarLook";
import type { GateInput } from "./traitGates";

/** The traits the player checked, as the look resolver reads them, and how to name one. */
export interface AvatarLock {
  traits: LookTraits;
  nameOf: (holder: BodyTraitOn) => string;
}

export interface CheckedLockInput {
  /** The cast's trait trees: global scope and each entity owner. */
  trees: Pick<GateInput, "global" | "owners">;
  /** The played entities' ids. */
  played: readonly string[];
  /** The checked global traits' ids and each owner's checked ids. */
  globalIds: readonly string[];
  ownedIds: Readonly<Record<string, readonly string[]>>;
  /** Puts the checked global traits in tree order. */
  inOrder: (traits: Trait[]) => Trait[];
}

/** The Avatar's lock from the checked traits. Automatic traits and item grants are not evaluated (Q18), and the
 *  switch-on order is empty, so tree order breaks a tie. */
export function checkedAvatarLock({ trees, played, globalIds, ownedIds, inOrder }: CheckedLockInput): AvatarLock {
  const checked = (traits: readonly Trait[], ids: readonly string[] | undefined) => traits.filter((t) => ids?.includes(t.id));
  const owners = Object.fromEntries(trees.owners.filter((o) => played.includes(o.id)).map((o) => [o.id, checked(o.traits, ownedIds[o.id])]));
  const scope = { global: inOrder(checked(trees.global.traits, globalIds)), owners, played };
  const nameOf = ({ ownerId, traitId }: BodyTraitOn): string => {
    const traits = ownerId === null ? trees.global.traits : trees.owners.find((o) => o.id === ownerId)?.traits ?? [];
    return traits.find((t) => t.id === traitId)?.name ?? traitId;
  };
  return { traits: avatarLookTraits(scope, []).player, nameOf };
}

/** The pins the lock puts on one model: its slider values and colors by holder. */
export function lockedLook(lock: AvatarLock, model: { catalog: readonly string[]; channels: readonly ColorChannel[] }): AvatarLook {
  return resolveAvatarLook({ stats: [], authored: [], customization: {}, catalog: model.catalog, channels: model.channels, traits: lock.traits });
}
