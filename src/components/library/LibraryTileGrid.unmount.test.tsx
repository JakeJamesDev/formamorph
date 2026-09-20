import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import { emptyTabOrganization, saveTabOrganization } from '@/lib/libraryOrganization';
import { useLibraryTiles } from '@/lib/useLibraryTiles';
import { LibraryTileGrid } from './LibraryTileGrid';
import { TooltipProvider } from '@/components/ui/tooltip';

const MEMBERS = ['m1', 'm2'];
const items = ['loose', ...MEMBERS].map((id) => ({ id, name: `Item ${id}` }));

const seed = () => saveTabOrganization('worlds', {
  ...emptyTabOrganization(),
  order: ['loose', 'gF'],
  groups: { gF: { id: 'gF', name: 'Packed Folder', members: MEMBERS, settings: {} } },
  placements: { 8: { loose: { row: 0, col: 0 }, gF: { row: 0, col: 2 }, m1: { row: 0, col: 0 }, m2: { row: 0, col: 2 } } },
});

function Grid() {
  const tiles = useLibraryTiles('worlds', items.map((item) => item.id), true);
  return <TooltipProvider><LibraryTileGrid
    items={items} idOf={(item) => item.id} nameOf={(item) => item.name} tiles={tiles}
    layout="grid" aspect="landscape" minMediumWidth={200} detailedColumnsClass="grid-cols-1"
    thumbnailOf={(item) => `/art/${item.id}.webp`} renderCard={(item) => <button>{item.name}</button>}
  /></TooltipProvider>;
}

const CARRIED = { left: 0, top: 0, width: 240, height: 180 };

/** Pick the folder tile up and move far enough for the mouse sensor's distance constraint to let go. */
const carry = () => {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    ...CARRIED, right: CARRIED.width, bottom: CARRIED.height, x: 0, y: 0, toJSON: () => CARRIED,
  } as DOMRect);
  const tile = document.querySelector('[data-tile-id="gF"]') as HTMLElement;
  fireEvent.mouseDown(tile.querySelector('[role="button"]') ?? tile);
  fireEvent.mouseMove(document, { clientX: 80, clientY: 80 });
  // The first move past the constraint starts the drag; the reading comes off the one after it.
  fireEvent.mouseMove(document, { clientX: 140, clientY: 140 });
};

describe('a drag the grid never sees the end of', () => {
  beforeEach(() => {
    localStorage.clear();
    seed();
    // Only the countdown is faked. dnd-kit's sensors start a drag through the real rAF and microtask
    // queues, and a drag that never starts would arm nothing to test.
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1000);
    vi.stubGlobal('ResizeObserver', class {
      constructor(private readonly report: ResizeObserverCallback) {}
      observe() {
        this.report([{ contentRect: { width: 1000 } } as ResizeObserverEntry], this as unknown as ResizeObserver);
      }
      unobserve() {}
      disconnect() {}
    });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  /**
   * A drag that ends disarms the rest countdown itself. A tab closed, a modal dismissed, or a test that
   * stops mid-gesture never reaches that, so the timer fires into a tree that is gone. Under a torn-down
   * jsdom it reaches React with no `window` at all, which fails a run outside any test.
   */
  it('leaves no rest countdown running after it unmounts mid-gesture', () => {
    const { unmount } = render(<Grid />);
    const idle = vi.getTimerCount();
    carry();
    expect(document.querySelector('[data-drag-overlay]')).not.toBeNull();
    // The gesture has to have armed something, or the unmount below proves nothing.
    expect(vi.getTimerCount()).toBeGreaterThan(idle);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
