import { useMemo } from 'react';
import type { DiscoveredEntity, GroupStates } from '@/types';
import { useGameplay } from '@/contexts/GameplayContext';
import { useResolvedWorld } from '@/lib/useResolvedWorld';
import { computePresence, IN_SCENE_TURNS, type Presence } from '@/lib/presence';
import type { StrangerLabels } from '@/lib/locationContext';
import { discoveredAsEntities } from '@/lib/runtimeCharacters';
import { followerIds } from '@/lib/positionPlay';
import { recentSceneTurns } from '@/lib/turnDigest';
import { pageAssistantIndex } from '@/lib/turnHistory';

const NONE: readonly string[] = [];
const NO_RUNTIME: readonly DiscoveredEntity[] = [];
const NO_POSITIONS: Readonly<Record<string, string>> = {};
const NO_GROUPS: Readonly<GroupStates> = {};
const NO_ALIASES: StrangerLabels = {};

/**
 * The Presence for what the player is looking at. With `viewedPage` on an earlier page it reads that
 * turn's snapshot and the history up to that turn; otherwise the live state.
 */
export function usePresence(viewedPage?: number): Presence {
  const { authoredCast, locations, connections, persona, currentLocation } = useResolvedWorld();
  const {
    gameStates, fullMessageHistory, totalPages, discoveredEntities,
    entityPositions, groupStates, entityFollowers, metEntities, strangerAliases,
  } = useGameplay();

  const snapshot = viewedPage !== undefined && viewedPage < totalPages ? (gameStates[viewedPage - 1] ?? null) : null;
  const history = useMemo(
    () => (snapshot && viewedPage !== undefined
      ? fullMessageHistory.slice(0, pageAssistantIndex(viewedPage, 2) + 1)
      : fullMessageHistory),
    [snapshot, viewedPage, fullMessageHistory],
  );
  const runtimeSource = snapshot ? (snapshot.discoveredEntities ?? NO_RUNTIME) : discoveredEntities;
  const runtime = useMemo(() => discoveredAsEntities(runtimeSource), [runtimeSource]);
  const positions = snapshot ? (snapshot.entityPositions ?? NO_POSITIONS) : entityPositions;
  const groups = snapshot ? (snapshot.groupStates ?? NO_GROUPS) : groupStates;
  const followers = useMemo(
    () => (snapshot ? followerIds(snapshot.individualStates ?? {}) : entityFollowers), [snapshot, entityFollowers],
  );
  const met = snapshot ? (snapshot.metEntities ?? NONE) : metEntities;
  const aliases = snapshot ? (snapshot.strangerAliases ?? NO_ALIASES) : strangerAliases;
  // A snapshot from an older save carries no location; the live one stands in, as the viewed location does.
  const locationId = snapshot?.locationId ?? currentLocation?.id;
  const personaEntity = persona?.entity ?? null;

  return useMemo(() => computePresence({
    entities: authoredCast, runtime, positions, groups, followers, locationId, locations, connections,
    persona: personaEntity, met, strangerAliases: aliases,
    turns: recentSceneTurns(history, IN_SCENE_TURNS),
  }), [authoredCast, runtime, positions, groups, followers, locationId, locations, connections, personaEntity, met, aliases, history]);
}
