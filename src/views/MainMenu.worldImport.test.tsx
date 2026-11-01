import type { ReactNode } from 'react';
import { render, screen, fireEvent, cleanup, waitFor, within } from '@testing-library/react';
import { toast } from 'react-toastify';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { renderMainMenu } from '@/test/mainMenu';
import { DEFAULT_WORLDS, tombstoneDefaultWorld } from '@/lib/defaultWorlds';
import { acceptAgeGate } from '@/lib/ageGate';
import { closeErrorDetails, getErrorDetailsState } from '@/lib/errorDetails';
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

/** A browser's quota DOMException is an Error; jsdom's is not, so this builds one with its name and message. */
const quotaError = () => Object.assign(new Error('Encountered full disk'), { name: 'QuotaExceededError' });

/** The lines of the one toast `level` raised, and the Error Details text its link opens. */
const toastReport = async (level: typeof toast.error) => {
  await waitFor(() => expect(level).toHaveBeenCalledTimes(1));
  const toasted = render(<>{vi.mocked(level).mock.calls[0][0] as ReactNode}</>);
  const lines = [...toasted.container.querySelectorAll('span')].map((line) => line.textContent ?? '');
  fireEvent.click(within(toasted.container).getByRole('button', { name: 'View Details →' }));
  toasted.unmount();
  const details = getErrorDetailsState().entry?.details ?? '';
  closeErrorDetails();
  return { lines, details };
};

beforeEach(() => {
  localStorage.clear();
  DEFAULT_WORLDS.forEach(({ id }) => tombstoneDefaultWorld(id));
  acceptAgeGate();
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ data: [] }), { status: 200 })));
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); Object.values(toast).forEach((level) => vi.mocked(level).mockClear()); });

describe('importing worlds from the Main Menu', () => {
  it('stores a world file the worker parsed', async () => {
    renderMainMenu();
    await screen.findByRole('radio', { name: 'Worlds' });

    importFiles(worldFile('Fenwick Reach'));

    await waitFor(async () => expect(await libraryNames()).toContain('Fenwick Reach'));
  });

  it('names a lone malformed file and its cause, and keeps the parser text in View Details', async () => {
    renderMainMenu();
    await screen.findByRole('radio', { name: 'Worlds' });

    const before = await libraryNames();

    importFiles(brokenFile());

    const report = await toastReport(toast.error);
    expect(report.lines).toEqual(["Couldn't import broken.json.", "This isn't a valid world file."]);
    expect(report.details).toContain('broken.json');
    expect(report.details).toMatch(/JSON/);
    expect(report.lines.join(' ')).not.toMatch(/JSON/);
    expect(await libraryNames()).toEqual(before);
  });

  it('calls a JSON file that is not a world an invalid world file', async () => {
    renderMainMenu();
    await screen.findByRole('radio', { name: 'Worlds' });

    importFiles(new File(['{"kind":"something else"}'], 'notes.json', { type: 'application/json' }));

    const report = await toastReport(toast.error);
    expect(report.lines).toEqual(["Couldn't import notes.json.", "This isn't a valid world file."]);
    expect(report.details).toContain('Invalid world data');
  });

  it('does not call a file invalid when reading it failed', async () => {
    renderMainMenu();
    await screen.findByRole('radio', { name: 'Worlds' });
    const unreadable = Object.assign(worldFile('Moved Away'), { text: () => Promise.reject(new Error('The file could not be read')) });

    importFiles(unreadable);

    const report = await toastReport(toast.error);
    expect(report.lines).toEqual(["Couldn't import Moved Away.json.", 'Formamorph cannot read this file.']);
    expect(report.details).toContain('The file could not be read');
  });

  it('imports the good files of a batch and names the one malformed file', async () => {
    renderMainMenu();
    await screen.findByRole('radio', { name: 'Worlds' });

    importFiles(worldFile('Marlow Deep'), brokenFile());

    const report = await toastReport(toast.warning);
    expect(report.lines).toEqual(['Imported 1 world.', "Couldn't import broken.json.", "This isn't a valid world file."]);
    expect((await libraryNames()).filter((name) => name === 'Marlow Deep')).toHaveLength(1);
  });

  it('keeps the count for several skipped files, and View Details lists each file and cause', async () => {
    renderMainMenu();
    await screen.findByRole('radio', { name: 'Worlds' });
    const storeWorld = WorldStorageService.storeWorld.bind(WorldStorageService);
    vi.spyOn(WorldStorageService, 'storeWorld').mockImplementation(async (world) => {
      if (world.name === 'Full Reach') throw quotaError();
      return storeWorld(world);
    });

    importFiles(worldFile('Calder Hollow'), brokenFile(), worldFile('Full Reach'));

    const report = await toastReport(toast.warning);
    expect(report.lines).toEqual(['Imported 1 world (2 skipped).']);
    expect(report.details).toMatch(/broken\.json\nThis isn't a valid world file\./);
    expect(report.details).toMatch(/Full Reach\.json\nThe storage is full\./);
    expect(report.details).toContain('Encountered full disk');
  });

  it('names the file when storage is full, and keeps the raw message in View Details', async () => {
    renderMainMenu();
    await screen.findByRole('radio', { name: 'Worlds' });
    vi.spyOn(WorldStorageService, 'storeWorld').mockRejectedValue(quotaError());

    importFiles(worldFile('Ashen Ford'));

    const report = await toastReport(toast.error);
    expect(report.lines).toEqual(["Couldn't import Ashen Ford.json.", 'The storage is full.']);
    expect(report.lines.join(' ')).not.toContain('Encountered full disk');
    expect(report.details).toContain('Encountered full disk');
  });

  it('writes a general line for any other storage failure', async () => {
    renderMainMenu();
    await screen.findByRole('radio', { name: 'Worlds' });
    vi.spyOn(WorldStorageService, 'storeWorld').mockRejectedValue(new Error('Transaction aborted'));

    importFiles(worldFile('Ashen Ford'));

    const report = await toastReport(toast.error);
    expect(report.lines).toEqual(["Couldn't import Ashen Ford.json.", 'Formamorph cannot save the world.']);
    expect(report.details).toContain('Transaction aborted');
  });

  it('keeps the summary for a clean batch, with no View Details', async () => {
    renderMainMenu();
    await screen.findByRole('radio', { name: 'Worlds' });

    importFiles(worldFile('Tern Hollow'), worldFile('Tern Rise'));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Imported 2 worlds.'));
    expect(toast.warning).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('shows no toast for a lone success', async () => {
    renderMainMenu();
    await screen.findByRole('radio', { name: 'Worlds' });

    importFiles(worldFile('Quiet Ford'));

    await waitFor(async () => expect(await libraryNames()).toContain('Quiet Ford'));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeTruthy());
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.warning).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });
});
