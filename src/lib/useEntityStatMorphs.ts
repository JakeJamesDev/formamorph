import { useCallback, useMemo, useRef, useState } from 'react';
import { useGameplay } from '@/contexts/GameplayContext';
import { resolveAvatarLook, type LookStats } from '@/lib/avatarLook';
import type { Entity } from '@/types';

const NO_STATS: LookStats['stats'] = [];

/** The stats an entity's own Avatar reads, for the turn on screen: live, or paged back. */
export function useEntityLookStats(entity: Pick<Entity, 'id' | 'stats'> | undefined): LookStats {
  const { viewEntityStats, viewEntityStatEnabled } = useGameplay();
  const values = entity ? viewEntityStats[entity.id] : undefined;
  const enabled = entity ? viewEntityStatEnabled[entity.id] : undefined;
  const authored = entity?.stats;
  return useMemo(() => ({ stats: values ?? NO_STATS, authored: authored ?? NO_STATS, enabled }), [values, authored, enabled]);
}

/** An Avatar's final slider values, re-resolved once its viewer reports the slider keys of `model`, the model shown. */
export function useAvatarMorphs(look: LookStats, customization: Readonly<Record<string, number>> | undefined, model: string | undefined): {
  morphs: Record<string, number>;
  onCatalog: (keys: readonly string[]) => void;
} {
  const [reported, setReported] = useState<{ model: string | undefined; keys: readonly string[] } | null>(null);
  const modelRef = useRef(model);
  modelRef.current = model;
  // Keys reported for another model don't apply to this one.
  const catalog = reported && reported.model === model ? reported.keys : null;
  const morphs = useMemo(
    () => resolveAvatarLook({ ...look, customization, catalog }).morphs,
    [look, customization, catalog],
  );
  const onCatalog = useCallback((keys: readonly string[]) => setReported({ model: modelRef.current, keys }), []);
  return { morphs, onCatalog };
}

/** The slider values an entity's own stats drive on its model, for the turn on screen. */
export function useEntityStatMorphs(entity: Pick<Entity, 'id' | 'stats'> | undefined) {
  return useAvatarMorphs(useEntityLookStats(entity), undefined, entity?.id);
}
