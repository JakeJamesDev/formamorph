import { act, cleanup, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { harborWorld, renderGameViewer } from '@/test/gameViewer';
import { funnelPosts } from '@/test/funnelPosts';
import { RoadSceneHost } from '@/components/road/RoadSceneHost';
import { closeRoadScene, roadSceneSource } from '@/components/road/roadSceneStore';

/** The built-in engine card's See Levels in the game view. When it shows is `useDemoAIOffer.test.tsx`'s concern. */

vi.hoisted(() => { vi.stubEnv('VITE_DEFAULT_ENDPOINT', ''); });

vi.mock('@/views/VRMViewer', () => import('@/test/stubs/vrmViewer'));
vi.mock('react-toastify', () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn(), warn: vi.fn(), dismiss: vi.fn(), isActive: vi.fn() }),
  ToastContainer: () => null,
}));
vi.mock('@/components/road/useDemoAIOffer', async (orig) => ({
  ...(await orig<typeof import('@/components/road/useDemoAIOffer')>()),
  useEngineStoryCard: () => ({ showing: true, dismiss: () => {} }),
}));

afterEach(() => {
  act(() => closeRoadScene());
  cleanup();
  vi.unstubAllGlobals();
});

describe('the built-in engine card', () => {
  it('See Levels opens the scene under the engine source', async () => {
    localStorage.clear();
    renderGameViewer(harborWorld(), { children: <RoadSceneHost /> });
    const card = await screen.findByTestId('engine-story-card');
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('offline (test)'))));
    fireEvent.click(within(card).getByRole('button', { name: 'See Levels' }));
    expect(roadSceneSource()).toBe('engine');
    expect(funnelPosts()).toEqual(['engine_see_levels']);
  }, 30_000);
});
