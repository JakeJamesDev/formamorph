import { screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderGameViewer } from '@/test/gameViewer';
import { createSurfaceRequester } from '@/test/surfaceRequest';
import { createSurfaceRegistry } from '@/lib/surface/surfaceRegistry';
import WorldStorageService from '@/services/WorldStorageService';
import type { World } from '@/types';

// The hosted build: the Default preset is the Demo AI, so entering a game shows the line the tests wait for.
vi.hoisted(() => { vi.stubEnv('VITE_DEFAULT_ENDPOINT', ''); });

vi.mock('@/views/VRMViewer', () => import('@/test/stubs/vrmViewer'));
vi.mock('react-toastify', () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn(), warn: vi.fn(), dismiss: vi.fn(), isActive: vi.fn() }),
  ToastContainer: () => null,
}));

/** The AI Context viewer's Export, on a Supporter Copy and on a plain world. */

const WORLD = {
  id: 'w1',
  worldOverview: {
    name: 'Sedge Landing', description: '', author: '', thumbnail: null, bgm: null,
    systemPrompt: '', tags: [],
  },
  stats: [], locations: [{ id: 'harbor', name: 'Harbor', isStarting: true }], entities: [], traits: [], statUpdates: [],
} as unknown as World;

const REASON = "You can't export the AI context of a Supporter world";

let registry: ReturnType<typeof createSurfaceRegistry>;
let requester: ReturnType<typeof createSurfaceRequester>;

beforeEach(() => {
  localStorage.clear();
  registry = createSurfaceRegistry();
  requester = createSurfaceRequester();
});
afterEach(() => { vi.restoreAllMocks(); });

const openAiContext = async () => {
  renderGameViewer(WORLD, { onExitToMenu: vi.fn(), registry, children: <requester.Requester /> });
  await screen.findByTestId('demo-ai-entry-line');
  requester.send('aiContext');
  await screen.findByPlaceholderText('Search terms, separated by spaces');
  return screen.getByRole('button', { name: 'Export' });
};

describe('the AI Context Export', () => {
  it('is blocked on a Supporter Copy, with the reason', async () => {
    vi.spyOn(WorldStorageService, 'getSupporterCopy').mockResolvedValue({ listingId: 'l1', accountId: 'a1', revision: 1 });
    const button = await openAiContext();
    await waitFor(() => expect(button).toHaveAttribute('aria-description', REASON));
    expect(button).toHaveAttribute('aria-disabled', 'true');
  });

  it('carries no block on a plain world', async () => {
    vi.spyOn(WorldStorageService, 'getSupporterCopy').mockResolvedValue(null);
    const button = await openAiContext();
    await waitFor(() => expect(button).not.toHaveAttribute('aria-disabled'));
    expect(button).not.toHaveAttribute('aria-description');
  });
});
