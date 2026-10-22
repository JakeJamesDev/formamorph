import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor, within } from '@testing-library/react';
import { benchEditorWorld, openEditorTab, renderWorldEditorBench } from '@/test/worldEditorBench';
import type { World } from '@/types';

/**
 * The world's Avatar store in the World Overview and each entity's Avatar pick, driven through the real editor.
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

const openOverview = () => openEditorTab(/Overview/);

/** Pick a Select's option by keyboard: a click needs pointer capture, which jsdom lacks. */
const pickOption = (trigger: HTMLElement, name: string) => {
  fireEvent.keyDown(trigger, { key: 'Enter' });
  fireEvent.keyDown(screen.getByRole('option', { name }), { key: 'Enter' });
};

const avatarNames = () => screen.getAllByRole('textbox', { name: 'Avatar Name' }).map((el) => (el as HTMLInputElement).value);

const selectEntity = (name: string) => {
  openEditorTab(/Entities/);
  fireEvent.click(screen.getByText(name));
};

beforeEach(() => {
  localStorage.clear();
  library.getModelMetadata.mockReset().mockResolvedValue([
    { id: 'lib-1', name: 'Fen Walker', type: 'model/vrm', size: LIBRARY_BYTES.length, license: { metaVersion: '1' } },
  ]);
  library.getModelData.mockReset().mockResolvedValue({ type: 'model/vrm', blob: new Blob([LIBRARY_BYTES]), size: LIBRARY_BYTES.length });
});

describe('the World Overview Avatar store', () => {
  it('lists every store Avatar by name in Advanced mode', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    openOverview();
    expect(avatarNames()).toEqual(['Heron', 'Reed']);
  });

  it('is hidden in Simple mode', () => {
    renderWorldEditorBench(WORLD, 'simple');
    openOverview();
    expect(screen.queryByRole('textbox', { name: 'Avatar Name' })).toBeNull();
  });

  it('adds an uploaded file under a new id, named for the file', async () => {
    const bench = renderWorldEditorBench(WORLD, 'advanced');
    openOverview();
    const file = new File([LIBRARY_BYTES], 'Bittern.vrm', { type: '' });
    fireEvent.change(screen.getByLabelText('Avatar File'), { target: { files: [file] } });

    await waitFor(() => expect(avatarNames()).toEqual(['Heron', 'Reed', 'Bittern']));
    const store = bench.ctx().worldOverview.vrmStore ?? {};
    const [id, added] = Object.entries(store).find(([, vrm]) => vrm.name === 'Bittern')!;
    expect(id).not.toMatch(/^(heron|reed)$/);
    expect(added.file).toMatchObject({ type: 'model/vrm', name: 'Bittern.vrm', size: LIBRARY_BYTES.length });
    expect(added.file.data).toMatch(/^data:/);
  });

  it('keeps both of two uploads started back to back', async () => {
    renderWorldEditorBench(WORLD, 'advanced');
    openOverview();
    const input = screen.getByLabelText('Avatar File');
    fireEvent.change(input, { target: { files: [new File([LIBRARY_BYTES], 'Bittern.vrm')] } });
    fireEvent.change(input, { target: { files: [new File([LIBRARY_BYTES], 'Egret.vrm')] } });

    await waitFor(() => expect(avatarNames()).toEqual(['Heron', 'Reed', 'Bittern', 'Egret']));
  });

  it('keeps the stored name when the field is cleared', () => {
    const bench = renderWorldEditorBench(WORLD, 'advanced');
    openOverview();
    const [heron] = screen.getAllByRole('textbox', { name: 'Avatar Name' });
    fireEvent.change(heron, { target: { value: '  ' } });
    fireEvent.blur(heron);

    expect(bench.ctx().worldOverview.vrmStore?.heron.name).toBe('Heron');
    expect(heron).toHaveValue('Heron');
  });

  it('copies a library Avatar as embedded bytes, never as a library id', async () => {
    const bench = renderWorldEditorBench(WORLD, 'advanced');
    openOverview();
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

  it('renames only the store entry on blur; entities keep their pick', () => {
    const bench = renderWorldEditorBench(WORLD, 'advanced');
    openOverview();
    const [heron] = screen.getAllByRole('textbox', { name: 'Avatar Name' });
    fireEvent.change(heron, { target: { value: 'Grey Heron' } });
    expect(bench.ctx().worldOverview.vrmStore?.heron.name).toBe('Heron');
    fireEvent.blur(heron);

    expect(bench.ctx().worldOverview.vrmStore?.heron).toEqual({ name: 'Grey Heron', file: FILE });
    expect(bench.ctx().entities.find((e) => e.id === 'e1')?.vrmPick).toEqual({ kind: 'world', id: 'heron' });
  });

  it('names every entity that uses an Avatar before its delete, and sets them to none on confirm', async () => {
    const bench = renderWorldEditorBench(WORLD, 'advanced');
    openOverview();
    const [heronRow] = screen.getAllByRole('textbox', { name: 'Avatar Name' }).map((el) => el.parentElement!);
    fireEvent.click(within(heronRow).getByRole('button', { name: 'Delete this Avatar' }));

    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText('Delete Heron?')).toBeInTheDocument();
    expect(within(dialog).getByText('Wren, Marsh Tom will show no Avatar.')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(avatarNames()).toEqual(['Reed']));
    const picks = Object.fromEntries(bench.ctx().entities.map((e) => [e.id, e.vrmPick]));
    expect(picks).toEqual({ e1: undefined, e2: undefined, e3: { kind: 'world', id: 'reed' } });
  });

  it('keeps everything when the delete is canceled', async () => {
    const bench = renderWorldEditorBench(WORLD, 'advanced');
    openOverview();
    const [, reedRow] = screen.getAllByRole('textbox', { name: 'Avatar Name' }).map((el) => el.parentElement!);
    fireEvent.click(within(reedRow).getByRole('button', { name: 'Delete this Avatar' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText('Odd Wick will show no Avatar.')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(avatarNames()).toEqual(['Heron', 'Reed']);
    expect(bench.ctx().entities.find((e) => e.id === 'e3')?.vrmPick).toEqual({ kind: 'world', id: 'reed' });
  });

  it('undoes a delete in one step, store and picks together', async () => {
    const bench = renderWorldEditorBench(WORLD, 'advanced');
    openOverview();
    const [heronRow] = screen.getAllByRole('textbox', { name: 'Avatar Name' }).map((el) => el.parentElement!);
    fireEvent.click(within(heronRow).getByRole('button', { name: 'Delete this Avatar' }));
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(avatarNames()).toEqual(['Reed']));

    bench.history().undo();
    await waitFor(() => expect(avatarNames()).toEqual(['Heron', 'Reed']));
    expect(bench.ctx().entities.find((e) => e.id === 'e1')?.vrmPick).toEqual({ kind: 'world', id: 'heron' });
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

  it('follows a store rename in its option label', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    openOverview();
    const [heron] = screen.getAllByRole('textbox', { name: 'Avatar Name' });
    fireEvent.change(heron, { target: { value: 'Grey Heron' } });
    fireEvent.blur(heron);
    selectEntity('Wren');
    expect(screen.getByRole('combobox', { name: 'Avatar' })).toHaveTextContent('Grey Heron');
  });

  it('is hidden in Simple mode', () => {
    renderWorldEditorBench(WORLD, 'simple');
    selectEntity('Wren');
    expect(screen.queryByRole('combobox', { name: 'Avatar' })).toBeNull();
  });
});
