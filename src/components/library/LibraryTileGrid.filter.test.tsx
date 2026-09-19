import { beforeEach, describe, expect, it, vi } from 'vitest';
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
