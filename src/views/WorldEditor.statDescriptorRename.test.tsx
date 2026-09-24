import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { benchEditorWorld, renderWorldEditorBench } from '@/test/worldEditorBench';
import { NEW_STAT_NAME } from '@/lib/blankWorld';
import type { Stat } from '@/types';

/**
 * A stat's default descriptors follow its name, driven through the real editor: the name field one
 * keystroke at a time, and the find bar's Replace. The stored descriptors are read back from the world
 * data, since Simple mode never shows them.
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

vi.mock('@/lib/jsonMeasureClient', async () => {
  const { measurePublishBytes } = await import('@/lib/publishLimits');
  return {
    measureJsonBytes: async (value: unknown) => measurePublishBytes(value),
    terminateMeasureWorker: vi.fn(),
  };
});

vi.mock('react-toastify', () => ({
  toast: { info: vi.fn(), success: vi.fn(), error: vi.fn() },
  ToastContainer: () => null,
}));

vi.setConfig({ testTimeout: 15_000 });

const WORLD = benchEditorWorld({});

const texts = (stat: Stat) => stat.descriptors.map((d) => d.description);

/** Open the Stats tab and add a stat with its Add button, which also selects it. */
const addStat = async () => {
  fireEvent.mouseDown(await screen.findByRole('tab', { name: /Stats/ }));
  fireEvent.click(await screen.findByRole('button', { name: 'Add to Stats' }));
  await waitFor(() => expect(screen.getByRole('textbox', { name: 'Name' })).toHaveTextContent(NEW_STAT_NAME));
};

/** Select the whole name in its field, the way select-all does, so the next key replaces it. Under jsdom a
 *  click never lands a selection inside this chip field, so the range is placed by hand. */
const selectName = () => {
  const field = screen.getByRole('textbox', { name: 'Name' });
  field.focus();
  const text = document.createTreeWalker(field, NodeFilter.SHOW_TEXT).nextNode() as Text;
  document.getSelection()!.setBaseAndExtent(text, 0, text, text.length);
};

/** Open Find with the replace row and wait for the bar to take focus. */
const openReplace = async () => {
  fireEvent.keyDown(window, { key: 'h', ctrlKey: true });
  await screen.findByRole('search', { name: 'Find and replace in world' });
  await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText('Find')));
};

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe('World Editor — default descriptors follow a stat rename', () => {
  it('rebuilds them from the name typed into the name field, one keystroke at a time', async () => {
    const user = userEvent.setup();
    const { ctx } = renderWorldEditorBench(WORLD, 'simple');
    await addStat();
    expect(texts(ctx().stats[0])).toEqual(['New Stat is low', 'New Stat is medium', 'New Stat is high']);

    selectName();
    await user.keyboard('S');
    await waitFor(() => expect(ctx().stats[0].name).toBe('S'));
    expect(texts(ctx().stats[0])).toEqual(['S is low', 'S is medium', 'S is high']);

    await user.keyboard('ea Change');
    await waitFor(() => expect(ctx().stats[0].name).toBe('Sea Change'));
    expect(texts(ctx().stats[0])).toEqual(['Sea Change is low', 'Sea Change is medium', 'Sea Change is high']);
  });

  it('follows the name into an empty one when the author clears the field', async () => {
    const user = userEvent.setup();
    const { ctx } = renderWorldEditorBench(WORLD, 'simple');
    await addStat();

    selectName();
    await user.keyboard('{Backspace}');
    await waitFor(() => expect(ctx().stats[0].name).toBe(''));
    expect(texts(ctx().stats[0])).toEqual([' is low', ' is medium', ' is high']);
  });

  it('leaves an edited descriptor alone and follows the rest', async () => {
    const user = userEvent.setup();
    const { ctx } = renderWorldEditorBench(WORLD, 'simple');
    await addStat();
    const added = ctx().stats[0];
    ctx().updateStat({
      ...added,
      descriptors: added.descriptors.map((d, i) => (i === 0 ? { ...d, description: 'Barely holding on' } : d)),
    });
    await waitFor(() => expect(texts(ctx().stats[0])[0]).toBe('Barely holding on'));

    selectName();
    await user.keyboard('Grit');
    await waitFor(() => expect(ctx().stats[0].name).toBe('Grit'));
    expect(texts(ctx().stats[0])).toEqual(['Barely holding on', 'Grit is medium', 'Grit is high']);
  });

  it('follows a rename made with the find bar\'s Replace on the name', async () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'simple');
    await addStat();

    // The name is the first hit; the descriptors carry the same words and sit behind it. One Replace
    // rewrites the name alone, so what the descriptors become is the rule's doing.
    await openReplace();
    fireEvent.change(screen.getByLabelText('Find'), { target: { value: NEW_STAT_NAME } });
    await waitFor(() => expect(screen.getByText(/^1 \/ 4$/)).toBeInTheDocument());
    fireEvent.change(screen.getByRole('textbox', { name: 'Replace with' }), { target: { value: 'Sea Change' } });
    fireEvent.click(screen.getByRole('button', { name: 'Replace' }));

    await waitFor(() => expect(ctx().stats[0].name).toBe('Sea Change'));
    expect(texts(ctx().stats[0])).toEqual(['Sea Change is low', 'Sea Change is medium', 'Sea Change is high']);
  });
});
