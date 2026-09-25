import { isDefaultWorldId } from '@/lib/defaultWorlds';
import { worldPublishPayload, type PublishPayload } from '@/lib/publishPayload';
import type { World } from '@/types';

/** What the player reads when a bundled world they never changed is refused. */
export const BUNDLED_WORLD_REFUSAL = 'This is a bundled world. Edit it to make it your own, then publish.';

/** A world that may be published, with the payload ready, or one that may not, with the reason. */
export type WorldPublishAttempt =
  | { allowed: true; payload: PublishPayload }
  | { allowed: false; message: string };

/** The parts of a library world record the check reads. */
export interface WorldPublishTarget {
  id: string;
  dirty?: boolean;
  data: Omit<World, 'id'>;
}

/**
 * Judge one library world and, when it passes, build the payload that publishes it.
 *
 * Only a bundled world with no local edits is refused: every player already has it. A copy under a new id
 * passes here, because only the server fingerprints content.
 *
 * @param target - The selected library world
 * @returns The verdict, with a ready payload when it passed
 */
export function buildWorldPublish(target: WorldPublishTarget): WorldPublishAttempt {
  if (isDefaultWorldId(target.id) && !target.dirty) return { allowed: false, message: BUNDLED_WORLD_REFUSAL };
  return { allowed: true, payload: worldPublishPayload(target.data) };
}
