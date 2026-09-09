import { renderHook, act, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { parseDictionaryFile } from './dictionaryFile';
import { embedEntityCard, readEntityCard } from './entityCard';
import { migrateWorld } from './version';

const mocks = vi.hoisted(() => ({
  fetchCatalogContent: vi.fn(),
  downloadBlob: vi.fn(),
  serializeJsonBlob: vi.fn(async (value: unknown) => new Blob([JSON.stringify(value)])),
  exportEntityCard: vi.fn(async () => new Blob(['card'], { type: 'image/webp' })),
}));

vi.mock('./fetchCatalogContent', () => ({ fetchCatalogContent: mocks.fetchCatalogContent }));
vi.mock('./downloadBlob', () => ({ downloadBlob: mocks.downloadBlob }));
vi.mock('./jsonFileWorkerUtils', () => ({ serializeJsonBlob: mocks.serializeJsonBlob }));
vi.mock('./entityFile', () => ({ exportEntityCard: mocks.exportEntityCard }));
vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import { toast } from 'react-toastify';
import { useDeviceDownload } from './useDeviceDownload';

const worldListing = {
  _id: 'world-listing', id: 'world-listing', kind: 'world', name: 'Sedge Landing', listingChangelog: 'Website-only metadata',
};
const entityListing = { _id: 'entity-listing', id: 'entity-listing', kind: 'entity', name: 'River Warden' };
const dictionaryListing = { _id: 'dictionary-listing', id: 'dictionary-listing', kind: 'dictionary', name: 'Harbor Terms' };
const modelListing = { _id: 'model-listing', id: 'model-listing', kind: 'model', name: 'Robot Girl' };

const blobText = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result));
  reader.onerror = () => reject(reader.error);
  reader.readAsText(blob);
});

function fakeWebp(): Uint8Array {
  const payload = [1, 2, 3, 4];
  const out = new Uint8Array(20 + payload.length);
  const view = new DataView(out.buffer);
  const put4 = (value: string, index: number) => {
    for (let offset = 0; offset < 4; offset++) out[index + offset] = value.charCodeAt(offset);
  };
  put4('RIFF', 0);
  view.setUint32(4, out.length - 8, true);
  put4('WEBP', 8);
  put4('VP8 ', 12);
  view.setUint32(16, payload.length, true);
  out.set(payload, 20);
  return out;
}

describe('useDeviceDownload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('writes a world JSON file with its published image links intact and no local-library action', async () => {
    mocks.fetchCatalogContent.mockResolvedValue({
      id: 'published-world-id',
      version: '2.16.0',
      worldOverview: { name: 'Sedge Landing', thumbnail: 'https://cdn.example/sedge.webp' },
      entities: [], locations: [{ id: 'shore', name: 'Shore', backgroundImage: 'https://cdn.example/shore.webp' }],
    });
    const { result } = renderHook(() => useDeviceDownload());

    await act(async () => { await result.current.download(worldListing); });

    expect(mocks.fetchCatalogContent).toHaveBeenCalledWith('world-listing', expect.any(Function));
    expect(mocks.downloadBlob).toHaveBeenCalledWith(expect.any(Blob), 'Sedge Landing.json');
    const payload = JSON.parse(await blobText(vi.mocked(mocks.downloadBlob).mock.calls[0][0]));
    expect(payload).not.toHaveProperty('id');
    expect(payload).not.toHaveProperty('listingChangelog');
    expect(payload.worldOverview.thumbnail).toBe('https://cdn.example/sedge.webp');
    expect(payload.locations[0].backgroundImage).toBe('https://cdn.example/shore.webp');
    expect(migrateWorld(payload).worldOverview.thumbnail).toBe('https://cdn.example/sedge.webp');
    expect(toast.success).toHaveBeenCalledWith('"Sedge Landing" downloaded successfully');
  });

  it('writes existing entity cards and dictionary files in their importable formats', async () => {
    const { result } = renderHook(() => useDeviceDownload());
    const entityFile = await vi.importActual<typeof import('./entityFile')>('./entityFile');
    mocks.fetchCatalogContent.mockResolvedValueOnce({ id: 'entity-content', name: 'River Warden', images: ['https://cdn.example/river.webp'] });
    const card = embedEntityCard(
      fakeWebp(),
      JSON.stringify(entityFile.buildEntityCardData({ id: 'entity-content', name: 'River Warden', type: 'guide' })),
      { w: 4, h: 4 },
    );
    mocks.exportEntityCard.mockResolvedValueOnce(new Blob([card], { type: 'image/webp' }));

    await act(async () => { await result.current.download(entityListing); });

    expect(mocks.exportEntityCard).toHaveBeenCalledWith(expect.objectContaining({ name: 'River Warden' }));
    expect(mocks.downloadBlob).toHaveBeenLastCalledWith(expect.any(Blob), 'River Warden.webp');
    const entityBytes = new Uint8Array(await vi.mocked(mocks.downloadBlob).mock.calls[0][0].arrayBuffer());
    const entityJson = readEntityCard(entityBytes);
    expect(entityFile.parseEntityCardData(JSON.parse(entityJson as string))).toMatchObject({ name: 'River Warden', type: 'guide' });

    mocks.fetchCatalogContent.mockResolvedValueOnce({ id: 'dictionary-content', name: 'Harbor Terms', entries: [] });
    await act(async () => { await result.current.download(dictionaryListing); });

    expect(mocks.downloadBlob).toHaveBeenLastCalledWith(expect.any(Blob), 'Harbor Terms.json');
    const payload = JSON.parse(await blobText(vi.mocked(mocks.downloadBlob).mock.calls[1][0]));
    expect(parseDictionaryFile(payload)).toMatchObject({ name: 'Harbor Terms', entries: [] });
  });

  it('writes the Avatar\'s own .vrm bytes rather than a JSON wrapper', async () => {
    mocks.fetchCatalogContent.mockResolvedValueOnce({
      vrm: `data:model/gltf-binary;base64,${Buffer.from('vrm-bytes').toString('base64')}`,
      license: { metaVersion: '1' },
      hash: 'content-hash',
    });
    const { result } = renderHook(() => useDeviceDownload());

    await act(async () => { await result.current.download(modelListing); });

    expect(mocks.downloadBlob).toHaveBeenCalledWith(expect.any(Blob), 'Robot Girl.vrm');
    const blob = vi.mocked(mocks.downloadBlob).mock.calls[0][0] as Blob;
    expect(blob.type).toBe('model/gltf-binary');
    expect(Buffer.from(await blob.arrayBuffer()).toString()).toBe('vrm-bytes');
    expect(toast.success).toHaveBeenCalledWith('"Robot Girl" downloaded successfully');
  });

  it('reports a failed portrait or serializer without falsely reporting a saved file', async () => {
    mocks.fetchCatalogContent.mockResolvedValue({ id: 'entity-content', name: 'River Warden', images: ['https://cdn.example/river.webp'] });
    mocks.exportEntityCard.mockRejectedValueOnce(new Error('Portrait fetch failed'));
    const { result } = renderHook(() => useDeviceDownload());

    await act(async () => { await result.current.download(entityListing); });

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Portrait fetch failed'));
    expect(mocks.downloadBlob).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();

    await act(async () => { await result.current.download(entityListing); });

    expect(mocks.downloadBlob).toHaveBeenCalledWith(expect.any(Blob), 'River Warden.webp');
    expect(toast.success).toHaveBeenCalledWith('"River Warden" downloaded successfully');
  });

  it('reports content fetch and JSON serialization failures without saving a file', async () => {
    const { result } = renderHook(() => useDeviceDownload());
    mocks.fetchCatalogContent.mockRejectedValueOnce(new Error('Content fetch failed'));

    await act(async () => { await result.current.download(worldListing); });

    expect(toast.error).toHaveBeenCalledWith('Content fetch failed');
    expect(mocks.downloadBlob).not.toHaveBeenCalled();

    mocks.fetchCatalogContent.mockResolvedValueOnce({ id: 'published-world-id', worldOverview: { name: 'Sedge Landing' } });
    mocks.serializeJsonBlob.mockRejectedValueOnce(new Error('Serialization failed'));
    await act(async () => { await result.current.download(worldListing); });

    expect(toast.error).toHaveBeenCalledWith('Serialization failed');
    expect(mocks.downloadBlob).not.toHaveBeenCalled();
  });

  it('ignores a duplicate click while the listing is already downloading', async () => {
    let resolveDownload: ((content: unknown) => void) | undefined;
    mocks.fetchCatalogContent.mockImplementationOnce(() => new Promise((resolve) => { resolveDownload = resolve; }));
    const { result } = renderHook(() => useDeviceDownload());

    act(() => {
      void result.current.download(worldListing);
      void result.current.download(worldListing);
    });
    expect(mocks.fetchCatalogContent).toHaveBeenCalledTimes(1);

    await act(async () => { resolveDownload?.({ id: 'published-world-id', worldOverview: { name: 'Sedge Landing' } }); });
    await waitFor(() => expect(mocks.downloadBlob).toHaveBeenCalledTimes(1));
  });
});
