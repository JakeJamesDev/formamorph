// Must load before the service singleton, whose constructor opens IndexedDB.
import 'fake-indexeddb/auto';
import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RemoteWorldDetailsModal } from './RemoteWorldDetailsModal';
import WorldStorageService from '@/services/WorldStorageService';
import type { WorldRecord } from '@/components/WorldDetails';

vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));
vi.mock('@/lib/useCachedThumbnail', () => ({ useCachedThumbnail: () => ({ src: '' }) }));
vi.mock('@/components/game/MarkdownRenderer', () => ({
  MarkdownRenderer: ({ text }: { text: string }) => <div>{text}</div>,
}));

const QUARANTINE = { quarantined_at: '2026-10-01T00:00:00.000Z', quarantine_expires_at: '2126-10-08T00:00:00.000Z' };

const listing = (over: Record<string, unknown> = {}): WorldRecord => ({
  id: 'w1',
  name: 'Sedge Landing',
  description: 'A drowned coastal town.',
  kind: 'world',
  author: { id: 'u1', username: 'wren_hallow' },
  tags: [],
  downloads: 0,
  ...over,
}) as unknown as WorldRecord;

const show = (world: WorldRecord) =>
  render(
    <RemoteWorldDetailsModal
      open
      onOpenChange={() => {}}
      world={world}
      collapsed={false}
      onToggleCollapsed={() => {}}
      isAuthenticated
      openImageViewer={() => {}}
      downloadStateForWorld={() => 'none'}
      downloadProgress={{}}
      onContextualDownload={() => {}}
      currentUser={{ id: 'u1', username: 'wren_hallow' } as unknown as WorldRecord}
    />
  );

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(WorldStorageService, 'fetchComments').mockResolvedValue({
    success: true, data: [], pagination: {}, total: 0,
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('the review marker in the details modal', () => {
  it('marks a listing that waits for review', () => {
    show(listing({ moderation_state: 'pending' }));

    expect(screen.getByText('Pending Review')).toBeTruthy();
  });

  it('marks a resubmitted listing with its deadline', () => {
    show(listing({ moderation_state: 'pending', ...QUARANTINE }));

    expect(screen.getByText('Resubmitted')).toBeTruthy();
    expect(screen.getByText(/Deleted on/)).toBeTruthy();
  });

  it('marks a rejected listing with the quarantine notice', () => {
    show(listing({ moderation_state: 'rejected', ...QUARANTINE }));

    expect(screen.getByText('Quarantined')).toBeTruthy();
  });

  it('adds no marker to an approved listing that staff quarantined', () => {
    show(listing({ moderation_state: 'approved', ...QUARANTINE }));

    expect(screen.queryByText('Quarantined')).toBeNull();
  });

  it('adds no marker to a live listing', () => {
    show(listing());

    expect(screen.queryByText('Pending Review')).toBeNull();
    expect(screen.queryByText('Quarantined')).toBeNull();
  });
});
