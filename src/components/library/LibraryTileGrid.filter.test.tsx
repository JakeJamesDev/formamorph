import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { emptyTabOrganization, loadTabOrganization, saveTabOrganization } from '@/lib/libraryOrganization';
import { useLibraryTiles } from '@/lib/useLibraryTiles';
import { entityLibraryPredicate } from '@/lib/entityLibraryFilter';
import { LibraryTileGrid } from './LibraryTileGrid';
import { TooltipProvider } from '@/components/ui/tooltip';

/**
 * The Entities tab's Personas filter: a view over the saved arrangement that never rewrites it.
 */

const items = [
  { id: 'p1', name: 'Loose Persona', persona: true },
  { id: 'n1', name: 'Loose Entity' },
  { id: 'p2', name: 'Filed Persona', persona: true },
  { id: 'n2', name: 'Filed Entity' },
  { id: 'n3', name: 'Other Filed Entity' },
];
const ITEM_IDS = items.map((item) => item.id);

const seed = () => saveTabOrganization('entities', {
  ...emptyTabOrganization(),
  order: ['p1', 'n1', 'gA', 'gB'],
  groups: {
    gA: { id: 'gA', name: 'Mixed Folder', members: ['p2', 'n2'], settings: {} },
    gB: { id: 'gB', name: 'Plain Folder', members: ['n3'], settings: {} },
  },
});

function Grid({ personas }: { personas: boolean }) {
  const tiles = useLibraryTiles('entities', ITEM_IDS, true);
  return <TooltipProvider><LibraryTileGrid
    items={items} idOf={(item) => item.id} nameOf={(item) => item.name} tiles={tiles}
    layout="grid" aspect="portrait" minMediumWidth={200} detailedColumnsClass="grid-cols-1"
    thumbnailOf={() => undefined} renderCard={(item) => <button>{item.name}</button>}
    onDelete={vi.fn()}
    filter={entityLibraryPredicate(personas ? 'personas' : 'all')}
  /></TooltipProvider>;
}

const shownCards = () => screen.queryAllByRole('button').map((b) => b.textContent ?? '');

beforeEach(() => { localStorage.clear(); seed(); });

describe('the Personas filter', () => {
  it('shows loose personas and folders holding one, and hides the rest', () => {
    render(<Grid personas />);
    const shown = shownCards().join('|');
    expect(shown).toContain('Loose Persona');
    expect(shown).toContain('Mixed Folder');
    expect(shown).not.toContain('Loose Entity');
    expect(shown).not.toContain('Plain Folder');
  });

  it('counts only a folder’s personas and opens to show only them, with no rename field', async () => {
    render(<Grid personas />);
    const folder = screen.getAllByRole('button').find((b) => b.textContent?.includes('Mixed Folder'));
    expect(folder?.textContent).toContain('1');
    await userEvent.click(folder!);
    expect(screen.getByRole('button', { name: 'Filed Persona' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Filed Entity' })).toBeNull();
    expect(screen.queryByRole('textbox', { name: 'Group name' })).toBeNull();
  });

  it('offers the item’s own actions but no size or folder edits', () => {
    render(<Grid personas />);
    fireEvent.contextMenu(screen.getByRole('button', { name: 'Loose Persona' }));
    const actions = screen.getAllByRole('menuitem').map((m) => m.textContent?.trim());
    expect(actions).toEqual(['Delete']);
    expect(screen.queryByText('Tile Size')).toBeNull();
  });

  it('keeps the size and folder edits when the tab shows everything', () => {
    render(<Grid personas={false} />);
    expect(shownCards().join('|')).toContain('Loose Entity');
    fireEvent.contextMenu(screen.getByRole('button', { name: 'Loose Persona' }));
    expect(screen.getByText('Tile Size')).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Add To Group…' })).toBeInTheDocument();
  });

  it('turns on and off without rewriting the saved arrangement', () => {
    const before = JSON.stringify(loadTabOrganization('entities'));
    const { rerender } = render(<Grid personas />);
    expect(JSON.stringify(loadTabOrganization('entities'))).toBe(before);

    rerender(<Grid personas={false} />);
    expect(shownCards().join('|')).toContain('Loose Entity');
    expect(shownCards().join('|')).toContain('Plain Folder');
    expect(JSON.stringify(loadTabOrganization('entities'))).toBe(before);
  });
});

describe('a folder face in a filtered view', () => {
  const faceItems = [
    { id: 'p2', name: 'Filed Persona', persona: true },
    { id: 'n2', name: 'Filed Entity' },
    { id: 'p3', name: 'Second Filed Persona', persona: true },
  ];

  function FaceGrid() {
    const tiles = useLibraryTiles('entities', faceItems.map((item) => item.id), true);
    return <TooltipProvider><LibraryTileGrid
      items={faceItems} idOf={(item) => item.id} nameOf={(item) => item.name} tiles={tiles}
      layout="grid" aspect="portrait" minMediumWidth={200} detailedColumnsClass="grid-cols-1"
      thumbnailOf={(item) => `/art/${item.id}.webp`} renderCard={(item) => <button>{item.name}</button>}
      filter={entityLibraryPredicate('personas')}
    /></TooltipProvider>;
  }

  const cells = (selector: string, attribute: string) => Object.fromEntries(
    [...document.querySelectorAll<HTMLElement>(selector)]
      .map((node) => [node.getAttribute(attribute), `${node.style.gridColumn} | ${node.style.gridRow}`]),
  );

  beforeEach(() => {
    // 1000 px at a 200 px medium tile is 8 base columns, and a medium folder tile's region is capped
    // at four of them. Unfiltered, p3 stands in the fifth column, past that edge; filtered, it packs
    // into the columns n2 leaves and comes inside the region.
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1000);
    saveTabOrganization('entities', {
      ...emptyTabOrganization(),
      order: ['gA'],
      groups: { gA: { id: 'gA', name: 'Mixed Folder', members: ['p2', 'n2', 'p3'], settings: {} } },
      placements: { 8: { gA: { row: 0, col: 0 }, p2: { row: 0, col: 0 }, n2: { row: 0, col: 2 }, p3: { row: 0, col: 4 } } },
    });
  });
  afterEach(() => vi.restoreAllMocks());

  it('draws only passing members, packed as the filtered folder board packs them', async () => {
    render(<FaceGrid />);
    const face = cells('[data-face-member]', 'data-face-member');
    expect(face).toEqual({ p2: '1 / span 2 | 1 / span 2', p3: '3 / span 2 | 1 / span 2' });
    // A region built from the members the filter drops would run six columns wide and leave p3
    // outside its right edge, so the face would shrink further and the badge would count one.
    expect(document.querySelector('[data-folder-badge]')).toBeNull();
    const gap = 16;
    const cellWidth = (1000 - 7 * gap) / 8;
    const side = (span: number) => span * cellWidth + (span - 1) * gap;
    const board = document.querySelector<HTMLElement>('[data-folder-face] > div');
    expect(board?.style.transform).toBe(`scale(${side(2) / side(4)})`);

    await userEvent.click(screen.getByText('Mixed Folder'));
    expect(cells('[data-tile-id]', 'data-tile-id')).toEqual(face);
  });
});
