import { Loader2 } from 'lucide-react';
import { useCallback, useMemo } from 'react';
import { COLOR_CHANNELS } from '@/lib/avatarLook';
import { useGameplay } from '@/contexts/GameplayContext';
import { useVrmSourceUrl } from '@/lib/useVrmSourceUrl';
import { useAvatarMorphs, useEntityLookStats } from '@/lib/useEntityStatMorphs';
import type { VrmSource } from '@/lib/vrmResolver';
import VRMViewer, { type VRMCapabilities } from '@/views/VRMViewer';
import type { Entity } from '@/types';

/**
 * An entity's Avatar in play. The played side wears the save's customization, with the player's active stats on
 * top. Any other entity shows its file as authored, with its own stats on top.
 */
export function EntityAvatar({ entity, source, played, resolving }: {
  entity: Pick<Entity, 'id' | 'stats' | 'statGroups'>;
  source: VrmSource;
  played: boolean;
  /** The library list is still loading, so a library source may not be final yet. */
  resolving: boolean;
}) {
  const { viewCharacterData, playerLookStats } = useGameplay();
  const ownLook = useEntityLookStats(played ? undefined : entity);
  const custom = played ? viewCharacterData : null;
  const { url, resolving: urlResolving } = useVrmSourceUrl(source);
  const bodyMorphs = custom?.bodyMorphs;
  const skinColor = custom?.skinColor;
  const eyeColor = custom?.eyeColor;
  const hairColor = custom?.hairColor;
  const customization = useMemo(
    () => ({ morphs: bodyMorphs, colors: { skin: skinColor, eye: eyeColor, hair: hairColor } }),
    [bodyMorphs, skinColor, eyeColor, hairColor],
  );
  const { morphs, colors, onCatalog } = useAvatarMorphs(played ? playerLookStats : ownLook, customization, url);
  const onCapabilities = useCallback(
    (caps: VRMCapabilities) => onCatalog(
      [...caps.bodyMorphs, ...caps.headMorphs],
      COLOR_CHANNELS.filter((channel) => caps.colors[channel] !== undefined),
    ),
    [onCatalog],
  );
  // Hold a loader rather than mount the bundled file and swap it a moment later.
  if (resolving || urlResolving) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <Loader2 className="animate-spin" size={32} />
      </div>
    );
  }
  return (
    <VRMViewer
      key={url ?? 'default'}
      bodyMorphValues={morphs}
      onCapabilities={onCapabilities}
      colorPlan={colors}
      hairTypes={custom?.hairTypes}
      currentHairStyle={custom?.currentHairStyle}
      hairLength={custom?.hairLength}
      modelUrl={url}
      extraColors={custom?.extraColors}
    />
  );
}
