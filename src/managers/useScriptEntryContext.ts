import { useMemo } from 'react';
import { useGameData } from '@/contexts/GameDataContext';
import { statBoxLookups, traitBoxSelf } from '@/lib/codeWorldLookup';
import { statCodeName, statCodeNamed } from '@/lib/statCodeNames';
import { blueprintGroupStats, resolvedEntityStats } from '@/lib/statLinks';
import { useScriptWorldNames } from '@/lib/useScriptWorldNames';
import type { ScriptEntry } from '@/lib/worldScripts';
import type { ScriptTiming, Stat } from '@/types';
import type { ScriptBoxContext, ScriptBoxOwner, ScriptSelf } from './ScriptBox';

const namesOf = (stats: readonly Stat[]) => stats.map((stat) => stat.name).filter((name): name is string => !!name);

/**
 * What a Scripts tab row's box completes against and runs under: the same owner, `self` and names the stat's or
 * trait's own Scripts section hands its boxes, read from the stored world. A world script runs with neither.
 */
export function useScriptEntryContext(entry: ScriptEntry): { self: ScriptSelf; context: ScriptBoxContext } {
  const world = useGameData();
  const { names, placeholderPlaces } = useScriptWorldNames();
  const placeholders = names.placeholders.list;
  const { box, entity } = entry;
  const statWorld = useMemo(() => ({ stats: world.stats, statGroups: world.statGroups }), [world.stats, world.statGroups]);
  const lookups = useMemo(() => statBoxLookups(world), [world]);

  return useMemo(() => {
    const trait = box && 'trait' in box ? box.trait : undefined;
    const stat = box && 'stat' in box ? box.stat : undefined;
    const selfName = statCodeName(trait?.name ?? stat?.name ?? '', placeholders);
    // A Blueprint box sits on no entity and still runs under an owner: each one that links it.
    const blueprint = !!box && !entity && box.owner !== null;
    const owner: ScriptBoxOwner | null = entity ? { kind: 'entity', entityId: entity.id } : blueprint ? { kind: 'blueprint' } : null;
    const ownerStats = entity ? statCodeNamed(resolvedEntityStats(statWorld, entity), placeholders)
      : blueprint && stat ? statCodeNamed(blueprintGroupStats(statWorld, stat), placeholders)
        : [];
    // A Blueprint trait's owners vary, so its `owner.stats` names go unchecked.
    const ownerStatNames = trait && !entity ? undefined : namesOf(ownerStats);
    const lookupSelf: Stat = stat ? { ...stat, name: selfName } : traitBoxSelf(trait?.id ?? '', selfName);
    const self: ScriptSelf = trait ? { kind: 'trait', id: trait.id } : stat ? { kind: 'stat', stat } : { kind: 'world' };
    const context: ScriptBoxContext = {
      selfName, owner, names, ownerStats, ...(ownerStatNames && { ownerStatNames }), placeholderPlaces,
      lookup: (timing: ScriptTiming) => lookups({ owner, timing, self: lookupSelf }),
    };
    return { self, context };
  }, [box, entity, placeholders, statWorld, names, placeholderPlaces, lookups]);
}
