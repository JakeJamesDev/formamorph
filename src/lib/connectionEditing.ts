import { randomUUID } from '@/lib/uuid';
import type { Connection, GameLocation } from '@/types';

/**
 * Editing Connections from one end of them.
 *
 * A Connection is a single world-level record, but an author meets it twice — once on each location's
 * panel. These functions translate between the record's own `from`/`to` and the direction it reads as at
 * the location being edited, so both panels can show and change the same record without either owning it.
 */

/** A Connection's direction as seen from one of its ends: travel leaves here, arrives here, or both. */
export type ConnectionDirection = 'two-way' | 'outgoing' | 'incoming';

/** One Connection, viewed from a location: who it links to, and which way travel runs from here. */
export interface ConnectionView {
  connection: Connection;
  partnerId: string;
  direction: ConnectionDirection;
}

/** The other end of a Connection from where the author is standing. */
function partnerOf(connection: Connection, locationId: string): string {
  return connection.from === locationId ? connection.to : connection.from;
}

/** Which way travel runs from `locationId` — the only thing about a Connection that differs by end. */
export function directionFrom(connection: Connection, locationId: string): ConnectionDirection {
  if (connection.twoWay) return 'two-way';
  return connection.from === locationId ? 'outgoing' : 'incoming';
}

/**
 * The record rewritten so it reads as `direction` from `locationId`. A one-way direction rewrites the
 * endpoints rather than adding a flag, which is what makes flipping orientation and toggling two-way the
 * same gesture; id and hint survive both.
 */
export function withDirection(
  connection: Connection,
  locationId: string,
  direction: ConnectionDirection,
): Connection {
  if (direction === 'two-way') return { ...connection, twoWay: true };
  const partnerId = partnerOf(connection, locationId);
  const [from, to] = direction === 'outgoing' ? [locationId, partnerId] : [partnerId, locationId];
  return { ...connection, from, to, twoWay: false };
}

/** Every Connection touching `locationId`, each turned into the view that location sees. A self-link is
 *  left out: it has no partner to name and reaches nowhere. */
export function connectionsAt(locationId: string, connections: Connection[]): ConnectionView[] {
  const views: ConnectionView[] = [];
  for (const connection of connections) {
    if (connection.from === connection.to) continue;
    if (connection.from !== locationId && connection.to !== locationId) continue;
    views.push({
      connection,
      partnerId: partnerOf(connection, locationId),
      direction: directionFrom(connection, locationId),
    });
  }
  return views;
}

/** The locations still available to connect to: everywhere but here and the partners already linked, so a
 *  pair never collects two records that would each claim to be its whole travel rule. */
export function connectionTargets(
  locationId: string,
  locations: GameLocation[],
  connections: Connection[],
): GameLocation[] {
  const taken = new Set(connectionsAt(locationId, connections).map((v) => v.partnerId));
  return locations.filter((l) => l.id !== locationId && !taken.has(l.id));
}

/** A new Connection out of `fromId`, two-way — the common case needs no follow-up click. */
export function createConnection(fromId: string, toId: string): Connection {
  return { id: randomUUID(), from: fromId, to: toId, twoWay: true };
}
