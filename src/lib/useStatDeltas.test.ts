// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { CHIP_MS, DRAIN_MS, FADE_MS, NO_DELTAS, rowDelta, useStatDeltas, type FollowedStatDeltas } from './useStatDeltas';

const ASH = 'ash';

const setup = (initial: FollowedStatDeltas = {}) => renderHook(
  ({ followed }: { followed: FollowedStatDeltas }) => useStatDeltas(followed),
  { initialProps: { followed: initial } },
);
const wait = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });

describe('useStatDeltas', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it("shows the global chip for 10 s and holds the band until the next turn", () => {
    const { result } = setup();
    act(() => result.current.show(null,{ health: -5 }));
    expect(rowDelta(result.current, null, 'health', null)).toMatchObject({ change: -5, barDelta: -5, draining: false });
    wait(CHIP_MS - 1);
    expect(result.current.recent.global).toEqual({ health: -5 });
    wait(1);
    expect(rowDelta(result.current, null, 'health', null)).toMatchObject({ change: 0, barDelta: -5 });
  });

  it("gives a followed owner the global timing: chip at landing, gone at 10 s, band held", () => {
    const { result, rerender } = setup();
    rerender({ followed: { [ASH]: { trust: 6 } } });
    // The band follows at once; the chip waits for the stat response.
    expect(rowDelta(result.current, ASH, 'trust', null)).toMatchObject({ change: 0, barDelta: 6 });
    act(() => result.current.show(null,{}));
    expect(rowDelta(result.current, ASH, 'trust', null)).toMatchObject({ change: 6, barDelta: 6 });
    // Code after the response moves the entity again: chip and band both follow.
    rerender({ followed: { [ASH]: { trust: 8 } } });
    expect(rowDelta(result.current, ASH, 'trust', null)).toMatchObject({ change: 8, barDelta: 8 });
    wait(CHIP_MS);
    expect(rowDelta(result.current, ASH, 'trust', null)).toMatchObject({ change: 0, barDelta: 8 });
  });

  it('drains every band and fades every chip at a submit', () => {
    const { result, rerender } = setup();
    rerender({ followed: { [ASH]: { trust: 6 } } });
    act(() => result.current.show(null,{ health: -5 }));
    act(() => result.current.drain());
    // The turn's baseline moves, so the followed total reads zero.
    rerender({ followed: {} });
    expect(rowDelta(result.current, null, 'health', null)).toMatchObject({ change: -5, barDelta: -5, draining: true, fading: true });
    expect(rowDelta(result.current, ASH, 'trust', null)).toMatchObject({ change: 6, barDelta: 6, draining: true, fading: true });
    wait(FADE_MS);
    expect(result.current.recent).toEqual(NO_DELTAS);
    expect(result.current.fading).toBe(false);
    wait(DRAIN_MS - FADE_MS);
    expect(rowDelta(result.current, ASH, 'trust', null)).toMatchObject({ change: 0, barDelta: 0, draining: false });
    expect(rowDelta(result.current, null, 'health', null)).toMatchObject({ change: 0, barDelta: 0, draining: false });
  });

  it('keeps chips up until the next submit on a turn with no stat response, for every owner', () => {
    const { result, rerender } = setup();
    rerender({ followed: { [ASH]: { trust: 1 } } });
    // Regen lands with no stat response: no 10 s timer, for global stats or the entity.
    act(() => result.current.add(null,{ health: 2 }));
    expect(rowDelta(result.current, ASH, 'trust', null).change).toBe(1);
    // Stat code then moves the entity: its chip follows, as the global chip takes code changes.
    rerender({ followed: { [ASH]: { trust: 3 } } });
    wait(CHIP_MS * 2);
    expect(rowDelta(result.current, null, 'health', null).change).toBe(2);
    expect(rowDelta(result.current, ASH, 'trust', null).change).toBe(3);
    act(() => result.current.drain());
    wait(FADE_MS);
    expect(result.current.recent).toEqual(NO_DELTAS);
  });

  it("sums the global adds and lays a response over the held band", () => {
    const { result } = setup();
    act(() => result.current.hold(null,{ mana: 3 }));
    act(() => result.current.show(null,{ health: -5 }));
    act(() => result.current.add(null,{ health: 1 }));
    expect(result.current.recent.global).toEqual({ health: -4 });
    expect(result.current.held.global).toEqual({ mana: 3, health: -4 });
  });

  it("wipes a change that lands during the submit fade, for every owner, as the global chip always was", () => {
    const { result, rerender } = setup();
    act(() => result.current.show(null,{ health: -5 }));
    act(() => result.current.drain());
    act(() => result.current.add(null,{ health: 1 }));
    wait(FADE_MS);
    rerender({ followed: { [ASH]: { trust: 2 } } });
    expect(rowDelta(result.current, null, 'health', null).change).toBe(0);
    expect(rowDelta(result.current, ASH, 'trust', null)).toMatchObject({ change: 0, barDelta: 2 });
  });

  it('closes the chips when a turn is abandoned', () => {
    const { result, rerender } = setup();
    act(() => result.current.add(null,{ health: 1 }));
    act(() => result.current.drop());
    rerender({ followed: { [ASH]: { trust: 2 } } });
    expect(rowDelta(result.current, ASH, 'trust', null)).toMatchObject({ change: 0, barDelta: 2 });
    expect(result.current.recent).toEqual(NO_DELTAS);
  });

  it('clears every owner and leaves no timer', () => {
    const { result, rerender } = setup();
    rerender({ followed: { [ASH]: { trust: 6 } } });
    act(() => result.current.show(null,{ health: -5 }));
    act(() => result.current.drain());
    act(() => result.current.clear());
    expect(vi.getTimerCount()).toBe(0);
    expect(result.current).toMatchObject({ recent: NO_DELTAS, held: NO_DELTAS, draining: NO_DELTAS, fading: false });
  });

  it('clears its timers on unmount', () => {
    const { result, unmount } = setup();
    act(() => result.current.show(null,{ health: -5 }));
    act(() => result.current.drain());
    act(() => result.current.show(null,{ health: 1 }));
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("reads a past turn's recorded change and never drains it", () => {
    const { result } = setup();
    expect(rowDelta(result.current, ASH, 'trust', -4)).toMatchObject({ change: -4, barDelta: -4, draining: false });
  });
});
