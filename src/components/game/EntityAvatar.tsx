import { Loader2 } from 'lucide-react';
import { useGameplay } from '@/contexts/GameplayContext';
import { useVrmSourceUrl } from '@/lib/useVrmSourceUrl';
import { useEntityStatMorphs } from '@/lib/useEntityStatMorphs';
import { mergeBodyMorphs } from '@/lib/bodyMorphs';
import type { VrmSource } from '@/lib/vrmResolver';
import VRMViewer from '@/views/VRMViewer';
import type { Entity } from '@/types';

/**
 * An entity's Avatar in play. The played side wears the save's customization, with morphs from the player's
 * active stats. Any other entity shows its file as authored, with morphs from its own stats.
 */
export function EntityAvatar({ entity, source, played, resolving }: {
  entity: Pick<Entity, 'id' | 'stats'>;
  source: VrmSource;
  played: boolean;
  /** The library list is still loading, so a library source may not be final yet. */
  resolving: boolean;
}) {
  const { viewCharacterData, bodyMorphValues } = useGameplay();
  const ownMorphs = useEntityStatMorphs(played ? undefined : entity);
  const { url, resolving: urlResolving } = useVrmSourceUrl(source);
  // Hold a loader rather than mount the bundled file and swap it a moment later.
  if (resolving || urlResolving) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <Loader2 className="animate-spin" size={32} />
      </div>
    );
  }
  const custom = played ? viewCharacterData : null;
  return (
    <VRMViewer
      key={url ?? 'default'}
      bodyMorphValues={played ? mergeBodyMorphs(custom?.bodyMorphs ?? {}, bodyMorphValues) : ownMorphs}
      hairColor={custom?.hairColor}
      eyeColor={custom?.eyeColor}
      skinColor={custom?.skinColor}
      hairTypes={custom?.hairTypes}
      currentHairStyle={custom?.currentHairStyle}
      hairLength={custom?.hairLength}
      modelUrl={url}
      extraColors={custom?.extraColors}
    />
  );
}
