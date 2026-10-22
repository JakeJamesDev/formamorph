import { screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { renderMainMenu } from '@/test/mainMenu';
import { DEFAULT_WORLDS, tombstoneDefaultWorld } from '@/lib/defaultWorlds';
import { acceptAgeGate } from '@/lib/ageGate';
import { readUserDefaultAvatar, setUserDefaultAvatar } from '@/lib/defaultAvatar';
import type { ModelMetadata } from '@/types';

vi.mock('react-toastify', () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn(), warn: vi.fn() },
  ToastContainer: () => null,
}));
vi.mock('./VRMViewer', async () => {
  const { forwardRef } = await import('react');
  return { default: forwardRef(() => null) };
});
// Cards already carry thumbnails, so the grid renders no WebGL card.
const models = vi.hoisted((): ModelMetadata[] => [
  { id: 'heron', name: 'Heron', type: 'model/vrm', size: 1, createdAt: '2026-01-02', thumbnail: 'data:,', hasFileThumbnail: false },
  { id: 'reed', name: 'Reed', type: 'model/vrm', size: 1, createdAt: '2026-01-01', thumbnail: 'data:,', hasFileThumbnail: false },
]);
vi.mock('@/services/ModelStorageService', () => ({
  default: {
    initialize: vi.fn(async () => {}),
    seedDefaultModel: vi.fn(async () => {}),
    getModelMetadata: vi.fn(async () => models),
    ensureThumbnail: vi.fn(async () => null),
    getModelData: vi.fn(async () => null),
    defaultAvatarHashes: vi.fn(async () => []),
  },
}));

beforeEach(() => {
  localStorage.clear();
  DEFAULT_WORLDS.forEach(({ id }) => tombstoneDefaultWorld(id));
  acceptAgeGate();
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ data: [] }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  })));
});

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

async function openAvatars() {
  renderMainMenu();
  fireEvent.click(await screen.findByRole('radio', { name: 'Avatars' }));
  await screen.findByText('Heron');
}

describe('the default Avatar on the Avatar library tile', () => {
  it('sets, badges and clears the default from the tile menu', async () => {
    await openAvatars();
    expect(screen.queryByText('Default')).not.toBeInTheDocument();
    fireEvent.contextMenu(screen.getByText('Heron'));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Set as Default Avatar' }));
    expect(readUserDefaultAvatar()).toBe('heron');
    expect(await screen.findByText('Default')).toBeInTheDocument();

    fireEvent.contextMenu(screen.getByText('Heron'));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Clear Default Avatar' }));
    expect(readUserDefaultAvatar()).toBeUndefined();
    await waitFor(() => expect(screen.queryByText('Default')).not.toBeInTheDocument());
  });

  it('offers Set on every other tile and moves the default', async () => {
    setUserDefaultAvatar('heron');
    await openAvatars();
    fireEvent.contextMenu(screen.getByText('Reed'));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Set as Default Avatar' }));
    expect(readUserDefaultAvatar()).toBe('reed');
    await waitFor(() => expect(screen.getAllByText('Default')).toHaveLength(1));
  });
});
