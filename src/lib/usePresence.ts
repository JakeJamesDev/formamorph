import { useMemo } from 'react';
import { useGameplay } from '@/contexts/GameplayContext';
import { useResolvedWorld } from '@/lib/useResolvedWorld';
import { computePresence, IN_SCENE_TURNS, type Presence } from '@/lib/presence';
import { recentSceneTurns } from '@/lib/turnDigest';
import { pageAssistantIndex } from '@/lib/turnHistory';

const NONE: readonly string[] = [];
const NO_ALIASES: Readonly<Record<string, string>> = {};

/**
 * The Presence for what the player is looking at. With `viewedPage` on an earlier page it reads that
 * turn's snapshot and the history up to that turn; otherwise the live state.
 */
export function usePresence(viewedPage?: number): Presence {
  const { authoredCast, locations, connections, persona, currentLocation } = useResolvedWorld();
  const {
    gameStates, fullMessageHistory, totalPages, discoveredEntities,
    entityPositions, entityFollowers, metEntities, strangerAliases,
  } = useGameplay();

  const snapshot = viewedPage !== undefined && viewedPage < totalPages ? (gameStates[viewedPage - 1] ?? null) : null;
  const history = useMemo(
    () => (snapshot && viewedPage !== undefined
      ? fullMessageHistory.slice(0, pageAssistantIndex(viewedPage, 2) + 1)
      : fullMessageHistory),
    [snapshot, viewedPage, fullMessageHistory],
  );
  const runtimeSource = snapshot ? (snapshot.discoveredEntities ?? []) : discoveredEntities;
  const runtime = useMemo(() => runtimeSource.map((d) => d.entity), [runtimeSource]);
  const positions = snapshot ? (snapshot.entityPositions ?? {}) : entityPositions;
  const followers = snapshot ? (snapshot.entityFollowers ?? NONE) : entityFollowers;
  const met = snapshot ? (snapshot.metEntities ?? NONE) : metEntities;
  const aliases = snapshot ? (snapshot.strangerAliases ?? NO_ALIASES) : strangerAliases;
  const locationId = snapshot ? snapshot.locationId : currentLocation?.id;
  const personaEntity = persona?.entity ?? null;

  return useMemo(() => computePresence({
    entities: authoredCast, runtime, positions, followers, locationId, locations, connections,
    persona: personaEntity, met, strangerAliases: aliases,
    turns: recentSceneTurns(history, IN_SCENE_TURNS),
  }), [authoredCast, runtime, positions, followers, locationId, locations, connections, personaEntity, met, aliases, history]);
}
