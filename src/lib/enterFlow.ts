/**
 * Which screens the enter-world flow puts in front of the player, in order.
 *
 * Pure, so the sequencing rules read as rules rather than as a screen's state flags: which steps a world
 * earns depends on the world *and* on how the player is starting it.
 */

import { customPersonaEntity } from './blueprints';
import { entityAvatarInUse, playedVrmAs, playedVrmPick, type PickedEntity, type VrmContext } from './vrmResolver';
import type { Entity, PersonaRef, VrmPick, WorldOverview } from '@/types';

/** How the player is starting: the full setup flow, the Quick Start bypass, or resuming a save. */
export type EnterMode = 'newGame' | 'quickStart' | 'saveLoad';

/**
 * One screen of the flow. `intro` is the world's Introduction readme — an overlay over whatever setup
 * screen comes next rather than a screen of its own, which is why `navigableSteps` drops it.
 */
export type EnterStep = 'intro' | 'workspace' | 'avatar';

/** The steps the player can actually step back to. */
export type NavigableStep = Exclude<EnterStep, 'intro'>;

/** What the selected world (and the player's library) offer the flow. */
export interface EnterFlowWorld {
  /** The world's Introduction readme, as authored. Blank/absent ⇒ no Introduction. */
  introReadme?: string;
  traitCount: number;
  startingLocationCount: number;
  hasLibraryAdditions: boolean;
  /** The world has entities the player can play as. */
  hasWorldPersonas: boolean;
  /** The world has a Custom Persona, whose fields only the workspace offers. */
  hasCustomPersona: boolean;
  /** The draft persona's played side shows an Avatar. */
  showsAvatar: boolean;
}

/** What world entry reads to place the draft persona's Avatar. */
export interface EntryVrmInput {
  persona: PersonaRef;
  /** The library persona's record, once loaded. Before that it has no pick. */
  libraryPersona: Pick<Entity, 'id' | 'vrmPick'> | undefined;
  entities: readonly Entity[];
  overview: Pick<WorldOverview, 'vrmStore' | 'legacyVrmFallback'> | undefined;
  /** The ids in the player's Avatar library. Absent while the read runs, when the pick counts as showing. */
  libraryIds?: ReadonlySet<string>;
}

/**
 * The pick the draft persona's played side lands on: none skips the avatar step, User's Default offers the
 * picker, and a world or library pick shows that Avatar as set. A library pick that is gone acts as User's
 * Default, and an empty library leaves User's Default with no Avatar, so the step is skipped.
 */
export function entryVrmPick(input: EntryVrmInput): VrmPick | undefined {
  const { libraryIds } = input;
  const pick = playedVrmPick(entryVrmContext(input));
  if (!pick || pick.kind === 'world' || !libraryIds) return pick;
  if (pick.kind === 'library' && libraryIds.has(pick.id)) return pick;
  return libraryIds.size ? { kind: 'default' } : undefined;
}

/** The resolver's context at world entry: the draft persona played, the world's store, no save yet. */
export function entryVrmContext(
  { persona, libraryPersona, entities, overview, libraryIds, deviceDefault }: EntryVrmInput & { deviceDefault?: string },
): VrmContext {
  const entity = persona.source === 'library' ? libraryPersona ?? { id: persona.entityId }
    : persona.source === 'world' ? entities.find((e) => e.id === persona.entityId)
    : undefined;
  return {
    store: overview?.vrmStore,
    libraryIds,
    deviceDefault,
    played: playedVrmAs(entity && persona.source !== 'none' ? { source: persona.source, entity } : null),
    customPersona: customPersonaEntity(entities),
    legacyFallback: overview?.legacyVrmFallback,
  };
}

/** What trait selection reads for an owner's Avatar icon. */
export interface EntryAvatarInput extends EntryVrmInput {
  libraryCast: readonly PickedEntity[];
  deviceDefault?: string;
}

/** Whether an owner's Avatar is in use at world entry. The played side (`null`, the persona, the Custom Persona
 *  under None) wears the draft persona's; a cast entity wears its own pick, resolved as the game resolves it. */
export function entryAvatarInUse(ownerId: string | null, input: EntryAvatarInput): boolean {
  const { persona, entities, libraryCast } = input;
  const played = ownerId === null
    || (persona.source !== 'none' && persona.entityId === ownerId)
    || (persona.source === 'none' && customPersonaEntity(entities)?.id === ownerId);
  if (played) return !!entryVrmPick(input);
  const entity = [...entities, ...libraryCast].find((e) => e.id === ownerId);
  return !!entity && entityAvatarInUse(entity, entryVrmContext(input));
}

/**
 * The flow for this world and mode. Quick Start and save loads bypass setup entirely, so both yield no
 * steps at all — including the Introduction, which is part of setup rather than part of the world.
 */
export function buildEnterFlow(world: EnterFlowWorld, mode: EnterMode): EnterStep[] {
  if (mode !== 'newGame') return [];
  const steps: EnterStep[] = [];
  if (world.introReadme?.trim()) steps.push('intro');
  if (
    world.traitCount > 0
    || world.startingLocationCount > 1
    || world.hasLibraryAdditions
    || world.hasWorldPersonas
    || world.hasCustomPersona
  ) steps.push('workspace');
  if (world.showsAvatar) steps.push('avatar');
  return steps;
}

/** The flow minus the Introduction — what the Back button walks, and what the first screen is. */
export const navigableSteps = (steps: EnterStep[]): NavigableStep[] =>
  steps.filter((step): step is NavigableStep => step !== 'intro');
