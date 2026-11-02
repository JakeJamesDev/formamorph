import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { toast } from 'react-toastify';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderGameViewer } from '@/test/gameViewer';
import { sseResponse, sseReply } from '@/test/aiTextFixtures';
import { DEFAULT_WORLDS, seedWorldData } from '@/lib/defaultWorlds';
import { setUserDefaultAvatar } from '@/lib/defaultAvatar';
import { useGameplay } from '@/contexts/GameplayContext';
import ModelStorageService from '@/services/ModelStorageService';
import { makeVrm1 } from '@/test/glbFixture';
import sugarscape from '@/defaultworlds/sugarscape.json';
import type { World } from '@/types';

// Vitest serves the build's define as a global, so the real modules read this value as a `none` build would.
vi.hoisted(() => {
  (globalThis as Record<string, unknown>).__AVATAR_SET__ = 'none';
  vi.stubEnv('VITE_DEFAULT_ENDPOINT', '');
});

vi.mock('@/views/VRMViewer', () => import('@/test/stubs/vrmViewer'));
vi.mock('@/lib/vrmThumbnail', () => ({ renderVrmThumbnail: vi.fn(async () => undefined) }));
vi.mock('react-toastify', () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn(), warn: vi.fn(), dismiss: vi.fn(), isActive: vi.fn() }),
  ToastContainer: () => null,
}));

const world = (): World => seedWorldData(sugarscape as unknown as Record<string, unknown>, DEFAULT_WORLDS.find(({ id }) => id === 'sugarscape')!);

let assistantTurns = 0;
function Probe() {
  const { fullMessageHistory } = useGameplay();
  assistantTurns = fullMessageHistory.filter((m) => m.role === 'assistant').length;
  return null;
}

/** Enter Sugarscape as a player with no pick, close its readme, and play one turn against a stubbed AI. */
async function playOneTurn() {
  const entered = world();
  renderGameViewer(entered, { inGameplay: <Probe /> });
  const requests = vi.fn(async (_url: string, init?: RequestInit) => (init?.body
    ? sseResponse(sseReply('The wind shifts and the scene holds still.'))
    : new Response(JSON.stringify({ data: [{ id: 'm' }] }), { status: 200, headers: { 'Content-Type': 'application/json' } })));
  vi.stubGlobal('fetch', requests);
  if (entered.worldOverview.readme?.trim()) {
    const readme = await screen.findByRole('dialog', { name: 'Readme' });
    fireEvent.click(within(readme).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Readme' })).toBeNull());
  }
  fireEvent.change(await screen.findByPlaceholderText(/Type your action/), { target: { value: 'I look around.' } });
  await waitFor(() => expect(screen.getByRole('button', { name: 'Send' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'Send' }));
  await waitFor(() => expect(assistantTurns).toBe(1), { timeout: 15_000 });
  return requests;
}

const bundledModelRequests = (requests: ReturnType<typeof vi.fn>) =>
  requests.mock.calls.map(([url]) => String(url)).filter((url) => /\.vrm/i.test(url));

beforeEach(async () => {
  assistantTurns = 0;
  vi.mocked(toast.error).mockClear();
  localStorage.clear();
  localStorage.setItem('FORMAMORPH_endpointUrl', 'http://127.0.0.1:5190/v1/chat/completions');
  localStorage.setItem('FORMAMORPH_thinkingMode', 'off');
  for (const { id } of await ModelStorageService.getModelMetadata()) await ModelStorageService.deleteModel(id);
});

describe('Sugarscape on a build with no bundled Avatar', () => {
  it('plays a turn with an empty library, no model, and no error', { timeout: 60_000 }, async () => {
    const consoleError = vi.spyOn(console, 'error');
    const requests = await playOneTurn();
    expect(screen.queryByTestId('vrm-viewer')).toBeNull();
    expect(bundledModelRequests(requests)).toEqual([]);
    expect(vi.mocked(toast.error)).not.toHaveBeenCalled();
    expect(consoleError.mock.calls.filter(([first]) => /avatar|vrm|model/i.test(String(first)))).toEqual([]);
    consoleError.mockRestore();
  });

  it('shows an added Avatar set as the device default', { timeout: 60_000 }, async () => {
    const added = await ModelStorageService.addModel(new File([makeVrm1({ name: 'Mine' })], 'mine.vrm', { type: 'model/vrm' }));
    setUserDefaultAvatar(added.id);
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: () => 'blob:mine', revokeObjectURL: () => undefined }));
    await playOneTurn();
    expect(await screen.findByTestId('vrm-viewer')).toBeInTheDocument();
  });
});
