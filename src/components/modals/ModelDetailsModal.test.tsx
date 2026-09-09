import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ModelDetailsModal } from './ModelDetailsModal';
import type { VrmLicense } from '@/types';

// A shell that renders only what this suite checks — the license the modal resolved and handed down — same
// approach WorldOverviewManager.avatar.test.tsx uses to keep the real 3D viewer out of this suite entirely.
vi.mock('./ModelDetailsPanel', () => ({
  ModelDetailsPanel: ({ open, license }: { open: boolean; license?: VrmLicense }) =>
    open ? <div data-testid="panel">{JSON.stringify(license)}</div> : null,
}));

const getModelData = vi.fn();
const ensureThumbnail = vi.fn();
vi.mock('@/services/ModelStorageService', () => ({
  default: {
    getModelData: (id: string) => getModelData(id),
    ensureThumbnail: (id: string) => ensureThumbnail(id),
  },
}));

const STALE_LICENSE = { metaVersion: '1' } as VrmLicense; // no `avatarPermission` key — the pre-gate shape
const FRESH_LICENSE: VrmLicense = {
  metaVersion: '1',
  avatarPermission: 'everyone',
  allowRedistribution: true,
  modification: 'allowModificationRedistribution',
  commercialUse: 'corporation',
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: () => 'blob:test', revokeObjectURL: () => {} }));
});

describe('ModelDetailsModal', () => {
  it('re-reads a stale-shape license on open rather than trusting the grid metadata forever', async () => {
    // The library grid only backfills a model with no thumbnail; a legacy model that already has one never
    // gets ensureThumbnail called on its behalf, so its stale license would otherwise never be refreshed and
    // the modal would show it — with a false verdict — for the rest of the session.
    ensureThumbnail.mockResolvedValue(undefined);
    getModelData.mockResolvedValue({ type: 'model/vrm', blob: new Blob(['x']), size: 1, license: FRESH_LICENSE });

    render(
      <ModelDetailsModal
        model={{ id: 'm1', name: 'Test', type: 'model/vrm', size: 1, license: STALE_LICENSE }}
        onClose={() => {}}
      />,
    );

    const panel = await screen.findByTestId('panel');
    await waitFor(() => expect(panel).toHaveTextContent(JSON.stringify(FRESH_LICENSE)));
    expect(ensureThumbnail).toHaveBeenCalledWith('m1');
    expect(getModelData).toHaveBeenCalledWith('m1');
  });

  it('backfills before reading the record, so the read sees what the backfill just wrote', async () => {
    const order: string[] = [];
    ensureThumbnail.mockImplementation(async () => { order.push('ensureThumbnail'); });
    getModelData.mockImplementation(async () => {
      order.push('getModelData');
      return { type: 'model/vrm', blob: new Blob(['x']), size: 1, license: FRESH_LICENSE };
    });

    render(
      <ModelDetailsModal
        model={{ id: 'm1', name: 'Test', type: 'model/vrm', size: 1, license: STALE_LICENSE }}
        onClose={() => {}}
      />,
    );

    await waitFor(() => expect(order).toEqual(['ensureThumbnail', 'getModelData']));
  });

  it('shows the grid metadata immediately, before the re-read resolves', () => {
    ensureThumbnail.mockReturnValue(new Promise(() => {})); // never resolves in this test
    getModelData.mockReturnValue(new Promise(() => {}));

    render(
      <ModelDetailsModal
        model={{ id: 'm1', name: 'Test', type: 'model/vrm', size: 1, license: STALE_LICENSE }}
        onClose={() => {}}
      />,
    );

    expect(screen.getByTestId('panel')).toHaveTextContent(JSON.stringify(STALE_LICENSE));
  });
});
