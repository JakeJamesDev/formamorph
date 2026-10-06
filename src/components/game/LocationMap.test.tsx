import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { CANVAS_NODE_HEIGHT, CANVAS_NODE_WIDTH } from '@/lib/locationCanvas';
import LocationMap from './LocationMap';
import type { Connection, GameLocation } from '@/types';

/**
 * The Map's arrows through what a player sees: which `implicit:` edges are in the DOM. xyflow draws only what
 * it has measured, and jsdom measures nothing, so each test gives the page a size and a ResizeObserver that
 * reports every element it is asked to watch. The 150 spokes sit in a grid the page holds whole, so culling hides none of them.
 */

const hub: GameLocation = { id: 'hub', name: 'Hub', canvasPosition: { x: 0, y: 0 } };
const spokes: GameLocation[] = Array.from({ length: 150 }, (_, i) => ({
  id: `s${i}`, name: `Spoke ${i}`, parentId: 'hub', canvasPosition: { x: 20 + (i % 15) * 200, y: 36 + Math.floor(i / 15) * 72 },
}));
const crowd = [hub, ...spokes];

/** The page the view fills. Wide enough for the whole grid unless a test narrows it. */
const WIDE = { width: 3600, height: 1200 };
let SIZE = WIDE;

/** Reports the size of whatever it watches, the way a browser's first observation does. */
class MeasuringObserver {
  constructor(private callback: ResizeObserverCallback) {}
  observe(target: Element) {
    const entry = { target, contentRect: { ...SIZE, x: 0, y: 0, top: 0, left: 0, right: SIZE.width, bottom: SIZE.height } };
    queueMicrotask(() => this.callback([entry as ResizeObserverEntry], this as never));
  }
  unobserve() {}
  disconnect() {}
}

const stubBrowser = (canHover: boolean, page = WIDE) => {
  SIZE = page;
  vi.stubGlobal('ResizeObserver', MeasuringObserver);
  vi.stubGlobal('DOMMatrixReadOnly', class {
    m22 = 1;
    constructor(public transform?: string) {}
  });
  // A box is as large as the map sizes it; everything else, the view itself included, is the page.
  const sized = (element: HTMLElement, axis: 'width' | 'height', fallback: number, page: number) =>
    (element.classList.contains('react-flow__node') ? parseFloat(element.style[axis]) || fallback : page);
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function (this: HTMLElement) {
    return sized(this, 'width', CANVAS_NODE_WIDTH, SIZE.width);
  });
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (this: HTMLElement) {
    return sized(this, 'height', CANVAS_NODE_HEIGHT, SIZE.height);
  });
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query === '(hover: hover)' ? canHover : false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
};

const implicitEdges = () => [...document.querySelectorAll('.react-flow__edge[data-id^="implicit:"]')]
  .map((edge) => edge.getAttribute('data-id')!);

const show = (props: { connections?: Connection[]; current: string | null; onTravel?: (l: GameLocation) => void }) => {
  const view = (current: string | null) => (
    <TooltipProvider>
      <div style={{ width: SIZE.width, height: SIZE.height }}>
        <LocationMap
          locations={crowd}
          connections={props.connections ?? []}
          currentLocationId={current}
          onTravel={props.onTravel ?? (() => {})}
        />
      </div>
    </TooltipProvider>
  );
  const rendered = render(view(props.current));
  return { travelTo: (current: string) => rendered.rerender(view(current)) };
};

const box = (name: string) => screen.getByRole('button', { name });
const nodeOf = (name: string) => box(name).closest('.react-flow__node')!;

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  SIZE = WIDE;
});

/** Waits for xyflow to measure the boxes and draw the arrows the player's own location asks for. */
const drawnAt = async (count: number) => {
  await waitFor(() => expect(implicitEdges()).toHaveLength(count));
  return implicitEdges();
};

describe('the Map', () => {
  describe('on a desktop', () => {
    beforeEach(() => stubBrowser(true));

    it('draws only the current location’s arrows, not a mesh of every pair', async () => {
      show({ current: 's7' });
      // 149 siblings, an arrow each way. A mesh would be 22,350.
      const drawn = await drawnAt(2 * 149);
      expect(drawn.every((id) => id.includes('s7'))).toBe(true);
    });

    it('leaves out the pairs a Connection replaced', async () => {
      show({ current: 's7', connections: [{ id: 'c1', a: 's7', b: 's8', aToB: {} }] });
      expect(await drawnAt(2 * 148)).not.toContain('implicit:s7>s8');
    });

    it('moves the arrows to the new location when the player travels', async () => {
      const { travelTo } = show({ current: 's7' });
      await drawnAt(2 * 149);
      travelTo('s20');
      await waitFor(() => expect(implicitEdges().every((id) => id.includes('s20'))).toBe(true));
      expect(implicitEdges()).toHaveLength(2 * 149);
    });

    it('adds a hovered location’s arrows, and drops them when the pointer leaves', async () => {
      show({ current: 's7' });
      await drawnAt(2 * 149);
      fireEvent.mouseEnter(nodeOf('Spoke 40'));
      expect(await drawnAt(2 * (149 + 149 - 1))).toContain('implicit:s40>s41');
      fireEvent.mouseLeave(nodeOf('Spoke 40'));
      await drawnAt(2 * 149);
    });

    it('travels when a location is clicked', async () => {
      const onTravel = vi.fn();
      show({ current: 's7', onTravel });
      await drawnAt(2 * 149);
      fireEvent.click(box('Spoke 40'), { detail: 1 });
      expect(onTravel).toHaveBeenCalledWith(expect.objectContaining({ id: 's40' }));
    });
  });

  it('keeps only the boxes in view in the page', async () => {
    stubBrowser(true, { width: 400, height: 300 });
    show({ current: 's7' });
    await waitFor(() => expect(document.querySelectorAll('.react-flow__node').length).toBeGreaterThan(0));
    // 151 boxes are on the map, and at the lowest zoom a 400-wide view holds only some of them.
    expect(document.querySelectorAll('.react-flow__node').length).toBeLessThan(151);
  });

  it('keeps hover arrows off a touch screen, where a tap fakes a mouse-enter', async () => {
    stubBrowser(false);
    show({ current: 's7' });
    await drawnAt(2 * 149);
    fireEvent.mouseEnter(nodeOf('Spoke 40'));
    // The hover would draw its arrows on the next render; give that render the chance to happen.
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 50)); });
    expect(implicitEdges()).toHaveLength(2 * 149);
  });
});
