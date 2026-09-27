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
  /** Set on an entity node's category. */
  entityId?: string;
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

export const buildTraitWorkspace = (
  traits: Trait[], groups: TraitGroup[], entityNodeIds: ReadonlySet<string> = new Set(),
): TraitWorkspace => {
  const directTraits = (groupId: string | null) => authoredOrder(
    traits.filter((trait) => (trait.groupId ?? null) === groupId),
  );
  const children = (parentId: string | null) => authoredOrder(
    groups.filter((group) => (group.parentId ?? null) === parentId),
  );
  const hasTraits = (groupId: string): boolean =>
    directTraits(groupId).length > 0 || children(groupId).some((group) => hasTraits(group.id));

  const categories: TraitCategory[] = [];
  const navigationGroups: NavigationGroup[] = [];
  const general = directTraits(null);
  if (general.length > 0) {
    categories.push({ kind: 'traits', id: null, name: 'General', path: [], depth: 0, traits: general });
  }

  const walk = (parentId: string | null, path: TraitGroup[], depth: number) => {
    for (const group of children(parentId).filter((candidate) => hasTraits(candidate.id))) {
      const entity = entityNodeIds.has(group.id);
      // An entity's pages describe the entity, so the world groups around its node drop out of the path.
      const nextPath = entity ? [group] : [...path, group];
      const ownTraits = directTraits(group.id);
      const categoryIndex = ownTraits.length > 0 || entity ? categories.length : -1;
      if (categoryIndex >= 0) {
        categories.push({
          kind: 'traits', id: group.id, name: group.name, group, path: nextPath, depth, traits: ownTraits,
          ...(entity ? { entityId: group.id } : {}),
        });
      }
      navigationGroups.push({ group, depth, categoryIndex });
      walk(group.id, nextPath, depth + 1);
    }
  };
  walk(null, [], 0);
  return { categories, navigationGroups };
};
