import { useMemo } from 'react';
import { useGameData } from '@/contexts/GameDataContext';
import { useGameplay } from '@/contexts/GameplayContext';
import { useResolvedWorld } from '@/lib/useResolvedWorld';
import { NO_LIBRARY, useLibraryIds } from '@/lib/useLibraryAvatars';
import { readUserDefaultAvatar } from '@/lib/defaultAvatar';
import { playedEntityId, playVrmContext, resolveEntityVrm, resolvePlayedVrm } from '@/lib/vrmResolver';
import { hasEntityVisual } from '@/lib/entityVisual';
import type { Entity } from '@/types';

/** Each entity's Avatar in this playthrough. Whether an entity shows one never waits on the library list: a
 *  library id that is not there resolves to the bundled file. Only which file waits, while `resolving`. */
export function usePlayAvatars() {
  const { entities, worldOverview } = useGameData();
  const { persona } = useResolvedWorld();
  const { viewCharacterData } = useGameplay();
  const libraryIds = useLibraryIds();
  const deviceDefault = useMemo(readUserDefaultAvatar, []);
  return useMemo(() => {
    const ctx = playVrmContext({
      persona, entities, overview: worldOverview, characterData: viewCharacterData,
      libraryIds: libraryIds ?? NO_LIBRARY, deviceDefault,
    });
    const sourceOf = (entity: Pick<Entity, 'id' | 'vrmPick'>) => resolveEntityVrm(entity, ctx);
    return {
      sourceOf,
      /** Whether the entity view has anything to show for `entity`: an Avatar, a 3D model or an image. */
      shows: (entity: Entity) => hasEntityVisual(entity) || !!sourceOf(entity),
      /** The played side's Avatar, which the You row shows when no entity is played. */
      played: resolvePlayedVrm(ctx),
      playedId: playedEntityId(ctx),
      resolving: !libraryIds,
    };
  }, [persona, entities, worldOverview, viewCharacterData, libraryIds, deviceDefault]);
}
