import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { benchEditorWorld, renderWorldEditorBench } from '@/test/worldEditorBench';
import { toast } from 'react-toastify';
import WorldStorageService from '../services/WorldStorageService';

/** Ctrl+S (Cmd+S on a Mac) saves the world from anywhere in the editor, and never opens the browser's Save Page. */

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

const storeWorld = vi.mocked(WorldStorageService.storeWorld);
const WORLD = benchEditorWorld({});

/** Edits the world name, which leaves focus in the field the way an author is mid-edit. */
const editName = async () => {
  const field = await screen.findByLabelText('World Name');
  field.focus();
  fireEvent.change(field, { target: { value: 'Renamed World' } });
  await waitFor(() => expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled());
  return field;
};

/** Returns whether the editor claimed the key, so the browser's own action stays shut. */
const press = (target: Element | Window, init: KeyboardEventInit) => !fireEvent.keyDown(target, { key: 's', ...init });

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

describe('World Editor save shortcut', () => {
  it('saves an edited world with Ctrl+S from inside a field', async () => {
    renderWorldEditorBench(WORLD, 'advanced');
    const field = await editName();
    expect(press(field, { ctrlKey: true })).toBe(true);
    await waitFor(() => expect(storeWorld).toHaveBeenCalledTimes(1));
    expect(storeWorld.mock.calls[0][0]).toMatchObject({ name: 'Renamed World' });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled());
  });

  it('saves with Cmd+S', async () => {
    renderWorldEditorBench(WORLD, 'advanced');
    await editName();
    press(window, { metaKey: true });
    await waitFor(() => expect(storeWorld).toHaveBeenCalledTimes(1));
  });

  it('claims the key on a clean world without saving', async () => {
    renderWorldEditorBench(WORLD, 'advanced');
    await screen.findByLabelText('World Name');
    expect(press(window, { ctrlKey: true })).toBe(true);
    await new Promise((r) => { setTimeout(r, 50); });
    expect(storeWorld).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('saves once while the key auto-repeats', async () => {
    renderWorldEditorBench(WORLD, 'advanced');
    await editName();
    press(window, { ctrlKey: true });
    press(window, { ctrlKey: true, repeat: true });
    await waitFor(() => expect(storeWorld).toHaveBeenCalledTimes(1));
  });

  it('names the shortcut in the Save tip and keeps the button named Save', async () => {
    renderWorldEditorBench(WORLD, 'advanced');
    await editName();
    const save = screen.getByRole('button', { name: 'Save' });
    fireEvent.pointerEnter(save);
    fireEvent.focus(save);
    expect(await screen.findByText('Save (Ctrl+S)')).toBeInTheDocument();
  });

  it('leaves plain S to the field', async () => {
    renderWorldEditorBench(WORLD, 'advanced');
    const field = await editName();
    expect(press(field, {})).toBe(false);
    expect(storeWorld).not.toHaveBeenCalled();
  });
});
