import { randomUUID } from '@/lib/uuid';
import type { Connection, ConnectionLeg, GameLocation, LegKey } from '@/types';
import { isTwoWay, otherLeg } from '@/lib/locationGraph';

/**
 * Editing Connections from one end of them.
 *
 * A Connection is a single world-level record, but an author meets it twice — once on each location's
 * panel. These functions translate between the record's own `a`/`b` legs and the direction it reads as at
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
  return connection.a === locationId ? connection.b : connection.a;
}

/** The leg that leaves `locationId`. */
export function legFrom(connection: Connection, locationId: string): LegKey {
  return connection.a === locationId ? 'aToB' : 'bToA';
}

/** The record with exactly the given legs; an absent leg leaves no key behind. */
function withLegs(connection: Connection, legs: Partial<Record<LegKey, ConnectionLeg>>): Connection {
  const { aToB: _aToB, bToA: _bToA, ...rest } = connection;
  return {
    ...rest,
    ...(legs.aToB ? { aToB: legs.aToB } : {}),
    ...(legs.bToA ? { bToA: legs.bToA } : {}),
  };
}

/** Which way travel runs from `locationId` — the only thing about a Connection that differs by end. */
export function directionFrom(connection: Connection, locationId: string): ConnectionDirection {
  if (isTwoWay(connection)) return 'two-way';
  return connection[legFrom(connection, locationId)] ? 'outgoing' : 'incoming';
}

/**
 * The record rewritten so it reads as `direction` from `locationId`. Each hint stays with its leg. A one-way
 * direction keeps only the leg that runs that way, moving the single leg across on a flip; a new return leg
 * copies the existing leg's hint. `a` and `b` never change.
 */
export function withDirection(
  connection: Connection,
  locationId: string,
  direction: ConnectionDirection,
): Connection {
  const out = legFrom(connection, locationId);
  const back = otherLeg(out);
  const existing = connection[out] ?? connection[back] ?? {};
  if (direction === 'two-way') {
    return withLegs(connection, { [out]: connection[out] ?? existing, [back]: connection[back] ?? existing });
  }
  const kept = direction === 'outgoing' ? out : back;
  return withLegs(connection, { [kept]: connection[kept] ?? existing });
}

/** The record with a new hint on one leg. A hint that is blank or only spaces drops the field rather than
 *  storing it, so an exported world has one shape for "no hint" instead of three. A missing leg stays missing. */
export function withHint(connection: Connection, leg: LegKey, hint: string): Connection {
  const current = connection[leg];
  if (!current) return connection;
  const { hint: _old, ...rest } = current;
  return { ...connection, [leg]: hint.trim() ? { ...rest, hint } : rest };
}

/** Whether a Connection opens with its hints linked: both legs exist and carry the same hint, where two
 *  absent hints count as the same. The link itself is never stored; this is how it is read back. */
export function hintsLinked(connection: Connection): boolean {
  return !!connection.aToB && !!connection.bToA && connection.aToB.hint === connection.bToA.hint;
}

/** The record with the `first` leg's hint written into the other leg. A one-way record has nothing to link. */
export function withLink(connection: Connection, first: LegKey): Connection {
  return withHint(connection, otherLeg(first), connection[first]?.hint ?? '');
}

/** The record with `text` written back into the leg after `first`. The caller holds the text the link replaced. */
export function withUnlink(connection: Connection, first: LegKey, text: string): Connection {
  return withHint(connection, otherLeg(first), text);
}

/** Every Connection touching `locationId`, each turned into the view that location sees. A self-link is
 *  left out: it has no partner to name and reaches nowhere. */
export function connectionsAt(locationId: string, connections: Connection[]): ConnectionView[] {
  const views: ConnectionView[] = [];
  for (const connection of connections) {
    if (connection.a === connection.b) continue;
    if (connection.a !== locationId && connection.b !== locationId) continue;
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
  return { id: randomUUID(), a: fromId, b: toId, aToB: {}, bToA: {} };
}
