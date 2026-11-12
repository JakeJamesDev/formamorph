import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { act, render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { CANVAS_NODE_HEIGHT, CANVAS_NODE_WIDTH } from '@/lib/locationCanvas';
import LocationMap from './LocationMap';
import { computePresence, type PresenceInput } from '@/lib/presence';
import { mapRoster, type MapRoster } from '@/lib/mapRoster';
import type { Connection, Entity, GameLocation } from '@/types';

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

const show = (props: {
  connections?: Connection[]; current: string | null; onTravel?: (l: GameLocation) => void;
  entitiesAt?: MapRoster;
}) => {
  const view = (current: string | null) => (
    <TooltipProvider>
      <div style={{ width: SIZE.width, height: SIZE.height }}>
        <LocationMap
          locations={crowd}
          connections={props.connections ?? []}
          currentLocationId={current}
          entitiesAt={props.entitiesAt}
          onTravel={props.onTravel ?? (() => {})}
        />
      </div>
    </TooltipProvider>
  );
  const rendered = render(view(props.current));
  return { travelTo: (current: string) => rendered.rerender(view(current)), unmount: rendered.unmount };
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

    it('draws a Far Connection dotted and a Nearby one solid, with no Far label', async () => {
      show({ current: 's7', connections: [
        { id: 'c1', a: 's7', b: 's8', aToB: {}, distance: 'far' },
        { id: 'c2', a: 's7', b: 's9', aToB: {} },
      ] });
      await drawnAt(2 * 147);
      const dashOf = (id: string) =>
        document.querySelector<SVGPathElement>(`.react-flow__edge[data-id="${id}"] .react-flow__edge-path`)?.style.strokeDasharray;
      expect(dashOf('connection:c1:aToB')).toBe('1 7');
      expect(dashOf('connection:c2:aToB')).toBe('');
      expect(screen.queryByText('Far')).toBeNull();
    });

    it('draws a Connection without its travel hint', async () => {
      show({ current: 's7', connections: [{ id: 'c1', a: 's7', b: 's8', aToB: { hint: 'Behind the loose brick' } }] });
      await drawnAt(2 * 148);
      expect(document.querySelector('.react-flow__edge[data-id="connection:c1:aToB"]')).not.toBeNull();
      expect(screen.queryByText('Behind the loose brick')).toBeNull();
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

    it('counts the entities on their box and lists them in the tip, on no other box', async () => {
      show({ current: 's7', entitiesAt: {
        s40: { named: ['Bram', 'Tilly'], unknown: 0 },
        hub: { named: ['Queen Ysolde'], unknown: 0 },
      } });
      await drawnAt(2 * 149);
      const counts = () => [...document.querySelectorAll('.react-flow__node [role="img"]')];
      expect(counts()).toHaveLength(2);
      const badge = within(nodeOf('Spoke 40') as HTMLElement).getByRole('img', { name: 'Bram, Tilly' });
      expect(badge.textContent).toBe('2');
      within(nodeOf('Hub') as HTMLElement).getByRole('img', { name: 'Queen Ysolde' });
    });

    it('splits the badge into named and unknown parts, and drops a part of zero', async () => {
      show({ current: 's7', entitiesAt: {
        s40: { named: ['Bram', 'Tilly'], unknown: 2 },
        s41: { named: ['Bram', 'Tilly'], unknown: 0 },
        s42: { named: [], unknown: 3 },
      } });
      await drawnAt(2 * 149);
      const badgeOf = (name: string) => within(nodeOf(name) as HTMLElement).getByRole('img');
      expect(badgeOf('Spoke 40').textContent).toBe('2+2?');
      expect(badgeOf('Spoke 41').textContent).toBe('2');
      expect(badgeOf('Spoke 41').querySelector('[data-part="unknown"]')).toBeNull();
      expect(badgeOf('Spoke 42').textContent).toBe('3?');
      expect(badgeOf('Spoke 42').querySelector('[data-part="named"]')).toBeNull();
    });

    it('lists the names, then the unknown line, in the tip', async () => {
      show({ current: 's7', entitiesAt: {
        s40: { named: ['Bram', 'a hooded stranger'], unknown: 2 },
        s42: { named: [], unknown: 1 },
      } });
      await drawnAt(2 * 149);
      within(nodeOf('Spoke 40') as HTMLElement).getByRole('img', { name: 'Bram, a hooded stranger\n2 unknown' });
      within(nodeOf('Spoke 42') as HTMLElement).getByRole('img', { name: '1 unknown' });
    });

    describe('fed by the Presence', () => {
      const entity = (id: string, name: string, extra: Partial<Entity> = {}): Entity => ({ id, name, ...extra });
      /** The roster the game builds for the map from a state where the player stands at s7. */
      const rosterOf = (input: Partial<PresenceInput>) => mapRoster(computePresence({
        entities: [], runtime: [], positions: {}, generics: {}, followers: [], locationId: 's7', locations: crowd, connections: [],
        persona: null, met: [], strangerAliases: {}, turns: [], ...input,
      }).byId.values(), 's7', crowd, []);
      const badges = () => [...document.querySelectorAll('.react-flow__node [role="img"]')].map((b) => b.getAttribute('aria-label'));

      it('draws a Met entity at its position, and an unpositioned one at each place it lists', async () => {
        const cast = [
          entity('bram', 'Bram', { locations: ['s7'] }),
          entity('lights', 'The Cold Lights', { locations: ['s40', 's41'] }),
        ];
        show({ current: 's7', entitiesAt: rosterOf({ entities: cast, positions: { bram: 's9' } }) });
        await drawnAt(2 * 149);
        within(nodeOf('Spoke 9') as HTMLElement).getByRole('img', { name: 'Bram' });
        within(nodeOf('Spoke 40') as HTMLElement).getByRole('img', { name: 'The Cold Lights' });
        within(nodeOf('Spoke 41') as HTMLElement).getByRole('img', { name: 'The Cold Lights' });
        expect(badges()).toHaveLength(3);
      });

      it('draws a stranger under its label nearby and as an unknown far off, never by its true name, until the story names it', async () => {
        const spy = entity('spy', 'Sylvie Thornwhistle', { strangerName: 'a hooded stranger', locations: ['s7'] });
        const far = entity('far', 'Orin Vale', { strangerName: 'a quiet figure', locations: ['s9'] });
        const hidden = show({ current: 's7', entitiesAt: rosterOf({ entities: [spy], strangerAliases: { spy: 'the tall one' } }) });
        await drawnAt(2 * 149);
        expect(badges()).toEqual(['the tall one']);
        expect(screen.queryByText('Sylvie Thornwhistle')).toBeNull();
        hidden.unmount();
        // s7's siblings are Nearby, so a figure at s9 shows its label; the true name never renders.
        const nearby = show({ current: 's7', entitiesAt: rosterOf({ entities: [far] }) });
        await drawnAt(2 * 149);
        expect(badges()).toEqual(['a quiet figure']);
        expect(document.body.textContent).not.toContain('Orin Vale');
        nearby.unmount();
        // A stranger with no label is an unknown even in the player's own place.
        const unmet = show({ current: 's7', entitiesAt: rosterOf({ entities: [entity('x', 'Ila Kerr', { strangerName: '', locations: ['s7'] })] }) });
        await drawnAt(2 * 149);
        expect(badges()).toEqual(['1 unknown']);
        expect(document.body.textContent).not.toContain('Ila Kerr');
        unmet.unmount();
        show({ current: 's7', entitiesAt: rosterOf({ entities: [spy], met: ['spy'] }) });
        await drawnAt(2 * 149);
        expect(badges()).toEqual(['Sylvie Thornwhistle']);
      });
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
