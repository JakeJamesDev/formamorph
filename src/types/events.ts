/**
 * Timed server events — the community-wide happenings staff schedule (a contest, an announcement).
 * Named `ServerEvent` rather than `Event`, which is a DOM global: the collision compiles and misbehaves
 * silently (the `GameLocation` convention).
 */

/** The types this client renders extras for. Any other value is shown as a plain announcement. */
export type ServerEventType = 'contest' | 'announcement';

/**
 * Which half of an event's life a player is being shown: its opening, or its conclusion. Acknowledgment
 * is recorded per phase, so a player who acknowledged the start is still shown the ending.
 */
export type ServerEventPhase = 'start' | 'end';

/**
 * An event as `GET /api/events/active` serves it.
 *
 * `type` is deliberately a bare string: a server running ahead of this client may name a type it has
 * never heard of, and the banner and modal render from the generic fields either way.
 */
export interface ServerEvent {
  id: string;
  type: string;
  title: string;
  /** One line for the banner. */
  bannerText: string;
  /** The acknowledge modal's body. */
  body: string;
  /** Contests only: what entrants are agreeing to. */
  rulesText: string | null;
  startsAt: string;
  endsAt: string;
  cancelledAt: string | null;
  /** The pinned broadcast posted when the event opened; acknowledging marks it read. */
  startMessageId: string | null;
  /** The broadcast posted when the window closed. */
  endMessageId: string | null;
  /** Contests only: the broadcast naming the winner. */
  winnerMessageId: string | null;
  winnerWorldId: string | null;
  /** Snapshots taken at the pick, so the archive survives the world being deleted. */
  winnerName: string | null;
  winnerAuthorName: string | null;
}
