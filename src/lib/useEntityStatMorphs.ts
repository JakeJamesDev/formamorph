import { useCallback, useMemo, useRef, useState } from 'react';
import { useGameplay } from '@/contexts/GameplayContext';
import { resolveAvatarLook, type AvatarLook, type LookStats } from '@/lib/avatarLook';
import { statsInTreeOrder } from '@/lib/statGroupTree';
import type { ColorChannel, Entity } from '@/types';

const NO_STATS: LookStats['stats'] = [];

/** The stats and traits an entity's own Avatar reads, for the turn on screen: live, or paged back. */
export function useEntityLookStats(entity: Pick<Entity, 'id' | 'stats' | 'statGroups'> | undefined): LookStats {
  const { viewEntityStats, viewEntityStatEnabled, viewEntityLookTraits } = useGameplay();
  const values = entity ? viewEntityStats[entity.id] : undefined;
  const enabled = entity ? viewEntityStatEnabled[entity.id] : undefined;
  const traits = entity ? viewEntityLookTraits[entity.id] : undefined;
  const stats = entity?.stats;
  const groups = entity?.statGroups;
  // Tree order, which orders color blends.
  const authored = useMemo(() => (stats ? statsInTreeOrder(groups ?? [], stats) : NO_STATS), [stats, groups]);
  return useMemo(
    () => ({ stats: values ?? NO_STATS, authored, enabled, ...(traits && { traits }) }),
    [values, authored, enabled, traits],
  );
}

/** The player's look choices an Avatar wears. */
export interface AvatarCustomization {
  morphs?: Readonly<Record<string, number>>;
  colors?: Readonly<Partial<Record<ColorChannel, string>>>;
}

/** An Avatar's final slider values and color plan, re-resolved once its viewer reports the slider keys and color
 *  channels of `model`, the model shown. A model reported with no channels, as a non-VRM one, gets no colors. */
export function useAvatarMorphs(look: LookStats, customization: AvatarCustomization | undefined, model: string | undefined): {
  morphs: Record<string, number>;
  colors: AvatarLook['colors'];
  onCatalog: (keys: readonly string[], channels?: readonly ColorChannel[]) => void;
} {
  const [reported, setReported] = useState<{ model: string | undefined; keys: readonly string[]; channels: readonly ColorChannel[] } | null>(null);
  const modelRef = useRef(model);
  modelRef.current = model;
  // Keys reported for another model don't apply to this one.
  const current = reported && reported.model === model ? reported : null;
  const resolved = useMemo(
    () => resolveAvatarLook({
      ...look, customization: customization?.morphs, colors: customization?.colors,
      catalog: current?.keys ?? null, channels: current?.channels ?? null,
    }),
    [look, customization?.morphs, customization?.colors, current],
  );
  const onCatalog = useCallback(
    (keys: readonly string[], channels: readonly ColorChannel[] = []) => setReported({ model: modelRef.current, keys, channels }),
    [],
  );
  return { morphs: resolved.morphs, colors: resolved.colors, onCatalog };
}

/** The slider values an entity's own stats drive on its model, for the turn on screen. */
export function useEntityStatMorphs(entity: Pick<Entity, 'id' | 'stats' | 'statGroups'> | undefined) {
  return useAvatarMorphs(useEntityLookStats(entity), undefined, entity?.id);
}
