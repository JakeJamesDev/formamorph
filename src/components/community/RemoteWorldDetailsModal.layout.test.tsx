// Must load before the service singleton, whose constructor opens IndexedDB.
import 'fake-indexeddb/auto';
import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RemoteWorldDetailsModal } from './RemoteWorldDetailsModal';
import WorldStorageService from '@/services/WorldStorageService';
import { type WorldRecord } from '@/components/WorldDetails';

vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));
vi.mock('@/lib/useCachedThumbnail', () => ({
  useCachedThumbnail: (file: string | undefined) => ({ src: file ? `blob:${file}` : '' }),
}));
vi.mock('@/components/game/MarkdownRenderer', () => ({
  MarkdownRenderer: ({ text }: { text: string }) => <div>{text}</div>,
}));

/** An entity's details window frames its art as a portrait beside the author and counts, as its card does. */

const listing = (over: Record<string, unknown>): WorldRecord => ({
  id: 'listing-1',
  name: 'Wren Hallow',
  description: 'A ferry keeper.',
  kind: 'entity',
  thumbnail_file: 'wren.png',
  author: { id: 'author-1', username: 'sedge_reader' },
  tags: ['boatman'],
  downloads: 7,
  ...over,
}) as unknown as WorldRecord;

const show = (over: Record<string, unknown>) =>
  render(
    <RemoteWorldDetailsModal
      open
      onOpenChange={() => {}}
      world={listing(over)}
      collapsed={false}
      onToggleCollapsed={() => {}}
      isAuthenticated={false}
      openImageViewer={() => {}}
      downloadStateForWorld={() => 'none'}
      downloadProgress={{}}
      onContextualDownload={() => {}}
      currentUser={null}
    />
  );

const header = () => document.querySelector('[data-layout="split"]');

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(WorldStorageService, 'fetchComments').mockResolvedValue({
    success: true, data: [], pagination: {}, total: 0,
  });
  vi.spyOn(WorldStorageService, 'fetchListingDetails')
    .mockResolvedValue({ anonymousLikes: false, changelog: null });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('the details window’s layout', () => {
  it('frames an entity’s art as a portrait beside its author, counts, tags and download', async () => {
    show({});
    await screen.findByText('A ferry keeper.');

    const frame = screen.getByRole('img', { name: 'Wren Hallow' }).parentElement!;
    expect(frame.className).toContain('aspect-[2/3]');
    expect(header()!.contains(frame)).toBe(true);
    for (const text of ['Author', 'Downloads', 'Likes', 'Created', 'Updated', 'Tags', 'boatman', 'Download Entity']) {
      expect(header()!.textContent).toContain(text);
    }
    // Each shows once: moved beside the art, not copied there.
    expect(screen.getAllByText('Author')).toHaveLength(1);
    expect(screen.getAllByText('Tags')).toHaveLength(1);
  });

  it('fills the portrait frame with Morph art rather than pillarboxing it', async () => {
    show({ placeholder: true });
    await screen.findByText('A ferry keeper.');

    // Its parent is the rounded, clipping frame itself, not a centered band inside it.
    const frame = document.querySelector('[data-morph-art]')!.parentElement!;
    expect(frame.className).toContain('aspect-[2/3]');
    expect(frame.className).toContain('overflow-hidden');
  });

  it('keeps a world’s wide art above its details', async () => {
    show({ kind: 'world' });
    await screen.findByText('A ferry keeper.');

    const frame = screen.getByRole('img', { name: 'Wren Hallow' }).parentElement!;
    expect(frame.className).toContain('aspect-video');
    expect(header()).toBeNull();
    expect(screen.getAllByText('Author')).toHaveLength(1);
  });

  it('names the kind when a listing has no name', async () => {
    show({ name: '' });
    await screen.findByText('A ferry keeper.');

    expect(screen.getByRole('heading', { name: 'Entity Details' })).toBeTruthy();
  });
});
