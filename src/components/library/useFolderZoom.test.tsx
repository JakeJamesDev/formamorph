import { useRef, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { emptyTabOrganization, saveTabOrganization } from '@/lib/libraryOrganization';
import { useLibraryTiles } from '@/lib/useLibraryTiles';
import { TooltipProvider } from '@/components/ui/tooltip';
import { LibraryTileGrid } from './LibraryTileGrid';
import { useFolderZoom } from './useFolderZoom';

/** The zoom's own overlay, which is the whole of what it adds to the document. */
const overlay = () => document.querySelector<HTMLElement>('[inert][aria-hidden="true"]');

/** One animation the hook has started, with what it was given. */
interface Running {
  el: Element;
  keyframes: Keyframe[];
  options: KeyframeAnimationOptions;
  finish: () => void;
  canceled: boolean;
  landed: boolean;
}

/** Every animation the hook has started and not yet finished, newest last. */
const running: Running[] = [];

/**
 * What each running animation is moving, named the way the DOM names it. The board that is leaving is
 * a deep copy, so the two boards are told apart by which one sits in the overlay.
 */
const movedTargets = () => running.map(({ el }) => {
  const frozen = !!el.closest('[inert]');
  if (el.hasAttribute('data-tile-title')) return `member name${frozen ? '' : ' (library)'}`;
  if (el.hasAttribute('data-folder-title')) return 'name bar';
  const tile = el.getAttribute('data-tile-id');
  if (tile) return `tile:${tile}`;
  return frozen ? 'frozen board' : 'live board';
});

/** The move the hook gave one element, by the name `movedTargets` uses. */
const moveFor = (target: string) => running[movedTargets().indexOf(target)];

/**
 * jsdom has no Web Animations, so the hook is given one that reports as finished when the test says
 * so. Everything the motion looks like on screen belongs to the Playwright spec; what is checked here
 * is what the hook puts in the document, what it asks for, and what it takes back out.
 */
function installAnimate() {
  Element.prototype.animate = function fakeAnimate(
    this: Element,
    keyframes: Keyframe[],
    options: KeyframeAnimationOptions,
  ) {
    let settle = () => {};
    const entry: Running = { el: this, keyframes, options, finish: () => settle(), canceled: false, landed: false };
    const finished = new Promise<void>((resolve) => { settle = resolve; });
    running.push(entry);
    return {
      finished,
      finish: () => { entry.landed = true; settle(); },
      cancel: () => { entry.canceled = true; settle(); },
    } as unknown as Animation;
  } as unknown as typeof Element.prototype.animate;
}

/** The board's box, which every element falls back to. */
const BOARD = { left: 24, top: 60, width: 800, height: 600 };
/** The folder tile's box: a quarter of the board's width, so the zoom is a number no other box gives. */
const TILE = { left: 120, top: 260, width: 200, height: 150 };

/** The scroll offset each folder tile measurement was taken at, oldest first. */
const tileReads: number[] = [];

/** Give every element a measurable box, except the ones the test says cannot be measured. */
function installRects(unmeasurable: string[] = []) {
  Element.prototype.getBoundingClientRect = function fakeRect(this: Element): DOMRect {
    const id = this.getAttribute('data-tile-id');
    if (id === 'g0') tileReads.push(document.querySelector<HTMLElement>('[data-testid="viewport"]')?.scrollTop ?? 0);
    const box = id !== null && unmeasurable.includes(id)
      ? { left: 0, top: 0, width: 0, height: 0 }
      : id === 'g0' ? TILE : BOARD;
    return { ...box, right: box.left + box.width, bottom: box.top + box.height, x: box.left, y: box.top, toJSON: () => box } as DOMRect;
  };
}

const MEMBER_IDS = ['m1', 'm2'];

function ZoomHarness({ busy = false, enabled = true }: { busy?: boolean; enabled?: boolean }) {
  const [openGroupId, setOpenGroupId] = useState<string | null>(null);
  const gridNode = useRef<HTMLDivElement | null>(null);
  const tileNodes = useRef(new Map<string, HTMLDivElement>());
  const { openGroup, closeGroup } = useFolderZoom({ gridNode, tileNodes, openGroupId, setOpenGroupId, busy, enabled });

  return (
    <>
      <div data-radix-scroll-area-viewport="" data-testid="viewport">
        <div ref={gridNode} data-testid="grid">
          {openGroupId ? MEMBER_IDS.map((id) => (
            <div key={id} data-tile-id={id}><h3 data-tile-title>Member {id}</h3></div>
          )) : (
            <div
              data-tile-id="g0"
              ref={(node) => {
                if (node) tileNodes.current.set('g0', node);
                else tileNodes.current.delete('g0');
              }}
            >
              {/* A folder tile carries a name of the same kind its members do, so a fly-out that fades
                  every name it can find rather than the ones on the board it shrinks shows up here. */}
              <div data-folder-title><h3 data-tile-title>Favorites</h3></div>
            </div>
          )}
        </div>
      </div>
      {/* Outside the viewport, as the context menu's Open Group is: the motion turns pointer input off
          inside the board area, so a control drawn in there could not reach the hook twice. */}
      <button onClick={() => openGroup('g0')}>Open Favorites</button>
      <button onClick={closeGroup}>Library</button>
      {/* The plain setter, which is what the grid's disband effect calls. */}
      <button onClick={() => setOpenGroupId(null)}>Disband</button>
    </>
  );
}

const rect = Element.prototype.getBoundingClientRect;
const animate = Element.prototype.animate;

beforeEach(() => {
  running.length = 0;
  tileReads.length = 0;
  installAnimate();
  installRects();
});

afterEach(() => {
  Element.prototype.getBoundingClientRect = rect;
  Element.prototype.animate = animate;
});

const finishAll = async () => {
  await act(async () => {
    running.forEach((entry) => entry.finish());
    await Promise.resolve();
  });
};

const flyIn = async (props: { busy?: boolean; enabled?: boolean } = {}) => {
  const user = userEvent.setup();
  render(<ZoomHarness {...props} />);
  await user.click(screen.getByRole('button', { name: 'Open Favorites' }));
  return user;
};

/** Open the folder, let the camera land, then start the trip back with a clean list. */
const flyOut = async (props: { busy?: boolean; enabled?: boolean } = {}) => {
  const user = userEvent.setup();
  const { rerender } = render(<ZoomHarness />);
  await user.click(screen.getByRole('button', { name: 'Open Favorites' }));
  await finishAll();
  running.length = 0;
  // The guards are read as the back click lands, so a case that turns one on turns it on here.
  rerender(<ZoomHarness {...props} />);
  await user.click(screen.getByRole('button', { name: 'Library' }));
  return user;
};

describe('folder fly-in', () => {
  it('raises the frozen library into an overlay clipped to the scroll viewport', async () => {
    await flyIn();
    const raised = overlay();
    expect(raised).not.toBeNull();
    // The viewport's own box, so a board zoomed past the board area never reaches the toolbar or tabs.
    expect(raised?.style).toMatchObject({
      position: 'fixed', left: '24px', top: '60px', width: '800px', height: '600px', overflow: 'hidden',
    });
    // The frozen copy, with the folder tile the player clicked still in it.
    expect(raised?.querySelector('[data-tile-id="g0"]')).not.toBeNull();
    expect(raised?.querySelector('[data-folder-title]')).not.toBeNull();
  });

  it('moves both layers, the frozen folder tile, and its name bar', async () => {
    await flyIn();
    expect(movedTargets().sort()).toEqual(['frozen board', 'live board', 'name bar', 'tile:g0']);
  });

  it('leaves member names at full opacity for the whole trip in', async () => {
    await flyIn();
    expect(movedTargets().some((target) => target.startsWith('member name'))).toBe(false);
    expect(running.every(({ options }) => options.direction === 'normal')).toBe(true);
  });

  it('takes no pointer input while the motion runs, and hands it back after', async () => {
    await flyIn();
    const viewport = screen.getByTestId('viewport');
    expect(viewport.style.pointerEvents).toBe('none');
    await finishAll();
    expect(viewport.style.pointerEvents).toBe('');
  });

  it('leaves nothing on the grid once the motion ends', async () => {
    await flyIn();
    await finishAll();
    expect(overlay()).toBeNull();
    const grid = screen.getByTestId('grid');
    expect(grid.style.transform).toBe('');
    expect(grid.style.transformOrigin).toBe('');
    expect(grid.style.willChange).toBe('');
  });

  it('lands the running motion before a second open starts another', async () => {
    const user = userEvent.setup();
    render(<ZoomHarness />);
    const open = screen.getByRole('button', { name: 'Open Favorites' });
    await user.click(open);
    const first = [...running];
    // The second open finds no folder tile — the folder is already showing — so it swaps instantly,
    // and the camera in flight has to be off the grid by then either way.
    await user.click(open);
    // Landed on the end state, then released: a second open never cuts a camera off at its start.
    expect(first.every((entry) => entry.landed && entry.canceled)).toBe(true);
    expect(overlay()).toBeNull();
    expect(screen.getByTestId('grid').style.transformOrigin).toBe('');
  });

  it.each([
    ['a drag is running', { busy: true }],
    ['the layout draws cards rather than tiles', { enabled: false }],
  ])('swaps instantly while %s', async (_case, props) => {
    await flyIn(props);
    expect(overlay()).toBeNull();
    expect(running).toHaveLength(0);
    expect(screen.getByText('Member m1')).toBeInTheDocument();
  });

  it('swaps instantly when the folder tile cannot be measured', async () => {
    installRects(['g0']);
    await flyIn();
    expect(overlay()).toBeNull();
    expect(running).toHaveLength(0);
    expect(screen.getByText('Member m1')).toBeInTheDocument();
  });

  it('swaps instantly under reduced motion', async () => {
    const media = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      matches: query.includes('prefers-reduced-motion'), media: query, onchange: null,
      addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {},
      removeListener: () => {}, dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
    try {
      await flyIn();
      expect(overlay()).toBeNull();
      expect(running).toHaveLength(0);
      expect(screen.getByText('Member m1')).toBeInTheDocument();
    } finally {
      window.matchMedia = media;
    }
  });

  it('opens the folder board at its top', async () => {
    const user = userEvent.setup();
    render(<ZoomHarness />);
    const viewport = screen.getByTestId('viewport');
    viewport.scrollTop = 420;
    await user.click(screen.getByRole('button', { name: 'Open Favorites' }));
    expect(viewport.scrollTop).toBe(0);
  });

  it('leaves the scroll alone in the layout that draws cards', async () => {
    const user = userEvent.setup();
    render(<ZoomHarness enabled={false} />);
    const viewport = screen.getByTestId('viewport');
    viewport.scrollTop = 420;
    await user.click(screen.getByRole('button', { name: 'Open Favorites' }));
    expect(viewport.scrollTop).toBe(420);
  });
});

describe('folder fly-out', () => {
  it('raises the frozen folder board into the overlay and leaves the library live', async () => {
    await flyOut();
    const raised = overlay();
    expect(raised).not.toBeNull();
    // The board that is leaving is the folder's, so the frozen copy holds its members.
    expect(raised?.querySelectorAll('[data-tile-title]')).toHaveLength(MEMBER_IDS.length);
    expect(raised?.querySelector('[data-tile-id="g0"]')).toBeNull();
    // The folder tile it flies to is the real one, back on the live board.
    expect(screen.getByTestId('viewport').querySelector('[data-tile-id="g0"]')).not.toBeNull();
  });

  it('plays the trip-in keyframes in reverse', async () => {
    await flyOut();
    expect(running).not.toHaveLength(0);
    expect(running.every(({ options }) => options.direction === 'reverse')).toBe(true);
  });

  it('moves both layers, the live folder tile, its name bar, and every member name', async () => {
    await flyOut();
    expect(movedTargets().sort()).toEqual([
      'frozen board', 'live board', 'member name', 'member name', 'name bar', 'tile:g0',
    ]);
    // The library's own names are not on the board that is shrinking, so they are left alone.
    expect(movedTargets()).not.toContain('member name (library)');
  });

  it('fades member names on the camera, so distance takes them rather than the clock', async () => {
    await flyOut();
    const { keyframes, options } = moveFor('member name');
    // Written in the trip-in sense and played backwards: a name is gone once the board has receded
    // past a quarter of the camera's range, and it holds full opacity above that.
    expect(keyframes).toEqual([
      { opacity: 0 }, { opacity: 0, offset: 0.25 }, { opacity: 1 },
    ]);
    // Linear time would read as an opening beat. The name bar, which is not on the board, keeps it.
    expect(options.easing).toBe(moveFor('live board').options.easing);
    expect(options.easing).not.toBe(moveFor('name bar').options.easing);
  });

  it('brings the folder tile name bar back in the last 12%', async () => {
    await flyOut();
    const { keyframes, options } = moveFor('name bar');
    expect(keyframes).toEqual([{ opacity: 1 }, { opacity: 0, offset: 0.12 }, { opacity: 0 }]);
    expect(options.easing).toBe('linear');
  });

  it('flies to the folder tile, not to the board it sits on', async () => {
    await flyOut();
    // The camera scales the library layer by board width over tile width, which the boxes make 4.
    expect(moveFor('live board').keyframes.at(-1)?.transform).toContain(`scale(${BOARD.width / TILE.width})`);
  });

  it('measures the folder tile only after the library scroll is back', async () => {
    const user = userEvent.setup();
    render(<ZoomHarness />);
    const viewport = screen.getByTestId('viewport');
    viewport.scrollTop = 420;
    await user.click(screen.getByRole('button', { name: 'Open Favorites' }));
    await finishAll();
    tileReads.length = 0;
    await user.click(screen.getByRole('button', { name: 'Library' }));
    // A tile read at the folder's scroll top would put the camera 420px off its target.
    expect(tileReads).not.toHaveLength(0);
    expect(tileReads.every((at) => at === 420)).toBe(true);
  });

  it('puts the library back where the player left it', async () => {
    const user = userEvent.setup();
    render(<ZoomHarness />);
    const viewport = screen.getByTestId('viewport');
    viewport.scrollTop = 420;
    await user.click(screen.getByRole('button', { name: 'Open Favorites' }));
    await finishAll();
    await user.click(screen.getByRole('button', { name: 'Library' }));
    await finishAll();
    expect(viewport.scrollTop).toBe(420);
  });

  it('leaves nothing on the grid once the motion ends', async () => {
    await flyOut();
    await finishAll();
    expect(overlay()).toBeNull();
    const grid = screen.getByTestId('grid');
    expect(grid.style.transform).toBe('');
    expect(grid.style.transformOrigin).toBe('');
    expect(grid.style.willChange).toBe('');
    expect(screen.getByTestId('viewport').style.pointerEvents).toBe('');
  });

  it('lands a trip in that is still running when the player goes back', async () => {
    const user = await flyIn();
    const first = [...running];
    await user.click(screen.getByRole('button', { name: 'Library' }));
    expect(first.every((entry) => entry.landed && entry.canceled)).toBe(true);
    // One board on screen, and the only overlay is the new trip's.
    expect(document.querySelectorAll('[inert][aria-hidden="true"]')).toHaveLength(1);
    await finishAll();
    expect(overlay()).toBeNull();
    expect(screen.getByTestId('grid').style.transform).toBe('');
  });

  it('lands a trip out that is still running when the player opens the folder again', async () => {
    const user = await flyOut();
    const first = [...running];
    await user.click(screen.getByRole('button', { name: 'Open Favorites' }));
    expect(first.every((entry) => entry.landed && entry.canceled)).toBe(true);
    expect(document.querySelectorAll('[inert][aria-hidden="true"]')).toHaveLength(1);
    await finishAll();
    expect(overlay()).toBeNull();
    expect(screen.getByTestId('grid').style.transform).toBe('');
  });

  it.each([
    ['a drag is running', { busy: true }],
    ['the layout draws cards rather than tiles', { enabled: false }],
  ])('swaps instantly while %s', async (_case, props) => {
    await flyOut(props);
    expect(overlay()).toBeNull();
    expect(running).toHaveLength(0);
    expect(screen.getByText('Favorites')).toBeInTheDocument();
  });

  it('swaps instantly when the folder tile cannot be measured', async () => {
    const user = await flyIn();
    await finishAll();
    running.length = 0;
    // The tile comes back with the swap, so a fly-out can only find it unmeasurable after the fact.
    installRects(['g0']);
    await user.click(screen.getByRole('button', { name: 'Library' }));
    expect(overlay()).toBeNull();
    expect(running).toHaveLength(0);
    expect(screen.getByText('Favorites')).toBeInTheDocument();
  });

  it('drops a disbanded folder back to the library with no motion', async () => {
    const user = await flyIn();
    await finishAll();
    running.length = 0;
    // What the grid's disband effect does: the plain setter, because there is no tile to fly to.
    await user.click(screen.getByRole('button', { name: 'Disband' }));
    expect(running).toHaveLength(0);
    expect(overlay()).toBeNull();
    expect(screen.getByText('Favorites')).toBeInTheDocument();
  });
});

const MEMBERS = ['m1', 'm2'];
const boardItems = ['loose', ...MEMBERS].map((id) => ({ id, name: `Item ${id}` }));

function BoardGrid() {
  const tiles = useLibraryTiles('worlds', boardItems.map((item) => item.id), true);
  return <TooltipProvider><LibraryTileGrid
    items={boardItems} idOf={(item) => item.id} nameOf={(item) => item.name} tiles={tiles}
    layout="grid" aspect="landscape" minMediumWidth={200} detailedColumnsClass="grid-cols-1"
    thumbnailOf={(item) => `/art/${item.id}.webp`} renderCard={(item) => <button>{item.name}</button>}
  /></TooltipProvider>;
}

describe('the grid zooms folders open and shut', () => {
  beforeEach(() => {
    localStorage.clear();
    saveTabOrganization('worlds', {
      ...emptyTabOrganization(),
      order: ['loose', 'gF'],
      groups: { gF: { id: 'gF', name: 'Packed Folder', members: MEMBERS, settings: {} } },
    });
  });

  const folderTile = () => document.querySelector('[data-tile-id="gF"]') as HTMLElement;

  it('runs the motion on a click on the folder tile', async () => {
    const user = userEvent.setup();
    render(<BoardGrid />);
    await user.click(within(folderTile()).getByText('Packed Folder'));
    expect(overlay()).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Library' })).toBeInTheDocument();
  });

  it('runs the motion on Open Group', async () => {
    const user = userEvent.setup();
    render(<BoardGrid />);
    fireEvent.contextMenu(folderTile());
    await user.click(screen.getByRole('menuitem', { name: 'Open Group' }));
    expect(overlay()).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Library' })).toBeInTheDocument();
  });

  it('runs the motion on Library in the folder header', async () => {
    const user = userEvent.setup();
    render(<BoardGrid />);
    await user.click(within(folderTile()).getByText('Packed Folder'));
    await finishAll();
    running.length = 0;
    await user.click(screen.getByRole('button', { name: 'Library' }));
    expect(overlay()).not.toBeNull();
    expect(running.every(({ options }) => options.direction === 'reverse')).toBe(true);
    expect(folderTile()).not.toBeNull();
  });
});
