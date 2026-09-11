import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { renderHook, act } from '@testing-library/react';
import { useDeferredSnapshot } from './useDeferredSnapshot';

// Drives the hook the way GameViewer does: a `watch` value that changes when the narration commits, a
// `takeSnapshot` that reads the latest game state (here a piece of React state), and a `commit` that
// records it. `setLive` stands in for the turn's batched state updates.
function setup(initialWatch: unknown) {
  const commit = vi.fn();
  const { result, rerender } = renderHook(
    ({ watch }: { watch: unknown }) => {
      const [live, setLive] = useState(1);
      const { arm } = useDeferredSnapshot(watch, () => live, commit);
      return { arm, setLive };
    },
    { initialProps: { watch: initialWatch } },
  );
  return { commit, arm: () => result.current.arm(), setLive: (n: number) => result.current.setLive(n), rerender };
}

describe('useDeferredSnapshot', () => {
  it('takes the snapshot on the commit that arming schedules, and not again on a later commit', () => {
    const { commit, arm, rerender } = setup('a');
    expect(commit).not.toHaveBeenCalled();
    act(() => arm());
    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit).toHaveBeenCalledWith(1);
    rerender({ watch: 'b' });
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it('does nothing on a commit when it was never armed', () => {
    const { commit, rerender } = setup('a');
    rerender({ watch: 'b' });
    rerender({ watch: 'c' });
    expect(commit).not.toHaveBeenCalled();
  });

  // The original bug: reading state synchronously (at arm time) captured a stale, half-applied turn.
  // The updates dispatched in the same batch as the arm land before the snapshot reads.
  it('snapshots the value at commit time, so updates batched with the arm are in it', () => {
    const { commit, arm, setLive } = setup('a');
    act(() => { setLive(2); arm(); });
    expect(commit).toHaveBeenCalledWith(2);
  });

  // Stat code's writes land after the narration already committed; arming after them still snapshots.
  it('snapshots after the arm even when the watched value committed earlier', () => {
    const { commit, arm, setLive, rerender } = setup('a');
    rerender({ watch: 'b' });
    expect(commit).not.toHaveBeenCalled();
    act(() => { setLive(3); arm(); });
    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit).toHaveBeenCalledWith(3);
  });
});
