import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { benchEditorWorld, openEditorTab, renderWorldEditorBench, shownEditorTab } from '@/test/worldEditorBench';
import { blobHash } from '@/lib/blobHash';
import { hasPendingWork } from '@/lib/pendingWork';
import type { World } from '@/types';

/**
 * The world's Avatar store in the Media tab and each entity's Avatar pick, driven through the real editor.
 */

vi.mock('../services/WorldStorageService', () => ({
  default: {
    initialize: vi.fn(),
    getWorldMetadata: vi.fn().mockResolvedValue([]),
    storeWorld: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@/lib/jsonFileWorkerUtils', () => ({
  serializeJsonBlob: vi.fn(), parseJsonText: vi.fn(), terminateWorker: vi.fn(),
}));

vi.mock('react-toastify', () => ({
  toast: { info: vi.fn(), success: vi.fn(), error: vi.fn() },
  ToastContainer: () => null,
}));

const LIBRARY_BYTES = new Uint8Array([0x67, 0x6c, 0x54, 0x46, 0x02, 0x00]);
const library = vi.hoisted(() => ({
  getModelMetadata: vi.fn(),
  getModelData: vi.fn(),
}));
vi.mock('@/services/ModelStorageService', () => ({ default: library }));

vi.mock('@/views/VRMViewer', () => import('@/test/stubs/vrmViewer'));
const download = vi.hoisted(() => vi.fn());
vi.mock('@/lib/downloadBlob', () => ({ downloadBlob: download }));

const FILE = { data: 'data:model/vrm;base64,Z2xURgIA', type: 'model/vrm', name: 'Heron.vrm' };

const WORLD: World = benchEditorWorld({
  worldOverview: {
    name: 'Sedge Landing', description: '', author: '', thumbnail: null, bgm: null,
    systemPrompt: 'Narrate the fen.', readme: 'A fen primer.', tags: [],
    vrmStore: { heron: { name: 'Heron', file: FILE }, reed: { name: 'Reed', file: FILE } },
  },
  entities: [
    { id: 'e1', name: 'Wren', aiDescription: 'A lamp-keeper.', locations: ['harbor'], vrmPick: { kind: 'world', id: 'heron' } },
    { id: 'e2', name: 'Marsh Tom', aiDescription: 'A ferryman.', locations: ['harbor'], vrmPick: { kind: 'world', id: 'heron' } },
    { id: 'e3', name: 'Odd Wick', aiDescription: 'Keeps the lamps.', locations: ['harbor'], vrmPick: { kind: 'world', id: 'reed' } },
  ],
});

type Mode = 'simple' | 'advanced';
const MODES: Mode[] = ['simple', 'advanced'];

const openMedia = () => openEditorTab(/^Media$/);
const avatarSection = () => screen.getByRole('region', { name: 'World › Avatars' });
const avatarCards = () => Array.from(avatarSection().querySelectorAll<HTMLElement>('[data-media-card="avatar"]'));
const avatarNames = () => avatarCards().map((c) => c.querySelector('.truncate')!.textContent);
const panel = () => document.querySelector<HTMLElement>('[data-media-panel]')!;
const openAvatarCard = (index: number) => fireEvent.click(avatarCards()[index]);
const openSummary = () => fireEvent.click(within(avatarSection()).getAllByRole('button')[0]);
const nameField = () => screen.getByRole('textbox', { name: 'Avatar Name' }) as HTMLInputElement;

/** Pick a Select's option by keyboard: a click needs pointer capture, which jsdom lacks. */
const pickOption = (trigger: HTMLElement, name: string) => {
  fireEvent.keyDown(trigger, { key: 'Enter' });
  fireEvent.keyDown(screen.getByRole('option', { name }), { key: 'Enter' });
};

const selectEntity = (name: string) => {
  openEditorTab(/Entities/);
  fireEvent.click(screen.getByText(name));
};

const rename = async (value: string) => {
  fireEvent.change(nameField(), { target: { value } });
  await act(async () => { fireEvent.blur(nameField()); });
};

const undo = () => act(async () => { fireEvent.keyDown(document.body, { key: 'z', ctrlKey: true }); });

const deleteFromPanel = async () => {
  await act(async () => { fireEvent.click(within(panel()).getByRole('button', { name: 'Delete' })); });
  const dialog = await screen.findByRole('alertdialog');
  return dialog;
};

const confirmDelete = async (dialog: HTMLElement) => {
  await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' })); });
};

const lastLabel = (bench: ReturnType<typeof renderWorldEditorBench>) => {
  const { steps, cursor } = bench.historyState();
  return steps[cursor - 1]?.label;
};

beforeEach(() => {
  localStorage.clear();
  download.mockReset();
  library.getModelMetadata.mockReset().mockResolvedValue([
    { id: 'lib-1', name: 'Fen Walker', type: 'model/vrm', size: LIBRARY_BYTES.length, license: { metaVersion: '1' } },
  ]);
  library.getModelData.mockReset().mockResolvedValue({ type: 'model/vrm', blob: new Blob([LIBRARY_BYTES]), size: LIBRARY_BYTES.length });
});

describe('the Overview', () => {
  it.each(MODES)('has no Avatar section in %s mode', (mode) => {
    renderWorldEditorBench(WORLD, mode);
    openEditorTab(/Overview/);
    expect(screen.queryByRole('textbox', { name: 'Avatar Name' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Upload Avatar…' })).toBeNull();
    expect(screen.queryByRole('combobox', { name: 'Copy From Library' })).toBeNull();
  });
});

describe('the Avatars section', () => {
  it.each(MODES)('lists every store Avatar as a card in %s mode', (mode) => {
    renderWorldEditorBench(WORLD, mode);
    openMedia();
    expect(avatarNames()).toEqual(['Heron', 'Reed']);
  });

  it.each(MODES)('adds an uploaded file under a new id, named for the file, in %s mode', async (mode) => {
    const bench = renderWorldEditorBench(WORLD, mode);
    openMedia();
    openSummary();
    const file = new File([LIBRARY_BYTES], 'Bittern.vrm', { type: '' });
    await act(async () => { fireEvent.change(screen.getByLabelText('Avatar File'), { target: { files: [file] } }); });

    await waitFor(() => expect(avatarNames()).toEqual(['Heron', 'Reed', 'Bittern']));
    const store = bench.ctx().worldOverview.vrmStore ?? {};
    const [id, added] = Object.entries(store).find(([, vrm]) => vrm.name === 'Bittern')!;
    expect(id).not.toMatch(/^(heron|reed)$/);
    expect(added.file).toMatchObject({ type: 'model/vrm', name: 'Bittern.vrm', size: LIBRARY_BYTES.length });
    expect(added.file.data).toMatch(/^data:/);
    expect(added.hash).toBe(await blobHash(new Blob([LIBRARY_BYTES])));
  });

  it('keeps both of two uploads started back to back', async () => {
    renderWorldEditorBench(WORLD, 'advanced');
    openMedia();
    openSummary();
    const input = screen.getByLabelText('Avatar File');
    await act(async () => {
      fireEvent.change(input, { target: { files: [new File([LIBRARY_BYTES], 'Bittern.vrm')] } });
      fireEvent.change(input, { target: { files: [new File([LIBRARY_BYTES], 'Egret.vrm')] } });
    });

    await waitFor(() => expect(avatarNames()).toEqual(['Heron', 'Reed', 'Bittern', 'Egret']));
  });

  it.each(MODES)('copies a library Avatar as embedded bytes, never as a library id, in %s mode', async (mode) => {
    const bench = renderWorldEditorBench(WORLD, mode);
    openMedia();
    openSummary();
    const copy = screen.getByRole('combobox', { name: 'Copy From Library' });
    await waitFor(() => expect(copy).toBeEnabled());
    pickOption(copy, 'Fen Walker');

    await waitFor(() => expect(avatarNames()).toEqual(['Heron', 'Reed', 'Fen Walker']));
    expect(library.getModelData).toHaveBeenCalledWith('lib-1');
    const store = bench.ctx().worldOverview.vrmStore ?? {};
    expect(Object.keys(store)).not.toContain('lib-1');
    const added = Object.values(store).find((vrm) => vrm.name === 'Fen Walker')!;
    expect(added.file.name).toBe('Fen Walker.vrm');
    const bytes = new Uint8Array(await (await fetch(added.file.data)).arrayBuffer());
    expect(bytes).toEqual(LIBRARY_BYTES);
  });
});

describe('an Avatars section with no Avatar', () => {
  const NONE: World = benchEditorWorld({ worldOverview: { ...WORLD.worldOverview, vrmStore: undefined }, entities: [] });

  it.each(MODES)('still shows in %s mode and adds the first Avatar', async (mode) => {
    renderWorldEditorBench(NONE, mode);
    openMedia();
    expect(avatarCards()).toHaveLength(0);
    openSummary();
    await act(async () => {
      fireEvent.change(screen.getByLabelText('Avatar File'), { target: { files: [new File([LIBRARY_BYTES], 'Bittern.vrm')] } });
    });
    await waitFor(() => expect(avatarNames()).toEqual(['Bittern']));
  });

  it('shows under type grouping too', () => {
    renderWorldEditorBench(NONE, 'simple');
    openMedia();
    fireEvent.click(screen.getByRole('button', { name: 'Group by Type' }));
    expect(screen.getByRole('region', { name: 'Avatars' })).toBeInTheDocument();
  });

  it('hides while a filter or a search is active, since no Avatar can match', () => {
    renderWorldEditorBench(NONE, 'simple');
    openMedia();
    openSummary();
    expect(screen.getByLabelText('Avatar File')).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('Search media'), { target: { value: 'x' } });
    expect(screen.queryByRole('region', { name: 'World › Avatars' })).toBeNull();
    expect(screen.queryByLabelText('Avatar File')).toBeNull();
    fireEvent.change(screen.getByPlaceholderText('Search media'), { target: { value: '' } });
    expect(screen.getByRole('region', { name: 'World › Avatars' })).toBeInTheDocument();
  });
});

describe('an Avatar panel', () => {
  it('keeps the stored name when the field is cleared', async () => {
    const bench = renderWorldEditorBench(WORLD, 'advanced');
    openMedia();
    openAvatarCard(0);
    await rename('  ');

    expect(bench.ctx().worldOverview.vrmStore?.heron.name).toBe('Heron');
    expect(nameField()).toHaveValue('Heron');
  });

  it('renames only the store entry on blur; entities keep their pick; undoes in one step', async () => {
    const bench = renderWorldEditorBench(WORLD, 'advanced');
    openMedia();
    openAvatarCard(0);
    fireEvent.change(nameField(), { target: { value: 'Grey Heron' } });
    expect(bench.ctx().worldOverview.vrmStore?.heron.name).toBe('Heron');
    const steps = bench.historyState().cursor;
    await act(async () => { fireEvent.blur(nameField()); });

    expect(bench.ctx().worldOverview.vrmStore?.heron).toEqual({ name: 'Grey Heron', file: FILE });
    expect(bench.ctx().entities.find((e) => e.id === 'e1')?.vrmPick).toEqual({ kind: 'world', id: 'heron' });
    expect(lastLabel(bench)).toBe('Rename Avatar: Grey Heron');
    expect(bench.historyState().cursor).toBe(steps + 1);
    await undo();
    expect(bench.historyState().cursor).toBe(steps);
    expect(bench.ctx().worldOverview.vrmStore?.heron.name).toBe('Heron');
  });

  it('lists the entities that pick it', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    openMedia();
    openAvatarCard(0);
    const users = within(panel()).getAllByRole('button').map((b) => b.textContent);
    expect(users).toEqual(expect.arrayContaining(['Wren', 'Marsh Tom']));
    expect(users).not.toContain('Odd Wick');
  });

  it('opens a user\'s entity from Used By', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    openMedia();
    openAvatarCard(0);
    fireEvent.click(within(panel()).getByRole('button', { name: 'Marsh Tom' }));
    expect(shownEditorTab()).toBe('Entities');
    const field = screen.getByLabelText('Name');
    expect(field instanceof HTMLInputElement ? field.value : field.textContent).toBe('Marsh Tom');
  });

  describe('Replace', () => {
    const replacement = new File([LIBRARY_BYTES], 'Heron v2.vrm', { type: '' });

    const replaceHeron = async (bench: ReturnType<typeof renderWorldEditorBench>) => {
      openMedia();
      openAvatarCard(0);
      const steps = bench.historyState().cursor;
      const input = panel().querySelector<HTMLInputElement>('input[type="file"]')!;
      await act(async () => { fireEvent.change(input, { target: { files: [replacement] } }); });
      await waitFor(() => expect(bench.historyState().cursor).toBe(steps + 1));
      return steps;
    };

    it('swaps the file and its hash under the same id, name and picks', async () => {
      const bench = renderWorldEditorBench(WORLD, 'simple');
      await replaceHeron(bench);

      const heron = bench.ctx().worldOverview.vrmStore?.heron;
      expect(Object.keys(bench.ctx().worldOverview.vrmStore ?? {})).toEqual(['heron', 'reed']);
      expect(heron?.name).toBe('Heron');
      expect(heron?.file).toMatchObject({ type: 'model/vrm', name: 'Heron v2.vrm', size: LIBRARY_BYTES.length });
      expect(heron?.file.data).not.toBe(FILE.data);
      expect(heron?.hash).toBe(await blobHash(new Blob([LIBRARY_BYTES])));
      const picks = bench.ctx().entities.map((e) => e.vrmPick);
      expect(picks).toEqual([{ kind: 'world', id: 'heron' }, { kind: 'world', id: 'heron' }, { kind: 'world', id: 'reed' }]);
      expect(panel()).toHaveAttribute('data-media-panel', 'world:world:avatar:heron');
      expect(lastLabel(bench)).toBe('Replace Avatar: Heron');
    });

    it('writes nothing when the panel closes before the file is read', async () => {
      const bench = renderWorldEditorBench(WORLD, 'advanced');
      openMedia();
      openAvatarCard(0);
      const steps = bench.historyState().cursor;
      const input = panel().querySelector<HTMLInputElement>('input[type="file"]')!;
      fireEvent.change(input, { target: { files: [replacement] } });
      expect(hasPendingWork()).toBe(true);
      openAvatarCard(1);
      // The read and any Replace it hands off are tracked to their end; waitFor lets React commit meanwhile.
      await waitFor(() => expect(hasPendingWork()).toBe(false));

      expect(bench.ctx().worldOverview.vrmStore?.heron.file).toEqual(FILE);
      expect(bench.historyState().cursor).toBe(steps);
    });

    it('undoes in one step', async () => {
      const bench = renderWorldEditorBench(WORLD, 'advanced');
      const steps = await replaceHeron(bench);
      await undo();

      expect(bench.historyState().cursor).toBe(steps);
      expect(bench.ctx().worldOverview.vrmStore?.heron.file).toEqual(FILE);
    });
  });

  it('downloads the stored bytes under the display name', async () => {
    renderWorldEditorBench(WORLD, 'simple');
    openMedia();
    openAvatarCard(0);
    await act(async () => { fireEvent.click(within(panel()).getByRole('button', { name: 'Download' })); });
    await waitFor(() => expect(download).toHaveBeenCalled());
    const [blob, name] = download.mock.lastCall as [Blob, string];
    expect(name).toBe('Heron.vrm');
    expect(new Uint8Array(await blob.arrayBuffer())).toEqual(new Uint8Array(await (await fetch(FILE.data)).arrayBuffer()));
  });

  describe('Delete', () => {
    it('names every entity that uses it, and sets them to None on confirm', async () => {
      const bench = renderWorldEditorBench(WORLD, 'advanced');
      openMedia();
      openAvatarCard(0);
      const dialog = await deleteFromPanel();
      expect(within(dialog).getByText('Delete Heron?')).toBeInTheDocument();
      expect(within(dialog).getByText('Wren, Marsh Tom will show no Avatar.')).toBeInTheDocument();
      await confirmDelete(dialog);

      await waitFor(() => expect(avatarNames()).toEqual(['Reed']));
      const picks = Object.fromEntries(bench.ctx().entities.map((e) => [e.id, e.vrmPick]));
      expect(picks).toEqual({ e1: undefined, e2: undefined, e3: { kind: 'world', id: 'reed' } });
      expect(lastLabel(bench)).toBe('Delete Avatar: Heron');
    });

    it('keeps everything when canceled', async () => {
      const bench = renderWorldEditorBench(WORLD, 'advanced');
      openMedia();
      openAvatarCard(1);
      const dialog = await deleteFromPanel();
      expect(within(dialog).getByText('Odd Wick will show no Avatar.')).toBeInTheDocument();
      fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));

      await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
      expect(avatarNames()).toEqual(['Heron', 'Reed']);
      expect(bench.ctx().entities.find((e) => e.id === 'e3')?.vrmPick).toEqual({ kind: 'world', id: 'reed' });
    });

    it('undoes in one step, store and picks together', async () => {
      const bench = renderWorldEditorBench(WORLD, 'advanced');
      openMedia();
      openAvatarCard(0);
      const steps = bench.historyState().cursor;
      await confirmDelete(await deleteFromPanel());
      await waitFor(() => expect(avatarNames()).toEqual(['Reed']));
      expect(bench.historyState().cursor).toBe(steps + 1);

      await undo();
      await waitFor(() => expect(avatarNames()).toEqual(['Heron', 'Reed']));
      expect(bench.historyState().cursor).toBe(steps);
      expect(bench.ctx().entities.find((e) => e.id === 'e1')?.vrmPick).toEqual({ kind: 'world', id: 'heron' });
    });

    it('clears a legacy fallback that pointed at the Avatar, and brings it back on undo', async () => {
      const legacy = benchEditorWorld({
        worldOverview: { ...WORLD.worldOverview, legacyVrmFallback: { kind: 'world', id: 'heron' } },
        entities: WORLD.entities,
      });
      const bench = renderWorldEditorBench(legacy, 'advanced');
      openMedia();
      openAvatarCard(0);
      await confirmDelete(await deleteFromPanel());
      await waitFor(() => expect(avatarNames()).toEqual(['Reed']));
      expect(bench.ctx().worldOverview.legacyVrmFallback).toBeUndefined();

      await undo();
      await waitFor(() => expect(bench.ctx().worldOverview.legacyVrmFallback).toEqual({ kind: 'world', id: 'heron' }));
    });

    it('keeps a legacy fallback that points at another Avatar', async () => {
      const legacy = benchEditorWorld({
        worldOverview: { ...WORLD.worldOverview, legacyVrmFallback: { kind: 'world', id: 'reed' } },
        entities: WORLD.entities,
      });
      const bench = renderWorldEditorBench(legacy, 'advanced');
      openMedia();
      openAvatarCard(0);
      await confirmDelete(await deleteFromPanel());
      await waitFor(() => expect(avatarNames()).toEqual(['Reed']));
      expect(bench.ctx().worldOverview.legacyVrmFallback).toEqual({ kind: 'world', id: 'reed' });
    });
  });
});

describe('the entity Avatar dropdown', () => {
  it('offers None, User\'s Default, then each store Avatar by name', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    selectEntity('Wren');
    const trigger = screen.getByRole('combobox', { name: 'Avatar' });
    expect(trigger).toHaveTextContent('Heron');
    fireEvent.keyDown(trigger, { key: 'Enter' });
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['None', "User's Default", 'Heron', 'Reed']);
  });

  it('starts a new entity on None, with no pick written', () => {
    const fresh = benchEditorWorld({
      worldOverview: WORLD.worldOverview,
      entities: [{ id: 'n1', name: 'Newcomer', aiDescription: 'Just arrived.', locations: ['harbor'] }],
    });
    const bench = renderWorldEditorBench(fresh, 'advanced');
    selectEntity('Newcomer');
    expect(screen.getByRole('combobox', { name: 'Avatar' })).toHaveTextContent('None');
    expect(bench.ctx().entities[0]).not.toHaveProperty('vrmPick');
  });

  it('reads a store id the store lacks as None, with no extra option', () => {
    const lost = benchEditorWorld({
      worldOverview: WORLD.worldOverview,
      entities: [{ id: 'n1', name: 'Newcomer', aiDescription: 'Just arrived.', locations: ['harbor'], vrmPick: { kind: 'world', id: 'gone' } }],
    });
    renderWorldEditorBench(lost, 'advanced');
    selectEntity('Newcomer');
    const trigger = screen.getByRole('combobox', { name: 'Avatar' });
    expect(trigger).toHaveTextContent('None');
    fireEvent.keyDown(trigger, { key: 'Enter' });
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['None', "User's Default", 'Heron', 'Reed']);
  });

  it('writes each form of the pick', () => {
    const bench = renderWorldEditorBench(WORLD, 'advanced');
    selectEntity('Odd Wick');
    const pick = () => bench.ctx().entities.find((e) => e.id === 'e3')?.vrmPick;

    pickOption(screen.getByRole('combobox', { name: 'Avatar' }), "User's Default");
    expect(pick()).toEqual({ kind: 'default' });
    pickOption(screen.getByRole('combobox', { name: 'Avatar' }), 'Heron');
    expect(pick()).toEqual({ kind: 'world', id: 'heron' });
    pickOption(screen.getByRole('combobox', { name: 'Avatar' }), 'None');
    expect(pick()).toBeUndefined();
  });

  it('follows a rename from the Media tab in its option label', async () => {
    renderWorldEditorBench(WORLD, 'advanced');
    openMedia();
    openAvatarCard(0);
    await rename('Grey Heron');
    selectEntity('Wren');
    expect(screen.getByRole('combobox', { name: 'Avatar' })).toHaveTextContent('Grey Heron');
  });

  it('is hidden in Simple mode', () => {
    renderWorldEditorBench(WORLD, 'simple');
    selectEntity('Wren');
    expect(screen.queryByRole('combobox', { name: 'Avatar' })).toBeNull();
  });
});
