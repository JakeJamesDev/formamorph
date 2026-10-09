import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { benchEditorWorld, renderWorldEditorBench } from '@/test/worldEditorBench';
import { toastTexts } from '@/test/toastText';
import { STORAGE_FULL } from '@/lib/saveFailureToast';
import { AUTO_SAVE_IDLE_MS } from '@/lib/autoSaveScheduler';
import { clearTourRecord, writeTourRecord } from '@/lib/authoringTour/progress';
import { TOUR_STEPS } from '@/lib/authoringTour/steps';
import type { Stat } from '@/types';
import WorldStorageService from '../services/WorldStorageService';

/**
 * The World Editor saves on its own once enough has changed, or once a change sits through the idle pause.
 * A world joins in at its first save by hand; a failed auto save pauses it until a save by hand works.
 */

vi.mock('../services/WorldStorageService', () => ({
  default: {
    initialize: vi.fn(),
    getWorldMetadata: vi.fn().mockResolvedValue([]),
    storeWorld: vi.fn().mockResolvedValue(undefined),
    isUneditedDefault: vi.fn().mockResolvedValue(false),
  },
}));

const toast = vi.hoisted(() => ({ info: vi.fn(), success: vi.fn(), error: vi.fn() }));
vi.mock('react-toastify', () => ({ toast, ToastContainer: () => null }));

const storeWorld = vi.mocked(WorldStorageService.storeWorld);
const isUneditedDefault = vi.mocked(WorldStorageService.isUneditedDefault);
const GB = 1_000_000_000;
const setStorage = (storage: unknown) =>
  Object.defineProperty(navigator, 'storage', { value: storage, configurable: true });

/** Lets the recorder's tick move on, as the next keystroke's own task would. */
const nextTask = () => act(() => new Promise<void>((resolve) => { setTimeout(resolve, 0); }));
const nameField = () => screen.getByRole('textbox', { name: /World Name/i }) as HTMLInputElement;
const type = async (chars: number) => {
  const field = nameField();
  fireEvent.change(field, { target: { value: field.value + 'x'.repeat(chars) } });
  await nextTask();
};
const stat = (i: number) => ({
  id: `s${i}`, name: `Stat ${i}`, type: 'number', description: '', min: 0, max: 10, regen: 0,
}) as unknown as Omit<Stat, 'descriptors'>;

/** A save by hand, which opts a new world in. */
const saveByHand = async () => {
  const saves = storeWorld.mock.calls.length;
  fireEvent.click(screen.getByRole('button', { name: /^(Save|Failed)$/ }));
  await waitFor(() => expect(storeWorld).toHaveBeenCalledTimes(saves + 1));
  await nextTask();
};

const openOptedIn = async (props: { inGame?: boolean } = {}) => {
  const bench = renderWorldEditorBench(benchEditorWorld({}), 'simple', props);
  fireEvent.change(await screen.findByDisplayValue('Sedge Landing'), { target: { value: 'Brinewell' } });
  await nextTask();
  await saveByHand();
  storeWorld.mockClear();
  toast.success.mockClear();
  return bench;
};

let quietConsole: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  quietConsole = vi.spyOn(console, 'error').mockImplementation(() => {});
  setStorage({ estimate: async () => ({ usage: 2.4 * GB, quota: 2.5 * GB }) });
});
afterEach(() => {
  vi.useRealTimers();
  setStorage(undefined);
  quietConsole.mockRestore();
  storeWorld.mockReset().mockResolvedValue(undefined);
  isUneditedDefault.mockReset().mockResolvedValue(false);
  toast.error.mockReset();
  toast.success.mockReset();
  localStorage.clear();
});

describe('the change threshold', () => {
  it('saves 300 characters of typing without a pause, quietly', async () => {
    await openOptedIn();
    for (let i = 0; i < 9; i += 1) await type(30);
    expect(storeWorld).not.toHaveBeenCalled();

    await type(30);
    await waitFor(() => expect(storeWorld).toHaveBeenCalledTimes(1));
    expect(storeWorld.mock.calls[0][0]).toMatchObject({ name: `Brinewell${'x'.repeat(300)}` });
    expect(await screen.findByRole('button', { name: 'Saved' })).toBeInTheDocument();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('saves 30 discrete actions without a pause', async () => {
    const bench = await openOptedIn();
    for (let i = 0; i < 29; i += 1) {
      act(() => bench.ctx().addStat(stat(i)));
      await nextTask();
    }
    expect(storeWorld).not.toHaveBeenCalled();

    act(() => bench.ctx().addStat(stat(29)));
    await waitFor(() => expect(storeWorld).toHaveBeenCalledTimes(1));
  });

  it('saves in the in-game editor under the same rule', async () => {
    await openOptedIn({ inGame: true });
    for (let i = 0; i < 10; i += 1) await type(30);
    await waitFor(() => expect(storeWorld).toHaveBeenCalledTimes(1));
  });
});

describe('the idle pause', () => {
  it('saves one action once 30 s pass', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const bench = await openOptedIn();
    act(() => bench.ctx().addStat(stat(1)));
    await nextTask();
    await act(() => vi.advanceTimersByTimeAsync(AUTO_SAVE_IDLE_MS - 1000));
    expect(storeWorld).not.toHaveBeenCalled();
    await act(() => vi.advanceTimersByTimeAsync(1000));
    await waitFor(() => expect(storeWorld).toHaveBeenCalledTimes(1));
  });
});

describe('a never-saved world', () => {
  it('does not auto save until its first save by hand', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderWorldEditorBench(benchEditorWorld({}), 'simple');
    await screen.findByDisplayValue('Sedge Landing');
    for (let i = 0; i < 12; i += 1) await type(30);
    await act(() => vi.advanceTimersByTimeAsync(AUTO_SAVE_IDLE_MS));
    expect(storeWorld).not.toHaveBeenCalled();

    await saveByHand();
    for (let i = 0; i < 10; i += 1) await type(30);
    await waitFor(() => expect(storeWorld).toHaveBeenCalledTimes(2));
  });
});

/** Opens the bench world as one read from the library, as the main menu's Edit does. */
const openFromLibrary = async () => {
  const world = benchEditorWorld({});
  const bench = renderWorldEditorBench(world, 'simple');
  await screen.findByDisplayValue('Sedge Landing');
  act(() => { bench.ctx().loadWorldData(world, false, { stored: true }); });
  await nextTask();
  return bench;
};

describe('a world from the library', () => {
  it('auto saves from its first edit', async () => {
    await openFromLibrary();
    await waitFor(() => expect(isUneditedDefault).toHaveBeenCalledWith('w1'));
    await nextTask();
    for (let i = 0; i < 10; i += 1) await type(30);
    await waitFor(() => expect(storeWorld).toHaveBeenCalledTimes(1));
  });

  it('waits for a save by hand when it is an unedited bundled default', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    isUneditedDefault.mockResolvedValue(true);
    await openFromLibrary();
    await waitFor(() => expect(isUneditedDefault).toHaveBeenCalledWith('w1'));
    for (let i = 0; i < 12; i += 1) await type(30);
    await act(() => vi.advanceTimersByTimeAsync(AUTO_SAVE_IDLE_MS));
    expect(storeWorld).not.toHaveBeenCalled();

    await saveByHand();
    for (let i = 0; i < 10; i += 1) await type(30);
    await waitFor(() => expect(storeWorld).toHaveBeenCalledTimes(2));
  });
});

describe('History', () => {
  it('keeps the Saved marker, and a typed run across an auto save undoes in one press', async () => {
    // A frozen clock keeps the typed run inside the merge pause, as fast typing does.
    vi.useFakeTimers({ toFake: ['Date'] });
    const bench = await openOptedIn();
    const before = bench.historyState();
    expect(before.saved).toBe(before.cursor);

    for (let i = 0; i < 10; i += 1) await type(30);
    await waitFor(() => expect(storeWorld).toHaveBeenCalledTimes(1));
    await nextTask();
    await type(5);
    expect(bench.historyState().saved).toBe(before.saved);
    expect(bench.historyState().cursor).toBe(before.cursor + 1);

    act(() => bench.history().undo());
    expect(nameField().value).toBe('Brinewell');
  });
});

describe('a world back to what is on disk', () => {
  it('has nothing left to save once an undo makes it clean', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const bench = await openOptedIn();
    await type(30);
    act(() => bench.history().undo());
    expect(bench.ctx().isWorldDirty).toBe(false);
    await act(() => vi.advanceTimersByTimeAsync(AUTO_SAVE_IDLE_MS));
    expect(storeWorld).not.toHaveBeenCalled();
  });
});

describe('Exit Without Saving during an auto save', () => {
  it('waits for the save, then rolls back to the world it wrote', async () => {
    const bench = await openOptedIn();
    let finish!: () => void;
    storeWorld.mockImplementationOnce(() => new Promise<void>((resolve) => { finish = resolve; }));
    for (let i = 0; i < 10; i += 1) await type(30);
    await waitFor(() => expect(storeWorld).toHaveBeenCalledTimes(1));
    const written = `Brinewell${'x'.repeat(300)}`;
    await type(5);

    fireEvent.click(document.querySelector('.lucide-arrow-left')!.closest('button')!);
    fireEvent.click(await screen.findByRole('button', { name: 'Exit Without Saving' }));
    expect(bench.ctx().worldOverview.name).toBe(`${written}xxxxx`);

    await act(async () => { finish(); });
    await waitFor(() => expect(bench.ctx().worldOverview.name).toBe(written));
    expect(bench.ctx().isWorldDirty).toBe(false);
  });
});

describe('the Authoring Tour', () => {
  it('holds auto save while it runs, and its end saves what piled up (Q29)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await openOptedIn();
    act(() => writeTourRecord('w1', { step: TOUR_STEPS[0].id, items: {} }));
    try {
      for (let i = 0; i < 12; i += 1) await type(30);
      await act(() => vi.advanceTimersByTimeAsync(AUTO_SAVE_IDLE_MS));
      expect(storeWorld).not.toHaveBeenCalled();
    } finally {
      act(() => clearTourRecord('w1'));
    }
    await waitFor(() => expect(storeWorld).toHaveBeenCalledTimes(1));
    expect(storeWorld.mock.calls[0][0]).toMatchObject({ name: `Brinewell${'x'.repeat(360)}` });
  });
});

describe('a clean leave during an auto save', () => {
  it('waits for the save, then asks, since the save left the world apart from disk', async () => {
    const bench = await openOptedIn();
    let finish!: () => void;
    storeWorld.mockImplementationOnce(() => new Promise<void>((resolve) => { finish = resolve; }));
    for (let i = 0; i < 10; i += 1) await type(30);
    await waitFor(() => expect(storeWorld).toHaveBeenCalledTimes(1));
    // Back to what is on disk while the auto save still runs.
    fireEvent.change(nameField(), { target: { value: 'Brinewell' } });
    await nextTask();
    expect(bench.ctx().isWorldDirty).toBe(false);

    fireEvent.click(document.querySelector('.lucide-arrow-left')!.closest('button')!);
    await nextTask();
    expect(bench.onClose).not.toHaveBeenCalled();

    await act(async () => { finish(); });
    expect(await screen.findByText('Unsaved changes')).toBeInTheDocument();
    expect(bench.onClose).not.toHaveBeenCalled();
  });
});

describe('the unsaved-changes prompt', () => {
  const askToLeave = () => fireEvent.click(document.querySelector('.lucide-arrow-left')!.closest('button')!);

  it('says Auto Save kept the rest only once an auto save wrote the world', async () => {
    await openOptedIn();
    await type(30);
    askToLeave();
    expect(await screen.findByText(/exit without saving, or keep editing/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());

    for (let i = 0; i < 10; i += 1) await type(30);
    await waitFor(() => expect(storeWorld).toHaveBeenCalledTimes(1));
    await type(5);
    askToLeave();
    expect(await screen.findByText(/Auto Save kept the rest/)).toBeInTheDocument();
  });
});

describe('a failed auto save', () => {
  it('toasts once, shows Failed, and pauses until a save by hand works', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await openOptedIn();
    storeWorld.mockRejectedValue(new DOMException('The quota has been exceeded.', 'QuotaExceededError'));
    for (let i = 0; i < 10; i += 1) await type(30);
    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));
    expect(toastTexts(toast.error)[0]).toContain(STORAGE_FULL);
    expect(await screen.findByRole('button', { name: 'Failed' })).toBeEnabled();

    for (let i = 0; i < 10; i += 1) await type(30);
    await act(() => vi.advanceTimersByTimeAsync(AUTO_SAVE_IDLE_MS));
    expect(storeWorld).toHaveBeenCalledTimes(1);
    expect(toast.error).toHaveBeenCalledTimes(1);

    storeWorld.mockReset().mockResolvedValue(undefined);
    await saveByHand();
    for (let i = 0; i < 10; i += 1) await type(30);
    await waitFor(() => expect(storeWorld).toHaveBeenCalledTimes(2));
  });
});

describe('the idle pause setting', () => {
  it('saves one action after the chosen pause, not the default one', async () => {
    localStorage.setItem('FORMAMORPH_editorAutoSaveIdleSeconds', '90');
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const bench = await openOptedIn();
    act(() => bench.ctx().addStat(stat(1)));
    await nextTask();
    await act(() => vi.advanceTimersByTimeAsync(AUTO_SAVE_IDLE_MS * 2));
    expect(storeWorld).not.toHaveBeenCalled();
    await act(() => vi.advanceTimersByTimeAsync(AUTO_SAVE_IDLE_MS - 1000));
    expect(storeWorld).not.toHaveBeenCalled();
    // The whole pause on the faked clock, so the save never rests on waitFor's own faked timeout.
    await act(() => vi.advanceTimersByTimeAsync(1000));
    await waitFor(() => expect(storeWorld).toHaveBeenCalledTimes(1));
  });
});

describe('Auto Save off', () => {
  it('saves only by hand, from the Save menu checkbox', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await openOptedIn();
    fireEvent.click(screen.getByRole('button', { name: 'Save options' }));
    const toggle = await screen.findByRole('checkbox', { name: 'Auto Save' });
    expect(toggle).toBeChecked();
    fireEvent.click(toggle);
    expect(toggle).not.toBeChecked();

    for (let i = 0; i < 12; i += 1) await type(30);
    await act(() => vi.advanceTimersByTimeAsync(AUTO_SAVE_IDLE_MS));
    expect(storeWorld).not.toHaveBeenCalled();

    await saveByHand();
    expect(storeWorld).toHaveBeenCalledTimes(1);
  });
});
