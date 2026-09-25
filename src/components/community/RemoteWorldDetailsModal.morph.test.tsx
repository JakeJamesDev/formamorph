// Must load before the service singleton, whose constructor opens IndexedDB.
import 'fake-indexeddb/auto';
import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RemoteWorldDetailsModal } from './RemoteWorldDetailsModal';
import WorldStorageService from '@/services/WorldStorageService';
import { type WorldRecord } from '@/components/WorldDetails';

vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));
const { useCachedThumbnail } = vi.hoisted(() => ({
  useCachedThumbnail: vi.fn((file: string | undefined, _url: string) => ({ src: file ? `blob:${file}` : '' })),
}));
vi.mock('@/lib/useCachedThumbnail', () => ({ useCachedThumbnail }));
vi.mock('@/components/game/MarkdownRenderer', () => ({
  MarkdownRenderer: ({ text }: { text: string }) => <div>{text}</div>,
}));

/** The details window draws the same Morph art as the card, and never loads the stand-in file. */

const listing = (over: Record<string, unknown>): WorldRecord => ({
  id: 'listing-1',
  name: 'Wren Hallow',
  description: 'A ferry keeper.',
  kind: 'entity',
  thumbnail_file: 'stand-in.png',
  author: { id: 'author-1', username: 'sedge_reader' },
  tags: [],
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

const morphArt = () => document.querySelector('[data-morph-art]');

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
  useCachedThumbnail.mockClear();
});

describe('the details window’s art', () => {
  it('draws Morph art for a flagged entity and requests no thumbnail', async () => {
    show({ placeholder: true });
    await screen.findByText('A ferry keeper.');

    expect(morphArt()).not.toBeNull();
    expect(screen.queryByRole('img', { name: 'Wren Hallow' })).toBeNull();
    for (const [file, url] of useCachedThumbnail.mock.calls) {
      expect(file).toBeUndefined();
      expect(url).toBe('');
    }
  });

  it('shows the stored image of an entity that is not flagged', async () => {
    show({ placeholder: false });
    await screen.findByText('A ferry keeper.');

    expect(screen.getByRole('img', { name: 'Wren Hallow' }).getAttribute('src')).toBe('blob:stand-in.png');
    expect(morphArt()).toBeNull();
  });

  it('draws Morph art for an entity with no picture at all, as its card does', async () => {
    show({ thumbnail_file: null });
    await screen.findByText('A ferry keeper.');

    expect(morphArt()).not.toBeNull();
  });

  it('keeps an avatar’s silhouette even when flagged', async () => {
    show({ kind: 'model', placeholder: true });
    await screen.findByText('A ferry keeper.');

    expect(screen.getByRole('img', { name: 'Wren Hallow' }).getAttribute('src')).toBe('blob:stand-in.png');
    expect(morphArt()).toBeNull();
  });
});
