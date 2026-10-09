/**
 * Tells the other tabs on this origin that a stored world was written or deleted, and hears them tell this one.
 * A tab never hears its own changes: its posts and its listeners share one channel, and a channel skips its own posts.
 */

export const WORLD_CHANGE_CHANNEL = 'formamorph.worldChanged';

export type WorldChange = 'saved' | 'deleted';
type Listener = (worldId: string, change: WorldChange) => void;
const listeners = new Set<Listener>();
// Open only while something listens, so an idle tab holds no channel.
let channel: BroadcastChannel | null = null;

const supported = () => typeof BroadcastChannel !== 'undefined';

function openChannel(): BroadcastChannel {
  const opened = new BroadcastChannel(WORLD_CHANGE_CHANNEL);
  opened.onmessage = (event: MessageEvent<unknown>) => {
    const data = event.data as { worldId?: unknown; deleted?: unknown } | null;
    if (typeof data?.worldId !== 'string') return;
    const change: WorldChange = data.deleted === true ? 'deleted' : 'saved';
    for (const listener of [...listeners]) listener(data.worldId, change);
  };
  return opened;
}

function post(message: { worldId: string; deleted?: true }): void {
  if (!supported() || !message.worldId) return;
  if (channel) {
    channel.postMessage(message);
    return;
  }
  // Nothing listens here, so a short-lived channel posts; the message is queued before it closes.
  const once = new BroadcastChannel(WORLD_CHANGE_CHANNEL);
  once.postMessage(message);
  once.close();
}

/** Tells the other tabs that `worldId` was written to world storage. */
export const announceWorldSaved = (worldId: string): void => post({ worldId });

/** Tells the other tabs that `worldId` was deleted from world storage. */
export const announceWorldDeleted = (worldId: string): void => post({ worldId, deleted: true });

/** Calls `listener` with each world id another tab writes or deletes. Returns the unsubscribe. */
export function onWorldChangedElsewhere(listener: Listener): () => void {
  if (!supported()) return () => {};
  listeners.add(listener);
  channel ??= openChannel();
  return () => {
    listeners.delete(listener);
    if (listeners.size > 0 || !channel) return;
    channel.close();
    channel = null;
  };
}
