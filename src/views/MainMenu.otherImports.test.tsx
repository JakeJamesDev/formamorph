import type { ReactNode } from 'react';
import { render, screen, fireEvent, cleanup, waitFor, within } from '@testing-library/react';
import { toast } from 'react-toastify';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { renderMainMenu } from '@/test/mainMenu';
import { DEFAULT_WORLDS, tombstoneDefaultWorld } from '@/lib/defaultWorlds';
import { acceptAgeGate } from '@/lib/ageGate';
import { toastTexts } from '@/test/toastText';
import { closeErrorDetails, getErrorDetailsState } from '@/lib/errorDetails';
import { embedEntityCard } from '@/lib/entityCard';
import DictionaryStorageService from '@/services/DictionaryStorageService';
import EntityStorageService from '@/services/EntityStorageService';
import ModelStorageService from '@/services/ModelStorageService';

vi.mock('react-toastify', () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn(), warn: vi.fn(), warning: vi.fn(), update: vi.fn(), dismiss: vi.fn() }),
  ToastContainer: () => null,
}));
vi.mock('./VRMViewer', async () => {
  const { forwardRef } = await import('react');
  return { default: forwardRef(() => null) };
});
vi.mock('@/lib/imageOptimWorkerClient', () => ({
  measureInWorker: vi.fn(async () => ({ w: 4, h: 4, bytes: 24 })),
  encodeInWorker: vi.fn(async (url: string) => url),
}));

/** A minimal simple-lossy WebP container to embed into (framing only; the bitstream bytes are arbitrary). */
function fakeWebp(): Uint8Array {
  const payload = [1, 2, 3, 4];
  const out = new Uint8Array(12 + 8 + payload.length);
  const view = new DataView(out.buffer);
  const put4 = (s: string, at: number) => { for (let i = 0; i < 4; i++) out[at + i] = s.charCodeAt(i); };
  put4('RIFF', 0);
  view.setUint32(4, out.length - 8, true);
  put4('WEBP', 8);
  put4('VP8 ', 12);
  view.setUint32(16, payload.length, true);
  out.set(payload, 20);
  return out;
}

const json = (name: string, body: unknown) => new File([JSON.stringify(body)], name, { type: 'application/json' });

const dictionaryFile = (name: string) => json(`${name}.json`, {
  formamorphKind: 'dictionary', name, entries: [{ id: 'e1', keywords: ['gate'], value: 'The gate sticks.' }],
});

const tavernCard = (name: string, withBook = false) => json(`${name}.json`, {
  spec: 'chara_card_v2',
  data: {
    name, description: 'A watcher at the gate.',
    ...(withBook ? { character_book: { entries: [{ keys: ['gate'], content: 'The gate sticks.', enabled: true, insertion_order: 1 }] } } : {}),
  },
});

/** A card image whose payload is a file of another kind. */
const cardImageOf = (kind: string) => new File(
  [embedEntityCard(fakeWebp(), JSON.stringify({ formamorphKind: kind }), { w: 4, h: 4 })],
  `${kind}.webp`,
  { type: 'image/webp' },
);

const quotaError = () => Object.assign(new Error('Encountered full disk'), { name: 'QuotaExceededError' });

const pick = (selector: string, ...files: File[]) => {
  fireEvent.change(document.querySelector<HTMLInputElement>(selector)!, { target: { files } });
};
const pickDictionaries = (...files: File[]) => pick('input[type="file"][accept^=".json,application"]', ...files);
const pickEntities = (...files: File[]) => pick('input[type="file"][accept^="image/webp"]', ...files);
const pickAvatars = (...files: File[]) => pick('input[type="file"][accept=".vrm,.glb"]', ...files);

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
const levels = [toast.error, toast.success, toast.info, toast.warn, toast.warning];
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); levels.forEach((level) => vi.mocked(level).mockClear()); });

const open = async () => {
  renderMainMenu();
  await screen.findByRole('radio', { name: 'Worlds' });
  levels.forEach((level) => vi.mocked(level).mockClear()); // the menu's own start-up toasts
};

describe('importing dictionaries from the Main Menu', () => {
  it('names a world file and points it to the Worlds tab', async () => {
    await open();

    pickDictionaries(json('realm.json', { formamorphKind: 'world', worldOverview: {} }));

    const report = await toastReport(toast.error);
    expect(report.lines).toEqual(["Couldn't import realm.json.", "That's a world file. Import it from the Worlds tab."]);
  });

  it('names a file that is not JSON, and keeps the parser text in View Details', async () => {
    await open();

    pickDictionaries(new File(['{"entries":'], 'cut.json', { type: 'application/json' }));

    const report = await toastReport(toast.error);
    expect(report.lines).toEqual(["Couldn't import cut.json.", "This isn't a valid dictionary file."]);
    expect(report.lines.join(' ')).not.toMatch(/JSON/);
    expect(report.details).toMatch(/JSON/);
  });

  it('names the file when storage is full', async () => {
    await open();
    vi.spyOn(DictionaryStorageService, 'storeDictionary').mockRejectedValue(quotaError());

    pickDictionaries(dictionaryFile('Gatehouse Lore'));

    const report = await toastReport(toast.error);
    expect(report.lines).toEqual(["Couldn't import Gatehouse Lore.json.", 'The storage is full.']);
    expect(report.details).toContain('Encountered full disk');
  });
});

describe('importing entities from the Main Menu', () => {
  it('names a JSON file that is not a card', async () => {
    await open();

    pickEntities(json('notes.json', { kind: 'something else' }));

    const report = await toastReport(toast.error);
    expect(report.lines).toEqual(["Couldn't import notes.json.", "This JSON isn't a SillyTavern character card."]);
  });

  it('names a world file and says it is not a card', async () => {
    await open();

    pickEntities(json('realm.json', { formamorphKind: 'world', worldOverview: {} }));

    const report = await toastReport(toast.error);
    expect(report.lines).toEqual(["Couldn't import realm.json.", "This JSON isn't a SillyTavern character card."]);
  });

  it('shows the written line that points a card holding world data to the Worlds tab', async () => {
    await open();

    pickEntities(cardImageOf('world'));

    const report = await toastReport(toast.error);
    expect(report.lines).toEqual(["Couldn't import world.webp.", "That's a world file. Import it from the Worlds tab."]);
  });

  it('names the good and the bad file of a batch', async () => {
    await open();

    pickEntities(tavernCard('Wren Watcher'), json('notes.json', { kind: 'something else' }));

    const report = await toastReport(toast.warning);
    expect(report.lines).toEqual(['Imported 1 entity.', "Couldn't import notes.json.", "This JSON isn't a SillyTavern character card."]);
  });

  it('names the file when storage fails, and keeps the raw message in View Details', async () => {
    await open();
    vi.spyOn(EntityStorageService, 'storeEntity').mockRejectedValue(new Error('Transaction aborted'));

    pickEntities(tavernCard('Wren Watcher'));

    const report = await toastReport(toast.error);
    expect(report.lines).toEqual(["Couldn't import Wren Watcher.json.", 'Formamorph cannot save the entity.']);
    expect(report.details).toContain('Transaction aborted');
  });

  it('keeps a card that stored when its lorebook fails', async () => {
    await open();
    vi.spyOn(DictionaryStorageService, 'storeDictionary').mockRejectedValue(new Error('Transaction aborted'));

    pickEntities(tavernCard('Wren Watcher', true));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Imported 1 entity.'));
    expect(toast.warning).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });
});

describe('importing player avatars from the Main Menu', () => {
  const avatar = (name: string) => new File([new Uint8Array([1, 2, 3])], name);

  it('names the file when the library cannot store it', async () => {
    await open();
    vi.spyOn(ModelStorageService, 'findDuplicate').mockResolvedValue(null);
    vi.spyOn(ModelStorageService, 'addModel').mockRejectedValue(quotaError());

    pickAvatars(avatar('knight.vrm'));

    const report = await toastReport(toast.error);
    expect(report.lines).toEqual(["Couldn't import knight.vrm.", 'The storage is full.']);
    expect(report.details).toContain('Encountered full disk');
  });

  it('counts a declined duplicate as neither imported nor skipped', async () => {
    await open();
    vi.spyOn(ModelStorageService, 'findDuplicate').mockResolvedValue({ name: 'Knight' } as Awaited<ReturnType<typeof ModelStorageService.findDuplicate>>);
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const addModel = vi.spyOn(ModelStorageService, 'addModel');

    pickAvatars(avatar('knight.vrm'));

    await waitFor(() => expect(window.confirm).toHaveBeenCalledTimes(1));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(addModel).not.toHaveBeenCalled();
    const shown = levels.flatMap((level) => toastTexts(vi.mocked(level)));
    expect(shown.filter((text) => /Imported|Couldn't import/.test(text))).toEqual([]);
  });

  it('reports the files that stored when another is declined', async () => {
    await open();
    vi.spyOn(ModelStorageService, 'findDuplicate').mockImplementation(async (file) =>
      (file as File).name === 'knight.vrm' ? ({ name: 'Knight' } as Awaited<ReturnType<typeof ModelStorageService.findDuplicate>>) : null);
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    vi.spyOn(ModelStorageService, 'addModel').mockResolvedValue({} as Awaited<ReturnType<typeof ModelStorageService.addModel>>);

    pickAvatars(avatar('knight.vrm'), avatar('mage.vrm'));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Imported 1 player avatar.'));
  });
});
