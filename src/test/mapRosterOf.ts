import type { Connection } from '@/types';
import { computePresence, type PresenceInput } from '@/lib/presence';
import { mapReach, mapRoster, type MapRoster } from '@/lib/mapRoster';

type RosterInput = Omit<Partial<PresenceInput>, 'connections'> & Pick<PresenceInput, 'locations'> & {
  connections: readonly Connection[];
};

/** The Map roster the game builds for a state where the player stands at `at`. */
export function mapRosterOf(input: RosterInput, at: string | null): MapRoster {
  const presence = computePresence({
    entities: [], runtime: [], positions: {}, generics: {}, followers: [], persona: null, met: [],
    strangerAliases: {}, turns: [], ...input, locationId: at,
  });
  return mapRoster(presence.byId.values(), mapReach(at, input.locations, input.connections));
}
