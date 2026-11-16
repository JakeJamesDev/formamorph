// @vitest-environment jsdom
// Must load before the storage singletons, whose first use opens IndexedDB.
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import EntityStorageService from '@/services/EntityStorageService';
import { useLibraryLinking } from './useLibraryLinking';
import type { Entity, SupporterCopyMarker } from '@/types';

vi.mock('@/services/AuthService', () => ({ default: { getCurrentUser: () => null } }));
vi.mock('react-toastify', () => ({ toast: { success: vi.fn(), info: vi.fn(), error: vi.fn() } }));

const MARKER: SupporterCopyMarker = { listingId: 'L1', accountId: 'A1', revision: 2 };
const entity = { id: 'e1', name: 'Wren' } as Entity;

function setup(supporterCopy: SupporterCopyMarker | null | undefined) {
  const noop = vi.fn();
  return renderHook(() => useLibraryLinking({
    worldId: 'w-source', worldName: 'Source', entities: [entity], dictionaries: [], placeholders: [], worldPlaceholders: [],
    placeholderGroups: [], locations: [], traits: [], traitGroups: [], stats: [], statGroups: [],
    updateEntity: noop, updateDictionary: noop, setEntities: noop, setDictionaries: noop,
    addEntityToWorld: noop, addBookToWorld: noop, addPlaceholder: noop, addLocation: noop,
    vrmStore: undefined, setVrmStore: noop, mediaList: undefined, setMediaList: noop, setOwnedLibraryIds: noop, reopenPicker: noop,
    exportEntity: noop, exportDictionary: noop, supporterCopy,
  }));
}

const saveFace = async (supporterCopy: SupporterCopyMarker | null | undefined) => {
  const { result } = setup(supporterCopy);
  await act(async () => { result.current.controlFor(entity, false).onFace(); });
};

beforeEach(async () => {
  for (const row of await EntityStorageService.getEntityMetadata()) await EntityStorageService.deleteEntity(row.id);
});
afterEach(cleanup);

describe('the Save to Library face of an entity', () => {
  it('writes a marked entry that names the world when the world is a Supporter Copy', async () => {
    await saveFace(MARKER);

    await waitFor(async () => expect(await EntityStorageService.getEntityMetadata()).toHaveLength(1));
    const [saved] = await EntityStorageService.getEntityMetadata();
    expect(saved.supporterCopy).toEqual({ ...MARKER, sourceWorldId: 'w-source' });
  });

  it('writes an unmarked entry when the world is plain', async () => {
    await saveFace(null);

    await waitFor(async () => expect(await EntityStorageService.getEntityMetadata()).toHaveLength(1));
    const [saved] = await EntityStorageService.getEntityMetadata();
    expect(saved.supporterCopy).toBeUndefined();
  });

  it('writes nothing while the world marker is unread', async () => {
    await saveFace(undefined);

    // Let any write land before reading.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(await EntityStorageService.getEntityMetadata()).toHaveLength(0);
  });
});
