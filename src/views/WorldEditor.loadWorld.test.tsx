import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { benchEditorWorld, renderWorldEditorBench } from '@/test/worldEditorBench';
import { parseJsonText } from '@/lib/jsonFileWorkerUtils';

/** Load World takes the same file twice: the input resets, so the second pick fires a change again. */

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

vi.mock('@/lib/worldBundleRun', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/lib/worldBundleRun')>(),
  resolveImportedWorld: async <T,>(world: T) => world,
}));

vi.mock('react-toastify', () => ({
  toast: { info: vi.fn(), success: vi.fn(), error: vi.fn() },
  ToastContainer: () => null,
}));

const parse = vi.mocked(parseJsonText);
const WORLD = benchEditorWorld({});

/**
 * Picks `file` the way a browser does: a pick sets the input's value, and the browser fires a change
 * only when that value differs from the one before it.
 */
const pick = (input: HTMLInputElement, file: File) => {
  let value = '';
  Object.defineProperty(input, 'value', { configurable: true, get: () => value, set: (v: string) => { value = v; } });
  return () => {
    const next = `C:\\fakepath\\${file.name}`;
    if (value === next) return false;
    value = next;
    Object.defineProperty(input, 'files', { configurable: true, value: [file] });
    act(() => { fireEvent.change(input); });
    return true;
  };
};

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  parse.mockResolvedValue({ ...WORLD, id: 'picked' });
});

describe('World Editor Load World', () => {
  it('loads the same world file twice', async () => {
    renderWorldEditorBench(WORLD, 'advanced');
    await screen.findByLabelText('World Name');
    const input = document.getElementById('load-world') as HTMLInputElement;
    const choose = pick(input, new File(['{}'], 'world.json', { type: 'application/json' }));

    expect(choose()).toBe(true);
    await waitFor(() => expect(parse).toHaveBeenCalledTimes(1));
    expect(choose()).toBe(true);
    await waitFor(() => expect(parse).toHaveBeenCalledTimes(2));
  });
});
