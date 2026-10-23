import { useMemo } from 'react';
import { useGameDataOptional } from '@/contexts/GameDataContext';
import { codeBoxOwnerOf } from '@/lib/codeBoxOwner';
import { statBoxLookups, traitBoxSelf } from '@/lib/codeWorldLookup';
import { ownerOfHome } from '@/lib/sandboxSnapshot';
import { ownerStatsOf, scriptHomeOf, type ScriptBoxWorld } from '@/lib/scriptBoxHome';
import { useScriptWorldNames } from '@/lib/useScriptWorldNames';
import type { ScriptHomeRef } from '@/lib/worldScripts';
import type { ScriptTiming } from '@/types';
import type { ScriptBoxContext } from './ScriptBox';

const NO_WORLD: ScriptBoxWorld = { stats: [], statGroups: [], traits: [], traitGroups: [], entities: [] };

/**
 * What a script box completes against and runs under, from its Script's home: the Owner as the Sandbox Snapshot
 * derives it, `self` as the stored world holds it, the owner's stats and the card lookup. Every surface that edits
 * a Script builds its boxes here. Off world, as in the library, `offWorld` stands in and there is no lookup.
 * Pass a stable `home`.
 */
export function useScriptBoxContext(home: ScriptHomeRef, offWorld?: ScriptBoxWorld): ScriptBoxContext {
  const gameData = useGameDataOptional();
  const { names, placeholderPlaces, world: foldWorld } = useScriptWorldNames();
  const lookups = useMemo(() => gameData && statBoxLookups(gameData), [gameData]);
  const world = gameData ?? offWorld ?? NO_WORLD;

  return useMemo(() => {
    const placeholders = names.placeholders.list;
    const unitHome = scriptHomeOf(home, world, placeholders);
    const derived = ownerOfHome(unitHome);
    const owner = codeBoxOwnerOf(derived);
    const ownerStats = ownerStatsOf(derived, world, placeholders);
    // Names are checked under an entity or a Blueprint stat's group; a Blueprint trait's owners vary.
    const checked = derived.kind === 'entity' || derived.kind === 'blueprintStat';
    const ownerStatNames = checked ? ownerStats.map((stat) => stat.name).filter((name) => !!name) : undefined;
    const trait = 'trait' in unitHome ? unitHome.trait : undefined;
    const selfName = 'stat' in unitHome ? unitHome.stat.name : trait?.name ?? '';
    const lookupSelf = 'stat' in unitHome ? unitHome.stat : traitBoxSelf(trait?.id ?? '', selfName);
    const lookup = lookups
      ? (timing: ScriptTiming) => lookups({ owner, timing, self: lookupSelf, ...(trait && { traitId: trait.id }) })
      : undefined;
    return {
      home: unitHome, selfName, owner, names, world: foldWorld, ownerStats, ...(ownerStatNames && { ownerStatNames }), placeholderPlaces, lookup,
    };
  }, [home, world, lookups, names, placeholderPlaces, foldWorld]);
}
