// Must load before the service singleton, whose constructor opens IndexedDB.
import 'fake-indexeddb/auto';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RemoteWorldDetailsModal } from './RemoteWorldDetailsModal';
import WorldStorageService from '@/services/WorldStorageService';
import type { ListingDetails } from '@/services/WorldStorageService';
import { type WorldRecord } from '@/components/WorldDetails';

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
 * What a community listing says about the content it fits, read by somebody deciding whether to take it.
 *
 * A component names the worlds it is offered for and says plainly that taking it takes only it. A world
 * names what it requires. And an unlisted component — which only its author and staff can reach at all —
 * says so, so its author is never left guessing why nobody else can find it.
 */

const component = (over: Record<string, unknown> = {}): WorldRecord => ({
  id: 'e1',
  _id: 'e1',
  name: 'Wren Hallow',
  description: 'A traveling cartographer.',
  kind: 'entity',
  author: { id: 'author-1', username: 'alice' },
  tags: [],
  ...over,
}) as unknown as WorldRecord;

const account = (id: string) => ({ id, username: id, accountType: 'normal' }) as unknown as WorldRecord;

const serveDetails = (details: Partial<ListingDetails>) =>
  vi.spyOn(WorldStorageService, 'fetchListingDetails')
    .mockResolvedValue({ changelog: null, ...details } as ListingDetails);

const show = (props: Record<string, unknown> = {}) =>
  render(
    <RemoteWorldDetailsModal
      open
      onOpenChange={() => {}}
      world={component()}
      collapsed={false}
      onToggleCollapsed={() => {}}
      isAuthenticated
      openImageViewer={() => {}}
      downloadStateForWorld={() => 'none'}
      downloadProgress={{}}
      onContextualDownload={() => {}}
      currentUser={account('reader-1')}
      {...props}
    />
  );

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(WorldStorageService, 'fetchComments').mockResolvedValue({
    success: true, data: [], pagination: {}, total: 0,
  });
  vi.spyOn(WorldStorageService, 'fetchDependencies').mockResolvedValue([]);
  vi.spyOn(WorldStorageService, 'fetchAddons').mockResolvedValue([]);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('a component listing’s Compatible Worlds', () => {
  it('lists the approved and the community worlds the component is offered for', async () => {
    serveDetails({
      compatibleWorlds: [
        { id: 'w1', name: 'Sedge Landing', reviewState: 'approved' },
        { id: 'w2', name: 'The Long Dark', reviewState: 'unreviewed' },
      ],
    });

    show();

    expect(await screen.findByText('Compatible Worlds')).toBeInTheDocument();
    expect(screen.getByText('Sedge Landing')).toBeInTheDocument();
    expect(screen.getByText('The Long Dark')).toBeInTheDocument();
  });

  it('says the download installs the component and none of those worlds', async () => {
    serveDetails({ compatibleWorlds: [{ id: 'w1', name: 'Sedge Landing', reviewState: 'approved' }] });

    show();

    expect(await screen.findByText(/Download installs this entity only/)).toBeInTheDocument();
  });

  it('keeps a world the author turned away off a player’s list', async () => {
    serveDetails({ compatibleWorlds: [{ id: 'w3', name: 'Ashfall', reviewState: 'declined' }] });

    show();

    await waitFor(() => expect(WorldStorageService.fetchListingDetails).toHaveBeenCalled());
    expect(screen.queryByText('Ashfall')).toBeNull();
    expect(screen.queryByText('Compatible Worlds')).toBeNull();
  });

  it('shows the component’s own author that answer, in words', async () => {
    serveDetails({ compatibleWorlds: [{ id: 'w3', name: 'Ashfall', reviewState: 'declined' }] });

    show({ currentUser: account('author-1') });

    expect(await screen.findByText('Ashfall')).toBeInTheDocument();
    expect(screen.getByText('Declined by the world author')).toBeInTheDocument();
  });

  it('opens a world the reader picks out of the list', async () => {
    serveDetails({ compatibleWorlds: [{ id: 'w1', name: 'Sedge Landing', reviewState: 'approved' }] });
    const onOpenListing = vi.fn();

    show({ onOpenListing });

    fireEvent.click(await screen.findByRole('button', { name: 'Open Sedge Landing' }));

    expect(onOpenListing).toHaveBeenCalledWith({ id: 'w1', kind: 'world' });
  });

  it('draws nothing for a component offered for no world', async () => {
    serveDetails({ compatibleWorlds: [] });

    show();

    await waitFor(() => expect(WorldStorageService.fetchListingDetails).toHaveBeenCalled());
    expect(screen.queryByText('Compatible Worlds')).toBeNull();
  });

  it('draws nothing against a server that has never heard of the field', async () => {
    serveDetails({});

    show();

    await waitFor(() => expect(WorldStorageService.fetchListingDetails).toHaveBeenCalled());
    expect(screen.queryByText('Compatible Worlds')).toBeNull();
  });

  it('never draws the section on a world listing, which is offered for nothing', async () => {
    serveDetails({ compatibleWorlds: [{ id: 'w1', name: 'Sedge Landing', reviewState: 'approved' }] });

    show({ world: component({ id: 'w9', _id: 'w9', kind: 'world', name: 'Ashfall' }) });

    await waitFor(() => expect(WorldStorageService.fetchListingDetails).toHaveBeenCalled());
    expect(screen.queryByText('Compatible Worlds')).toBeNull();
  });
});

describe('a world listing’s required components', () => {
  it('names each one before the player downloads the world', async () => {
    serveDetails({});
    vi.mocked(WorldStorageService.fetchDependencies).mockResolvedValue([
      { id: 'e1', status: 'ok', listing: { id: 'e1', name: 'Wren Hallow', kind: 'entity' } },
      { id: 'd1', status: 'ok', listing: { id: 'd1', name: 'Coastal Lore', kind: 'dictionary' } },
    ]);

    show({ world: component({ id: 'w9', _id: 'w9', kind: 'world', name: 'Ashfall' }) });

    expect(await screen.findByText('Wren Hallow')).toBeInTheDocument();
    expect(screen.getByText('Coastal Lore')).toBeInTheDocument();
  });

  it('says a required source the server could not resolve is gone', async () => {
    serveDetails({});
    vi.mocked(WorldStorageService.fetchDependencies).mockResolvedValue([
      { id: 'e1', status: 'not_found' },
    ]);

    show({ world: component({ id: 'w9', _id: 'w9', kind: 'world', name: 'Ashfall' }) });

    expect(await screen.findByText(/no longer on the server/)).toBeInTheDocument();
  });
});

describe('an unlisted component', () => {
  it('tells its author why nobody else can find it', async () => {
    serveDetails({ visibility: 'unlisted' });

    show({ currentUser: account('author-1'), world: component({ visibility: 'unlisted' }) });

    expect(await screen.findByText('Unlisted')).toBeInTheDocument();
    expect(screen.getByText(/only inside a world that requires it/)).toBeInTheDocument();
  });

  it('still offers its author the standalone download', async () => {
    serveDetails({ visibility: 'unlisted' });
    const onContextualDownload = vi.fn();

    show({
      currentUser: account('author-1'),
      world: component({ visibility: 'unlisted' }),
      onContextualDownload,
    });

    fireEvent.click(await screen.findByRole('button', { name: /Download Entity/ }));

    expect(onContextualDownload).toHaveBeenCalled();
  });

  it('says nothing about visibility on an ordinary public listing', async () => {
    serveDetails({ visibility: 'public' });

    show();

    await waitFor(() => expect(WorldStorageService.fetchListingDetails).toHaveBeenCalled());
    expect(screen.queryByText('Unlisted')).toBeNull();
  });
});
