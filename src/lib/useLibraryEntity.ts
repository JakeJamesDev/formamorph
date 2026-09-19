import { useEffect, useState } from 'react';
import EntityStorageService from '@/services/EntityStorageService';
import type { Entity } from '@/types';

/**
 * A live read of one library entity: read when `id` changes and again whenever the library writes it.
 * `entity` is null when the library does not hold it; `pending` is true until the first read lands.
 */
export function useLibraryEntity(id: string | null): { entity: Entity | null; pending: boolean } {
  // `id` records which read landed, so a read still in flight is not mistaken for a missing entity.
  const [read, setRead] = useState<{ id: string; entity: Entity | null } | null>(null);
  useEffect(() => {
    if (!id) return;
    let mounted = true;
    const load = () => EntityStorageService.getEntityData(id).then(
      (entity) => { if (mounted) setRead({ id, entity }); },
      () => { if (mounted) setRead({ id, entity: null }); },
    );
    void load();
    const unsubscribe = EntityStorageService.subscribe((changed) => { if (changed === id) void load(); });
    return () => { mounted = false; unsubscribe(); };
  }, [id]);
  const landed = id !== null && read?.id === id ? read : null;
  return { entity: landed?.entity ?? null, pending: id !== null && landed === null };
}
