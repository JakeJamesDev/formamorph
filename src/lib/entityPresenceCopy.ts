import type { PickMode } from '@/lib/entityPicking';

/** The labels and help lines of the Known In control and the canvas pick modes, shared by every surface that
 *  shows them. */

export type KnownInChoice = 'nearby' | 'nowhere' | 'picked';

export const KNOWN_IN_LABEL: Record<KnownInChoice, string> = {
  nearby: 'Nearby',
  nowhere: 'Nowhere',
  picked: 'Picked Locations',
};

export const KNOWN_IN_HELP: Record<KnownInChoice, string> = {
  nearby: 'Sends its summary to the AI one location away from where it is',
  nowhere: 'Sends it to the AI only at its own location',
  picked: 'Sends its summary to the AI anywhere inside the picked locations',
};

export const PICK_MODE_HELP: Record<PickMode, string> = {
  locations: 'Click a location to add it or remove it',
  knownIn: 'Click a location to pick it. A pick covers every location inside it.',
};

export const PICK_START_HELP = 'Click a location to make it where the entity starts';
