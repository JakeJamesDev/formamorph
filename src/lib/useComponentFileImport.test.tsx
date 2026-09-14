// Must load before the storage singletons, whose first use opens IndexedDB.
import 'fake-indexeddb/auto';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useComponentFileImport } from './useComponentFileImport';
import type { ComponentFileLinks } from './componentFileLinks';
import { libraryItems } from './librarySources';
import type { LinkableContent } from './linkedContent';
import EntityStorageService from '@/services/EntityStorageService';
import WorldStorageService from '@/services/WorldStorageService';
import type { Entity } from '@/types';

vi.mock('@/services/AuthService', () => ({ default: { getCurrentUser: () => null } }));
vi.mock('react-toastify', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

const found: string[] = [];

/** A host that reviews one file as soon as it mounts, the way the main menu does after reading it. */
function Harness({ content, links }: { content: LinkableContent; links: ComponentFileLinks }) {
  const { reviewFile, storeFile, dialogs } = useComponentFileImport({
    onFindWorld: (listingId) => found.push(listingId),
    onImported: () => {},
  });
  return (
    <>
      <button onClick={() => { void reviewFile('entity', content, links); }}>Review</button>
      <button onClick={() => { void storeFile('entity', content, links); }}>Store</button>
      {dialogs}
    </>
  );
}

const card: Entity = { id: 'file-content', name: 'Wren', aiDescription: 'From the file.' };

async function storeWorld(id: string, name: string, over: { sourceId?: string } = {}) {
  await WorldStorageService.storeWorld({
    id,
    name,
    author: 'Ann',
    ...over,
    data: {
      worldOverview: { name },
      stats: [], locations: [], traits: [], statUpdates: [], entities: [], dictionaries: [],
      placeholders: [],
    },
  });
}

async function open(links: ComponentFileLinks, content: LinkableContent = card) {
  render(<Harness content={content} links={links} />);
  await userEvent.click(screen.getByRole('button', { name: 'Review' }));
}

describe('useComponentFileImport', () => {
  beforeEach(async () => {
    found.length = 0;
    for (const id of await WorldStorageService.getWorldIds()) await WorldStorageService.deleteWorld(id);
    for (const item of await libraryItems('entity')) await EntityStorageService.deleteEntity(item.id);
  });

  it('offers an installed world the file names', async () => {
    await storeWorld('w-1', 'Sedge Landing', { sourceId: 'listing-w' });

    await open({ associations: [{ id: 'listing-w', name: 'Sedge Landing' }] });

    expect(await screen.findByText('Add to Your Worlds')).toBeInTheDocument();
    expect(screen.getByText('Sedge Landing')).toBeInTheDocument();
  });

  it('imports the component alone when no world is chosen', async () => {
    await storeWorld('w-1', 'Sedge Landing', { sourceId: 'listing-w' });
    await open({ associations: [{ id: 'listing-w', name: 'Sedge Landing' }] });

    await userEvent.click(await screen.findByRole('button', { name: 'Import Entity' }));

    await waitFor(async () => expect(await libraryItems('entity')).toHaveLength(1));
    const stored = await WorldStorageService.getWorldData('w-1') as { entities: Entity[] };
    expect(stored.entities).toHaveLength(0);
  });

  it('gives a chosen world a linked copy of the component', async () => {
    await storeWorld('w-1', 'Sedge Landing', { sourceId: 'listing-w' });
    await open({ associations: [{ id: 'listing-w', name: 'Sedge Landing' }] });

    await userEvent.click(await screen.findByRole('checkbox'));
    await userEvent.click(screen.getByRole('button', { name: 'Import Entity' }));

    await waitFor(async () => {
      const stored = await WorldStorageService.getWorldData('w-1') as { entities: Entity[] };
      expect(stored.entities).toHaveLength(1);
    });
    const stored = await WorldStorageService.getWorldData('w-1') as { entities: Entity[] };
    const library = await libraryItems('entity');
    expect(stored.entities[0].link?.libraryId).toBe(library[0].id);
    expect(stored.entities[0].aiDescription).toBe('From the file.');
  });

  it('hands a world this machine has not got to Community Creations', async () => {
    await open({ associations: [{ id: 'listing-w', name: 'The Long Thaw' }] });

    expect(await screen.findByText('Worlds You Do Not Have')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Open Listing' }));

    expect(found).toEqual(['listing-w']);
  });

  it('imports a file naming an unreachable world without reporting anything missing', async () => {
    // Offline: the file's world is neither installed nor reachable, which resolves nothing and blocks
    // nothing. The component still lands.
    const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    try {
      await open({ associations: [{ id: 'listing-w', name: 'The Long Thaw' }] });
      expect(await screen.findByText(/cannot connect to Community Creations/)).toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', { name: 'Import Entity' }));

      await waitFor(async () => expect(await libraryItems('entity')).toHaveLength(1));
    } finally {
      online.mockRestore();
    }
  });

  it('stores a file naming a listing as one copy of it, however many times it is imported', async () => {
    // The batch import path, which reviews nothing: two files of one listing must leave one library row.
    render(<Harness content={card} links={{ source: { sourceId: 'listing-e', sourceName: 'Wren' } }} />);
    const store = screen.getByRole('button', { name: 'Store' });

    await userEvent.click(store);
    await waitFor(async () => expect(await libraryItems('entity')).toHaveLength(1));
    await userEvent.click(store);

    await waitFor(async () => expect(await libraryItems('entity')).toHaveLength(1));
    expect((await libraryItems('entity'))[0].sourceId).toBe('listing-e');
  });

  it('stores a file naming no listing as the player\'s own item', async () => {
    render(<Harness content={card} links={{}} />);

    await userEvent.click(screen.getByRole('button', { name: 'Store' }));

    await waitFor(async () => expect(await libraryItems('entity')).toHaveLength(1));
    expect((await libraryItems('entity'))[0].sourceId).toBeUndefined();
  });

  it('opens the update review when the file\'s source is already in the library', async () => {
    await EntityStorageService.storeEntity({
      id: 'lib-1',
      name: 'Wren',
      createdAt: '2026-01-01T00:00:00.000Z',
      data: { id: 'lib-1', name: 'Wren', aiDescription: 'What the library holds.' },
      sourceId: 'listing-e',
    });
    await storeWorld('w-1', 'Sedge Landing');
    await WorldStorageService.updateWorldContent('w-1', (data) => ({
      ...data,
      entities: [{ id: 'copy', name: 'Wren', link: { libraryId: 'lib-1', sourceRevision: 'old' } }],
    }));

    await open({ source: { sourceId: 'listing-e', sourceName: 'Wren' } });

    expect(await screen.findByText('Update Available')).toBeInTheDocument();
    expect(screen.getByText(/differs from the library entity/)).toBeInTheDocument();
    // Nothing is written until Apply Updates.
    expect(await libraryItems('entity')).toHaveLength(1);
  });

  it('applies an imported revision to the library item and to the world that answered Update', async () => {
    await EntityStorageService.storeEntity({
      id: 'lib-1',
      name: 'Wren',
      createdAt: '2026-01-01T00:00:00.000Z',
      data: { id: 'lib-1', name: 'Wren', aiDescription: 'What the library holds.' },
      sourceId: 'listing-e',
    });
    await storeWorld('w-1', 'Sedge Landing');
    await WorldStorageService.updateWorldContent('w-1', (data) => ({
      ...data,
      entities: [{ id: 'copy', name: 'Wren', link: { libraryId: 'lib-1', sourceRevision: 'old' } }],
    }));
    await open({ source: { sourceId: 'listing-e', sourceName: 'Wren' } });

    await userEvent.click(await screen.findByRole('button', { name: 'Apply Updates' }));

    await waitFor(async () => {
      const stored = await WorldStorageService.getWorldData('w-1') as { entities: Entity[] };
      expect(stored.entities[0].aiDescription).toBe('From the file.');
    });
    expect(await EntityStorageService.getEntityData('lib-1'))
      .toMatchObject({ aiDescription: 'From the file.' });
  });
});
