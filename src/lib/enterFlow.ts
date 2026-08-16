/**
 * Which screens the enter-world flow puts in front of the player, in order.
 *
 * Pure, so the sequencing rules read as rules rather than as a screen's state flags: which steps a world
 * earns depends on the world *and* on how the player is starting it.
 */

/** How the player is starting: the full setup flow, the Quick Start bypass, or resuming a save. */
export type EnterMode = 'newGame' | 'quickStart' | 'saveLoad';

/**
 * One screen of the flow. `intro` is the world's Introduction readme — an overlay over whatever setup
 * screen comes next rather than a screen of its own, which is why `navigableSteps` drops it.
 */
export type EnterStep = 'intro' | 'traits' | 'location' | 'characters' | 'dictionaries' | 'avatar';

/** The steps the player can actually step back to. */
export type NavigableStep = Exclude<EnterStep, 'intro'>;

/** What the selected world (and the player's library) offer the flow. */
export interface EnterFlowWorld {
  /** The world's Introduction readme, as authored. Blank/absent ⇒ no Introduction. */
  introReadme?: string;
  traitCount: number;
  startingLocationCount: number;
  hasCharacterStep: boolean;
  hasDictionaryStep: boolean;
  use3DModel: boolean;
}

/**
 * The flow for this world and mode. Quick Start and save loads bypass setup entirely, so both yield no
 * steps at all — including the Introduction, which is part of setup rather than part of the world.
 */
export function buildEnterFlow(world: EnterFlowWorld, mode: EnterMode): EnterStep[] {
  if (mode !== 'newGame') return [];
  const steps: EnterStep[] = [];
  if (world.introReadme?.trim()) steps.push('intro');
  if (world.traitCount > 0) steps.push('traits');
  if (world.startingLocationCount > 1) steps.push('location');
  if (world.hasCharacterStep) steps.push('characters');
  if (world.hasDictionaryStep) steps.push('dictionaries');
  if (world.use3DModel) steps.push('avatar');
  return steps;
}

/** The flow minus the Introduction — what the Back button walks, and what the first screen is. */
export const navigableSteps = (steps: EnterStep[]): NavigableStep[] =>
  steps.filter((step): step is NavigableStep => step !== 'intro');
