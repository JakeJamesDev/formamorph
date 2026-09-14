// Must load before the storage singletons, whose first use opens IndexedDB.
import 'fake-indexeddb/auto';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useComponentUpdates } from './useComponentUpdates';
import type { LiveWorld } from '@/lib/componentUpdateRun';
import EntityStorageService from '@/services/EntityStorageService';
import WorldStorageService from '@/services/WorldStorageService';
import type { ContentLink, Entity } from '@/types';

vi.mock('@/services/AuthService', () => ({ default: { getCurrentUser: () => null } }));
vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));

const { toast } = await import('react-toastify');

const LIBRARY_ID = 'lib-1';

/** The library item every check in this file is against, at `revision`. */
async function seedLibraryItem(revision: string, over: Partial<Entity> = {}) {
  await EntityStorageService.storeEntity({
    id: LIBRARY_ID,
    name: 'Sedge',
    createdAt: 'r0',
    editedAt: revision,
    lastAccessed: revision,
    data: { id: 'lib-content', name: 'Sedge', aiDescription: "The author's latest.", ...over },
  });
}

const copy = (link: ContentLink, over: Partial<Entity> = {}): Entity => ({
  id: 'copy-1', name: 'Sedge', aiDescription: 'What this world holds.', link, ...over,
});

async function seedWorld(id: string, name: string, entities: Entity[]) {
  await WorldStorageService.storeWorld({
    id,
    name,
    data: {
      worldOverview: { name },
      stats: [], locations: [], traits: [], statUpdates: [],
      entities: entities as unknown as unknown[],
      dictionaries: [],
    },
  });
}

/** The Check for Updates entry point, with the review it opens. */
function Host({ live }: { live?: LiveWorld }) {
  const { checkForUpdates, updateDialog } = useComponentUpdates(live ? [live] : undefined);
  return (
    <>
      <button onClick={() => { void checkForUpdates('entity', LIBRARY_ID); }}>Check for Updates</button>
      {updateDialog}
    </>
  );
}

const check = () => fireEvent.click(screen.getByRole('button', { name: 'Check for Updates' }));

/** The row one world is drawn in, so its own controls can be found inside it. */
const rowFor = (world: string): HTMLElement => screen.getByText(world).closest('li')!;

/**
 * Choose one row's action. Radix opens a Select on pointerdown and takes an option on Enter; the options
 * render in a portal outside the dialog, which Radix marks `aria-hidden` while the Select is open.
 */
async function choose(world: string, label: string) {
  const trigger = within(rowFor(world)).getByRole('combobox');
  fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false, pointerType: 'mouse' });
  await waitFor(() => expect(trigger).toHaveAttribute('aria-expanded', 'true'));
  fireEvent.keyDown(await screen.findByRole('option', { name: label, hidden: true }), { key: 'Enter' });
}

/** One world's stored entities, read back. */
async function storedEntities(id: string): Promise<Entity[]> {
  const data = await WorldStorageService.getWorldData(id) as { entities: Entity[] };
  return data.entities;
}

beforeEach(async () => {
  vi.clearAllMocks();
  for (const id of await WorldStorageService.getWorldIds()) await WorldStorageService.deleteWorld(id);
  for (const row of await EntityStorageService.getEntityMetadata()) {
    await EntityStorageService.deleteEntity(row.id);
  }
});

afterEach(cleanup);

describe('Check for Updates', () => {
  it('reports up to date and opens no review when nothing changed', async () => {
    await seedLibraryItem('r2');
    await seedWorld('w-1', 'Sedge Landing', [copy({ libraryId: LIBRARY_ID, sourceRevision: 'r2' })]);
    render(<Host />);

    check();

    await waitFor(() => expect(toast.info).toHaveBeenCalledWith('“Sedge” is up to date.'));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('lists each linked world, defaulting an unmodified copy to Update and a replacement to Keep Mine', async () => {
    await seedLibraryItem('r2');
    await seedWorld('w-1', 'Sedge Landing', [copy({ libraryId: LIBRARY_ID, sourceRevision: 'r1' })]);
    await seedWorld('w-2', 'Fen Crossing', [
      copy({ libraryId: LIBRARY_ID, sourceRevision: 'r1', localReplacement: true }, { id: 'copy-2' }),
    ]);
    render(<Host />);

    check();

    await screen.findByText('Sedge Landing');
    expect(within(rowFor('Sedge Landing')).getByRole('combobox').textContent).toBe('Update');
    expect(within(rowFor('Fen Crossing')).getByRole('combobox').textContent).toBe('Keep Mine');
    expect(within(rowFor('Fen Crossing')).getByText('Local replacement')).toBeTruthy();
    expect(within(rowFor('Fen Crossing')).getByText("Keep Mine keeps this world's edits.")).toBeTruthy();
    expect(within(rowFor('Sedge Landing')).queryByText(/keeps this world's edits/)).toBeNull();
  });

  it('shows changed fields, grouped entries, and unchanged content behind a disclosure', async () => {
    await seedLibraryItem('r2');
    await seedWorld('w-1', 'Sedge Landing', [copy({ libraryId: LIBRARY_ID, sourceRevision: 'r1' })]);
    render(<Host />);

    check();
    await screen.findByText('Sedge Landing');
    fireEvent.click(screen.getByRole('button', { name: /View Changes/ }));

    const row = rowFor('Sedge Landing');
    await waitFor(() => expect(within(row).queryByText('AI Description')).toBeTruthy());
    expect(within(row).getByText(/What this world holds\./)).toBeTruthy();
    expect(within(row).getByText(/The author's latest\./)).toBeTruthy();
    // Name did not change, so it sits behind the disclosure rather than in the changed list.
    expect(within(row).queryByText('Name')).toBeNull();
    fireEvent.click(within(row).getByRole('button', { name: /Unchanged/ }));
    expect(within(row).getByText('Name')).toBeTruthy();
  });

  it('changes nothing until Apply Updates, then applies each row its own action', async () => {
    await seedLibraryItem('r2');
    await seedWorld('w-1', 'Sedge Landing', [copy({ libraryId: LIBRARY_ID, sourceRevision: 'r1' })]);
    await seedWorld('w-2', 'Fen Crossing', [
      copy({ libraryId: LIBRARY_ID, sourceRevision: 'r1' }, { id: 'copy-2' }),
    ]);
    render(<Host />);

    check();
    await screen.findByText('Sedge Landing');
    await choose('Fen Crossing', 'Unlink');
    // Selecting alone writes nothing.
    expect((await storedEntities('w-2'))[0].link).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Apply Updates' }));

    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    expect((await storedEntities('w-1'))[0].aiDescription).toBe("The author's latest.");
    const unlinked = (await storedEntities('w-2'))[0];
    expect(unlinked.link).toBeUndefined();
    expect(unlinked.aiDescription).toBe('What this world holds.');
  });

  it('omits a kept world from the next check and lists it again on a newer revision', async () => {
    await seedLibraryItem('r2');
    await seedWorld('w-1', 'Sedge Landing', [
      copy({ libraryId: LIBRARY_ID, sourceRevision: 'r1', localReplacement: true }),
    ]);
    render(<Host />);

    check();
    await screen.findByText('Sedge Landing');
    fireEvent.click(screen.getByRole('button', { name: 'Apply Updates' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    check();
    await waitFor(() => expect(toast.info).toHaveBeenCalledWith('“Sedge” is up to date.'));

    await seedLibraryItem('r3');
    check();
    await screen.findByText('Sedge Landing');
    expect((await storedEntities('w-1'))[0].aiDescription).toBe('What this world holds.');
  });

  it('keeps one world when another fails, and offers Retry for the failure alone', async () => {
    await seedLibraryItem('r2');
    await seedWorld('w-good', 'Sedge Landing', [copy({ libraryId: LIBRARY_ID, sourceRevision: 'r1' })]);
    await seedWorld('w-gone', 'Fen Crossing', [
      copy({ libraryId: LIBRARY_ID, sourceRevision: 'r1' }, { id: 'copy-2' }),
    ]);
    render(<Host />);

    check();
    await screen.findByText('Sedge Landing');
    // The other world lost the copy while the review was open.
    await seedWorld('w-gone', 'Fen Crossing', [{ id: 'someone-else', name: 'Other' }]);

    fireEvent.click(screen.getByRole('button', { name: 'Apply Updates' }));

    await screen.findByRole('button', { name: 'Retry' });
    expect(screen.queryByText('Sedge Landing')).toBeNull();
    expect((await storedEntities('w-good'))[0].aiDescription).toBe("The author's latest.");
    expect((await storedEntities('w-gone'))[0].name).toBe('Other');

    // The copy comes back, and Retry alone finishes that world.
    await seedWorld('w-gone', 'Fen Crossing', [
      copy({ libraryId: LIBRARY_ID, sourceRevision: 'r1' }, { id: 'copy-2' }),
    ]);
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect((await storedEntities('w-gone'))[0].aiDescription).toBe("The author's latest.");
  });

  it('leaves a second failure standing when one is retried', async () => {
    await seedLibraryItem('r2');
    for (const [id, name] of [['w-a', 'Sedge Landing'], ['w-b', 'Fen Crossing']]) {
      await seedWorld(id, name, [copy({ libraryId: LIBRARY_ID, sourceRevision: 'r1' }, { id: `copy-${id}` })]);
    }
    render(<Host />);

    check();
    await screen.findByText('Sedge Landing');
    // Both worlds lose their copy while the review is open, so Apply fails on each.
    await seedWorld('w-a', 'Sedge Landing', [{ id: 'gone-a', name: 'Other' }]);
    await seedWorld('w-b', 'Fen Crossing', [{ id: 'gone-b', name: 'Other' }]);
    fireEvent.click(screen.getByRole('button', { name: 'Apply Updates' }));
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Retry' })).toHaveLength(2));

    // Only the first world's copy comes back; retrying it must not close the review over the second.
    await seedWorld('w-a', 'Sedge Landing', [
      copy({ libraryId: LIBRARY_ID, sourceRevision: 'r1' }, { id: 'copy-w-a' }),
    ]);
    fireEvent.click(within(rowFor('Sedge Landing')).getByRole('button', { name: 'Retry' }));

    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Retry' })).toHaveLength(1));
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText('Fen Crossing')).toBeTruthy();
    expect((await storedEntities('w-a'))[0].aiDescription).toBe("The author's latest.");
  });

  it('writes the open world through the editor rather than to storage', async () => {
    await seedLibraryItem('r2');
    await seedWorld('w-open', 'Open World', [{ id: 'copy-live', name: 'Sedge' }]);
    const writeItem = vi.fn();
    const live: LiveWorld = {
      id: 'w-open',
      name: 'Open World',
      entities: [copy({ libraryId: LIBRARY_ID, sourceRevision: 'r1' }, { id: 'copy-live' })],
      dictionaries: [],
      placeholders: [],
      writeItem,
      addPlaceholder: vi.fn(),
    };
    render(<Host live={live} />);

    check();
    await screen.findByText('Open World');
    fireEvent.click(screen.getByRole('button', { name: 'Apply Updates' }));

    await waitFor(() => expect(writeItem).toHaveBeenCalledTimes(1));
    expect(writeItem.mock.calls[0][0]).toMatchObject({ aiDescription: "The author's latest." });
    expect((await storedEntities('w-open'))[0].link).toBeUndefined();
  });

  it('cancels without applying anything', async () => {
    await seedLibraryItem('r2');
    await seedWorld('w-1', 'Sedge Landing', [copy({ libraryId: LIBRARY_ID, sourceRevision: 'r1' })]);
    render(<Host />);

    check();
    await screen.findByText('Sedge Landing');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect((await storedEntities('w-1'))[0].aiDescription).toBe('What this world holds.');
  });
});
