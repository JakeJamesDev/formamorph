import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { benchEditorWorld, renderWorldEditorBench } from '@/test/worldEditorBench';

/**
 * Guards the editor's focus return around Find.
 *
 * The Find bar owns neither end of this: it only reports that it closed. The editor records where focus was
 * before it opened and puts it back, so an author who opened Find mid-sentence keeps typing after Escape.
 */

const getWorldMetadata = vi.fn();

vi.mock('../services/WorldStorageService', () => ({
  default: {
    initialize: vi.fn(),
    getWorldMetadata: () => getWorldMetadata(),
    storeWorld: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@/lib/jsonFileWorkerUtils', () => ({
  serializeJsonBlob: vi.fn(),
  parseJsonText: vi.fn(),
  terminateWorker: vi.fn(),
}));

vi.mock('react-toastify', () => ({
  toast: { info: vi.fn(), success: vi.fn(), error: vi.fn() },
  ToastContainer: () => null,
}));

const WORLD = benchEditorWorld({});

const setup = () => renderWorldEditorBench(WORLD, 'advanced');

/** Focus the Overview name field, the way an author is mid-edit when the shortcut lands. */
const focusWorldName = async () => {
  const field = await screen.findByLabelText('World Name');
  field.focus();
  expect(document.activeElement).toBe(field);
  return field;
};

/** Fire the editor's own shortcut; `withReplace` picks Ctrl+H over Ctrl+F. */
const pressFindShortcut = async (withReplace = false) => {
  fireEvent.keyDown(window, { key: withReplace ? 'h' : 'f', ctrlKey: true });
  return screen.findByRole('search', { name: 'Find and replace in world' });
};

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  getWorldMetadata.mockResolvedValue([]);
});

describe('World Editor find focus return', () => {
  it('returns focus to the field the author was in when Escape closes Find', async () => {
    setup();
    const field = await focusWorldName();
    await pressFindShortcut();

    fireEvent.keyDown(screen.getByLabelText('Find'), { key: 'Escape' });

    await waitFor(() => expect(screen.queryByRole('search', { name: 'Find and replace in world' })).toBeNull());
    expect(document.activeElement).toBe(field);
  });

  it('returns focus to that field when the Close action closes Find', async () => {
    setup();
    const field = await focusWorldName();
    await pressFindShortcut();

    fireEvent.click(screen.getByLabelText('Close find'));

    await waitFor(() => expect(screen.queryByRole('search', { name: 'Find and replace in world' })).toBeNull());
    expect(document.activeElement).toBe(field);
  });

  it('returns focus to the field when Find and Replace opens with its own shortcut', async () => {
    setup();
    const field = await focusWorldName();
    await pressFindShortcut(true);
    // Ctrl+H opens the bar with the replace row already showing.
    expect(screen.getByLabelText('Hide replace')).toBeTruthy();

    fireEvent.keyDown(screen.getByLabelText('Find'), { key: 'Escape' });

    await waitFor(() => expect(screen.queryByRole('search', { name: 'Find and replace in world' })).toBeNull());
    expect(document.activeElement).toBe(field);
  });

  it('falls back to the editor container when the field is gone, never the body', async () => {
    setup();
    await focusWorldName();
    await pressFindShortcut();

    // Leaving Overview unmounts the field focus was in, which is what a navigated hit does.
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Entities' }));
    await waitFor(() => expect(screen.queryByLabelText('World Name')).toBeNull());

    fireEvent.keyDown(screen.getByLabelText('Find'), { key: 'Escape' });

    await waitFor(() => expect(screen.queryByRole('search', { name: 'Find and replace in world' })).toBeNull());
    const landed = document.activeElement as HTMLElement;
    expect(landed).not.toBe(document.body);
    // The container that holds the editor's own tab strip, not some detached node.
    expect(landed.contains(screen.getByRole('tab', { name: 'Entities' }))).toBe(true);
  });
});
