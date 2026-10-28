import 'fake-indexeddb/auto';
import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));
vi.mock('@/lib/useCachedThumbnail', () => ({ useCachedThumbnail: () => ({ src: '' }) }));
vi.mock('@/components/game/MarkdownRenderer', () => ({ MarkdownRenderer: ({ text }: { text: string }) => <div>{text}</div> }));
vi.mock('@/components/prompt/PromptField', () => ({
  default: ({ value, ariaLabel }: { value: string; ariaLabel?: string }) => <textarea aria-label={ariaLabel} value={value} readOnly />,
}));
vi.mock('@/lib/supporterContent', () => {
  // One stable object, like the real store: a fresh one per read would loop useSyncExternalStore.
  const snapshot = { status: 'ready', qualifies: false, entitled: [], installed: [] };
  return {
    supporterContent: { subscribe: () => () => {}, getSnapshot: () => snapshot, install: async () => {}, refresh: async () => {} },
  };
});

import { RemoteWorldDetailsModal } from './RemoteWorldDetailsModal';
import WorldStorageService from '@/services/WorldStorageService';
import { type WorldRecord } from '@/components/WorldDetails';

const listing = (over: Record<string, unknown> = {}): WorldRecord => ({
  id: 'excl', name: 'Aster', description: 'An exclusive.', kind: 'mascot', supporter_only: true,
  author: { id: 'author-1', username: 'wren_hallow' }, tags: [], downloads: 0, likes: 2, ...over,
}) as unknown as WorldRecord;

const player = { id: 'reader-1', username: 'reader-1', accountType: 'normal' } as unknown as WorldRecord;
const staff = { id: 'a1', username: 'root-admin', accountType: 'admin' } as unknown as WorldRecord;

const show = (user: WorldRecord, props: Record<string, unknown> = {}) =>
  render(
    <RemoteWorldDetailsModal
      open onOpenChange={() => {}} world={listing()} collapsed={false} onToggleCollapsed={() => {}}
      isAuthenticated openImageViewer={() => {}} downloadStateForWorld={() => 'none'} downloadProgress={{}}
      onContextualDownload={() => {}} currentUser={user} onLike={async () => {}} {...props}
    />,
  );

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(WorldStorageService, 'fetchComments').mockResolvedValue({ success: true, data: [], pagination: {}, total: 0 });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('the details window of a Supporter-only listing', () => {
  it('shows Patreon in place of Download for a signed-in non-supporter, who can still like and comment', async () => {
    show(player);

    expect(await screen.findByRole('button', { name: 'Patreon' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Download/ })).toBeNull();
    expect(screen.getByRole('button', { name: /like/i })).toBeTruthy();
    expect(await screen.findByLabelText('Comment')).toBeTruthy();
  });

  it('shows Sign In to a signed-out reader', async () => {
    show(null as unknown as WorldRecord, { isAuthenticated: false, onGuestLike: () => {} });

    expect(await screen.findByRole('button', { name: 'Sign In' })).toBeTruthy();
  });

  it('shows the Supporter-only toggle to admins only', async () => {
    const capabilities = { localLibrary: true, deviceDownloads: false, likes: true, comments: true, moderation: true, reports: true };
    const { unmount } = show(staff, { onToggleSupporterOnly: () => {}, capabilities });
    expect(await screen.findByRole('button', { name: /Let everyone download it/ })).toBeTruthy();
    unmount();

    for (const reader of [player, { id: 'm1', username: 'a-mod', accountType: 'mod' } as unknown as WorldRecord]) {
      const shown = show(reader, { onToggleSupporterOnly: () => {}, capabilities });
      await screen.findByRole('button', { name: 'Patreon' });
      expect(screen.queryByRole('button', { name: /Let everyone download it|Limit the download to Supporters/ })).toBeNull();
      shown.unmount();
    }
  });
});
