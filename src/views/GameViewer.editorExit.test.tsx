import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderGameViewer } from '@/test/gameViewer';
import { markDemoAISeen } from '@/components/game/demoAISeen';
import WorldStorageService from '@/services/WorldStorageService';
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
afterEach(() => { localStorage.clear(); });

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

describe('the in-play prompt copy', () => {
  it('says Exit drops only the changes since the last save while Auto Save is on', async () => {
    renderGameViewer(WORLD);
    const editor = await editName('Brinewell');

    fireEvent.click(within(editor).getByRole('button', { name: 'Close' }));
    expect(await screen.findByText(/drops only the changes since the last save/)).toBeInTheDocument();
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
});
