import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDeferredSnapshot } from './useDeferredSnapshot';

// Drives the hook the way GameViewer does: a `watch` value that changes when a turn commits, a
// `takeSnapshot` that reads the latest game state, and a `commit` that records it. `rerender` with a new
// `watch` stands in for React committing the turn's batched updates.
function setup(initialWatch: unknown, takeSnapshot: () => unknown) {
  const commit = vi.fn();
  const { result, rerender } = renderHook(
    ({ watch }: { watch: unknown }) => useDeferredSnapshot(watch, takeSnapshot, commit),
    { initialProps: { watch: initialWatch } },
  );
  return { commit, arm: () => result.current.arm(), rerender };
}

describe('useDeferredSnapshot', () => {
  it('takes the snapshot on the next commit after being armed', () => {
    const { commit, arm, rerender } = setup('a', () => 'snap');
    act(() => arm());
    expect(commit).not.toHaveBeenCalled(); // not until the watched value commits
    rerender({ watch: 'b' });
    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit).toHaveBeenCalledWith('snap');
  });

  it('does nothing on a commit when it was never armed', () => {
    const { commit, rerender } = setup('a', () => 'snap');
    rerender({ watch: 'b' });
    rerender({ watch: 'c' });
    expect(commit).not.toHaveBeenCalled();
  });

  it('fires exactly once per arm — a second commit does not re-snapshot', () => {
    const { commit, arm, rerender } = setup('a', () => 'snap');
    act(() => arm());
    rerender({ watch: 'b' });
    rerender({ watch: 'c' });
    expect(commit).toHaveBeenCalledTimes(1);
  });

  // The original bug: reading state synchronously (at arm time) captured a stale, half-applied turn.
  // Deferring means the snapshot reflects the value present *at commit*, after the batch landed.
  it('snapshots the value at commit time, not at arm time (freshness)', () => {
    let liveState = 1;
    const { commit, arm, rerender } = setup('a', () => liveState);
    act(() => arm());
    liveState = 2; // the turn's batched updates land before the commit fires
    rerender({ watch: 'b' });
    expect(commit).toHaveBeenCalledWith(2);
  });
});
