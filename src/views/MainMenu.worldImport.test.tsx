import { screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { toast } from 'react-toastify';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { renderMainMenu } from '@/test/mainMenu';
import { DEFAULT_WORLDS, tombstoneDefaultWorld } from '@/lib/defaultWorlds';
import { acceptAgeGate } from '@/lib/ageGate';
import WorldStorageService from '@/services/WorldStorageService';

vi.mock('react-toastify', () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn(), warn: vi.fn(), warning: vi.fn() },
  ToastContainer: () => null,
}));
vi.mock('./VRMViewer', async () => {
  const { forwardRef } = await import('react');
  return { default: forwardRef(() => null) };
});
vi.mock('@/lib/jsonFileWorkerUtils', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  ...(await (await import('@/test/inlineJsonWorker')).inlineJsonWorker()),
}));

const worldFile = (name: string) => new File([JSON.stringify({
  worldOverview: { name, description: '', author: '', systemPrompt: '', tags: [] },
  stats: [], statUpdates: [], traits: [], dictionaries: [], locations: [], entities: [],
})], `${name}.json`, { type: 'application/json' });

/** The names in the library. The fake database outlives a test, so each case reads its own before and after. */
const libraryNames = async () => (await WorldStorageService.getWorldMetadata()).map((w) => w.name);

const brokenFile = () => new File(['{"worldOverview":'], 'broken.json', { type: 'application/json' });

/** Hand the menu's world file input these files, the way picking them in the dialog does. */
const importFiles = (...files: File[]) => {
  const input = document.querySelector<HTMLInputElement>('input[type="file"][accept=".json"]')!;
  fireEvent.change(input, { target: { files } });
};

beforeEach(() => {
  localStorage.clear();
  DEFAULT_WORLDS.forEach(({ id }) => tombstoneDefaultWorld(id));
  acceptAgeGate();
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ data: [] }), { status: 200 })));
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.mocked(toast.warning).mockClear(); });

describe('importing worlds from the Main Menu', () => {
  it('stores a world file the worker parsed', async () => {
    renderMainMenu();
    await screen.findByRole('radio', { name: 'Worlds' });

    importFiles(worldFile('Fenwick Reach'));

    await waitFor(async () => expect(await libraryNames()).toContain('Fenwick Reach'));
  });

  it('skips a malformed file and says so in the summary', async () => {
    renderMainMenu();
    await screen.findByRole('radio', { name: 'Worlds' });

    const before = await libraryNames();

    importFiles(brokenFile());

    await waitFor(() => expect(toast.warning).toHaveBeenCalledWith('Imported 0 worlds (1 skipped).'));
    expect(await libraryNames()).toEqual(before);
  });

  it('imports the good files of a batch that holds a malformed one', async () => {
    renderMainMenu();
    await screen.findByRole('radio', { name: 'Worlds' });

    importFiles(worldFile('Marlow Deep'), brokenFile());

    await waitFor(() => expect(toast.warning).toHaveBeenCalledWith('Imported 1 world (1 skipped).'));
    expect((await libraryNames()).filter((name) => name === 'Marlow Deep')).toHaveLength(1);
  });
});
