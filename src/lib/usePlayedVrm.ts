import { useEffect, useMemo, useRef, useState } from 'react';
import ModelStorageService from '@/services/ModelStorageService';
import { useGameData } from '@/contexts/GameDataContext';
import { useGameplay } from '@/contexts/GameplayContext';
import { readUserDefaultAvatar } from '@/lib/defaultAvatar';
import { seededCharacterData } from '@/lib/legacyVrm';
import { playVrmContext, resolvePlayedVrm, type VrmSource } from '@/lib/vrmResolver';
import type { CharacterData } from '@/types';
import type { ResolvedPersona } from '@/lib/persona';

/** The ids in the Avatar library, read once per mount. `undefined` until the read settles. */
function useLibraryIds(): ReadonlySet<string> | undefined {
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

/** The played side's Avatar in this playthrough. `resolving` holds while the library list loads, so a library
 *  pick does not flash the bundled file first. */
export function usePlayedVrm(
  persona: ResolvedPersona | null, characterData: CharacterData | null,
): { source: VrmSource | undefined; resolving: boolean } {
  const { entities, worldOverview } = useGameData();
  const libraryIds = useLibraryIds();
  const deviceDefault = useMemo(readUserDefaultAvatar, []);
  const source = useMemo(() => libraryIds && resolvePlayedVrm(playVrmContext({
    persona, entities, overview: worldOverview, characterData, libraryIds, deviceDefault,
  })), [persona, entities, worldOverview, characterData, libraryIds, deviceDefault]);
  return { source: source || undefined, resolving: !libraryIds };
}

const NO_LIBRARY: ReadonlySet<string> = new Set();

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
