import { useRef, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { emptyTabOrganization, saveTabOrganization } from '@/lib/libraryOrganization';
import { useLibraryTiles } from '@/lib/useLibraryTiles';
import { TooltipProvider } from '@/components/ui/tooltip';
import { LibraryTileGrid } from './LibraryTileGrid';
import { useFolderFlyIn } from './useFolderFlyIn';

/** The fly-in's own overlay, which is the whole of what it adds to the document. */
const overlay = () => document.querySelector<HTMLElement>('[inert][aria-hidden="true"]');

/** Every animation the hook has started and not yet finished, newest last. */
const running: { el: Element; finish: () => void; canceled: boolean; landed: boolean }[] = [];

/**
 * What each running animation is moving, named the way the DOM names it. The frozen library is a deep
 * copy of the grid, so the two boards are told apart by which one sits in the overlay.
 */
const movedTargets = () => running.map(({ el }) => {
  const frozen = !!el.closest('[inert]');
  if (el.hasAttribute('data-folder-title')) return 'name bar';
  const tile = el.getAttribute('data-tile-id');
  if (tile) return `tile:${tile}`;
  return frozen ? 'frozen library' : 'folder board';
});

/**
 * jsdom has no Web Animations, so the hook is given one that reports as finished when the test says
 * so. Everything the motion looks like on screen belongs to the Playwright spec; what is checked here
 * is what the hook puts in the document and what it takes back out.
 */
function installAnimate() {
  Element.prototype.animate = function fakeAnimate(this: Element) {
    let settle = () => {};
    const entry = { el: this, finish: () => settle(), canceled: false, landed: false };
    const finished = new Promise<void>((resolve) => { settle = resolve; });
    running.push(entry);
    return {
      finished,
      finish: () => { entry.landed = true; settle(); },
      cancel: () => { entry.canceled = true; settle(); },
    } as unknown as Animation;
  } as unknown as typeof Element.prototype.animate;
}

/** Give every element a measurable box, except the ones the test says cannot be measured. */
function installRects(unmeasurable: string[] = []) {
  Element.prototype.getBoundingClientRect = function fakeRect(this: Element): DOMRect {
    const id = this.getAttribute('data-tile-id');
    const zero = id !== null && unmeasurable.includes(id);
    const box = zero
      ? { left: 0, top: 0, width: 0, height: 0 }
      : { left: 24, top: 60, width: 800, height: 600 };
    return { ...box, right: box.left + box.width, bottom: box.top + box.height, x: box.left, y: box.top, toJSON: () => box } as DOMRect;
  };
}

function FlyInHarness({ busy = false, enabled = true }: { busy?: boolean; enabled?: boolean }) {
  const [openGroupId, setOpenGroupId] = useState<string | null>(null);
  const gridNode = useRef<HTMLDivElement | null>(null);
  const tileNodes = useRef(new Map<string, HTMLDivElement>());
  const { openGroup } = useFolderFlyIn({ gridNode, tileNodes, openGroupId, setOpenGroupId, busy, enabled });

  return (
    <>
      <div data-radix-scroll-area-viewport="" data-testid="viewport">
        <div ref={gridNode} data-testid="grid">
          {openGroupId ? <div data-tile-id="member">Member</div> : (
            <div
              data-tile-id="g0"
              ref={(node) => {
                if (node) tileNodes.current.set('g0', node);
                else tileNodes.current.delete('g0');
              }}
            >
              <div data-folder-title>Favorites</div>
            </div>
          )}
        </div>
      </div>
      {/* Outside the viewport, as the context menu's Open Group is: the motion turns pointer input off
          inside the board area, so a control drawn in there could not reach the hook twice. */}
      <button onClick={() => openGroup('g0')}>Open Favorites</button>
      {/* The folder header's own Library button, which stays on the plain setter until ticket 03. */}
      <button onClick={() => setOpenGroupId(null)}>Back</button>
    </>
  );
}

const rect = Element.prototype.getBoundingClientRect;
const animate = Element.prototype.animate;

beforeEach(() => {
  running.length = 0;
  installAnimate();
  installRects();
});

afterEach(() => {
  Element.prototype.getBoundingClientRect = rect;
  Element.prototype.animate = animate;
});

const flyIn = async (props: { busy?: boolean; enabled?: boolean } = {}) => {
  const user = userEvent.setup();
  render(<FlyInHarness {...props} />);
  await user.click(screen.getByRole('button', { name: 'Open Favorites' }));
};

const finishAll = async () => {
  await act(async () => {
    running.forEach((entry) => entry.finish());
    await Promise.resolve();
  });
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
    expect(movedTargets().sort()).toEqual(['folder board', 'frozen library', 'name bar', 'tile:g0']);
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
    render(<FlyInHarness />);
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
    expect(screen.getByText('Member')).toBeInTheDocument();
  });

  it('swaps instantly when the folder tile cannot be measured', async () => {
    installRects(['g0']);
    await flyIn();
    expect(overlay()).toBeNull();
    expect(running).toHaveLength(0);
    expect(screen.getByText('Member')).toBeInTheDocument();
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
      expect(screen.getByText('Member')).toBeInTheDocument();
    } finally {
      window.matchMedia = media;
    }
  });

  it('opens the folder board at its top', async () => {
    const user = userEvent.setup();
    render(<FlyInHarness />);
    const viewport = screen.getByTestId('viewport');
    viewport.scrollTop = 420;
    await user.click(screen.getByRole('button', { name: 'Open Favorites' }));
    expect(viewport.scrollTop).toBe(0);
  });

  it('puts the library back where the player left it', async () => {
    const user = userEvent.setup();
    render(<FlyInHarness />);
    const viewport = screen.getByTestId('viewport');
    viewport.scrollTop = 420;
    await user.click(screen.getByRole('button', { name: 'Open Favorites' }));
    await finishAll();
    await act(async () => { screen.getByRole('button', { name: 'Back' }).click(); });
    expect(viewport.scrollTop).toBe(420);
  });

  it('leaves the scroll alone in the layout that draws cards', async () => {
    const user = userEvent.setup();
    render(<FlyInHarness enabled={false} />);
    const viewport = screen.getByTestId('viewport');
    viewport.scrollTop = 420;
    await user.click(screen.getByRole('button', { name: 'Open Favorites' }));
    expect(viewport.scrollTop).toBe(420);
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

describe('the grid opens folders through the fly-in', () => {
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
});
