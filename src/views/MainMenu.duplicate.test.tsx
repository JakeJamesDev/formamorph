import { screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { renderMainMenu } from '@/test/mainMenu';
import { DEFAULT_WORLDS, tombstoneDefaultWorld } from '@/lib/defaultWorlds';
import { acceptAgeGate } from '@/lib/ageGate';
import { emptyTabOrganization, loadTabOrganization, saveTabOrganization } from '@/lib/libraryOrganization';
import EntityStorageService from '@/services/EntityStorageService';
import DictionaryStorageService from '@/services/DictionaryStorageService';

vi.mock('react-toastify', () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn(), warn: vi.fn(), warning: vi.fn(), update: vi.fn(), dismiss: vi.fn() }),
  ToastContainer: () => null,
}));
vi.mock('./VRMViewer', async () => {
  const { forwardRef } = await import('react');
  return { default: forwardRef(() => null) };
});

const filed = (itemId: string) => ({
  ...emptyTabOrganization(),
  order: ['grp'],
  groups: { grp: { id: 'grp', name: 'Heroes', members: [itemId], settings: {} } },
});

const cases = [
  {
    tab: 'Entities',
    key: 'entities' as const,
    id: 'dup-entity',
    name: 'Ferry Warden',
    seed: () => EntityStorageService.storeEntity({ id: 'dup-entity', name: 'Ferry Warden', data: { id: 'dup-entity', name: 'Ferry Warden' } }),
    list: async () => (await EntityStorageService.getEntityMetadata()).map((item) => item.id),
    remove: (id: string) => EntityStorageService.deleteEntity(id),
  },
  {
    tab: 'Dictionaries',
    key: 'dictionaries' as const,
    id: 'dup-book',
    name: 'Ferry Lore',
    seed: () => DictionaryStorageService.storeDictionary({ id: 'dup-book', name: 'Ferry Lore', data: { id: 'dup-book', name: 'Ferry Lore', entries: [] } }),
    list: async () => (await DictionaryStorageService.getDictionaryMetadata()).map((item) => item.id),
    remove: (id: string) => DictionaryStorageService.deleteDictionary(id),
  },
];

beforeEach(() => {
  localStorage.clear();
  DEFAULT_WORLDS.forEach(({ id }) => tombstoneDefaultWorld(id));
  acceptAgeGate();
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ data: [] }), { status: 200 })));
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe.each(cases)('Duplicate on the $tab tab', ({ tab, key, id, name, seed, list, remove }) => {
  beforeEach(async () => {
    await seed();
    saveTabOrganization(key, filed(id));
  });
  afterEach(async () => {
    for (const stored of await list()) await remove(stored);
  });

  it('adds a copy to the library inside the original folder', async () => {
    renderMainMenu();
    await userEvent.click(await screen.findByRole('radio', { name: tab }));
    fireEvent.contextMenu(await screen.findByText('Heroes'));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Open Group' }));

    fireEvent.contextMenu(await screen.findByText(name));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Duplicate' }));

    await waitFor(async () => expect(await list()).toHaveLength(2));
    const copyId = (await list()).find((stored) => stored !== id)!;
    await waitFor(() => expect(loadTabOrganization(key).groups.grp.members).toEqual([id, copyId]));
    expect(await screen.findByText(`${name} (Copy)`)).toBeInTheDocument();
  });
});
