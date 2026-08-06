import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { WorldOverview } from '@/types';
import WorldOverviewManager from './WorldOverviewManager';

const AVATAR_BYTES = new Uint8Array([0x67, 0x6c, 0x54, 0x46, 0x02, 0x00]); // glTF magic + version
const worldOverview = {
  name: 'Sedge Landing',
  use3DModel: true,
  customPlayerVRM: { data: 'data:model/vrm;base64,Z2xURgIA', type: 'model/vrm', name: 'Wren.vrm' },
} as unknown as WorldOverview;

vi.mock('@/contexts/GameDataContext', () => ({
  useGameData: () => ({ worldOverview, updateWorldOverview: vi.fn() }),
}));

// The real panel is a three.js/WebGL surface; this test is about the bytes leaving it, so stand in a shell
// that renders only what the export path needs — the footer the manager passes in.
vi.mock('@/components/modals/ModelDetailsPanel', () => ({
  ModelDetailsPanel: ({ open, name, footer }: { open: boolean; name: string; footer?: React.ReactNode }) =>
    open ? <div>{name}{footer}</div> : null,
}));
vi.mock('../components/modals/ModelDetailsPanel', () => ({
  ModelDetailsPanel: ({ open, name, footer }: { open: boolean; name: string; footer?: React.ReactNode }) =>
    open ? <div>{name}{footer}</div> : null,
}));

// Unrelated to the avatar and settings-bound; the rest of the Overview tab renders for real.
vi.mock('../components/GenerateImageButton', () => ({ GenerateImageButton: () => <div /> }));

const readVrmMeta = vi.fn();
vi.mock('../lib/vrmMeta', () => ({ readVrmMeta: (blob: Blob) => readVrmMeta(blob) }));

const downloadBlob = vi.fn();
vi.mock('@/lib/downloadBlob', () => ({ downloadBlob: (b: Blob, n: string) => downloadBlob(b, n) }));

beforeEach(() => {
  vi.clearAllMocks();
  readVrmMeta.mockResolvedValue({ license: { metaVersion: '1' } });
  // jsdom's fetch doesn't read data: URLs — hand back the bytes the stored data URL stands for.
  vi.stubGlobal('fetch', vi.fn(async () => new Response(AVATAR_BYTES)));
  // jsdom implements neither; the preview makes an object URL for the 3D view before it keeps the bytes.
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: () => 'blob:avatar', revokeObjectURL: () => {} }));
});

/** Open the avatar preview and wait for its bytes to land (the Export button is disabled until they do). */
const openPreview = async () => {
  const user = userEvent.setup();
  render(<WorldOverviewManager />);
  await user.click(screen.getByRole('button', { name: 'Preview' }));
  const exportButton = await screen.findByRole('button', { name: /Export Avatar/ });
  await waitFor(() => expect(exportButton).toBeEnabled());
  return { user, exportButton };
};

describe('exporting the world editor\'s player avatar', () => {
  it('saves the stored bytes byte-for-byte, so the file keeps its own license', async () => {
    const { user, exportButton } = await openPreview();
    await user.click(exportButton);

    expect(downloadBlob).toHaveBeenCalledTimes(1);
    const [blob] = downloadBlob.mock.calls[0];
    expect(new Uint8Array(await blob.arrayBuffer())).toEqual(AVATAR_BYTES);
  });

  it('names the file what the author uploaded', async () => {
    const { user, exportButton } = await openPreview();
    await user.click(exportButton);
    expect(downloadBlob.mock.calls[0][1]).toBe('Wren.vrm');
  });

  it('falls back to a .vrm name when the world predates the stored filename', async () => {
    const named = worldOverview.customPlayerVRM!.name;
    delete worldOverview.customPlayerVRM!.name;
    try {
      const { user, exportButton } = await openPreview();
      await user.click(exportButton);
      expect(downloadBlob.mock.calls[0][1]).toBe('Player Avatar.vrm');
    } finally {
      worldOverview.customPlayerVRM!.name = named;
    }
  });

  it('calls an unnamed file with no VRM data what it is — a plain glTF', async () => {
    readVrmMeta.mockResolvedValue({ license: { metaVersion: null } });
    const named = worldOverview.customPlayerVRM!.name;
    delete worldOverview.customPlayerVRM!.name;
    try {
      const { user, exportButton } = await openPreview();
      await user.click(exportButton);
      expect(downloadBlob.mock.calls[0][1]).toBe('Player Avatar.glb');
    } finally {
      worldOverview.customPlayerVRM!.name = named;
    }
  });

  it('offers nothing to export before the bytes have loaded', async () => {
    let release: (r: Response) => void = () => {};
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((resolve) => { release = resolve; })));
    const user = userEvent.setup();
    render(<WorldOverviewManager />);
    await user.click(screen.getByRole('button', { name: 'Preview' }));

    const exportButton = await screen.findByRole('button', { name: /Export Avatar/ });
    expect(exportButton).toBeDisabled();
    release(new Response(AVATAR_BYTES));
    await waitFor(() => expect(exportButton).toBeEnabled());
  });
});
