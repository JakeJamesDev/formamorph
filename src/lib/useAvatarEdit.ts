import { useMemo } from 'react';
import { useGameData } from '@/contexts/GameDataContext';
import { useGameplay } from '@/contexts/GameplayContext';
import { useResolvedWorld } from '@/lib/useResolvedWorld';
import { playedVrmPick, playVrmContext } from '@/lib/vrmResolver';
import { traitNameOf, type AvatarLock } from '@/lib/customizationLock';
import type { VRMCapabilities } from '@/views/VRMViewer';
import type { BodyTraitOn, VrmPick } from '@/types';

const NO_LOOK_TRAITS: AvatarLock['traits'] = { on: [], active: [] };

/** What the in-game Avatar editor opens on: the played side's pick, as the enter-world step reads it, and
 *  the traits in force that hold sliders and colors. */
export interface AvatarEditTarget {
  vrm: VrmPick;
  /** The pick is not User's Default, so the editor shows no Avatar list. */
  locked: boolean;
  lock: AvatarLock;
}

export function useAvatarEditTarget(): AvatarEditTarget {
  const { entities: allEntities, worldOverview } = useGameData();
  const { characterData, playerLookStats, globalTraits } = useGameplay();
  const { persona, entities, traits } = useResolvedWorld();
  const chosen = characterData?.chosenVrm;
  const vrm = useMemo<VrmPick>(() => {
    // An old save's choice replaces the whole played side, so it stays as set.
    if (chosen?.legacy) return chosen.pick;
    const ctx = playVrmContext({
      persona, entities: allEntities, overview: worldOverview, characterData: null, libraryIds: undefined, deviceDefault: undefined,
    });
    return playedVrmPick(ctx) ?? { kind: 'default' };
  }, [chosen, persona, allEntities, worldOverview]);
  const lookTraits = playerLookStats.traits ?? NO_LOOK_TRAITS;
  const lock = useMemo<AvatarLock>(() => ({
    traits: lookTraits,
    nameOf: (holder: BodyTraitOn) => traitNameOf(holder, [...globalTraits, ...traits],
      (ownerId) => [persona?.entity, ...entities, ...allEntities].find((e) => e?.id === ownerId)?.traits),
  }), [lookTraits, globalTraits, traits, persona, entities, allEntities]);
  return { vrm, locked: vrm.kind !== 'default', lock };
}

/** Whether a loaded model gives the editor anything to change: a slider, a hairstyle choice, or a color. */
export const modelHasControls = (caps: VRMCapabilities): boolean =>
  caps.bodyMorphs.length > 0 || caps.headMorphs.length > 0 || caps.hairLength || caps.hairStyles.length > 1
  || Object.values(caps.colors).some((color) => color !== undefined) || caps.extras.length > 0;
