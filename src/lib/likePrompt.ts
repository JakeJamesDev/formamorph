/**
 * When a playthrough has earned the right to ask for a like, and which listing to ask about.
 *
 * A player who downloads a world plays it in the app and rarely returns to its listing, so the listing
 * looks unloved however much the world is played. This decides when to ask, once, inside the game.
 *
 * Pure on purpose: the trigger reads a stored world record, a turn count, the network state and what this
 * device has already been asked, and every one of those is a value the caller already holds.
 */
import { isDefaultWorldId } from './defaultWorlds';

/** How many turns a playthrough runs before the prompt is due. */
export const LIKE_PROMPT_TURNS = 15;

/** The part of a stored world record the question is decided from. */
export interface LikePromptWorld {
  /** The local record's id. A bundled world's id is its seed id, which is what marks it bundled. */
  id: string;
  /** The listing this copy was downloaded from. Absent on an authored or imported world. */
  sourceId?: string;
  /** When this copy was downloaded. Absent on a copy that reached the library another way. */
  downloadedAt?: string;
}

/**
 * The listing to ask this player about, or null to ask nothing.
 *
 * A non-null answer means show the prompt. Every rule that returns null is a reason a like could not be
 * given or would not be wanted: nothing to like, a world that ships with the app, a listing this device
 * has already answered for, too little play to have an opinion, and no network to send the like over.
 *
 * Being above the threshold rather than exactly on it is what lets a save loaded past it ask on its next
 * turn instead of on load: the caller runs this on a committed turn, never on a restore.
 *
 * @param input - The world being played, its turn count, whether the browser reports a connection, and
 *   the listing ids this device has already been asked about
 */
export function listingToAskAbout(input: {
  world: LikePromptWorld | null;
  turns: number;
  online: boolean;
  prompted: ReadonlySet<string>;
}): string | null {
  const { world, turns, online, prompted } = input;
  if (!world) return null;

  const listingId = world.sourceId;
  if (!listingId || !world.downloadedAt) return null;
  if (isDefaultWorldId(world.id)) return null;
  if (prompted.has(listingId)) return null;
  if (turns < LIKE_PROMPT_TURNS) return null;
  if (!online) return null;

  return listingId;
}
