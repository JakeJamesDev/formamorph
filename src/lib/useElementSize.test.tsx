import { render, screen, cleanup, act } from '@testing-library/react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { useElementSize } from './useElementSize';

/**
 * Measuring an element that changes size.
 *
 * The first measurement is synchronous, so a reader has a box to work with on the frame it mounts; every
 * one after it comes from the observer. Both matter to anything positioned by hand — a poster band whose
 * height follows its title and the viewport is re-laid-out constantly, and a stale box there means
 * artwork left hanging over blank space.
 */

/** A ResizeObserver whose delivery this test drives, standing in for the browser's. */
const stubResizeObserver = () => {
  const observed: Array<() => void> = [];

  class StubResizeObserver {
    constructor(private readonly callback: () => void) {}

    observe() { observed.push(() => this.callback()); }
    disconnect() { observed.length = 0; }
  }

  vi.stubGlobal('ResizeObserver', StubResizeObserver);

  return { fire: () => observed.forEach((deliver) => deliver()), get count() { return observed.length; } };
};

/** A box that answers with whatever the test last set. */
const stubBox = (width: number, height: number) => {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
    width, height, top: 0, left: 0, right: width, bottom: height, x: 0, y: 0, toJSON: () => ({}),
  });
};

function Measured() {
  const [ref, size] = useElementSize();

  return <div ref={ref} data-testid="box">{`${size.width}x${size.height}`}</div>;
}

const shown = () => screen.getByTestId('box').textContent;

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('measuring an element', () => {
  it('has an answer on the frame it mounts, without waiting for an observation', () => {
    stubResizeObserver();
    stubBox(800, 200);
    render(<Measured />);

    expect(shown()).toBe('800x200');
  });

  it('follows the element when its box changes', () => {
    const observer = stubResizeObserver();
    stubBox(800, 200);
    render(<Measured />);

    stubBox(355, 209);
    act(() => observer.fire());

    expect(shown()).toBe('355x209');
  });

  it('observes the element it was handed', () => {
    const observer = stubResizeObserver();
    stubBox(800, 200);
    render(<Measured />);

    expect(observer.count).toBe(1);
  });

  it('reads the layout size through a transform, not the box an entrance animation is painting', () => {
    // A dialog mounts mid `zoom-in-95`: the rect reads ~5% small and ResizeObserver never corrects it,
    // since a transform is not a layout change. Artwork placed from that measure sits under-scaled and
    // off-center for the life of the dialog.
    stubResizeObserver();
    stubBox(760, 190); // the painted box, scaled by the animation
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(800);
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(200);
    render(<Measured />);

    expect(shown()).toBe('800x200');
  });

  it('measures nothing where the browser has no observer to give it', () => {
    // jsdom and older browsers both: the first measurement still lands, which is the one that matters.
    vi.stubGlobal('ResizeObserver', undefined);
    stubBox(800, 200);

    expect(() => render(<Measured />)).not.toThrow();
    expect(shown()).toBe('800x200');
  });
});
