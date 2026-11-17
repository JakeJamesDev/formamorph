import { waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderGameViewer } from '@/test/gameViewer';
import type { World } from '@/types';

/** World music and location ambience play through the Media List once a loaded world links them. */

vi.mock('@/views/VRMViewer', () => import('@/test/stubs/vrmViewer'));
vi.mock('react-toastify', () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn(), warn: vi.fn(), dismiss: vi.fn(), isActive: vi.fn() }),
  ToastContainer: () => null,
}));
// The looping players: what each was asked to play, in render order.
const playing = vi.hoisted(() => ({ srcs: [] as (string | null | undefined)[] }));
vi.mock('@/hooks/useLoopingAudio', () => ({ useLoopingAudio: (src: string | null | undefined) => { playing.srcs.push(src); } }));

const THEME = 'data:audio/mpeg;base64,VEhFTUU=';
const RAIN = 'data:audio/ogg;base64,UkFJTg==';

const WORLD = {
  id: 'w1',
  worldOverview: {
    name: 'Sedge Landing', description: '', author: '', thumbnail: null, bgm: THEME,
    systemPrompt: '', tags: [],
  },
  stats: [],
  locations: [{ id: 'harbor', name: 'Harbor', isStarting: true, ambientSound: { data: RAIN, type: 'audio/ogg', name: 'rain.ogg' } }],
  entities: [], traits: [], statUpdates: [],
} as unknown as World;

describe('music and ambience in play', () => {
  it('plays the linked world music and the starting location ambience', async () => {
    renderGameViewer(WORLD);
    await waitFor(() => {
      expect(playing.srcs).toContain(THEME);
      expect(playing.srcs).toContain(RAIN);
    });
  });
});
