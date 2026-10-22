import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import { SEEN_STORAGE_KEYS, saveSeenTiles } from '@/lib/libraryOrganization';
import { useLibraryTiles } from '@/lib/useLibraryTiles';
import { LibraryTileGrid } from './LibraryTileGrid';
import { TooltipProvider } from '@/components/ui/tooltip';

const items = ['old', 'new'].map((id) => ({ id, name: `Item ${id}` }));

function Grid() {
  const tiles = useLibraryTiles('worlds', items.map((item) => item.id), true);
  return <TooltipProvider><LibraryTileGrid
    items={items} idOf={(item) => item.id} nameOf={(item) => item.name} tiles={tiles}
    layout="grid" aspect="landscape" minMediumWidth={200} detailedColumnsClass="grid-cols-1"
    thumbnailOf={(item) => `/art/${item.id}.webp`} renderCard={(item) => <button>{item.name}</button>}
  /></TooltipProvider>;
}

const seen = () => JSON.parse(localStorage.getItem(SEEN_STORAGE_KEYS.worlds) ?? '[]') as string[];
const tile = (id: string) => document.querySelector(`[data-tile-id="${id}"]`) as HTMLElement;
/** What sits on top at a tile's center: the tile itself, or something covering it. */
const onTop = (pick: () => Element | null) => {
  Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: pick });
};

describe('a tile new since the last visit', () => {
  beforeEach(() => {
    localStorage.clear();
    saveSeenTiles('worlds', ['old']);
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1000);
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      left: 0, top: 0, width: 200, height: 120, right: 200, bottom: 120, x: 0, y: 0, toJSON: () => ({}),
    } as DOMRect);
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
    Reflect.deleteProperty(document, 'elementFromPoint');
  });

  it('waits while something covers it', () => {
    const cover = document.createElement('div');
    onTop(() => cover);
    render(<Grid />);

    act(() => { vi.advanceTimersByTime(2000); });

    expect(seen()).toEqual(['old']);
  });

  it('pulses once it is on top, and is then seen', () => {
    onTop(() => tile('new'));
    render(<Grid />);

    act(() => { vi.advanceTimersByTime(500); });

    expect(seen()).toEqual(['old', 'new']);
    expect(document.querySelector('.landing-pulse, .landing-ring')).not.toBeNull();
  });
});
