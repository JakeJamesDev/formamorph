import type { Connection, Entity, GameLocation } from '@/types';

/** The authored lists the gates read. */
export interface InPlaySource {
  entities: readonly Entity[];
  locations: readonly GameLocation[];
  connections: readonly Connection[];
}

/** The playthrough state the gates read. */
export interface InPlayState {
  /** The entity the player plays, which is always on. */
  playedEntityId?: string | null;
}

/** What the gates decided: the ids switched off and the locations locked. */
export interface GateVerdicts {
  offEntityIds: ReadonlySet<string>;
  offLocationIds: ReadonlySet<string>;
  lockedLocationIds: ReadonlySet<string>;
}

const NONE: ReadonlySet<string> = new Set();
const ALL_OPEN: GateVerdicts = { offEntityIds: NONE, offLocationIds: NONE, lockedLocationIds: NONE };

/** Every Enabled and Lock gate in the world, evaluated. Worlds carry none, so all are on and open. */
export function evaluateGates(_source: InPlaySource, _state: InPlayState): GateVerdicts {
  return ALL_OPEN;
}
