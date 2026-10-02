import type { Placeholder, PlaceholderGroup } from '@/types';
import type { PlaceholderOwners } from './placeholderHomes';
import type { CodeTraitPlace } from './statCodeAnalysis';
import { statCodeName } from './statCodeNames';
import { placeholderPathMap } from './statCodePaths';
import { inTreeOrder } from './statCodeTraits';

/** What the placeholder map is built from, plus the Placeholders-tab folders. */
export interface PlaceholderPlacesSource {
  list: readonly Placeholder[];
  owners?: PlaceholderOwners;
  groups?: readonly PlaceholderGroup[];
}

/**
 * The names `placeholders["X"]` reaches, in Placeholders-tab order, each under its folders. Owned and child
 * placeholders drop out, since code reaches them through their owner or parent.
 */
export function worldPlaceholderPlaces({ list, owners, groups = [] }: PlaceholderPlacesSource): CodeTraitPlace[] {
  const top = new Set(placeholderPathMap({ list, owners }).top.flatMap((node) => (node.placeholder ? [node.placeholder.id] : [])));
  return inTreeOrder(groups, list, (group) => statCodeName(group.name, list))
    .filter(({ leaf }) => top.has(leaf.id))
    .map(({ leaf, path }) => ({ id: leaf.id, name: leaf.name, path }));
}
