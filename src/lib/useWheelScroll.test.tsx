import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { useWheelScroll } from './useWheelScroll';

/** A list the hook is attached to, with the geometry jsdom has no layout to give it. */
function List({ scrollHeight = 500, clientHeight = 200 }: { scrollHeight?: number; clientHeight?: number }) {
  const scroller = useWheelScroll<HTMLDivElement>();
  return <div ref={(el) => { if (el) size(el, scrollHeight, clientHeight); scroller(el); }} data-testid="list" />;
}

/** jsdom reports every box as zero and clamps `scrollTop` to it, so the element is given a real scroll range
 *  and a real scroll position. Only layout is stood in for — the wheel, the handler, and the clamping the
 *  hook relies on are all genuine. */
function size(el: HTMLElement, scrollHeight: number, clientHeight: number) {
  let top = 0;
  Object.defineProperty(el, 'scrollHeight', { value: scrollHeight, configurable: true });
  Object.defineProperty(el, 'clientHeight', { value: clientHeight, configurable: true });
  Object.defineProperty(el, 'scrollTop', {
    configurable: true,
    get: () => top,
    set: (v: number) => { top = Math.max(0, Math.min(v, scrollHeight - clientHeight)); },
  });
}

const wheel = (el: HTMLElement, deltaY: number, deltaMode = 0) => {
  const e = new WheelEvent('wheel', { deltaY, deltaMode, bubbles: true, cancelable: true });
  el.dispatchEvent(e);
  return e;
};

/**
 * A dropdown portaled out of a modal dialog sits outside that dialog's scroll lock, which cancels the
 * browser's scroll for every wheel that lands there. The hook scrolls the list itself so the cancel has
 * nothing left to take.
 */
describe('useWheelScroll', () => {
  it('scrolls the list by the wheel delta', () => {
    const { getByTestId } = render(<List />);
    const el = getByTestId('list');
    wheel(el, 120);
    expect(el.scrollTop).toBe(120);
    wheel(el, 60);
    expect(el.scrollTop).toBe(180);
  });

  it('claims the wheel it acted on, so nothing scrolls the list twice', () => {
    const { getByTestId } = render(<List />);
    expect(wheel(getByTestId('list'), 120).defaultPrevented).toBe(true);
  });

  it('scrolls back up', () => {
    const { getByTestId } = render(<List />);
    const el = getByTestId('list');
    wheel(el, 200);
    wheel(el, -80);
    expect(el.scrollTop).toBe(120);
  });

  it('leaves a wheel it could not act on alone, so the page behind still scrolls', () => {
    // At the bottom already: taking this one would strand the wheel with nothing to move.
    const { getByTestId } = render(<List />);
    const el = getByTestId('list');
    wheel(el, 1000);
    expect(el.scrollTop).toBe(300); // 500 - 200, the end of the range
    const past = wheel(el, 120);
    expect(past.defaultPrevented).toBe(false);
  });

  it('leaves a list with nothing to scroll alone', () => {
    const { getByTestId } = render(<List scrollHeight={200} clientHeight={200} />);
    expect(wheel(getByTestId('list'), 120).defaultPrevented).toBe(false);
  });

  it('reads a line-mode delta as lines rather than as pixels', () => {
    // A wheel set to scroll by lines reports deltaY 3, not 48. Taken as pixels it barely moves the list.
    const { getByTestId } = render(<List />);
    const el = getByTestId('list');
    wheel(el, 3, 1);
    expect(el.scrollTop).toBe(48);
  });

  it('reads a page-mode delta as a page of the list', () => {
    const { getByTestId } = render(<List />);
    const el = getByTestId('list');
    wheel(el, 1, 2);
    expect(el.scrollTop).toBe(180); // 200 * 0.9
  });

  it('stops listening once the list unmounts', () => {
    const { getByTestId, unmount } = render(<List />);
    const el = getByTestId('list');
    wheel(el, 100);
    expect(el.scrollTop).toBe(100);
    unmount();
    expect(wheel(el, 100).defaultPrevented).toBe(false);
    expect(el.scrollTop).toBe(100);
  });
});
