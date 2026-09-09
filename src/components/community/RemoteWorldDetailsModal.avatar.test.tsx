// Must load before the service singleton, whose constructor opens IndexedDB.
import 'fake-indexeddb/auto';
import { render, screen, cleanup, waitFor, within } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RemoteWorldDetailsModal } from './RemoteWorldDetailsModal';
import WorldStorageService from '@/services/WorldStorageService';
import { type WorldRecord } from '@/components/WorldDetails';
import type { VrmLicense } from '@/types';

vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));
vi.mock('@/lib/useCachedThumbnail', () => ({ useCachedThumbnail: () => ({ src: '' }) }));
vi.mock('@/components/game/MarkdownRenderer', () => ({
  MarkdownRenderer: ({ text }: { text: string }) => <div>{text}</div>,
}));
vi.mock('@/components/prompt/PromptField', () => ({
  default: ({ value, ariaLabel }: { value: string; ariaLabel?: string }) => (
    <textarea aria-label={ariaLabel} value={value} readOnly />
  ),
}));

/**
 * What an Avatar listing tells a reader about the file behind it.
 *
 * A downloader decides here whether they may use it, so the terms come from the file the server read at
 * publish rather than from anything the publisher typed. Every other kind must be untouched: a world's
 * details window has no license section and never asks for one.
 */

const AVATAR_LICENSE: VrmLicense = {
  metaVersion: '1',
  title: 'Sedge',
  authors: ['Alice', 'Bob'],
  licenseUrl: 'https://example.test/license',
  allowRedistribution: true,
  commercialUse: 'corporation',
  creditRequired: true,
  avatarPermission: 'everyone',
  modification: 'allowModificationRedistribution',
};

const listing = (over: Record<string, unknown> = {}): WorldRecord => ({
  id: 'w1',
  name: 'Sedge',
  description: 'By Alice and Bob.',
  kind: 'model',
  author: { id: 'author-1', username: 'wren_hallow' },
  tags: [],
  downloads: 7,
  likes: 3,
  ...over,
}) as unknown as WorldRecord;

const show = (props: Record<string, unknown> = {}) =>
  render(
    <RemoteWorldDetailsModal
      open
      onOpenChange={() => {}}
      world={listing()}
      collapsed={false}
      onToggleCollapsed={() => {}}
      isAuthenticated
      openImageViewer={() => {}}
      downloadStateForWorld={() => 'none'}
      downloadProgress={{}}
      onContextualDownload={() => {}}
      currentUser={{ id: 'reader-1', username: 'reader-1' } as unknown as WorldRecord}
      {...props}
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

describe('an Avatar listing’s license terms', () => {
  it('shows the file’s title, authors, and what it permits', async () => {
    vi.spyOn(WorldStorageService, 'fetchListingDetails')
      .mockResolvedValue({ changelog: null, modelLicense: AVATAR_LICENSE });

    show();

    // Scoped to the section, because the listing's own name is the file's title — which is exactly what
    // the payload builder does with it, so the two really do read the same.
    const section = within((await screen.findByText('Avatar File')).parentElement!);
    expect(section.getByText('Sedge')).toBeInTheDocument();
    expect(section.getByText('Alice, Bob')).toBeInTheDocument();
    expect(section.getByText('VRM 1.0')).toBeInTheDocument();
    expect(section.getByText('Allowed')).toBeInTheDocument();
    expect(section.getByText('Allowed, including commercial')).toBeInTheDocument();
    expect(section.getByText('Required')).toBeInTheDocument();
    expect(section.getByRole('link', { name: 'https://example.test/license' })).toBeInTheDocument();
  });

  it('says so when the author asks to be credited', async () => {
    vi.spyOn(WorldStorageService, 'fetchListingDetails')
      .mockResolvedValue({ changelog: null, modelLicense: AVATAR_LICENSE });

    show();

    expect(await screen.findByText(/asks to be credited wherever it appears/i)).toBeInTheDocument();
  });

  it('shows nothing at all for a kind that carries no license', async () => {
    vi.spyOn(WorldStorageService, 'fetchListingDetails').mockResolvedValue({ changelog: null });

    show({ world: listing({ kind: 'world', name: 'Sedge Landing' }) });

    await waitFor(() => expect(WorldStorageService.fetchListingDetails).toHaveBeenCalled());
    expect(screen.queryByText('Avatar File')).not.toBeInTheDocument();
  });

  it('shows nothing against a server that predates the field, rather than an empty section', async () => {
    // The client and the community server ship separately; an older deploy answers without the terms and
    // the section must simply not be there.
    vi.spyOn(WorldStorageService, 'fetchListingDetails').mockResolvedValue({ changelog: null });

    show();

    await waitFor(() => expect(WorldStorageService.fetchListingDetails).toHaveBeenCalled());
    expect(screen.queryByText('Avatar File')).not.toBeInTheDocument();
  });

  it('does not show one listing’s terms under the next one’s name while its fetch is still out', async () => {
    // The window stays mounted between listings, so terms left standing would be read as the new
    // listing's for as long as the network takes — a false claim about what a file permits.
    const fetchDetails = vi.spyOn(WorldStorageService, 'fetchListingDetails')
      .mockResolvedValue({ changelog: null, modelLicense: AVATAR_LICENSE });

    const view = show();
    expect(await screen.findByText('Avatar File')).toBeInTheDocument();

    fetchDetails.mockReturnValue(new Promise(() => {})); // still out when the assertion runs
    view.rerender(
      <RemoteWorldDetailsModal
        open
        onOpenChange={() => {}}
        world={listing({ id: 'w2', kind: 'world', name: 'Sedge Landing' })}
        collapsed={false}
        onToggleCollapsed={() => {}}
        isAuthenticated
        openImageViewer={() => {}}
        downloadStateForWorld={() => 'none'}
        downloadProgress={{}}
        onContextualDownload={() => {}}
        currentUser={{ id: 'reader-1', username: 'reader-1' } as unknown as WorldRecord}
      />
    );

    await waitFor(() => expect(screen.queryByText('Avatar File')).not.toBeInTheDocument());
  });
});
