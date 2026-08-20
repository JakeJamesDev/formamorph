/**
 * DEV-only stand-in for the world the publish modal would otherwise be opened on from a library card.
 * Dynamically imported by `#dev?view=mainMenu&modal=publish`, so the publish dialog — and the contest
 * opt-in inside it — is reachable on a profile with nothing published and no contest really running.
 */
import type { PublishPayload } from '@/lib/publishPayload';

/** A canned world payload: the fields the dialog actually reads, and nothing it doesn't. */
export function devPublishPayload(): PublishPayload {
  return {
    kind: 'world',
    name: 'The Long Thaw',
    description: 'A valley coming out of a winter that lasted a generation.',
    contentData: { worldOverview: { name: 'The Long Thaw', tags: ['Fantasy'] } },
    tags: ['Fantasy'],
  };
}
