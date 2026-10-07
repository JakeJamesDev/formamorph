import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'react-toastify';
import { renderGameViewer } from '@/test/gameViewer';
import { failWritesOnQuota } from '@/test/quotaAbort';
import { toastTexts } from '@/test/toastText';
import { WORLD_STORE } from '@/lib/worldLibrary';
import { STORAGE_FULL } from '@/lib/saveFailureToast';
import type { World } from '@/types';

/** The in-play editor's exit prompt, when Save & Exit runs out of space. */

vi.mock('@/views/VRMViewer', () => import('@/test/stubs/vrmViewer'));
vi.mock('react-toastify', () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn(), warn: vi.fn(), dismiss: vi.fn(), isActive: vi.fn() }),
  ToastContainer: () => null,
}));

const WORLD = {
  id: 'w-in-play',
  worldOverview: {
    name: 'Sedge Landing', description: '', author: '', thumbnail: null, bgm: null,
    systemPrompt: '', use3DModel: false, tags: [],
  },
  stats: [], locations: [{ id: 'harbor', name: 'Harbor', isStarting: true }], entities: [], traits: [], statUpdates: [],
} as unknown as World;

let restore: (() => void) | null = null;
afterEach(() => { restore?.(); restore = null; });

describe('Save & Exit on a full disk', () => {
  it('shows the storage-full message instead of closing silently', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    renderGameViewer(WORLD);
    fireEvent.click(await screen.findByRole('button', { name: 'Edit World' }));
    const editor = await screen.findByRole('dialog', { name: 'World Editor' });
    fireEvent.change(within(editor).getByDisplayValue('Sedge Landing'), { target: { value: 'Brinewell' } });
    restore = failWritesOnQuota(WORLD_STORE);

    fireEvent.keyDown(editor, { key: 'Escape' });
    fireEvent.click(await screen.findByRole('button', { name: 'Save & Exit' }));

    await waitFor(() => expect(toastTexts(vi.mocked(toast.error))).toContainEqual(expect.stringContaining(STORAGE_FULL)));
  });
});
