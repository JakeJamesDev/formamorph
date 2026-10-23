import { useMemo } from 'react';
import { useGameData } from '@/contexts/GameDataContext';
import { statBoxLookups } from '@/lib/codeWorldLookup';
import { useScriptWorldNames } from '@/lib/useScriptWorldNames';
import type { ScriptEntry } from '@/lib/worldScripts';
import { scriptEntryBoxContext, type BuiltBoxContext } from './scriptBoxBuilders';

/**
 * What a Scripts tab row's box completes against and runs under: the same owner, `self` and names the stat's or
 * trait's own Scripts section hands its boxes, read from the stored world. A world script runs with neither.
 */
export function useScriptEntryContext(entry: ScriptEntry): BuiltBoxContext {
  const world = useGameData();
  const { names, placeholderPlaces, world: foldWorld } = useScriptWorldNames();
  const statWorld = useMemo(() => ({ stats: world.stats, statGroups: world.statGroups }), [world.stats, world.statGroups]);
  const lookups = useMemo(() => statBoxLookups(world), [world]);

  return useMemo(
    () => scriptEntryBoxContext({ entry, statWorld, lookups, shared: { names, placeholderPlaces, world: foldWorld } }),
    [entry, statWorld, lookups, names, placeholderPlaces, foldWorld],
  );
}
