import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { World } from '@/types';

vi.mock('react-toastify', () => ({
  toast: Object.assign(vi.fn(), { warning: vi.fn(), error: vi.fn() }),
}));
vi.mock('./downloadBlob', () => ({ downloadBlob: vi.fn() }));
vi.mock('./jsonFileWorkerUtils', () => ({
  serializeJsonBlob: vi.fn(async (value: unknown) => new Blob([JSON.stringify(value)])),
}));
vi.mock('./embedRemoteImages', () => ({
  remoteWorldImages: vi.fn(() => [] as string[]),
  embedWorldRemoteImages: vi.fn(),
}));

import { toast } from 'react-toastify';
import { downloadBlob } from './downloadBlob';
import { serializeJsonBlob } from './jsonFileWorkerUtils';
import { embedWorldRemoteImages, remoteWorldImages } from './embedRemoteImages';
import { APP_VERSION } from './version';
import { useWorldExport } from './useWorldExport';

const world = {
  id: 'w1',
  version: '1.0.0',
  worldOverview: { name: 'Sedge Landing' },
  entities: [],
  locations: [],
} as unknown as World;

// The downscale offer the host would normally supply; null = "nothing changed, export the original".
const promptWorld = vi.fn(async () => null);

let api: ReturnType<typeof useWorldExport>;
const Host = () => {
  api = useWorldExport(promptWorld);
  return api.dialog;
};

/** The parsed payload handed to the serializer for the Nth download. */
const exported = (call = 0) =>
  vi.mocked(serializeJsonBlob).mock.calls[call][0] as Record<string, unknown>;

describe('useWorldExport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(remoteWorldImages).mockReturnValue([]);
    promptWorld.mockResolvedValue(null);
  });

  it('exports a world with no linked images straight to a file, no dialog', async () => {
    render(<Host />);
    await api.exportWorld(world);

    expect(promptWorld).toHaveBeenCalledWith(world);
    expect(screen.queryByText('Linked Images')).not.toBeInTheDocument();
    expect(vi.mocked(downloadBlob).mock.calls[0][1]).toBe('Sedge Landing.json');
    expect(exported()).toMatchObject({ formamorphKind: 'world', version: APP_VERSION });
    // The world's own id never rides along in the exported file — imports re-mint it.
    expect(exported()).not.toHaveProperty('id');
  });

  it('exports the downscaled copy when the optimize prompt returns one', async () => {
    const smaller = { ...world, worldOverview: { name: 'Smaller' } } as World;
    promptWorld.mockResolvedValue(smaller as never);
    render(<Host />);
    await api.exportWorld(world);

    expect(vi.mocked(downloadBlob).mock.calls[0][1]).toBe('Smaller.json');
  });

  it('asks how to handle linked images and can keep them as links', async () => {
    vi.mocked(remoteWorldImages).mockReturnValue(['https://img/a.png', 'https://img/b.png']);
    render(<Host />);
    await api.exportWorld(world);

    expect(await screen.findByText('Linked Images')).toBeInTheDocument();
    expect(screen.getByText(/links to 2 images/)).toBeInTheDocument();
    expect(downloadBlob).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: /Keep Links/ }));
    await waitFor(() => expect(downloadBlob).toHaveBeenCalledTimes(1));
    expect(embedWorldRemoteImages).not.toHaveBeenCalled();
    expect(exported()).toMatchObject({ worldOverview: { name: 'Sedge Landing' } });
  });

  it('embeds linked images on the other choice and writes the embedded copy', async () => {
    vi.mocked(remoteWorldImages).mockReturnValue(['https://img/a.png']);
    const embedded = { ...world, worldOverview: { name: 'Embedded' } } as World;
    vi.mocked(embedWorldRemoteImages).mockResolvedValue({ world: embedded, failures: [] });
    render(<Host />);
    await api.exportWorld(world);

    await userEvent.click(await screen.findByRole('button', { name: /Download and Embed/ }));
    await waitFor(() => expect(downloadBlob).toHaveBeenCalledTimes(1));
    expect(exported()).toMatchObject({ worldOverview: { name: 'Embedded' } });
    // Choice made, dialog gone.
    await waitFor(() => expect(screen.queryByText('Linked Images')).not.toBeInTheDocument());
  });

  it('still writes the file but warns when some images could not be fetched', async () => {
    vi.mocked(remoteWorldImages).mockReturnValue(['https://img/a.png', 'https://img/b.png']);
    vi.mocked(embedWorldRemoteImages).mockResolvedValue({
      world,
      failures: [{ url: 'https://img/b.png', reason: 'blocked by the host' }],
    });
    render(<Host />);
    await api.exportWorld(world);

    await userEvent.click(await screen.findByRole('button', { name: /Download and Embed/ }));
    await waitFor(() => expect(downloadBlob).toHaveBeenCalledTimes(1));
    expect(toast.warning).toHaveBeenCalledWith("1 image couldn't be downloaded and stayed linked.");
  });

  it('reports an embed failure instead of writing a partial file', async () => {
    vi.mocked(remoteWorldImages).mockReturnValue(['https://img/a.png']);
    vi.mocked(embedWorldRemoteImages).mockRejectedValue(new Error('network down'));
    render(<Host />);
    await api.exportWorld(world);

    await userEvent.click(await screen.findByRole('button', { name: /Download and Embed/ }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('network down'));
    expect(downloadBlob).not.toHaveBeenCalled();
  });
});
