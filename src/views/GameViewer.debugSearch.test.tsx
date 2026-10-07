import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderGameViewer } from '@/test/gameViewer';
import { createSurfaceRequester } from '@/test/surfaceRequest';
import { stubReachableEndpoint } from '@/test/endpointProbe';
import { createSurfaceRegistry } from '@/lib/surface/surfaceRegistry';
import type { World } from '@/types';

// The hosted build: the Default preset is the Demo AI, so entering a game raises the gate the tests dismiss.
vi.hoisted(() => { vi.stubEnv('VITE_DEFAULT_ENDPOINT', ''); });

vi.mock('@/views/VRMViewer', () => import('@/test/stubs/vrmViewer'));
vi.mock('kokoro-js', () => ({ KokoroTTS: { from_pretrained: vi.fn() } }));
vi.mock('react-toastify', () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn(), warn: vi.fn(), dismiss: vi.fn(), isActive: vi.fn() }),
  ToastContainer: () => null,
}));

const WORLD = {
  id: 'w1',
  worldOverview: {
    name: 'Sedge Landing', description: '', author: '', thumbnail: null, bgm: null,
    systemPrompt: '', use3DModel: false, tags: [],
  },
  stats: [], locations: [{ id: 'harbor', name: 'Harbor', isStarting: true }], entities: [], traits: [], statUpdates: [],
} as unknown as World;

let registry: ReturnType<typeof createSurfaceRegistry>;
let requester: ReturnType<typeof createSurfaceRequester>;

beforeEach(() => {
  localStorage.clear();
  stubReachableEndpoint();
  registry = createSurfaceRegistry();
  requester = createSurfaceRequester();
});
afterEach(() => { vi.unstubAllGlobals(); });

describe('the AI Context search box', () => {
  it('clears with the X, drops the counter, and keeps the cursor in the box', async () => {
    renderGameViewer(WORLD, { onExitToMenu: vi.fn(), registry, children: <requester.Requester /> });
    fireEvent.click(await screen.findByRole('button', { name: 'Keep Playing' }));
    await waitFor(() => expect(registry.get().dialog).toBeNull());
    requester.send('aiContext');
    const box = await screen.findByPlaceholderText('Search (space-separated terms)…');

    expect(screen.queryByRole('button', { name: 'Clear Search' })).toBeNull();
    fireEvent.change(box, { target: { value: 'harbor' } });
    const counter = screen.getByText('0 of 0');
    expect(screen.getByRole('button', { name: 'Clear Search' }).compareDocumentPosition(counter) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const buttons = screen.getAllByRole('button', { name: /^(Clear Search|Previous match|Next match)$/ });
    expect(buttons.map((b) => b.getAttribute('aria-label'))).toEqual(['Clear Search', 'Previous match', 'Next match']);

    // A real click moves focus onto the X before it fires.
    const clear = screen.getByRole('button', { name: 'Clear Search' });
    clear.focus();
    expect(box).not.toHaveFocus();
    fireEvent.click(clear);
    expect(box).toHaveValue('');
    expect(screen.queryByText('0 of 0')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Clear Search' })).toBeNull();
    expect(box).toHaveFocus();
  });
});
