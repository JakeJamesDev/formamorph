import { useEffect, useRef, useState } from 'react';
import ModelStorageService from '@/services/ModelStorageService';
import { useGameData } from '@/contexts/GameDataContext';
import { useGameplay } from '@/contexts/GameplayContext';
import { seededCharacterData } from '@/lib/legacyVrm';
import { playVrmContext, resolvePlayedVrm } from '@/lib/vrmResolver';
import type { ResolvedPersona } from '@/lib/persona';

/** The ids in the Avatar library, read once per mount. `undefined` until the read settles. */
export function useLibraryIds(): ReadonlySet<string> | undefined {
  const [ids, setIds] = useState<ReadonlySet<string>>();
  useEffect(() => {
    let cancelled = false;
    ModelStorageService.getModelMetadata().catch(() => []).then((models) => {
      if (!cancelled) setIds(new Set(models.map((m) => m.id)));
    });
    return () => { cancelled = true; };
  }, []);
  return ids;
}

/** An empty library, for a resolve that must not wait on the library read. */
export const NO_LIBRARY: ReadonlySet<string> = new Set();

/**
 * After each save load, once the persona has resolved, seed default customization for a save that holds
 * none while its played side shows an Avatar. Whether it shows one never depends on the library list.
 */
export function useSeedAvatarOnSaveLoad(loads: number, ready: boolean, persona: ResolvedPersona | null): void {
  const { entities, worldOverview } = useGameData();
  const { characterData, setCharacterData } = useGameplay();
  const seededLoads = useRef(loads);
  useEffect(() => {
    if (!ready || loads === seededLoads.current) return;
    seededLoads.current = loads;
    const shows = !!resolvePlayedVrm(playVrmContext({
      persona, entities, overview: worldOverview, characterData, libraryIds: NO_LIBRARY, deviceDefault: undefined,
    }));
    const seeded = seededCharacterData(characterData, shows);
    if (seeded !== characterData) setCharacterData(seeded);
  }, [loads, ready, persona, entities, worldOverview, characterData, setCharacterData]);
}
