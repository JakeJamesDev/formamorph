/**
 * The Opening picker Test Code and the Test Bench share: every Opening in the world, grouped by owner, and the
 * one the author picked, which their runs read as the Drawn Opening. None is the default.
 *
 * Pure and world-shaped: nothing here reads storage or React.
 */
import { sameOpeningKey, type OpeningKey } from '@/lib/drawnOpening';
import { openingLabel } from '@/lib/openings';
import { openingKeyId } from '@/lib/openingCondition';
import { allPlaceholders } from '@/lib/placeholderHomes';
import { labelPlaceholders, worldPlacementLetters } from '@/lib/placementLetters';
import type { Opening } from '@/types';
import type { LensWorld } from './lens';

/** One Opening the picker lists, labeled by its name or its derived label. */
export interface OpeningPickOption {
  /** The option's value in the picker; unique across the world. */
  id: string;
  key: OpeningKey;
  label: string;
}

/** One owner's Openings: the world's own, an entity's or a location's. */
export interface OpeningPickGroup {
  label: string;
  options: OpeningPickOption[];
}

/** Every Opening in `world`: the world's own first, then each entity's, then each location's, Self rows included. */
export function openingPickGroups(world: LensWorld): OpeningPickGroup[] {
  const placeholders = allPlaceholders(world);
  const letters = worldPlacementLetters(world);
  const named = (name: string) => labelPlaceholders(name, placeholders, { letters });
  const group = (label: string, openings: readonly Opening[] | undefined, keyOf: (opening: Opening) => OpeningKey): OpeningPickGroup => ({
    label,
    options: (openings ?? []).map((opening, index) => {
      const key = keyOf(opening);
      return { id: openingKeyId(key), key, label: openingLabel(opening, label, index) };
    }),
  });
  return [
    group('World', world.worldOverview?.openings, (o) => ({ ownerId: null, openingId: o.id })),
    ...(world.entities ?? []).map((e) => group(named(e.name) || 'Unnamed', e.openings, (o) => ({ ownerId: e.id, openingId: o.id }))),
    ...(world.locations ?? []).map((l) => group(named(l.name) || 'Untitled location', l.openings, (o) => ({ ownerId: null, openingId: o.id, locationId: l.id }))),
  ].filter((g) => g.options.length > 0);
}

/** The option `key` names, or null under None and for a key whose Opening is gone. */
export const pickedOption = (groups: readonly OpeningPickGroup[], key: OpeningKey | null): OpeningPickOption | null =>
  (key && groups.flatMap((g) => g.options).find((option) => sameOpeningKey(option.key, key))) || null;
