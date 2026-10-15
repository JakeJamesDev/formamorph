import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { KeyboardEvent } from 'react';
import { useSuggestionKeys } from './useSuggestionKeys';

function setup(over: Partial<Parameters<typeof useSuggestionKeys>[0]> = {}) {
  const setActive = vi.fn<(update: (active: number) => number) => void>();
  const opts = {
    count: 3,
    setActive,
    onEnter: vi.fn(),
    onTab: vi.fn(),
    onEscape: vi.fn(),
    onArrowDown: vi.fn(),
    ...over,
  };
  const { result } = renderHook(() => useSuggestionKeys(opts));
  const press = (key: string, extra: { isComposing?: boolean } = {}) => {
    const preventDefault = vi.fn();
    // The hook reads only key, preventDefault and nativeEvent.isComposing, so a stub stands in for the event.
    const e = { key, preventDefault, nativeEvent: { isComposing: !!extra.isComposing } } as unknown as KeyboardEvent<HTMLInputElement>;
    return { handled: result.current(e), preventDefault };
  };
  // The updater the handler passed to `setActive`, run against a starting row.
  const step = (from: number) => setActive.mock.calls.at(-1)![0](from);
  return { opts: { ...opts, setActive }, press, step };
}

describe('useSuggestionKeys', () => {
  it('Enter accepts and is consumed', () => {
    const { opts, press } = setup();
    const { handled, preventDefault } = press('Enter');
    expect(handled).toBe(true);
    expect(preventDefault).toHaveBeenCalled();
    expect(opts.onEnter).toHaveBeenCalledTimes(1);
  });

  it('Enter during IME composition does nothing and is not consumed', () => {
    const { opts, press } = setup();
    const { handled, preventDefault } = press('Enter', { isComposing: true });
    expect(handled).toBe(false);
    expect(preventDefault).not.toHaveBeenCalled();
    expect(opts.onEnter).not.toHaveBeenCalled();
  });

  it('Tab accepts when allowed', () => {
    const { opts, press } = setup();
    expect(press('Tab').handled).toBe(true);
    expect(opts.onTab).toHaveBeenCalledTimes(1);
  });

  it('Tab passes through when the caller refuses it', () => {
    const { opts, press } = setup({ tabAccepts: false });
    const { handled, preventDefault } = press('Tab');
    expect(handled).toBe(false);
    expect(preventDefault).not.toHaveBeenCalled();
    expect(opts.onTab).not.toHaveBeenCalled();
  });

  it('Tab passes through without an onTab handler', () => {
    const { press } = setup({ onTab: undefined });
    expect(press('Tab').handled).toBe(false);
  });

  it('Escape dismisses', () => {
    const { opts, press } = setup();
    const { handled, preventDefault } = press('Escape');
    expect(handled).toBe(true);
    expect(opts.onEscape).toHaveBeenCalledTimes(1);
    expect(preventDefault).not.toHaveBeenCalled(); // the caller owns it
  });

  it('ArrowDown moves down, stops on the last row, and signals the caller', () => {
    const { opts, press, step } = setup();
    expect(press('ArrowDown').handled).toBe(true);
    expect(opts.onArrowDown).toHaveBeenCalledTimes(1);
    expect(step(0)).toBe(1);
    expect(step(2)).toBe(2);
  });

  it('ArrowDown with an empty list stays on row 0', () => {
    const { press, step } = setup({ count: 0 });
    press('ArrowDown');
    expect(step(0)).toBe(0);
  });

  it('ArrowUp moves up and stops on the first row', () => {
    const { press, step } = setup();
    expect(press('ArrowUp').handled).toBe(true);
    expect(step(2)).toBe(1);
    expect(step(0)).toBe(0);
  });

  it('leaves other keys to the caller', () => {
    const { opts, press } = setup();
    const { handled, preventDefault } = press('a');
    expect(handled).toBe(false);
    expect(preventDefault).not.toHaveBeenCalled();
    expect(opts.setActive).not.toHaveBeenCalled();
  });
});
