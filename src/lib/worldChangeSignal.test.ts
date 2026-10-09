import { afterEach, describe, expect, it, vi } from 'vitest';
import { announceWorldDeleted, announceWorldSaved, onWorldChangedElsewhere, WORLD_CHANGE_CHANNEL } from './worldChangeSignal';

/**
 * A stored world's write or delete is heard in every other tab on the origin, never in the tab that made it. Another
 * tab is a second channel on the same name, which is what a second tab's copy of this module opens.
 */

const opened: BroadcastChannel[] = [];
/** Another tab's end of the channel; every message it hears lands in `heard`. */
const otherTab = () => {
  const channel = new BroadcastChannel(WORLD_CHANGE_CHANNEL);
  opened.push(channel);
  const heard: unknown[] = [];
  channel.onmessage = (event) => { heard.push(event.data); };
  return { post: (data: unknown) => channel.postMessage(data), heard };
};
/** Resolves once `check` holds, polling across tasks as messages arrive. */
const until = (check: () => boolean) => vi.waitFor(() => { if (!check()) throw new Error('not yet'); });
/** Lets messages already posted arrive. */
const settle = () => new Promise<void>((resolve) => { setTimeout(resolve, 50); });

const stops: (() => void)[] = [];
const listen = () => {
  const heard: string[] = [];
  stops.push(onWorldChangedElsewhere((worldId) => { heard.push(worldId); }));
  return heard;
};

afterEach(() => {
  for (const stop of stops.splice(0)) stop();
  for (const channel of opened.splice(0)) channel.close();
});

describe('worldChangeSignal', () => {
  it('hears a save another tab announces, with its world id', async () => {
    const heard = listen();
    otherTab().post({ worldId: 'w1' });
    await until(() => heard.length === 1);
    expect(heard).toEqual(['w1']);
  });

  it('tells a delete from a save, both ways', async () => {
    const changes: string[] = [];
    stops.push(onWorldChangedElsewhere((worldId, change) => { changes.push(`${worldId} ${change}`); }));
    const other = otherTab();
    other.post({ worldId: 'w1' });
    await until(() => changes.length === 1);
    other.post({ worldId: 'w1', deleted: true });
    await until(() => changes.length === 2);
    expect(changes).toEqual(['w1 saved', 'w1 deleted']);

    announceWorldDeleted('w2');
    await until(() => other.heard.length === 1);
    expect(other.heard).toEqual([{ worldId: 'w2', deleted: true }]);
  });

  it('never hears its own tab, while another tab does', async () => {
    const heard = listen();
    const other = otherTab();
    announceWorldSaved('w1');
    await until(() => other.heard.length === 1);
    await settle();
    expect(other.heard).toEqual([{ worldId: 'w1' }]);
    expect(heard).toEqual([]);
  });

  it('reaches other tabs with no listener open here', async () => {
    const other = otherTab();
    announceWorldSaved('w2');
    await until(() => other.heard.length === 1);
    expect(other.heard).toEqual([{ worldId: 'w2' }]);
  });

  it('stops hearing once the last listener leaves, and closes its channel then', async () => {
    const close = vi.spyOn(BroadcastChannel.prototype, 'close');
    const heard = listen();
    listen();
    stops.pop()!();
    expect(close).not.toHaveBeenCalled();
    stops.pop()!();
    expect(close).toHaveBeenCalledTimes(1);
    close.mockRestore();
    otherTab().post({ worldId: 'w1' });
    await settle();
    expect(heard).toEqual([]);
  });

  it('ignores a message that names no world', async () => {
    const heard = listen();
    const other = otherTab();
    other.post(null);
    other.post({ worldId: 7 });
    other.post({ worldId: 'w3' });
    await until(() => heard.length === 1);
    await settle();
    expect(heard).toEqual(['w3']);
  });
});
