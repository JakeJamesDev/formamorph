// Real in-memory storage for saves; must load before anything touches `indexedDB`.
import 'fake-indexeddb/auto';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, act, fireEvent } from '@testing-library/react';
import { toast } from 'react-toastify';
import { GameplayProvider, useGameplay } from './GameplayContext';
import { GameDataProvider } from './GameDataContext';
import { PlaceholderSessionProvider } from './PlaceholderSessionContext';
import { STORE_NAME } from '@/components/modals/dbUtils';
import { showErrorDetails } from '@/lib/errorDetails';
import { AUTOSAVE_FAILED, AUTOSAVE_STORAGE_FULL } from '@/lib/saveFailureToast';
import { failWritesOnQuota } from '@/test/quotaAbort';

vi.mock('@/lib/useTtsPlayback', () => import('@/test/stubs/ttsPlayback'));
vi.mock('react-toastify', () => ({ toast: { info: vi.fn(), success: vi.fn(), error: vi.fn(), dismiss: vi.fn() } }));
vi.mock('@/lib/errorDetails', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/errorDetails')>()),
  showErrorDetails: vi.fn(),
}));
vi.mock('@/lib/saveConversionWorkerUtils', () => ({ convertSaveFile: async () => ({}), terminateWorker: () => {} }));

const toastError = vi.mocked(toast.error);

const mount = () => {
  let live: ReturnType<typeof useGameplay> | null = null;
  render(
    <GameDataProvider>
      <PlaceholderSessionProvider>
        <GameplayProvider>
          <Probe expose={(g) => { live = g; }} />
        </GameplayProvider>
      </PlaceholderSessionProvider>
    </GameDataProvider>,
  );
  return () => live!;
};

const Probe = ({ expose }: { expose: (g: ReturnType<typeof useGameplay>) => void }) => {
  expose(useGameplay());
  return null;
};

/** Every put into the saves store throws `error`, as a store that rejects writes does. */
function failWritesWith(error: Error): () => void {
  const proto = IDBObjectStore.prototype;
  const realPut = proto.put;
  proto.put = function put(this: IDBObjectStore, ...args: Parameters<IDBObjectStore['put']>) {
    if (this.name === STORE_NAME) throw error;
    return realPut.apply(this, args);
  };
  return () => { proto.put = realPut; };
}

/** The visible text of a toast.error call's content. */
const toastText = (call: number): string => {
  const content = toastError.mock.calls[call][0];
  if (typeof content === 'string') return content;
  return render(<>{content}</>).container.textContent ?? '';
};

let restore: (() => void) | null = null;
beforeEach(() => { vi.clearAllMocks(); });
afterEach(() => { restore?.(); restore = null; });

describe('a failed autosave', () => {
  it('says the storage is full on a quota error', async () => {
    const live = mount();
    restore = failWritesOnQuota(STORE_NAME);
    await act(async () => { await live().autosaveGame('World', 'w1', 1, 3); });

    expect(toastError).toHaveBeenCalledTimes(1);
    expect(toastError.mock.calls[0][0]).toBe(AUTOSAVE_STORAGE_FULL);
  });

  it('shows a written line with the cause in View Details on any other error', async () => {
    const live = mount();
    restore = failWritesWith(new Error('the disk exploded'));
    await act(async () => { await live().autosaveGame('World', 'w1', 1, 3); });

    expect(toastError).toHaveBeenCalledTimes(1);
    const { container } = render(<>{toastError.mock.calls[0][0]}</>);
    expect(container.textContent).toContain(AUTOSAVE_FAILED);
    fireEvent.click(container.querySelector('button')!);
    expect(showErrorDetails).toHaveBeenCalledWith(expect.objectContaining({
      message: AUTOSAVE_FAILED,
      details: expect.stringContaining('the disk exploded'),
    }));
  });

  it.each([
    ['a quota error', () => failWritesOnQuota(STORE_NAME)],
    ['any other error', () => failWritesWith(new Error('boom'))],
  ])('never claims that manual saves still work after %s', async (_name, fail) => {
    const live = mount();
    restore = fail();
    await act(async () => { await live().autosaveGame('World', 'w1', 1, 3); });

    expect(toastError).toHaveBeenCalledTimes(1);
    expect(toastText(0)).not.toMatch(/still work/i);
  });

  it('shows once across repeated failures, and again after a success then a new failure', async () => {
    const live = mount();
    restore = failWritesOnQuota(STORE_NAME);
    await act(async () => { await live().autosaveGame('World', 'w1', 1, 3); });
    await act(async () => { await live().autosaveGame('World', 'w1', 2, 3); });
    expect(toastError).toHaveBeenCalledTimes(1);

    restore();
    await act(async () => { await live().autosaveGame('World', 'w1', 3, 3); });
    expect(toastError).toHaveBeenCalledTimes(1);

    restore = failWritesOnQuota(STORE_NAME);
    await act(async () => { await live().autosaveGame('World', 'w1', 4, 3); });
    expect(toastError).toHaveBeenCalledTimes(2);
  });
});

describe('a failed manual save', () => {
  it('keeps its own message and shows no autosave line', async () => {
    const live = mount();
    restore = failWritesWith(new Error('boom'));
    let ok = true;
    await act(async () => { ok = await live().saveGame('slot', 'World', 'w1'); });

    expect(ok).toBe(false);
    expect(toastError).toHaveBeenCalledTimes(1);
    expect(toastText(0)).toContain('Failed to save game');
    expect(toastText(0)).not.toContain(AUTOSAVE_FAILED);
  });
});
