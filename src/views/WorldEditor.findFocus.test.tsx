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
  const bar = await screen.findByRole('search', { name: 'Find and replace in world' });
  // The bar takes focus off the field on open. Without this the restore cases would pass on a field that
  // never lost focus in the first place.
  await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText('Find')));
  return bar;
};

const findBarIsGone = () =>
  waitFor(() => expect(screen.queryByRole('search', { name: 'Find and replace in world' })).toBeNull());

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

    await findBarIsGone();
    expect(document.activeElement).toBe(field);
  });

  it('returns focus to that field when the Close action closes Find', async () => {
    setup();
    const field = await focusWorldName();
    await pressFindShortcut();

    fireEvent.click(screen.getByLabelText('Close find'));

    await findBarIsGone();
    expect(document.activeElement).toBe(field);
  });

  it('returns focus to the field when Find and Replace opens with its own shortcut', async () => {
    setup();
    const field = await focusWorldName();
    await pressFindShortcut(true);
    // Ctrl+H opens the bar with the replace row already showing.
    expect(screen.getByLabelText('Hide replace')).toBeTruthy();

    fireEvent.keyDown(screen.getByLabelText('Find'), { key: 'Escape' });

    await findBarIsGone();
    expect(document.activeElement).toBe(field);
  });

  it('keeps the first opener when Ctrl+H reaches an already open bar', async () => {
    setup();
    const field = await focusWorldName();
    await pressFindShortcut();
    // The second shortcut adds the replace row. It must not re-record the opener as the bar's own field.
    await pressFindShortcut(true);
    expect(screen.getByLabelText('Hide replace')).toBeTruthy();

    fireEvent.keyDown(screen.getByLabelText('Find'), { key: 'Escape' });

    await findBarIsGone();
    expect(document.activeElement).toBe(field);
  });

  it('returns focus to the header button when Find is opened by clicking it', async () => {
    setup();
    const opener = await screen.findByLabelText('Find and replace');
    opener.focus();
    fireEvent.click(opener);
    await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText('Find')));

    fireEvent.keyDown(screen.getByLabelText('Find'), { key: 'Escape' });

    await findBarIsGone();
    expect(document.activeElement).toBe(opener);
  });

  it('falls back to the editor container when navigating to a hit unmounts the field', async () => {
    setup();
    await focusWorldName();
    const bar = await pressFindShortcut();
    // The bar is a child of the container Find falls back to, which is how the test names it without
    // reaching for a test-only attribute.
    const editorRoot = bar.parentElement as HTMLElement;

    // A hit on another tab: taking it switches tabs, which unmounts the field focus was in.
    fireEvent.change(screen.getByLabelText('Find'), { target: { value: 'Odd Wick' } });
    fireEvent.keyDown(screen.getByLabelText('Find'), { key: 'Enter' });
    await waitFor(() => expect(screen.queryByLabelText('World Name')).toBeNull());

    fireEvent.keyDown(screen.getByLabelText('Find'), { key: 'Escape' });

    await findBarIsGone();
    expect(document.activeElement).not.toBe(document.body);
    expect(document.activeElement).toBe(editorRoot);
  });
});
