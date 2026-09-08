import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { emptyTabOrganization, groupOf, loadTabOrganization, saveTabOrganization, type LibraryTabOrganization } from '@/lib/libraryOrganization';
import { useLibraryTiles } from '@/lib/useLibraryTiles';
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
