import { screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { renderMainMenu } from '@/test/mainMenu';
import WorldStorageService from '@/services/WorldStorageService';
import { DEFAULT_WORLDS, tombstoneDefaultWorld } from '@/lib/defaultWorlds';
import { acceptAgeGate } from '@/lib/ageGate';
import { setUserDefaultAvatar } from '@/lib/defaultAvatar';
import { rememberWorldPersona } from '@/lib/personaPick';
import type { StoredWorldRecord } from '@/services/WorldStorageService';
import type { CharacterData, Entity, ModelMetadata, VrmPick } from '@/types';

vi.mock('react-toastify', () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn(), warn: vi.fn() },
  ToastContainer: () => null,
}));
// The preview names the file it would render.
vi.mock('./VRMViewer', async () => {
  const { forwardRef } = await import('react');
  return { default: forwardRef<HTMLDivElement, { modelUrl?: string }>(({ modelUrl }, ref) => <div ref={ref} data-testid="preview" data-url={modelUrl ?? 'bundled'} />) };
});
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

const persona = (id: string, vrmPick?: VrmPick): Entity => ({
  id, name: id, playerDescription: '', aiDescription: '', aiSummary: '', persona: true, ...(vrmPick ? { vrmPick } : {}),
});

// Two personas, one with the author's Avatar and one on User's Default, and one with none.
const world: StoredWorldRecord = {
  id: 'avatar-world', name: 'Avatar World',
  data: {
    version: __APP_VERSION__,
    worldOverview: {
      name: 'Avatar World', description: '', author: '', systemPrompt: '', tags: [],
      vrmStore: { knight: { name: 'Knight', file: { name: 'knight.vrm', type: 'model/gltf-binary', data: 'data:,knight' } } },
    },
    stats: [], statUpdates: [], traits: [], traitGroups: [], dictionaries: [],
    locations: [{ id: 'inn', name: 'Inn', isStarting: true }],
    entities: [persona('Hero', { kind: 'world', id: 'knight' }), persona('Scout', { kind: 'default' }), persona('Ghost')],
  },
};

beforeEach(async () => {
  localStorage.clear();
  DEFAULT_WORLDS.forEach(({ id }) => tombstoneDefaultWorld(id));
  acceptAgeGate();
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ data: [] }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  })));
  await WorldStorageService.storeWorld(world);
});

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

async function enterAs(name: string) {
  const onStartGame = vi.fn();
  renderMainMenu({ onStartGame });
  fireEvent.click(await screen.findByText('Avatar World'));
  fireEvent.click(await screen.findByRole('button', { name: 'Enter World' }));
  await screen.findByRole('dialog', { name: 'Enter Avatar World' });
  fireEvent.click(screen.getByRole('radio', { name }));
  return onStartGame;
}

const startedWith = (onStartGame: ReturnType<typeof vi.fn>): CharacterData | null => onStartGame.mock.calls[0][1];

describe('the avatar step follows the persona pick', () => {
  it('relabels the continue button as the persona changes', async () => {
    await enterAs('Ghost');
    expect(screen.getByRole('button', { name: 'Start Game' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: 'Hero' }));
    expect(screen.getByRole('button', { name: 'Continue to Avatar' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: 'Ghost' }));
    expect(screen.getByRole('button', { name: 'Start Game' })).toBeInTheDocument();
  });

  it('starts with no avatar step and no customization for a persona with no Avatar', async () => {
    const onStartGame = await enterAs('Ghost');
    fireEvent.click(screen.getByRole('button', { name: 'Start Game' }));
    await waitFor(() => expect(onStartGame).toHaveBeenCalledOnce());
    expect(startedWith(onStartGame)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Finalize Character' })).not.toBeInTheDocument();
  });

  it("offers the library picker on User's Default, starting on the device default", async () => {
    setUserDefaultAvatar('reed');
    const onStartGame = await enterAs('Scout');
    fireEvent.click(screen.getByRole('button', { name: 'Continue to Avatar' }));
    await screen.findByRole('button', { name: 'Finalize Character' });
    const picker = screen.getByRole('combobox');
    await waitFor(() => expect(picker).toHaveTextContent('Reed'));
    fireEvent.click(picker);
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual(['Heron', 'Reed']);
    fireEvent.click(screen.getByRole('option', { name: 'Heron' }));
    expect(screen.getByText('Add .vrm')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Finalize Character' }));
    expect(startedWith(onStartGame)?.chosenVrm).toEqual({ pick: { kind: 'library', id: 'heron' } });
  });

  it("hides the picker on the author's Avatar, previews it, and starts with no choice", async () => {
    const onStartGame = await enterAs('Hero');
    fireEvent.click(screen.getByRole('button', { name: 'Continue to Avatar' }));
    const finalize = await screen.findByRole('button', { name: 'Finalize Character' });
    expect(await screen.findByTestId('preview')).toHaveAttribute('data-url', 'data:,knight');
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.queryByText('Add .vrm')).not.toBeInTheDocument();
    await waitFor(() => expect(finalize).toBeEnabled());
    fireEvent.click(finalize);
    expect(startedWith(onStartGame)).toEqual(expect.objectContaining({ chosenVrm: null }));
  });
});

describe('Quick Start', () => {
  const quickStart = async (name: string) => {
    rememberWorldPersona('avatar-world', { source: 'world', entityId: name });
    const onStartGame = vi.fn();
    renderMainMenu({ onStartGame });
    fireEvent.click(await screen.findByText('Avatar World'));
    fireEvent.click(await screen.findByRole('button', { name: 'Quick Start' }));
    await waitFor(() => expect(onStartGame).toHaveBeenCalledOnce());
    return startedWith(onStartGame);
  };

  it('seeds customization when the played entity has an Avatar', async () => {
    expect(await quickStart('Hero')).toEqual(expect.objectContaining({ chosenVrm: null, bodyMorphs: {} }));
  });

  it('seeds nothing when the played entity has no Avatar', async () => {
    expect(await quickStart('Ghost')).toBeNull();
  });
});
