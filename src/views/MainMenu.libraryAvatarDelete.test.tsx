import { screen, fireEvent, waitFor, cleanup, within } from '@testing-library/react';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { renderMainMenu } from '@/test/mainMenu';
import { DEFAULT_WORLDS, tombstoneDefaultWorld } from '@/lib/defaultWorlds';
import { acceptAgeGate } from '@/lib/ageGate';
import type { Entity, ModelMetadata } from '@/types';

/** Deleting an Avatar from the library names the library entities and saves that use it, and clears their picks. */

vi.mock('react-toastify', () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn(), warn: vi.fn() },
  ToastContainer: () => null,
}));
vi.mock('./VRMViewer', async () => {
  const { forwardRef } = await import('react');
  return { default: forwardRef(() => null) };
});

const library = vi.hoisted(() => ({
  models: [] as ModelMetadata[],
  entities: new Map<string, { id: string; name: string; data: Entity; editedAt?: string }>(),
  saves: [] as string[],
}));

vi.mock('@/services/ModelStorageService', () => ({
  default: {
    initialize: vi.fn(async () => {}),
    seedDefaultModel: vi.fn(async () => {}),
    getModelMetadata: vi.fn(async () => library.models),
    ensureThumbnail: vi.fn(async () => null),
    getModelData: vi.fn(async () => null),
    defaultAvatarHashes: vi.fn(async () => []),
    deleteModel: vi.fn(async (id: string) => { library.models = library.models.filter((m) => m.id !== id); }),
  },
}));

vi.mock('@/services/EntityStorageService', () => ({
  default: {
    initialize: vi.fn(async () => {}),
    getEntityMetadata: vi.fn(async () => [...library.entities.values()].map(({ id, name, data, editedAt }) => ({
      id, name, editedAt, ...(data.vrmPick?.kind === 'library' ? { vrmLibraryId: data.vrmPick.id } : {}),
    }))),
    getEntityData: vi.fn(async (id: string) => library.entities.get(id)!.data),
    storeEntity: vi.fn(async (record: { id: string; name: string; data: Entity; editedAt?: string }) => {
      library.entities.set(record.id, { ...library.entities.get(record.id), ...record });
    }),
    deleteEntity: vi.fn(async () => {}),
    subscribe: vi.fn(() => () => {}),
  },
}));

// The save scan reads the save database; ticket 03 owns it and its tests.
vi.mock('@/lib/modelUsage', () => ({ findSavesUsingModel: vi.fn(async () => library.saves) }));

const seed = (id: string, name: string, data: Partial<Entity>) =>
  library.entities.set(id, { id, name, editedAt: '2026-01-01T00:00:00.000Z', data: { id, name, ...data } as Entity });

beforeEach(() => {
  localStorage.clear();
  DEFAULT_WORLDS.forEach(({ id }) => tombstoneDefaultWorld(id));
  acceptAgeGate();
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ data: [] }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  })));
  library.models = [
    { id: 'heron', name: 'Heron', type: 'model/vrm', size: 1, createdAt: '2026-01-02', thumbnail: 'data:,', hasFileThumbnail: false },
    { id: 'reed', name: 'Reed', type: 'model/vrm', size: 1, createdAt: '2026-01-01', thumbnail: 'data:,', hasFileThumbnail: false },
  ];
  library.entities.clear();
  seed('wren', 'Wren', { vrmPick: { kind: 'library', id: 'heron' } });
  seed('sedge', 'Sedge', { vrmPick: { kind: 'library', id: 'reed' } });
  library.saves = ['Night One'];
});

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('deleting a library Avatar', () => {
  it('names its library entities and saves, then sets their picks to none', async () => {
    renderMainMenu();
    fireEvent.click(await screen.findByRole('radio', { name: 'Avatars' }));
    fireEvent.contextMenu(await screen.findByText('Heron'));
    fireEvent.click(await screen.findByRole('menuitem', { name: /Delete/ }));

    const dialog = await screen.findByRole('alertdialog');
    await within(dialog).findByText(/"Wren" will show no Avatar\. One save uses this Avatar: "Night One"\./);
    fireEvent.click(within(dialog).getByRole('button', { name: /Delete|Confirm/ }));

    await waitFor(() => expect(library.entities.get('wren')?.data).not.toHaveProperty('vrmPick'));
    expect(library.entities.get('sedge')?.data.vrmPick).toEqual({ kind: 'library', id: 'reed' });
    expect(library.models.map((m) => m.id)).toEqual(['reed']);
  });
});
