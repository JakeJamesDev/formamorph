import { Loader2, Pencil } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDevRoute } from '@/lib/devRouter';
import { modelHasControls, useAvatarEditTarget } from '@/lib/useAvatarEdit';
import { AvatarEditDialog } from './AvatarEditDialog';
import { CornerButton } from './EntityVisual';
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
  const { viewCharacterData, playerLookStats, isViewingPast } = useGameplay();
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
  // The model whose loaded capabilities offer something to edit.
  const [controlsFor, setControlsFor] = useState<string>();
  const onCapabilities = useCallback(
    (caps: VRMCapabilities) => {
      if (played && modelHasControls(caps)) setControlsFor(url);
      onCatalog(
        [...caps.bodyMorphs, ...caps.headMorphs],
        COLOR_CHANNELS.filter((channel) => caps.colors[channel] !== undefined),
      );
    },
    [onCatalog, played, url],
  );
  const editTarget = useAvatarEditTarget();
  const [editing, setEditing] = useState(false);
  const canEdit = played && !isViewingPast && !!url && (!editTarget.locked || controlsFor === url);
  const devRoute = useDevRoute();
  const devEdit = import.meta.env.DEV && played && devRoute?.modal === 'avatarEdit';
  useEffect(() => {
    if (devEdit) setEditing(true);
  }, [devEdit]);
  // Mounted through the loader too, so a model reload never drops an open edit.
  const editor = played && <AvatarEditDialog target={editTarget} open={editing} onOpenChange={setEditing} />;
  // Hold a loader rather than mount an empty viewer and swap the model in a moment later.
  if (resolving || urlResolving) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <Loader2 className="animate-spin" size={32} />
        {editor}
      </div>
    );
  }
  return (
    <div className="relative w-full h-full">
      <VRMViewer
        key={url ?? 'none'}
        bodyMorphValues={morphs}
        onCapabilities={onCapabilities}
        colorPlan={colors}
        hairTypes={custom?.hairTypes}
        currentHairStyle={custom?.currentHairStyle}
        hairLength={custom?.hairLength}
        modelUrl={url}
        extraColors={custom?.extraColors}
      />
      {canEdit && (
        <div className="absolute bottom-1 right-1">
          <CornerButton label="Edit Avatar" onClick={() => setEditing(true)}>
            <Pencil className="h-4 w-4" />
          </CornerButton>
        </div>
      )}
      {editor}
    </div>
  );
}
