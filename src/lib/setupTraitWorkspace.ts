/** The setup screen's trait categories: one per group that holds traits directly, plus General for root traits. */
import type { Trait, TraitGroup } from '@/types';

export interface TraitCategory {
  kind: 'traits';
  id: string | null;
  name: string;
  group?: TraitGroup;
  path: TraitGroup[];
  depth: number;
  traits: Trait[];
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

export const buildTraitWorkspace = (traits: Trait[], groups: TraitGroup[]): TraitWorkspace => {
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
      const nextPath = [...path, group];
      const ownTraits = directTraits(group.id);
      const categoryIndex = ownTraits.length > 0 ? categories.length : -1;
      if (ownTraits.length > 0) {
        categories.push({ kind: 'traits', id: group.id, name: group.name, group, path: nextPath, depth, traits: ownTraits });
      }
      navigationGroups.push({ group, depth, categoryIndex });
      walk(group.id, nextPath, depth + 1);
    }
  };
  walk(null, [], 0);
  return { categories, navigationGroups };
};
