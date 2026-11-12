import { useMemo } from 'react';
import { useGameData } from '@/contexts/GameDataContext';
import { useGameplay } from '@/contexts/GameplayContext';
import { useResolvedWorld } from '@/lib/useResolvedWorld';
import { useLibraryIds } from '@/lib/useLibraryAvatars';
import { readUserDefaultAvatar } from '@/lib/defaultAvatar';
import { entityAvatarInUse, playedEntityId, playVrmContext, resolveEntityVrm, resolvePlayedVrm, type PickedEntity } from '@/lib/vrmResolver';
import { hasEntityVisual } from '@/lib/entityVisual';
import type { Entity } from '@/types';

/** Each entity's Avatar in this playthrough. While the library list loads, a User's Default or library pick
 *  resolves to `pending`, so the entity counts as showing one and its view holds a loader. */
export function usePlayAvatars() {
  const { entities, worldOverview } = useGameData();
  const { persona } = useResolvedWorld();
  const { viewCharacterData } = useGameplay();
  const libraryIds = useLibraryIds();
  const deviceDefault = useMemo(readUserDefaultAvatar, []);
  return useMemo(() => {
    const ctx = playVrmContext({
      persona, entities, overview: worldOverview, characterData: viewCharacterData,
      libraryIds, deviceDefault,
    });
    const sourceOf = (entity: PickedEntity) => resolveEntityVrm(entity, ctx);
    const inUse = (entity: PickedEntity) => entityAvatarInUse(entity, ctx);
    return {
      sourceOf,
      inUse,
      /** Whether the entity view has anything to show for `entity`: an Avatar, a 3D model or an image. */
      shows: (entity: Entity) => hasEntityVisual(entity) || inUse(entity),
      /** The played side's Avatar, which the You row shows when no entity is played. */
      played: resolvePlayedVrm(ctx),
      playedId: playedEntityId(ctx),
      resolving: !libraryIds,
    };
  }, [persona, entities, worldOverview, viewCharacterData, libraryIds, deviceDefault]);
}
