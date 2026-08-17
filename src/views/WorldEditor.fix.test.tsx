import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { toast } from 'react-toastify';
import { benchEditorWorld, clickOpenBench, renderWorldEditorBench } from '@/test/worldEditorBench';

/**
 * Guards the Bench's quick fixes through the real editor.
 *
 * `rules.test.ts` proves each fix repairs its finding, but a fix is only a feature once the editor writes the
 * repaired world back: the bug this shape invites is a rule returning a perfect world nobody applies. These
 * tests fail if the write-through — or the dirty flag it depends on — disappears.
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

/** Two unambiguous defects on two tabs — an articled alias and a placeholder nothing uses — so the Bench
 *  shows two fixable rows and a second fix can be pressed without waiting for the first row to clear. */
const WORLD = benchEditorWorld({
  entities: [{
    id: 'e1', name: 'Maren', aliases: ['the visitor'], locations: ['harbor'],
    playerDescription: 'A trader.', aiDescription: 'Trades salt and rope.',
  }],
  placeholders: [{ id: 'p1', name: 'Hue', values: ['red', 'blue'] }],
});

// Both defects live in Advanced-only fields, which is where the Bench lists them and offers the repair.
const setup = () => renderWorldEditorBench(WORLD, 'advanced');

/** Open the Bench and hand back its Fix buttons. */
const openBench = async () => {
  await clickOpenBench();
  return screen.findAllByRole('button', { name: 'Fix' });
};

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  getWorldMetadata.mockResolvedValue([]);
});

describe('WorldEditor — Bench quick fixes', () => {
  it('writes the repaired world back and marks it dirty', async () => {
    const { ctx } = setup();
    expect(ctx().isWorldDirty).toBe(false);

    const [fixAlias] = await openBench();
    fireEvent.click(fixAlias);

    expect(ctx().entities[0].aliases).toEqual(['visitor']);
    // The repair is a hand edit like any other, so Exit Without Saving is still the whole undo path.
    expect(ctx().isWorldDirty).toBe(true);
  });

  it('writes back the slice the rule rebuilt, whichever slice that is', async () => {
    const { ctx } = setup();
    const buttons = await openBench();
    fireEvent.click(buttons[1]);

    expect(ctx().placeholders).toEqual([]);
    expect(ctx().entities[0].aliases).toEqual(['the visitor']);
  });

  it('drops each finding from the Bench once the world is repaired', async () => {
    setup();
    const buttons = await openBench();
    buttons.forEach((button) => fireEvent.click(button));

    // The rule pass is debounced on the world changing, so the rows clear a beat after the clicks.
    await waitFor(() => expect(screen.getByText('No Problems Found')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /^Fix/ })).toBeNull();
  });

  it('says nothing about downloads when the world was never downloaded', async () => {
    setup();
    const [fixAlias] = await openBench();
    fireEvent.click(fixAlias);
    expect(toast.info).not.toHaveBeenCalled();
  });

  it('notes once that a never-edited downloaded copy is about to diverge from its source', async () => {
    getWorldMetadata.mockResolvedValue([{ id: 'w1', name: 'Sedge Landing', sourceId: 'srv1', dirty: false }]);
    const { ctx } = setup();
    await waitFor(() => expect(ctx().worldMetadata).toHaveLength(1));

    const buttons = await openBench();
    fireEvent.click(buttons[0]);
    expect(toast.info).toHaveBeenCalledTimes(1);

    // The second fix lands on a copy that has already been told — and the mark outlives this session.
    fireEvent.click(buttons[1]);
    expect(toast.info).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('FORMAMORPH_benchDownloadNoted')).toContain('w1');
  });

  it('stays quiet on a downloaded copy that has already been edited', async () => {
    getWorldMetadata.mockResolvedValue([{ id: 'w1', name: 'Sedge Landing', sourceId: 'srv1', dirty: true }]);
    const { ctx } = setup();
    await waitFor(() => expect(ctx().worldMetadata).toHaveLength(1));

    const [fixAlias] = await openBench();
    fireEvent.click(fixAlias);
    expect(toast.info).not.toHaveBeenCalled();
  });

  it('offers no repair in Simple mode for fields Simple mode hides', async () => {
    // The same two defects, in the mode that shows neither field: the fold is the only thing on the list,
    // and the world is untouched because there is no button to press.
    const { ctx } = renderWorldEditorBench(WORLD, 'simple');
    await clickOpenBench();
    expect(await screen.findByRole('button', { name: '2 findings need Advanced mode' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Fix/ })).toBeNull();
    expect(screen.queryByText('No Problems Found')).toBeNull();
    expect(ctx().entities[0].aliases).toEqual(['the visitor']);
  });
});
