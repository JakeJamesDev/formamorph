import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderGameViewer } from '@/test/gameViewer';
import type { World } from '@/types';

/** A new game on a world whose file has no id: the dev fixtures and hand-authored world files. */

vi.mock('@/views/VRMViewer', () => import('@/test/stubs/vrmViewer'));
vi.mock('kokoro-js', () => ({ KokoroTTS: { from_pretrained: vi.fn() } }));
vi.mock('react-toastify', () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn(), warn: vi.fn(), dismiss: vi.fn(), isActive: vi.fn() }),
  ToastContainer: () => null,
}));

const OPENING = 'You wake on the harbor steps.';

const WORLD = {
  worldOverview: {
    name: 'Sedge Landing', description: '', author: '', thumbnail: null, bgm: null,
    systemPrompt: '', use3DModel: false, tags: [],
    openings: [{ id: 'harbor-opening', text: OPENING, kind: 'action' }],
  },
  stats: [], locations: [{ id: 'harbor', name: 'Harbor', isStarting: true }], entities: [], traits: [], statUpdates: [],
} as unknown as World;

describe('a world without an id', () => {
  it('starts a new game and pre-fills its opening', async () => {
    renderGameViewer(WORLD);
    await waitFor(() => expect(screen.getByPlaceholderText(/Type your action/)).toHaveValue(OPENING));
  });
});
