import { isEverywhere, type MovementChoice } from '@/lib/entityPresence';
import type { Entity } from '@/types';
import type { PickMode } from '@/lib/entityPicking';

/** The labels and help lines of the Presence, Movement and Known In controls, shared by every surface that
 *  shows them. */

export const MOVEMENT_LABEL: Record<MovementChoice, string> = {
  free: 'Free',
  stays: 'Stays Put',
  between: 'Moves Between Its Locations',
  follow: 'Can Follow the Player',
};

export const MOVEMENT_HELP: Record<MovementChoice, string> = {
  free: 'Keeps no position. It appears at every listed location and costs no AI request.',
  stays: 'Never leaves its location. Costs no AI request.',
  between: 'Moves one Connection at a time, only between its own locations',
  follow: 'Joins the player when the AI decides, then travels with them until it stays behind',
};

export const FOLLOW_EVERYWHERE_HELP = 'Adds a new entity with this name that travels with the player. This one stays at every listed location.';

/** The help line under `entity`'s Movement: Can Follow peels a new follower off an Everywhere Listed one. */
export const movementHelpFor = (entity: Entity): string => {
  const movement: MovementChoice = entity.movement ?? 'free';
  return movement === 'follow' && isEverywhere(entity) ? FOLLOW_EVERYWHERE_HELP : MOVEMENT_HELP[movement];
};

export const PRESENCE_OPTIONS = [
  { value: 'everywhere', label: 'Everywhere Listed' },
  { value: 'random', label: 'One, at Random' },
] as const;

export const PRESENCE_HELP = {
  everywhere: 'Puts it at every listed location at once',
  random: 'Places it at one of its locations at random in each new game',
} as const;

export const PERSONA_IGNORED_HELP = 'Ignored while the player plays this entity';

export type KnownInChoice = 'nearby' | 'nowhere' | 'picked';

export const KNOWN_IN_LABEL: Record<KnownInChoice, string> = {
  nearby: 'Nearby',
  nowhere: 'Nowhere',
  picked: 'Picked Locations',
};

export const KNOWN_IN_HELP: Record<KnownInChoice, string> = {
  nearby: 'Sends its summary to the AI one step away from where it is',
  nowhere: 'Sends it to the AI only at its own location',
  picked: 'Sends its summary to the AI anywhere inside the picked locations',
};

export const PICK_MODE_HELP: Record<PickMode, string> = {
  locations: 'Click a location to add it or remove it',
  knownIn: 'Click a location to pick it. A pick covers every location inside it.',
};
