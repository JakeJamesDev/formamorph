// Must load before the storage singletons, whose first use opens IndexedDB.
import 'fake-indexeddb/auto';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BundledContentChoice } from './BundledContentChoice';
import { libraryItems } from '@/lib/librarySources';
import EntityStorageService from '@/services/EntityStorageService';
import WorldStorageService from '@/services/WorldStorageService';
import type { ContentLink, Entity, World } from '@/types';

vi.mock('@/services/AuthService', () => ({ default: { getCurrentUser: () => null } }));
vi.mock('react-toastify', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

const entity = (link?: ContentLink): Entity => ({
  id: 'e1', name: 'Wren', aiDescription: 'A marsh guide.', ...(link ? { link } : {}),
});

const worldData = (entities: Entity[]): World => ({
  worldOverview: { name: 'Sedge Landing' },
  stats: [], locations: [], traits: [], statUpdates: [],
  entities,
  dictionaries: [],
  placeholders: [],
} as unknown as World);

async function storeWorld(data: World) {
  await WorldStorageService.storeWorld({
    id: 'w-1', name: 'Sedge Landing', author: 'Ann', data: data as never,
  });
}

/** Render the choice over a stored world, reporting what it writes back. */
function draw(data: World) {
  const applied: World[] = [];
  render(<BundledContentChoice worldId="w-1" data={data} onApplied={(next) => applied.push(next)} />);
  return applied;
}

describe('BundledContentChoice', () => {
  beforeEach(async () => {
    for (const id of await WorldStorageService.getWorldIds()) await WorldStorageService.deleteWorld(id);
    for (const item of await libraryItems('entity')) await EntityStorageService.deleteEntity(item.id);
  });

  it('draws nothing for a world that carries no bundled content', () => {
    draw(worldData([entity()]));

    expect(screen.queryByText('Link bundled content to My Library')).not.toBeInTheDocument();
  });

  it('starts unchecked while the bundled content follows nothing', () => {
    draw(worldData([entity({ bundledFrom: 'their-lib', sourceName: 'Wren the Guide' })]));

    expect(screen.getByRole('checkbox')).not.toBeChecked();
  });

  it('places the content in the library and links the copy when it is checked', async () => {
    const data = worldData([entity({ bundledFrom: 'their-lib', sourceName: 'Wren the Guide' })]);
    await storeWorld(data);
    const applied = draw(data);

    await userEvent.click(screen.getByRole('checkbox'));

    await waitFor(() => expect(applied).toHaveLength(1));
    const library = await libraryItems('entity');
    expect(library).toHaveLength(1);
    expect(applied[0].entities[0].link?.libraryId).toBe(library[0].id);
    // The world still holds exactly the content the file shipped.
    expect(applied[0].entities[0].aiDescription).toBe('A marsh guide.');
  });

  it('writes the linked content back to storage', async () => {
    const data = worldData([entity({ bundledFrom: 'their-lib' })]);
    await storeWorld(data);
    draw(data);

    await userEvent.click(screen.getByRole('checkbox'));

    await waitFor(async () => {
      const stored = await WorldStorageService.getWorldData('w-1') as { entities: Entity[] };
      expect(stored.entities[0].link?.libraryId).toBeTruthy();
    });
  });

  it('releases the copy when it is unchecked, and keeps its content', async () => {
    const data = worldData([entity({
      bundledFrom: 'lib-1', libraryId: 'lib-1', sourceRevision: 'r1', sourceName: 'Wren the Guide',
    })]);
    await storeWorld(data);
    const applied = draw(data);

    expect(screen.getByRole('checkbox')).toBeChecked();
    await userEvent.click(screen.getByRole('checkbox'));

    await waitFor(() => expect(applied).toHaveLength(1));
    expect(applied[0].entities[0].link).toEqual({ bundledFrom: 'lib-1', sourceName: 'Wren the Guide' });
    expect(applied[0].entities[0].aiDescription).toBe('A marsh guide.');
  });
});
