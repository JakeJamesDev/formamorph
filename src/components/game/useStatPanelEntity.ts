import { useMemo } from 'react';
import { useGameplay } from '@/contexts/GameplayContext';
import { useResolvedWorld } from '@/lib/useResolvedWorld';
import { usePresence } from '@/lib/usePresence';
import { personaEntities } from '@/lib/entityStats';
import { shownEntityStats, statPanelOptions, statPanelSelection } from '@/lib/statPanelEntities';
import { withTraitToggles, type OwnerStatTraits } from '@/lib/statOwners';
import type { Entity, PlayerStat, Stat, StatGroup } from '@/types';
import { usePlayAvatars } from '@/lib/usePlayAvatars';

/** One owner's stats as the panel lays them out: its visible rows, placed by its authored stats and groups. */
export interface StatPanelOwner {
  entity: Entity;
  stats: Stat[];
  groups: StatGroup[];
  rows: PlayerStat[];
}

const ownerOf = (entity: Entity, values: Readonly<Record<string, readonly PlayerStat[]>>): StatPanelOwner =>
  ({ entity, stats: entity.stats ?? [], groups: entity.statGroups ?? [], rows: shownEntityStats(values[entity.id]) });

/**
 * The entity the in-game stat panel shows below the player's stats: who the picker lists, which one is shown,
 * and that entity's visible stat rows. With no pick it reads the entity view's own fallback, so both places
 * open on the same entity. The entities the player plays as list in `players`, whose rows join the player's;
 * picking one shows no entity section. `showPicker` is false when no other listed entity has a stat the
 * player can see. `inForce` gives each entity's stat traits in force on the viewed turn, which switch its
 * stats on and off.
 */
export function useStatPanelEntity(inForce: OwnerStatTraits) {
  const { viewEntityStats, currentPage, isViewingPast, selectedEntityId, personaRef } = useGameplay();
  const { persona, traitEntities } = useResolvedWorld();
  const { inScene } = usePresence(isViewingPast ? currentPage : undefined);
  const values = useMemo(() => withTraitToggles(viewEntityStats, inForce), [viewEntityStats, inForce]);
  const played = useMemo(() => personaEntities(persona?.entity, traitEntities, personaRef), [persona, traitEntities, personaRef]);
  const options = useMemo(
    () => statPanelOptions({ persona: persona?.entity ?? null, scene: inScene }),
    [persona, inScene],
  );
  const { shows } = usePlayAvatars();
  const firstShown = inScene.find((p) => shows(p.entity))?.entity.id;
  const shownId = statPanelSelection(selectedEntityId, options, firstShown);
  const playedIds = new Set(played.map((entity) => entity.id));
  const shownPresence = shownId && !playedIds.has(shownId) ? inScene.find((p) => p.entity.id === shownId) : undefined;
  // A stranger's section reads its label wherever its name would show.
  const shownEntity = shownPresence && (shownPresence.met || !shownPresence.label
    ? shownPresence.entity : { ...shownPresence.entity, name: shownPresence.label });
  return {
    options,
    shown: options.find((option) => option.id === shownId),
    // The shown entity's own section; none for (None) or an entity the player plays as.
    section: shownEntity ? ownerOf(shownEntity, values) : null,
    players: played.map((entity) => ownerOf(entity, values)),
    showPicker: options.some((option) => !playedIds.has(option.id) && shownEntityStats(values[option.id]).length > 0),
  };
}
