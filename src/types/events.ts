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
  /**
   * The acknowledge modal's body. Absent — not null — on a row from a slim list, which is how a reader
   * knows to fetch the event in full before showing prose.
   */
  body?: string;
  /** Contests only: what entrants are agreeing to. Absent on a slim row; null when there are none. */
  rulesText?: string | null;
  /**
   * The organizer's color for the poster's header band, as a hex string. Absent on a server that has not
   * deployed the styling fields yet, which is why every reader goes through `posterStyle`.
   */
  posterColor?: string | null;
  /** The band's artwork, as the server's root-relative path. */
  posterImageUrl?: string | null;
  startsAt: string;
  endsAt: string;
  cancelledAt: string | null;
  /** The pinned broadcast posted when the event opened; acknowledging marks it read. */
  startMessageId: string | null;
  /** The broadcast posted when the window closed. */
  endMessageId: string | null;
  /** Contests only: the broadcast naming the podium. */
  winnerMessageId: string | null;
  /**
   * Contests only: when the results were announced, which is what makes a contest decided. Not any one
   * place existing — an announced podium stays editable, and a contest must not un-decide mid-correction.
   */
  resultsAnnouncedAt: string | null;
  /** Contests only: the podium, gold first. Empty until the results are announced. */
  placements: EventPlacement[];
}

/** Which step of the podium a world is on. Three, and no ties — see the contest podium spec. */
export type ContestPlace = 1 | 2 | 3;

/**
 * One step of a contest's podium.
 *
 * `worldId` is null once the listing is gone, which is exactly why the two names are snapshots rather
 * than a lookup: the archive has to still read after a placed world is deleted.
 */
export interface EventPlacement {
  place: ContestPlace;
  worldId: string | null;
  worldName: string;
  authorName: string;
}

/**
 * The authored half of an event, as the admin form sends it.
 *
 * The window is written as ISO instants, which is the only format the server compares reliably. An edit
 * sends the same shape: the server reads only what changed, so a field left out is a field left alone.
 */
export interface ServerEventDraft {
  type: ServerEventType;
  title: string;
  bannerText: string;
  body: string;
  /** Contests only; null clears it. */
  rulesText: string | null;
  /** The poster band's color as `#rrggbb`; null restores the default band. */
  posterColor: string | null;
  /**
   * The band's artwork as a data URI, which the server stores as a file. Null clears whatever is there;
   * omitting the key on an edit leaves the stored image alone.
   */
  posterImage: string | null;
  startsAt: string;
  endsAt: string;
}
