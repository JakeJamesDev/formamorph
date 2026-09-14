import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import WorldStorageService from '@/services/WorldStorageService';
import { benchEditorWorld, clickOpenBench, renderWorldEditorBench } from '@/test/worldEditorBench';
import { readSourceCheck } from '@/lib/sourceCheckStore';
import type { Entity, World } from '@/types';

/**
 * Guards the missing-source check and its repairs through the real editor.
 *
 * `sourceChecks.test.ts` proves the repairs themselves and `sourceCheckRun.test.ts` the run's reasoning.
 * What these tests are about is the wiring: that a check happens only because the author asked, that each
 * row's repair reaches that row's copy alone, and that the repaired world is what the editor now holds.
 */

vi.mock('../services/WorldStorageService', () => ({
  default: {
    initialize: vi.fn(),
    getWorldMetadata: () => Promise.resolve([]),
    storeWorld: vi.fn().mockResolvedValue(undefined),
    checkSource: vi.fn(),
    fetchDependencies: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('@/lib/jsonFileWorkerUtils', () => ({
  serializeJsonBlob: vi.fn(), parseJsonText: vi.fn(), terminateWorker: vi.fn(),
}));

// The world holds linked copies, so the editor reads the local libraries on mount and the picker reads them
// again. jsdom has no IndexedDB; an empty library is what both should see here.
vi.mock('@/services/EntityStorageService', () => ({
  default: { getEntityMetadata: vi.fn().mockResolvedValue([]), getEntityData: vi.fn() },
}));
vi.mock('@/services/DictionaryStorageService', () => ({
  default: { getDictionaryMetadata: vi.fn().mockResolvedValue([]), getDictionaryData: vi.fn() },
}));

vi.mock('react-toastify', () => ({
  toast: { info: vi.fn(), success: vi.fn(), error: vi.fn() },
  ToastContainer: () => null,
}));

const linked = (id: string, name: string, sourceId: string, sourceName: string): Entity => ({
  id, name, playerDescription: 'Seen around.', aiDescription: 'A fen regular.', locations: ['harbor'],
  link: { libraryId: `lib-${sourceId}`, sourceId, sourceName },
} as unknown as Entity);

/** Two copies following two published sources, so a repair on one has a neighbor to leave alone. */
const WORLD: World = benchEditorWorld({
  entities: [
    linked('e1', 'Warden', 'src-a', 'Marsh Warden'),
    linked('e2', 'Herald', 'src-b', 'Fen Herald'),
  ],
});

const setup = () => renderWorldEditorBench(WORLD, 'advanced');

/** Open the Bench and hand back the check's run button. */
const openBench = async () => {
  await clickOpenBench();
  return screen.findByRole('button', { name: /Check Sources/ });
};

const entities = (ctx: () => { entities: Entity[] }) => ctx().entities;

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe('WorldEditor — the missing-source check', () => {
  it('asks the server only when the author asks, and lists what came back', async () => {
    setup();
    const button = await openBench();
    expect(WorldStorageService.checkSource).not.toHaveBeenCalled();

    vi.mocked(WorldStorageService.checkSource).mockResolvedValue('not_found');
    fireEvent.click(button);

    // Two copies of one rule collapse to the rule's own row, with a repair line per copy inside it.
    expect(await screen.findByText('2 linked copies follow a source the author removed')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Repair for Warden' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Repair for Herald' })).toBeInTheDocument();
    expect(WorldStorageService.checkSource).toHaveBeenCalledTimes(2);
  });

  it('records the answer, so the rows come back with the world', async () => {
    setup();
    vi.mocked(WorldStorageService.checkSource).mockResolvedValue('not_found');
    fireEvent.click(await openBench());

    await waitFor(() => expect(readSourceCheck('w1').results).toEqual({
      'src-a': 'not_found', 'src-b': 'not_found',
    }));
  });

  it('reports a failed request as unchecked, never as removed', async () => {
    setup();
    vi.mocked(WorldStorageService.checkSource).mockResolvedValue('unavailable');
    fireEvent.click(await openBench());

    expect(await screen.findByText('2 linked copies’ sources could not be checked')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Retry Check/ })).toBeInTheDocument();
    expect(screen.queryByText(/removed the listing/)).not.toBeInTheDocument();
  });
});

describe('WorldEditor — repairing one missing source', () => {
  /** Run a check that finds both sources gone, and leave the Bench open on its rows. */
  const checkedGone = async () => {
    const handle = setup();
    vi.mocked(WorldStorageService.checkSource).mockResolvedValue('not_found');
    fireEvent.click(await openBench());
    await screen.findByRole('combobox', { name: 'Repair for Warden' });
    return handle;
  };

  // Radix opens a Select from the keyboard; a click needs pointer capture, which jsdom has not got.
  const repair = async (name: string, choice: string, index: number) => {
    fireEvent.keyDown(screen.getByRole('combobox', { name: `Repair for ${name}` }), { key: 'Enter' });
    await userEvent.click(await screen.findByRole('option', { name: choice }));
    await userEvent.click(screen.getAllByRole('button', { name: 'Apply' })[index]);
  };

  it('unlinks one copy and keeps its content, leaving the other copy alone', async () => {
    const { ctx } = await checkedGone();
    await repair('Warden', 'Unlink and Keep Content', 0);

    const [warden, herald] = entities(ctx);
    expect(warden).toMatchObject({ id: 'e1', name: 'Warden', playerDescription: 'Seen around.' });
    expect(warden.link).toBeUndefined();
    expect(herald.link).toMatchObject({ sourceId: 'src-b' });
  });

  it('removes one copy from the world, leaving the other copy alone', async () => {
    const { ctx } = await checkedGone();
    await repair('Warden', 'Remove from World', 0);

    expect(entities(ctx).map((e) => e.id)).toEqual(['e2']);
  });

  it('drops the repaired copy’s row and keeps the other one', async () => {
    await checkedGone();
    await repair('Warden', 'Unlink and Keep Content', 0);

    await waitFor(() => expect(
      screen.queryByRole('combobox', { name: 'Repair for Warden' }),
    ).not.toBeInTheDocument());
    expect(screen.getByRole('combobox', { name: 'Repair for Herald' })).toBeInTheDocument();
  });

  it('opens the library picker for Replace, and changes nothing until a pick is made', async () => {
    const { ctx } = await checkedGone();
    await repair('Warden', 'Replace from Library', 0);

    expect(await screen.findByRole('dialog', { name: 'Replace Warden' })).toBeInTheDocument();
    expect(entities(ctx)[0].link).toMatchObject({ sourceId: 'src-a' });
  });
});
