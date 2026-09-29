/** The setup screen's trait categories: one per group that holds traits directly, plus General for root traits.
 *  An entity node is always a category: its page shows the entity even when all its traits sit in groups. */
import type { Trait, TraitGroup } from '@/types';

export interface TraitCategory {
  kind: 'traits';
  id: string | null;
  name: string;
  group?: TraitGroup;
  path: TraitGroup[];
  depth: number;
  traits: Trait[];
  /** The bearer whose tree the category is in: set on an entity node's category and on every category below it. */
  entityId?: string;
  /** Set on an entity node's own category, whose page shows the entity. */
  entityNode?: true;
}

export interface NavigationGroup {
  group: TraitGroup;
  depth: number;
  categoryIndex: number;
}

export interface TraitWorkspace {
  categories: TraitCategory[];
  navigationGroups: NavigationGroup[];
}

const authoredOrder = <T extends { order?: number }>(items: T[]): T[] =>
  [...items].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

/** Whether the player sees a trait's row, read under the bearer whose tree it sits in. */
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
  const bearerIn = (groupId: string, within?: string) => (entityNodeIds.has(groupId) ? groupId : within);
  const showsAny = (groupId: string | null, within?: string) => directTraits(groupId).some((trait) => shows(trait, within));
  const hasTraits = (groupId: string, within?: string): boolean => {
    const bearer = bearerIn(groupId, within);
    return showsAny(groupId, bearer) || children(groupId).some((group) => hasTraits(group.id, bearer));
  };

  const categories: TraitCategory[] = [];
  const navigationGroups: NavigationGroup[] = [];
  const general = directTraits(null);
  if (showsAny(null)) {
    categories.push({ kind: 'traits', id: null, name: 'General', path: [], depth: 0, traits: general });
  }

  const walk = (parentId: string | null, path: TraitGroup[], depth: number, within?: string) => {
    for (const group of children(parentId).filter((candidate) => hasTraits(candidate.id, within))) {
      const entity = entityNodeIds.has(group.id);
      const bearer = bearerIn(group.id, within);
      // An entity's pages describe the entity, so the world groups around its node drop out of the path.
      const nextPath = entity ? [group] : [...path, group];
      const ownTraits = directTraits(group.id);
      const categoryIndex = showsAny(group.id, bearer) || entity ? categories.length : -1;
      if (categoryIndex >= 0) {
        categories.push({
          kind: 'traits', id: group.id, name: group.name, group, path: nextPath, depth, traits: ownTraits,
          ...(bearer ? { entityId: bearer } : {}),
          ...(entity ? { entityNode: true as const } : {}),
        });
      }
      navigationGroups.push({ group, depth, categoryIndex });
      walk(group.id, nextPath, depth + 1, bearer);
    }
  };
  walk(null, [], 0);
  return { categories, navigationGroups };
};
