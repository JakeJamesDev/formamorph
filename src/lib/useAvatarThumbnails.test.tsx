// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ModelMetadata } from '@/types';
import { useAvatarThumbnails } from './useAvatarThumbnails';

const service = vi.hoisted(() => ({ ensureCard: vi.fn(), setThumbnailSource: vi.fn() }));
vi.mock('@/services/ModelStorageService', () => ({ default: service }));
const toastError = vi.hoisted(() => vi.fn());
vi.mock('@/lib/linkToast', () => ({ toastError }));

const FILE = 'data:image/png;base64,FILE';
const GENERATED = 'data:image/webp;base64,GENERATED';
const card = (over: Partial<ModelMetadata> = {}): ModelMetadata => ({
  id: 'a', name: 'Sedge', type: 'model/vrm', size: 1, thumbnail: FILE, hasFileThumbnail: true, ...over,
});

/** The hook over real grid state, as MainMenu holds it. */
const renderGrid = (initial: ModelMetadata[]) => renderHook(() => {
  const [models, setModels] = useState(initial);
  return { models, setSource: useAvatarThumbnails(models, setModels, true) };
});

beforeEach(() => {
  vi.clearAllMocks();
  service.ensureCard.mockImplementation(async (id: string) => card({ id }));
});

describe('useAvatarThumbnails', () => {
  it('puts the switched image on the card without rerunning the backfill', async () => {
    service.setThumbnailSource.mockResolvedValueOnce(card({ thumbnail: GENERATED, thumbnailSource: 'generated' }));
    const { result } = renderGrid([card(), card({ id: 'b', name: 'Other' })]);

    await act(() => result.current.setSource('a', 'generated'));

    expect(service.setThumbnailSource).toHaveBeenCalledWith('a', 'generated');
    expect(result.current.models.map((m) => m.id)).toEqual(['a', 'b']);
    expect(result.current.models[0]).toMatchObject({ thumbnail: GENERATED, thumbnailSource: 'generated' });
    expect(result.current.models[1].thumbnail).toBe(FILE);
    expect(service.ensureCard).not.toHaveBeenCalled();
  });

  it('keeps the card and shows an error toast when the render fails', async () => {
    const failure = new Error('rendered no image');
    service.setThumbnailSource.mockRejectedValueOnce(failure);
    const { result } = renderGrid([card()]);

    await act(() => result.current.setSource('a', 'generated'));

    expect(result.current.models[0]).toEqual(card());
    expect(toastError).toHaveBeenCalledWith(failure, { headline: "Couldn't generate the thumbnail." });
  });

  it('names a failed switch back to the file without blaming a render', async () => {
    const failure = new Error('storage failed');
    service.setThumbnailSource.mockRejectedValueOnce(failure);
    const { result } = renderGrid([card({ thumbnailSource: 'generated' })]);

    await act(() => result.current.setSource('a', 'file'));

    expect(toastError).toHaveBeenCalledWith(failure, { headline: "Couldn't change the thumbnail." });
  });

  it('backfills a card whose file was never read, so the menu learns it has a choice', async () => {
    const { result } = renderGrid([card({ hasFileThumbnail: undefined })]);
    await waitFor(() => expect(result.current.models[0].hasFileThumbnail).toBe(true));
    expect(service.ensureCard).toHaveBeenCalledWith('a');
  });
});
