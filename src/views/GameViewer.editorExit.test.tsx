import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderGameViewer } from '@/test/gameViewer';
import { markDemoAISeen } from '@/components/game/demoAISeen';
import WorldStorageService from '@/services/WorldStorageService';
import { WORLD_CHANGE_CHANNEL } from '@/lib/worldChangeSignal';
import { watchStackedAlerts } from '@/test/stackedDialogs';
import type { World } from '@/types';

/** The in-play editor's unsaved-changes prompt: what Exit drops, what its copy says, and that Save still saves. */

vi.mock('@/views/VRMViewer', () => import('@/test/stubs/vrmViewer'));
vi.mock('react-toastify', () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn(), warn: vi.fn(), dismiss: vi.fn(), isActive: vi.fn() }),
  ToastContainer: () => null,
}));

const WORLD = {
  id: 'w-in-play',
  worldOverview: {
    name: 'Sedge Landing', description: '', author: '', thumbnail: null, bgm: null,
    systemPrompt: '', use3DModel: false, tags: [],
  },
  stats: [], locations: [{ id: 'harbor', name: 'Harbor', isStarting: true }], entities: [], traits: [], statUpdates: [],
} as unknown as World;

// A returning player has met the Demo AI notice; its first-entry dialog would cover the editor.
beforeEach(() => { markDemoAISeen(); });
afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

/** Opens the editor over the game and renames the world, which leaves one pending edit. */
const editName = async (name: string) => {
  fireEvent.click(await screen.findByRole('button', { name: 'Edit World' }));
  const editor = await screen.findByRole('dialog', { name: 'World Editor' });
  fireEvent.change(within(editor).getByDisplayValue('Sedge Landing'), { target: { value: name } });
  // The editor reads the edit as pending once Save lights up, as a person would wait for it.
  await waitFor(() => expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled());
  return editor;
};

describe('Exit Without Saving in the in-play editor', () => {
  it('drops the pending edit, so the editor reopens on the saved world', async () => {
    renderGameViewer(WORLD);
    const editor = await editName('Brinewell');

    fireEvent.click(within(editor).getByRole('button', { name: 'Close' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Exit Without Saving' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'World Editor' })).toBeNull());

    fireEvent.click(await screen.findByRole('button', { name: 'Edit World' }));
    const reopened = await screen.findByRole('dialog', { name: 'World Editor' });
    expect(within(reopened).getByDisplayValue('Sedge Landing')).toBeInTheDocument();
    expect(within(reopened).queryByDisplayValue('Brinewell')).toBeNull();
  });

  it('leaves the edit in place when the prompt is cancelled', async () => {
    renderGameViewer(WORLD);
    const editor = await editName('Brinewell');

    fireEvent.click(within(editor).getByRole('button', { name: 'Close' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(screen.queryByText('Unsaved changes')).toBeNull());
    expect(within(editor).getByDisplayValue('Brinewell')).toBeInTheDocument();
  });
});

/** Saves by hand, which opts the world into auto save, and waits for the Save face to settle. */
const saveByHand = async (editor: HTMLElement) => {
  fireEvent.click(within(editor).getByRole('button', { name: 'Save' }));
  await within(editor).findByRole('button', { name: 'Saved' });
};
const storedName = async () => ((await WorldStorageService.getWorldData(WORLD.id)) as World).worldOverview.name;
const FULL_COUNT = `Brinewell${'x'.repeat(300)}`;

describe('the in-play prompt copy', () => {
  it('says Exit drops only the changes since the last save once an auto save wrote the world', async () => {
    renderGameViewer(WORLD);
    const editor = await editName('Brinewell');
    await saveByHand(editor);
    fireEvent.change(within(editor).getByDisplayValue('Brinewell'), { target: { value: FULL_COUNT } });
    await waitFor(async () => expect(await storedName()).toBe(FULL_COUNT));
    fireEvent.change(within(editor).getByDisplayValue(FULL_COUNT), { target: { value: 'Saltmarsh' } });
    await waitFor(() => expect(within(editor).getByRole('button', { name: 'Save' })).toBeEnabled());

    fireEvent.click(within(editor).getByRole('button', { name: 'Close' }));
    expect(await screen.findByText(/“Exit Without Saving” drops only the changes since the last save/)).toBeInTheDocument();
  });

  it('keeps the plain copy on a world no auto save wrote, with Auto Save on', async () => {
    renderGameViewer(WORLD);
    const editor = await editName('Brinewell');

    fireEvent.click(within(editor).getByRole('button', { name: 'Close' }));
    expect(await screen.findByText(/exit without saving, or keep editing/)).toBeInTheDocument();
  });

  it('keeps the plain copy while Auto Save is off', async () => {
    localStorage.setItem('FORMAMORPH_editorAutoSave', 'false');
    renderGameViewer(WORLD);
    const editor = await editName('Brinewell');

    fireEvent.click(within(editor).getByRole('button', { name: 'Close' }));
    expect(await screen.findByText(/exit without saving, or keep editing/)).toBeInTheDocument();
    expect(screen.queryByText(/since the last save/)).toBeNull();
  });
});

describe('Save & Exit in the in-play editor', () => {
  it('writes the edit to the library and closes the editor', async () => {
    renderGameViewer(WORLD);
    const editor = await editName('Brinewell');

    fireEvent.click(within(editor).getByRole('button', { name: 'Close' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Save & Exit' }));

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'World Editor' })).toBeNull());
    const stored = await WorldStorageService.getWorldData(WORLD.id) as World;
    expect(stored.worldOverview.name).toBe('Brinewell');
  });

  it('keeps the editor open with its edits, and the browser leave prompt armed, when the save fails', async () => {
    renderGameViewer(WORLD);
    const editor = await editName('Brinewell');
    vi.spyOn(WorldStorageService, 'storeWorld').mockRejectedValueOnce(new Error('disk gone'));

    fireEvent.click(within(editor).getByRole('button', { name: 'Close' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Save & Exit' }));

    await within(editor).findByRole('button', { name: 'Failed' });
    await waitFor(() => expect(screen.queryByText('Unsaved changes')).toBeNull());
    expect(screen.getByRole('dialog', { name: 'World Editor' })).toBeInTheDocument();
    expect(within(editor).getByDisplayValue('Brinewell')).toBeInTheDocument();
    const unload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(true);
  });
});

describe('a clean close in the in-play editor', () => {
  it('waits for a running save, then asks, since the save left the world apart from disk', async () => {
    renderGameViewer(WORLD);
    const editor = await editName('Brinewell');
    await saveByHand(editor);
    let finish!: () => void;
    const storeWorld = vi.spyOn(WorldStorageService, 'storeWorld')
      .mockImplementationOnce(() => new Promise<void>((resolve) => { finish = resolve; }));
    fireEvent.change(within(editor).getByDisplayValue('Brinewell'), { target: { value: FULL_COUNT } });
    await waitFor(() => expect(storeWorld).toHaveBeenCalledTimes(1));
    // Back to what is on disk while the auto save still runs.
    fireEvent.change(within(editor).getByDisplayValue(FULL_COUNT), { target: { value: 'Brinewell' } });
    await waitFor(() => expect(within(editor).getByRole('button', { name: 'Saving…' })).toBeInTheDocument());

    fireEvent.click(within(editor).getByRole('button', { name: 'Close' }));
    await act(() => new Promise<void>((resolve) => { setTimeout(resolve, 50); }));
    expect(screen.getByRole('dialog', { name: 'World Editor' })).toBeInTheDocument();

    await act(async () => { finish(); });
    expect(await screen.findByText('Unsaved changes')).toBeInTheDocument();
  });
});

describe('a save of the open world in another tab, in the in-play editor', () => {
  let otherTab: BroadcastChannel;
  beforeEach(() => { otherTab = new BroadcastChannel(WORLD_CHANGE_CHANNEL); });
  afterEach(() => { otherTab.close(); });
  const TITLE = 'World Saved in Another Tab';

  it('asks which copy wins, and Escape or an outside press does not dismiss it', async () => {
    renderGameViewer(WORLD);
    await editName('Brinewell');
    act(() => { otherTab.postMessage({ worldId: WORLD.id }); });
    const asked = await screen.findByRole('alertdialog', { name: TITLE });
    fireEvent.keyDown(asked, { key: 'Escape' });
    fireEvent.pointerDown(document.body);
    await act(() => new Promise<void>((resolve) => { setTimeout(resolve, 50); }));
    expect(screen.getByRole('alertdialog', { name: TITLE })).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'World Editor' })).toBeInTheDocument();
  });

  it('replaces an open unsaved-changes prompt, which does not come back after Keep Mine', async () => {
    renderGameViewer(WORLD);
    const editor = await editName('Brinewell');
    fireEvent.click(within(editor).getByRole('button', { name: 'Close' }));
    await screen.findByText('Unsaved changes');

    const watch = watchStackedAlerts();
    act(() => { otherTab.postMessage({ worldId: WORLD.id }); });
    const asked = await screen.findByRole('alertdialog', { name: TITLE });
    expect(watch.stop()).toBe(false);
    expect(screen.queryByText('Unsaved changes')).toBeNull();
    fireEvent.click(within(asked).getByRole('button', { name: 'Keep Mine' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    await act(() => new Promise<void>((resolve) => { setTimeout(resolve, 50); }));
    expect(screen.queryByText('Unsaved changes')).toBeNull();
    expect(screen.getByRole('dialog', { name: 'World Editor' })).toBeInTheDocument();
  });
});
