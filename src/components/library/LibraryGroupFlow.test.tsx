import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { emptyTabOrganization, groupOf, loadTabOrganization, saveTabOrganization, type LibraryTabOrganization } from '@/lib/libraryOrganization';
import { useLibraryTiles, type LibraryTiles } from '@/lib/useLibraryTiles';
import { LibraryTileContextMenu } from './LibraryTileContextMenu';
import { LibraryTileGrid } from './LibraryTileGrid';
import { TooltipProvider } from '@/components/ui/tooltip';

const ITEM_IDS = ['world', 'other', 'resident0', 'resident1', 'resident2', 'resident3', 'resident4'];
const names = ['Archive of Very Long Expeditions and Unfinished Maps', 'Favorites', 'Coastal Mysteries', 'Favorites', 'Quiet Horror'];
const seed = (count = names.length, assigned?: string) => {
  const org: LibraryTabOrganization = {
    ...emptyTabOrganization(),
    order: [...ITEM_IDS, ...names.slice(0, count).map((_, index) => `g${index}`)],
    groups: Object.fromEntries(names.slice(0, count).map((name, index) => [
      `g${index}`, { id: `g${index}`, name, members: [`resident${index}`, ...(assigned === `g${index}` ? ['world'] : [])], settings: {} },
    ])),
  };
  saveTabOrganization('worlds', org);
};

function LibraryFlow() {
  const tiles = useLibraryTiles('worlds', ITEM_IDS, true);
  return <LibraryTileContextMenu id="world" name="The Lantern District" tiles={tiles} layout="grid" renderedIds={ITEM_IDS} baseCols={4} onOpenGroup={() => {}}>
    <button>World Tile</button>
  </LibraryTileContextMenu>;
}

const items = ITEM_IDS.map((id) => ({ id, name: id === 'world' ? 'World Tile' : id }));
function GridFlow() {
  const tiles = useLibraryTiles('worlds', ITEM_IDS, true);
  return <TooltipProvider><LibraryTileGrid
    items={items} idOf={(item) => item.id} nameOf={(item) => item.name} tiles={tiles}
    layout="grid" aspect="landscape" minMediumWidth={200} detailedColumnsClass="grid-cols-1"
    thumbnailOf={() => undefined} renderCard={(item) => <button>{item.name}</button>}
  /></TooltipProvider>;
}

const openMenu = () => fireEvent.contextMenu(screen.getByRole('button', { name: 'World Tile' }));
const organization = () => loadTabOrganization('worlds');
const openPicker = async (user: ReturnType<typeof userEvent.setup>) => {
  openMenu();
  await user.click(screen.getByRole('menuitem', { name: 'Add To Group…' }));
  return screen.getByRole('dialog', { name: 'Add To Group' });
};

beforeEach(() => localStorage.clear());

describe('library group flow', () => {
  it('restores focus to the real grid after assignment removes the opener', async () => {
    seed();
    const user = userEvent.setup();
    render(<GridFlow />);
    const opener = screen.getByRole('button', { name: 'World Tile' });
    const grid = opener.closest('[data-library-focus-root]');
    await openPicker(user);
    await user.keyboard('{Tab} ');
    expect(groupOf(organization(), 'world')?.id).toBe('g0');
    expect(opener).not.toBeInTheDocument();
    expect(grid).toHaveFocus();
  });
  it.each([0, 2, 5])('bounds shortcuts with %s groups in existing order', (count) => {
    seed(count);
    render(<LibraryFlow />);
    openMenu();
    const actions = screen.getAllByRole('menuitem').map((item) => item.textContent?.trim());
    expect(actions).toEqual([...names.slice(0, Math.min(count, 3)), 'Create New Group…', 'Add To Group…']);
  });

  it('excludes the current group before taking three shortcuts', async () => {
    seed(5, 'g1');
    const user = userEvent.setup();
    render(<LibraryFlow />);
    openMenu();
    expect(screen.getAllByRole('menuitem').map((item) => item.textContent?.trim())).toEqual([
      names[0], names[2], names[3], 'Create New Group…', 'Add To Group…', 'Remove From Group',
    ]);
    await user.click(screen.getByRole('menuitem', { name: 'Favorites' }));
    expect(groupOf(organization(), 'world')?.id).toBe('g3');
  });

  it('filters without reordering, preserves duplicate identities, and persists the chosen group', async () => {
    seed();
    const user = userEvent.setup();
    render(<LibraryFlow />);
    const dialog = await openPicker(user);
    expect(within(dialog).getByText('The Lantern District')).toBeInTheDocument();
    const search = screen.getByRole('textbox', { name: 'Find a Group' });
    expect(search).toHaveFocus();
    await user.type(search, '  FAVOR  ');
    const matches = within(screen.getByRole('group', { name: 'Groups' })).getAllByRole('button');
    expect(matches.map((item) => item.textContent)).toEqual(['Favorites', 'Favorites']);
    await user.click(matches[1]);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    const saved = organization();
    expect(groupOf(saved, 'world')?.id).toBe('g3');
    expect(saved.groups.g1.members).toEqual(['resident1']);
    expect(saved.groups.g3.name).toBe('Favorites');
    expect(screen.getByRole('button', { name: 'World Tile' })).toHaveFocus();
  });

  it('keeps the current assignment selected and performs no write when chosen again', async () => {
    seed(5, 'g1');
    const user = userEvent.setup();
    render(<LibraryFlow />);
    const write = vi.spyOn(Storage.prototype, 'setItem');
    write.mockClear();
    await openPicker(user);
    const current = screen.getAllByRole('button', { name: 'Favorites' })[0];
    expect(current).toHaveAttribute('aria-pressed', 'true');
    await user.click(current);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(write).not.toHaveBeenCalled();
    write.mockRestore();
  });

  it.each(['Cancel', 'Close', 'Escape'])('dismisses with %s without changing storage and restores the opener', async (action) => {
    seed();
    const before = organization();
    const user = userEvent.setup();
    render(<LibraryFlow />);
    await openPicker(user);
    await user.type(screen.getByRole('textbox', { name: 'Find a Group' }), 'missing');
    expect(screen.getByRole('status')).toHaveTextContent('The search found no groups.');
    if (action === 'Escape') await user.keyboard('{Escape}');
    else await user.click(screen.getByRole('button', { name: action }));
    expect(organization()).toEqual(before);
    expect(screen.getByRole('button', { name: 'World Tile' })).toHaveFocus();
  });

  it('names and assigns a new group from an empty picker without using its name as identity', async () => {
    seed(0);
    const user = userEvent.setup();
    render(<LibraryFlow />);
    await openPicker(user);
    expect(screen.getByRole('status')).toHaveTextContent('There are no groups.');
    await user.click(screen.getByRole('button', { name: 'Create New Group…' }));
    const input = screen.getByRole('textbox', { name: 'Group Name' });
    expect(input).toHaveFocus();
    await user.type(input, '  Lantern Walks  ');
    await user.keyboard('{Enter}');
    const created = groupOf(organization(), 'world');
    expect(created?.name).toBe('Lantern Walks');
    expect(created?.id).not.toBe('Lantern Walks');
    expect(created?.members).toEqual(['world']);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('rejects blank and trimmed case-insensitive duplicates, then accepts a corrected name', async () => {
    seed();
    const before = organization();
    const user = userEvent.setup();
    render(<LibraryFlow />);
    openMenu();
    await user.click(screen.getByRole('menuitem', { name: 'Create New Group…' }));
    const input = screen.getByRole('textbox', { name: 'Group Name' });
    await user.type(input, '   ');
    expect(screen.getByRole('button', { name: 'Create Group' })).toBeDisabled();
    fireEvent.submit(input.closest('form')!);
    expect(screen.getByRole('alert')).toHaveTextContent('Write a group name.');
    await user.type(input, 'fAvOrItEs ');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('A group has this name.');
    fireEvent.submit(input.closest('form')!);
    expect(organization()).toEqual(before);
    await user.clear(input);
    await user.type(input, 'New Expedition');
    await user.click(screen.getByRole('button', { name: 'Create Group' }));
    const saved = organization();
    expect(groupOf(saved, 'world')?.name).toBe('New Expedition');
    expect(saved.groups.g1).toEqual(before.groups.g1);
    expect(saved.groups.g3).toEqual(before.groups.g3);
  });

  it('cancels creation without assigning or creating a group', async () => {
    seed();
    const before = organization();
    const user = userEvent.setup();
    render(<LibraryFlow />);
    await openPicker(user);
    await user.click(screen.getByRole('button', { name: 'Create New Group…' }));
    await user.type(screen.getByRole('textbox', { name: 'Group Name' }), 'Unfinished');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(organization()).toEqual(before);
    expect(screen.getByRole('button', { name: 'World Tile' })).toHaveFocus();
  });
});

describe('the folder face', () => {
  // 1000 px at a 200 px medium tile is 4 medium columns, so 8 base columns. A medium folder tile's
  // region is capped at four of them; a small one's at two, which its corner member can override.
  const MEMBERS = ['m1', 'm2', 'm3', 'm4', 'm5'];
  const faceItems = ['loose', ...MEMBERS, 'n1', 's1', 's2'].map((id) => ({ id, name: `Item ${id}` }));
  let resize: ((width: number) => void) | null = null;
  let latest: LibraryTiles | null = null;

  const seedFolder = () => saveTabOrganization('worlds', {
    ...emptyTabOrganization(),
    order: ['loose', 'gF', 'gN', 'gS'],
    groups: {
      // Packed Folder fills the cap and runs past it in both directions.
      gF: { id: 'gF', name: 'Packed Folder', members: MEMBERS, settings: {} },
      // Narrow Folder uses one medium column, which is less than its tile's own width.
      gN: { id: 'gN', name: 'Narrow Folder', members: ['n1'], settings: {} },
      // Small Folder is a small tile whose corner member is large.
      gS: { id: 'gS', name: 'Small Folder', members: ['s1', 's2'], settings: {} },
    },
    sizes: { m2: 'small', gS: 'small', s1: 'large' },
    // m2 leaves a hole at (0,3); m3 leaves one at (2,2) and (2,3). m4 runs past the region's right
    // edge and m5 starts below its bottom, so the face leaves both out.
    placements: {
      8: {
        loose: { row: 0, col: 0 }, gF: { row: 0, col: 2 }, gN: { row: 0, col: 4 }, gS: { row: 0, col: 6 },
        m1: { row: 0, col: 0 }, m2: { row: 0, col: 2 }, m3: { row: 2, col: 0 },
        m4: { row: 0, col: 4 }, m5: { row: 4, col: 0 },
        n1: { row: 0, col: 0 },
        s1: { row: 0, col: 0 }, s2: { row: 0, col: 4 },
      },
    },
  });

  function FaceGrid({ layout = 'grid' }: { layout?: 'grid' | 'detailed' }) {
    const tiles = useLibraryTiles('worlds', faceItems.map((item) => item.id), true);
    latest = tiles;
    return <TooltipProvider><LibraryTileGrid
      items={faceItems} idOf={(item) => item.id} nameOf={(item) => item.name} tiles={tiles}
      layout={layout} aspect="landscape" minMediumWidth={200} detailedColumnsClass="grid-cols-1"
      thumbnailOf={(item) => `/art/${item.id}.webp`} renderCard={(item) => <button>{item.name}</button>}
    /></TooltipProvider>;
  }

  const cell = (node: Element | null) => {
    const style = (node as HTMLElement | null)?.style;
    return style ? `${style.gridColumn} | ${style.gridRow}` : null;
  };
  const tileOf = (groupId: string) => document.querySelector(`[data-tile-id="${groupId}"]`) as HTMLElement;
  /** What one face draws, by member, at the cell it draws it in: a folder tile's, or the carried one's. */
  const faceOf = (groupId: string | Element = 'gF') => Object.fromEntries(
    [...(typeof groupId === 'string' ? tileOf(groupId) : groupId).querySelectorAll('[data-face-member]')]
      .map((node) => [node.getAttribute('data-face-member'), cell(node)]),
  );
  /** The `+N` badge's count on one folder tile, or null where the face leaves nobody out. */
  const badgeOf = (groupId = 'gF') =>
    tileOf(groupId).querySelector('[data-folder-badge]')?.textContent ?? null;
  const folderTile = () => tileOf('gF');
  /** The open folder board's cells for the members it draws. */
  const openBoard = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(within(folderTile()).getByText('Packed Folder'));
    const board = Object.fromEntries(MEMBERS
      .map((id) => [id, cell(document.querySelector(`[data-tile-id="${id}"]`))])
      .filter(([, at]) => at));
    await user.click(screen.getByRole('button', { name: 'Library' }));
    return board;
  };

  beforeEach(() => {
    seedFolder();
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1000);
    vi.stubGlobal('ResizeObserver', class {
      constructor(private readonly report: ResizeObserverCallback) {}
      observe() {
        resize = (width) => this.report(
          [{ contentRect: { width } } as ResizeObserverEntry], this as unknown as ResizeObserver,
        );
      }
      unobserve() {}
      disconnect() {}
    });
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    resize = null;
    latest = null;
  });

  it('draws each member that fits whole at the cell and span the open folder gives it', async () => {
    const user = userEvent.setup();
    render(<FaceGrid />);
    const face = faceOf();
    expect(face).toEqual({
      m1: '1 / span 2 | 1 / span 2',
      m2: '3 / span 1 | 1 / span 1',
      m3: '1 / span 2 | 3 / span 2',
    });
    const board = await openBoard(user);
    const { m4: _pastTheEdge, m5: _belowTheEdge, ...whole } = board;
    expect(face).toEqual(whole);
  });

  it('leaves out a member an edge would cut and counts it in the badge', () => {
    render(<FaceGrid />);
    // m4 starts inside the region and runs past its right edge; m5 starts below its bottom.
    expect(Object.keys(faceOf())).toEqual(['m1', 'm2', 'm3']);
    expect(badgeOf()).toBe('+2');
    expect(within(folderTile()).getByText('Packed Folder')).toBeInTheDocument();
    expect(within(folderTile()).getByText(String(MEMBERS.length))).toBeInTheDocument();
  });

  it('fills the tile width for a folder narrower than the cap, with no badge', () => {
    render(<FaceGrid />);
    expect(faceOf('gN')).toEqual({ n1: '1 / span 2 | 1 / span 2' });
    expect(badgeOf('gN')).toBeNull();
    // One medium column is exactly the medium tile's own width, so the face draws it at full size.
    const board = tileOf('gN').querySelector<HTMLElement>('[data-folder-face] > div');
    expect(board?.style.transform).toBe('scale(1)');
  });

  it('shows a large member whole on a small folder tile', () => {
    render(<FaceGrid />);
    // A small tile's own cap is two base columns, which would cut a large member in half.
    expect(Object.keys(faceOf('gS'))).toEqual(['s1']);
    expect(faceOf('gS').s1).toBe('1 / span 4 | 1 / span 4');
    expect(badgeOf('gS')).toBe('+1');
    // The region widens to the corner member, so the face shrinks it to exactly the tile's width.
    const gap = 16;
    const cellWidth = (1000 - 7 * gap) / 8;
    const largeWidth = 4 * cellWidth + 3 * gap;
    const board = tileOf('gS').querySelector<HTMLElement>('[data-folder-face] > div');
    expect(board?.style.transform).toBe(`scale(${cellWidth / largeWidth})`);
  });

  it('repacks with the board when the column count changes', async () => {
    const user = userEvent.setup();
    render(<FaceGrid />);
    const wide = faceOf();
    act(() => resize?.(500));
    const narrow = faceOf();
    expect(narrow).not.toEqual(wide);
    const board = await openBoard(user);
    expect(board).toMatchObject(narrow);
  });

  it('follows a member resized inside the folder', async () => {
    const user = userEvent.setup();
    render(<FaceGrid />);
    act(() => latest?.setSize('m2', 'medium'));
    expect(faceOf().m2).toMatch(/span 2 \| .* span 2$/);
    const board = await openBoard(user);
    expect(board.m2).toBe(faceOf().m2);
  });

  it('keeps the mosaic in the detailed layout', () => {
    render(<FaceGrid layout="detailed" />);
    expect(document.querySelector('[data-folder-face]')).toBeNull();
    expect(document.querySelector('[data-folder-mosaic]')).not.toBeNull();
  });

  /** The carried tile's box, which jsdom reports as nothing until a test says otherwise. */
  const CARRIED = { left: 0, top: 0, width: 240, height: 180 };

  /** Pick a tile up and move far enough for the mouse sensor's distance constraint to let go. */
  const carry = (groupId: string) => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      ...CARRIED, right: CARRIED.width, bottom: CARRIED.height, x: 0, y: 0, toJSON: () => CARRIED,
    } as DOMRect);
    fireEvent.mouseDown(tileOf(groupId).querySelector('[role="button"]') ?? tileOf(groupId));
    fireEvent.mouseMove(document, { clientX: 80, clientY: 80 });
    // The first move past the constraint starts the drag; the overlay is sized by the one after it.
    fireEvent.mouseMove(document, { clientX: 96, clientY: 96 });
  };
  const carried = () => document.querySelector<HTMLElement>('[data-drag-overlay]');

  it('carries the folder tile under the pointer as the face, not as four mosaic cells', () => {
    render(<FaceGrid />);
    carry('gF');
    const overlay = carried();
    expect(overlay).not.toBeNull();
    expect(overlay?.querySelector('[data-folder-mosaic]')).toBeNull();
    // The same members at the same cells the tile draws, because both read one region function.
    expect(faceOf(overlay!)).toEqual(faceOf('gF'));
  });

  it('keeps the carried tile at half opacity with no shadow, ring, or name bar', () => {
    render(<FaceGrid />);
    carry('gF');
    const frame = carried()?.firstElementChild;
    expect(frame?.className).toContain('opacity-50');
    expect(frame?.className).not.toMatch(/shadow|ring-/);
    expect(carried()?.querySelector('[data-folder-title]')).toBeNull();
    // The tile's own border, which is not chrome the overlay adds: the face is drawn to sit under
    // it, so dropping it would let the face bleed past the carried tile's rounded corner.
    expect(frame?.className).toContain('border-2');
    expect(tileOf('gF').querySelector('[data-folder-face]')?.parentElement?.className)
      .toContain('border-2');
  });

  it('carries the mosaic in the detailed layout', () => {
    render(<FaceGrid layout="detailed" />);
    carry('gF');
    expect(carried()?.querySelector('[data-folder-mosaic]')).not.toBeNull();
    expect(carried()?.querySelector('[data-folder-face]')).toBeNull();
  });
});
