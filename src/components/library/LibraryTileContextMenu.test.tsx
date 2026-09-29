import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { LibraryGroup } from '@/lib/libraryOrganization';
import { LibraryTileContextMenu, type LibraryTileMenuModel } from './LibraryTileContextMenu';
import { AvatarThumbnailMenuItems } from './AvatarThumbnail';
import type { ModelMetadata } from '@/types';

const group: LibraryGroup = { id: 'group-1', name: 'Favorites', members: ['group-1'], settings: {} };

const groupTileModel = (): LibraryTileMenuModel => ({
  groups: [group],
  group: () => group,
  groupOfItem: () => undefined,
  size: () => 'medium',
  setSize: vi.fn(),
  addTo: vi.fn(),
  groupWithNew: vi.fn(),
  removeFrom: vi.fn(),
  disband: vi.fn(),
});

describe('LibraryTileContextMenu', () => {
  it('retains the production group-tile actions after extraction', async () => {
    const user = userEvent.setup();
    const tiles = groupTileModel();
    const onOpenGroup = vi.fn();
    const onDelete = vi.fn();
    render(
      <LibraryTileContextMenu
        id={group.id}
        name={group.name}
        tiles={tiles}
        layout="grid"
        renderedIds={[group.id]}
        baseCols={4}
        onOpenGroup={onOpenGroup}
        onDelete={onDelete}
      >
        <button>Favorites tile</button>
      </LibraryTileContextMenu>,
    );

    fireEvent.contextMenu(screen.getByRole('button', { name: 'Favorites tile' }));
    expect(screen.queryByRole('menuitem', { name: /^Delete$/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole('menuitem', { name: 'Open Group' }));
    expect(onOpenGroup).toHaveBeenCalledWith(group.id);

    fireEvent.contextMenu(screen.getByRole('button', { name: 'Favorites tile' }));
    await user.click(screen.getByRole('menuitem', { name: 'Delete Group' }));
    expect(tiles.disband).toHaveBeenCalledWith(group.id);
    expect(onDelete).not.toHaveBeenCalled();
  });

  it('omits Tile Size from the detailed layout', () => {
    render(
      <LibraryTileContextMenu
        id="world-1"
        name="World"
        tiles={{ ...groupTileModel(), group: () => undefined }}
        layout="detailed"
        renderedIds={['world-1']}
        baseCols={4}
        onOpenGroup={vi.fn()}
      >
        <button>World tile</button>
      </LibraryTileContextMenu>,
    );

    fireEvent.contextMenu(screen.getByRole('button', { name: 'World tile' }));
    expect(screen.queryByText('Tile Size')).not.toBeInTheDocument();
    expect(screen.getByText('Add To Group')).toBeInTheDocument();
  });
});

describe('Publish', () => {
  const itemTiles = (): LibraryTileMenuModel => ({ ...groupTileModel(), group: () => undefined });

  const showItem = (props: Record<string, unknown>) => render(
    <LibraryTileContextMenu
      id="model-1"
      name="Sedge"
      tiles={itemTiles()}
      layout="grid"
      renderedIds={['model-1']}
      baseCols={4}
      onOpenGroup={vi.fn()}
      {...props}
    >
      <button>Sedge tile</button>
    </LibraryTileContextMenu>,
  );

  it('publishes the tile it was opened on', async () => {
    const user = userEvent.setup();
    const onPublish = vi.fn();
    showItem({ onPublish, onDelete: vi.fn() });

    fireEvent.contextMenu(screen.getByRole('button', { name: 'Sedge tile' }));
    await user.click(screen.getByRole('menuitem', { name: 'Publish' }));

    expect(onPublish).toHaveBeenCalledWith('model-1');
  });

  it('is absent on a tab that cannot publish, which still keeps Delete', () => {
    showItem({ onDelete: vi.fn() });

    fireEvent.contextMenu(screen.getByRole('button', { name: 'Sedge tile' }));

    expect(screen.queryByRole('menuitem', { name: 'Publish' })).not.toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeInTheDocument();
  });

  it('is absent on a folder, which is an arrangement rather than a thing to publish', () => {
    render(
      <LibraryTileContextMenu
        id={group.id}
        name={group.name}
        tiles={groupTileModel()}
        layout="grid"
        renderedIds={[group.id]}
        baseCols={4}
        onOpenGroup={vi.fn()}
        onPublish={vi.fn()}
        onDelete={vi.fn()}
      >
        <button>Favorites tile</button>
      </LibraryTileContextMenu>,
    );

    fireEvent.contextMenu(screen.getByRole('button', { name: 'Favorites tile' }));

    expect(screen.queryByRole('menuitem', { name: 'Publish' })).not.toBeInTheDocument();
  });
});

describe('Avatar Thumbnail', () => {
  const showAvatar = (model: Pick<ModelMetadata, 'hasFileThumbnail' | 'thumbnailSource'>, onChange = vi.fn()) => {
    render(
      <LibraryTileContextMenu
        id="model-1"
        name="Sedge"
        tiles={{ ...groupTileModel(), group: () => undefined }}
        layout="grid"
        renderedIds={['model-1']}
        baseCols={4}
        onOpenGroup={vi.fn()}
        onDelete={vi.fn()}
        itemActions={() => <AvatarThumbnailMenuItems model={model} onChange={onChange} />}
      >
        <button>Sedge tile</button>
      </LibraryTileContextMenu>,
    );
    fireEvent.contextMenu(screen.getByRole('button', { name: 'Sedge tile' }));
    return onChange;
  };

  it('marks From File active by default', () => {
    showAvatar({ hasFileThumbnail: true });
    expect(screen.getByText('Thumbnail')).toBeInTheDocument();
    expect(screen.getByRole('menuitemradio', { name: 'From File' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('menuitemradio', { name: 'Generated' })).toHaveAttribute('aria-checked', 'false');
  });

  it('marks the stored choice active', () => {
    showAvatar({ hasFileThumbnail: true, thumbnailSource: 'generated' });
    expect(screen.getByRole('menuitemradio', { name: 'Generated' })).toHaveAttribute('aria-checked', 'true');
  });

  it('calls back with the picked source', async () => {
    const user = userEvent.setup();
    const onChange = showAvatar({ hasFileThumbnail: true });
    await user.click(screen.getByRole('menuitemradio', { name: 'Generated' }));
    expect(onChange).toHaveBeenCalledWith('generated');
  });

  it.each([false, undefined])('is absent when the file has no embedded image (%s)', (hasFileThumbnail) => {
    showAvatar({ hasFileThumbnail });
    expect(screen.queryByText('Thumbnail')).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitemradio', { name: 'Generated' })).not.toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeInTheDocument();
  });
});
