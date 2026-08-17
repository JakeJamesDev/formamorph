import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor, act } from '@testing-library/react';
import { checkStatCode } from '@/lib/testBench/statCodeCheck';
import { benchEditorWorld, clickOpenBench, renderWorldEditorBench } from '@/test/worldEditorBench';
import type { Finding } from '@/lib/testBench/rules';

/**
 * Guards the on-demand stat-code check through the real editor.
 *
 * `statCodeCheck.test.ts` proves the check itself against the real sandbox; what these tests are about is the
 * wiring around it — that a run only ever happens because the author asked for one, and that a verdict about
 * code the author has since edited can never land on the list. The check is stubbed here purely so the test
 * decides when a run finishes; the world, the editor and the rule pass are all real.
 */

vi.mock('../services/WorldStorageService', () => ({
  default: {
    initialize: vi.fn(),
    getWorldMetadata: () => Promise.resolve([]),
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

vi.mock('@/lib/testBench/statCodeCheck', () => ({ checkStatCode: vi.fn() }));

const FAILURE: Finding = {
  ruleId: 'stat-code-execution',
  severity: 'error',
  section: 'stats',
  message: 'Code on “Fertility” throws when it runs, so the stat keeps its manual value',
  items: [{ id: 's1', name: 'Fertility' }],
};

/** One coded stat that reads the clock, so the world's only Issues row is the one the check raises. */
const WORLD = benchEditorWorld({
  stats: [{
    id: 's1', name: 'Fertility', type: 'number', description: '', min: 0, max: 100, regen: 0,
    starting: 0, descriptors: [], code: 'return elapsedHours;',
  }],
});

// Stat Code is an Advanced-only field, so an author with code to check is an author in Advanced mode.
const setup = () => renderWorldEditorBench(WORLD, 'advanced');

/** Open the Bench and hand back the check's run button. */
const openBench = async () => {
  await clickOpenBench();
  return screen.findByRole('button', { name: /Check Stat Code/ });
};

/** A run the test finishes by hand, so the world can be edited while it is still in flight. */
const deferredRun = () => {
  let finish!: (findings: Finding[]) => void;
  vi.mocked(checkStatCode).mockReturnValue(new Promise<Finding[]>((resolve) => { finish = resolve; }));
  return (findings: Finding[]) => act(async () => { finish(findings); });
};

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe('WorldEditor — the on-demand stat-code check', () => {
  it('runs only when the author asks, and lists what came back', async () => {
    setup();
    const button = await openBench();
    // Opening the Bench must not have run anything: a VM per coded stat is what the live pass can't afford.
    expect(checkStatCode).not.toHaveBeenCalled();

    const finish = deferredRun();
    fireEvent.click(button);
    expect(checkStatCode).toHaveBeenCalledTimes(1);
    await finish([FAILURE]);

    expect(screen.getByText(FAILURE.message)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Check Again/ })).toBeInTheDocument();
  });

  it('drops a verdict about code the author edited while it was running', async () => {
    const { ctx } = setup();
    const button = await openBench();

    const finish = deferredRun();
    fireEvent.click(button);
    // The author repairs the very stat being checked before the run comes back.
    act(() => { ctx().setStats([{ ...WORLD.stats[0], code: 'return elapsedHours * 2;' }]); });
    await finish([FAILURE]);

    expect(screen.queryByText(FAILURE.message)).toBeNull();
    // And the action reads as never-run, so the author is invited to check the code they now have.
    await waitFor(() => expect(screen.getByRole('button', { name: /Check Stat Code/ })).toBeInTheDocument());
  });

  it('clears a finished run’s findings as soon as the world moves', async () => {
    const { ctx } = setup();
    const button = await openBench();
    const finish = deferredRun();
    fireEvent.click(button);
    await finish([FAILURE]);
    expect(screen.getByText(FAILURE.message)).toBeInTheDocument();

    act(() => { ctx().setStats([{ ...WORLD.stats[0], code: 'return elapsedHours * 2;' }]); });
    expect(screen.queryByText(FAILURE.message)).toBeNull();
  });

  it('lets the author try again when the check itself breaks', async () => {
    setup();
    const button = await openBench();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(checkStatCode).mockRejectedValue(new Error('sandbox unavailable'));

    await act(async () => { fireEvent.click(button); });
    // A stranded "Running…" would leave no way back; the action has to return to the author.
    expect(screen.getByRole('button', { name: /Check Stat Code/ })).toBeEnabled();
  });
});
