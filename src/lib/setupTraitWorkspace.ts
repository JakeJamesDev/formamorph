/** The setup screen's trait categories and nav. A category is a group that holds traits directly, plus General
 *  for root traits; an entity node is always one. Every nav node opens a page with its whole subtree. */
import type { Trait, TraitGroup } from '@/types';
import { isShown } from './traitEffects';
import { groupPickState } from './traitGates';

export interface TraitCategory {
  kind: 'traits';
  id: string | null;
  name: string;
  group?: TraitGroup;
  path: TraitGroup[];
  depth: number;
  traits: Trait[];
  /** The owner whose tree the category is in: set on an entity node's category and on every category below it. */
  entityId?: string;
  /** Set on an entity node's own category, whose page shows the entity. */
  entityNode?: true;
}

/** One group row of the setup nav. Every node has a page, a label-only group included. */
export interface TraitNavNode {
  group: TraitGroup;
  depth: number;
  /** The node's own category, or -1 for a group that holds only child groups. */
  categoryIndex: number;
  hasChildren: boolean;
  /** From the root down to the parent. */
  ancestorIds: string[];
  /** The categories the node's page shows: its own, then every descendant's, in authored order. */
  subtree: number[];
}

export interface TraitWorkspace {
  categories: TraitCategory[];
  navigationNodes: TraitNavNode[];
}

/** What a nav row shows for its subtree. */
export interface SubtreeRollup {
  shown: number;
  selected: number;
  short: boolean;
}

/** Sums `subtree` the way a single category's row counts: unseen traits drop out, picks read under each category's owner. */
export const subtreeRollup = (
  categories: readonly TraitCategory[], subtree: readonly number[], picksOf: (entityId: string | undefined) => readonly string[],
): SubtreeRollup => {
  const rollup: SubtreeRollup = { shown: 0, selected: 0, short: false };
  for (const index of subtree) {
    const category = categories[index];
    if (!category) continue;
    const picks = picksOf(category.entityId);
    const shown = category.traits.filter((trait) => isShown(trait, picks));
    rollup.shown += shown.length;
    rollup.selected += shown.filter((trait) => picks.includes(trait.id)).length;
    if (category.group && groupPickState(category.group, category.traits, picks).short) rollup.short = true;
  }
  return rollup;
};

const authoredOrder = <T extends { order?: number }>(items: T[]): T[] =>
  [...items].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

/** Whether the player sees a trait's row, read under the owner whose tree it sits in. */
export type ShowsTrait = (trait: Trait, entityId: string | undefined) => boolean;

/** `shows` drops every category with no row the player sees (Q33); each kept category still lists all its
 *  direct traits, so pick counts include the unseen ones. */
export const buildTraitWorkspace = (
  traits: Trait[], groups: TraitGroup[], entityNodeIds: ReadonlySet<string> = new Set(), shows: ShowsTrait = () => true,
): TraitWorkspace => {
  const directTraits = (groupId: string | null) => authoredOrder(
    traits.filter((trait) => (trait.groupId ?? null) === groupId),
  );
  const children = (parentId: string | null) => authoredOrder(
    groups.filter((group) => (group.parentId ?? null) === parentId),
  );
  const ownerIn = (groupId: string, within?: string) => (entityNodeIds.has(groupId) ? groupId : within);
  const showsAny = (groupId: string | null, within?: string) => directTraits(groupId).some((trait) => shows(trait, within));
  const hasTraits = (groupId: string, within?: string): boolean => {
    const owner = ownerIn(groupId, within);
    return showsAny(groupId, owner) || children(groupId).some((group) => hasTraits(group.id, owner));
  };

  const categories: TraitCategory[] = [];
  const navigationNodes: TraitNavNode[] = [];
  const general = directTraits(null);
  if (showsAny(null)) {
    categories.push({ kind: 'traits', id: null, name: 'General', path: [], depth: 0, traits: general });
  }

  const walk = (parentId: string | null, path: TraitGroup[], ancestorIds: string[], depth: number, within?: string) => {
    for (const group of children(parentId).filter((candidate) => hasTraits(candidate.id, within))) {
      const entity = entityNodeIds.has(group.id);
      const owner = ownerIn(group.id, within);
      // An entity's pages describe the entity, so the world groups around its node drop out of the path.
      const nextPath = entity ? [group] : [...path, group];
      const ownTraits = directTraits(group.id);
      const firstCategory = categories.length;
      const categoryIndex = showsAny(group.id, owner) || entity ? firstCategory : -1;
      if (categoryIndex >= 0) {
        categories.push({
          kind: 'traits', id: group.id, name: group.name, group, path: nextPath, depth, traits: ownTraits,
          ...(owner ? { entityId: owner } : {}),
          ...(entity ? { entityNode: true as const } : {}),
        });
      }
      const node: TraitNavNode = { group, depth, categoryIndex, hasChildren: false, ancestorIds, subtree: [] };
      const nodeIndex = navigationNodes.push(node);
      walk(group.id, nextPath, [...ancestorIds, group.id], depth + 1, owner);
      // Preorder keeps a subtree's categories contiguous.
      node.hasChildren = navigationNodes.length > nodeIndex;
      node.subtree = Array.from({ length: categories.length - firstCategory }, (_, offset) => firstCategory + offset);
    }
  };
  walk(null, [], [], 0);
  return { categories, navigationNodes };
};
