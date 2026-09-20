import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PublishModal } from './PublishModal';
import WorldStorageService from '@/services/WorldStorageService';
import * as librarySources from '@/lib/librarySources';
import type { PublishPayload } from '@/lib/publishPayload';

/** A library row as `libraryItems` returns it. */
const libraryRow = (over: { id: string; kind: 'entity' | 'dictionary'; name: string; sourceId?: string }) => ({
  revision: 'r1', owned: true, authorLine: 'You', sourceLine: 'Your library', ...over,
});

/** A world whose copies follow the given library items. */
const worldWith = (links: { entity?: string; dictionary?: string }) => ({
  kind: 'world' as const,
  name: 'Sedge Landing',
  description: 'd',
  contentData: {
    entities: links.entity ? [{ id: 'e1', name: 'Sedge', link: { libraryId: links.entity } }] : [],
    dictionaries: links.dictionary
      ? [{ id: 'd1', name: 'Shared Lore', entries: [], link: { libraryId: links.dictionary } }]
      : [],
  },
});

const bookPayload: PublishPayload = {
  kind: 'dictionary', name: 'Shared Lore', description: '', contentData: { id: 'lib-d', name: 'Shared Lore', entries: [] },
};

/** The relationship fields on the body a publish sent. */
const sent = (call: unknown[]) => call[0] as PublishPayload;

beforeEach(() => {
  vi.spyOn(WorldStorageService, 'getUserWorlds').mockResolvedValue([]);
  vi.spyOn(WorldStorageService, 'linkWorldToListing').mockResolvedValue(undefined);
  vi.spyOn(WorldStorageService, 'worldsLinking').mockResolvedValue([]);
  vi.spyOn(WorldStorageService, 'fetchListingDetails').mockResolvedValue(null);
  vi.spyOn(WorldStorageService, 'publishItem').mockResolvedValue({ _id: 'new-listing' });
  vi.spyOn(librarySources, 'libraryItems').mockResolvedValue([]);
  vi.spyOn(librarySources, 'libraryItemData').mockResolvedValue(null);
  vi.spyOn(librarySources, 'linkLibraryItemToListing').mockResolvedValue(undefined);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

const view = (payload: PublishPayload, localId?: string) =>
  render(<PublishModal open onOpenChange={() => {}} isAuthenticated payload={payload} localId={localId} />);

describe('publishing a world with linked content', () => {
  beforeEach(() => {
    vi.mocked(librarySources.libraryItems).mockImplementation(async (kind) => (
      kind === 'dictionary' ? [libraryRow({ id: 'lib-d', kind: 'dictionary', name: 'Shared Lore' })] : []
    ));
    vi.mocked(librarySources.libraryItemData)
      .mockResolvedValue({ id: 'lib-d', name: 'Shared Lore', entries: [] } as never);
  });

  it('publishes the source unlisted first, then the world declaring it', async () => {
    vi.mocked(WorldStorageService.publishItem)
      .mockResolvedValueOnce({ _id: 'listing-d' })
      .mockResolvedValueOnce({ _id: 'listing-w' });
    const payload = worldWith({ dictionary: 'lib-d' });
    view(payload, 'world-1');

    await screen.findByText('Linked Content');
    expect(screen.getByLabelText('Include Shared Lore as required')).toBeChecked();

    await userEvent.click(screen.getByRole('button', { name: 'Publish' }));

    await waitFor(() => expect(WorldStorageService.publishItem).toHaveBeenCalledTimes(2));
    const [source, world] = vi.mocked(WorldStorageService.publishItem).mock.calls;
    expect(sent(source)).toMatchObject({ kind: 'dictionary', visibility: 'unlisted' });
    expect(sent(world).requiredDependencies).toEqual(['listing-d']);
    // The library item now has a listing, so a later publish declares it rather than creating a second.
    expect(librarySources.linkLibraryItemToListing)
      .toHaveBeenCalledWith('dictionary', 'lib-d', 'listing-d', expect.anything());
  });

  it('names the listing on the published copy and leaves the author their own link', async () => {
    vi.mocked(WorldStorageService.publishItem)
      .mockResolvedValueOnce({ _id: 'listing-d' })
      .mockResolvedValueOnce({ _id: 'listing-w' });
    const payload = worldWith({ dictionary: 'lib-d' });
    view(payload, 'world-1');

    await screen.findByText('Linked Content');
    await userEvent.click(screen.getByRole('button', { name: 'Publish' }));

    await waitFor(() => expect(WorldStorageService.publishItem).toHaveBeenCalledTimes(2));
    const world = sent(vi.mocked(WorldStorageService.publishItem).mock.calls[1]);
    const published = (world.contentData as { dictionaries: { link?: Record<string, string> }[] }).dictionaries[0];
    expect(published.link).toEqual({ sourceId: 'listing-d' });
    // The author's own copy keeps the library item it follows; publishing is not an edit.
    expect(payload.contentData.dictionaries[0].link).toEqual({ libraryId: 'lib-d' });
  });

  it('embeds the content and declares nothing when Include as required is unchecked', async () => {
    const payload = worldWith({ dictionary: 'lib-d' });
    view(payload, 'world-1');

    await userEvent.click(await screen.findByLabelText('Include Shared Lore as required'));
    await userEvent.click(screen.getByRole('button', { name: 'Publish' }));

    await waitFor(() => expect(WorldStorageService.publishItem).toHaveBeenCalledTimes(1));
    const world = sent(vi.mocked(WorldStorageService.publishItem).mock.calls[0]);
    expect(world).not.toHaveProperty('requiredDependencies');
    // Nothing was published for the source, so its listing state is exactly what it was: none.
    expect(librarySources.linkLibraryItemToListing).not.toHaveBeenCalled();
    const published = (world.contentData as { dictionaries: Record<string, unknown>[] }).dictionaries[0];
    expect(published).not.toHaveProperty('link');
    expect(published.name).toBe('Shared Lore');
  });

  it('clears a listing that requires a source the world no longer follows', async () => {
    // The world's own content is the authority: it follows nothing, so it requires nothing. Stating that
    // needs no read of the listing, which is why no listing request is made here.
    vi.mocked(WorldStorageService.getUserWorlds).mockResolvedValue([{ _id: 'w1', name: 'Sedge Landing', downloads: 0 }]);
    view(worldWith({}), 'world-1');

    await userEvent.click(await screen.findByLabelText('Sedge Landing (w1, 0 downloads)'));
    await userEvent.click(screen.getByRole('button', { name: 'Publish' }));

    await waitFor(() => expect(WorldStorageService.publishItem).toHaveBeenCalled());
    expect(sent(vi.mocked(WorldStorageService.publishItem).mock.calls[0]).requiredDependencies).toEqual([]);
  });

  it('leaves a listing alone when its own required set could not be read', async () => {
    // A failed read is not an empty set. Every row is unchecked, and nothing publishes or is cleared.
    vi.mocked(librarySources.libraryItems).mockImplementation(async (kind) => (
      kind === 'dictionary'
        ? [libraryRow({ id: 'lib-d', kind: 'dictionary', name: 'Shared Lore', sourceId: 'listing-d' })]
        : []
    ));
    vi.mocked(WorldStorageService.getUserWorlds).mockResolvedValue([{ _id: 'w1', name: 'Sedge Landing', downloads: 0 }]);
    vi.mocked(WorldStorageService.fetchListingDetails).mockResolvedValue(null);
    view(worldWith({ dictionary: 'lib-d' }), 'world-1');

    await userEvent.click(await screen.findByLabelText('Sedge Landing (w1, 0 downloads)'));

    await waitFor(() => expect(screen.getByLabelText('Include Shared Lore as required')).not.toBeChecked());
    await userEvent.click(screen.getByRole('button', { name: 'Publish' }));

    await waitFor(() => expect(WorldStorageService.publishItem).toHaveBeenCalled());
    expect(sent(vi.mocked(WorldStorageService.publishItem).mock.calls[0]))
      .not.toHaveProperty('requiredDependencies');
  });

  it('keeps a source that published when a later one fails, and does not publish it again on Retry', async () => {
    vi.mocked(librarySources.libraryItems).mockImplementation(async (kind) => (
      kind === 'dictionary'
        ? [libraryRow({ id: 'lib-d', kind: 'dictionary', name: 'Shared Lore' })]
        : [libraryRow({ id: 'lib-e', kind: 'entity', name: 'Sedge' })]
    ));
    vi.mocked(librarySources.libraryItemData)
      .mockImplementation(async (_kind, id) => ({ id, name: id === 'lib-e' ? 'Sedge' : 'Shared Lore' } as never));
    // Rows run entities first, so Sedge goes up and Shared Lore is refused.
    vi.mocked(WorldStorageService.publishItem)
      .mockResolvedValueOnce({ _id: 'listing-e' })
      .mockRejectedValueOnce(new Error('Over the publish limit.'));
    view({ ...worldWith({ entity: 'lib-e', dictionary: 'lib-d' }) }, 'world-1');

    await screen.findByText('Linked Content');
    await userEvent.click(screen.getByRole('button', { name: 'Publish' }));

    // The world is not up: it cannot publish until every source it requires exists.
    await screen.findByText(/Required content failed/);
    expect(screen.getByText(/Shared Lore: Over the publish limit\./)).toBeInTheDocument();
    expect(WorldStorageService.publishItem).toHaveBeenCalledTimes(2);

    vi.mocked(WorldStorageService.publishItem)
      .mockResolvedValueOnce({ _id: 'listing-d' })
      .mockResolvedValueOnce({ _id: 'listing-w' });
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));

    await waitFor(() => expect(WorldStorageService.publishItem).toHaveBeenCalledTimes(4));
    const retried = vi.mocked(WorldStorageService.publishItem).mock.calls.slice(2).map((call) => sent(call));
    expect(retried.map((one) => one.name)).toEqual(['Shared Lore', 'Sedge Landing']);
    expect(retried[1].requiredDependencies).toEqual(['listing-e', 'listing-d']);
  });

  it('leaves a source the listing already requires checked, and one it does not unchecked', async () => {
    vi.mocked(librarySources.libraryItems).mockImplementation(async (kind) => (
      kind === 'dictionary'
        ? [libraryRow({ id: 'lib-d', kind: 'dictionary', name: 'Shared Lore', sourceId: 'listing-d' })]
        : [libraryRow({ id: 'lib-e', kind: 'entity', name: 'Sedge', sourceId: 'listing-e' })]
    ));
    vi.mocked(WorldStorageService.getUserWorlds).mockResolvedValue([{ _id: 'w1', name: 'Sedge Landing', downloads: 0 }]);
    vi.mocked(WorldStorageService.fetchListingDetails)
      .mockResolvedValue({ anonymousLikes: false, changelog: null, requiredDependencies: ['listing-e'], compatibleWorlds: [] });
    view(worldWith({ entity: 'lib-e', dictionary: 'lib-d' }), 'world-1');

    await userEvent.click(await screen.findByLabelText('Sedge Landing (w1, 0 downloads)'));

    await waitFor(() => expect(screen.getByLabelText('Include Sedge as required')).toBeChecked());
    expect(screen.getByLabelText('Include Shared Lore as required')).not.toBeChecked();
  });

  it('will not publish until the rows the author has to answer are on screen', async () => {
    // Publishing in that window would embed every copy — the checkboxes answered by nobody, delivered
    // as the author's choices. The button waits for the library read instead.
    // One call per library, so both have to land before the rows can be built.
    const waiting: (() => void)[] = [];
    vi.mocked(librarySources.libraryItems).mockImplementation(() => new Promise((resolve) => {
      waiting.push(() => resolve([libraryRow({ id: 'lib-d', kind: 'dictionary', name: 'Shared Lore' })]));
    }));
    view(worldWith({ dictionary: 'lib-d' }), 'world-1');

    await waitFor(() => expect(waiting).toHaveLength(2));
    expect(screen.getByRole('button', { name: 'Publish' })).toBeDisabled();

    waiting.forEach((resolve) => resolve());
    await screen.findByText('Linked Content');
    expect(screen.getByRole('button', { name: 'Publish' })).toBeEnabled();
  });

  it('says nothing about dependencies for a world whose content follows nothing', async () => {
    view(worldWith({}), 'world-1');

    await userEvent.click(screen.getByRole('button', { name: 'Publish' }));

    await waitFor(() => expect(WorldStorageService.publishItem).toHaveBeenCalled());
    expect(sent(vi.mocked(WorldStorageService.publishItem).mock.calls[0]))
      .not.toHaveProperty('requiredDependencies');
  });
});

describe('publishing a component with compatible worlds', () => {
  beforeEach(() => {
    vi.mocked(WorldStorageService.worldsLinking)
      .mockResolvedValue([{ id: 'world-1', name: 'Sedge Landing', sourceId: 'listing-w' }]);
  });

  it('offers each linked world that has a listing, unchecked until the author asks', async () => {
    view(bookPayload, 'lib-d');

    await screen.findByText('Compatible Worlds');
    expect(screen.getByLabelText('Offer as add-on for Sedge Landing')).not.toBeChecked();
  });

  it('publishes the association the author checked', async () => {
    view(bookPayload, 'lib-d');

    await userEvent.click(await screen.findByLabelText('Offer as add-on for Sedge Landing'));
    await userEvent.click(screen.getByRole('button', { name: 'Publish' }));

    await waitFor(() => expect(WorldStorageService.publishItem).toHaveBeenCalled());
    expect(sent(vi.mocked(WorldStorageService.publishItem).mock.calls[0]).compatibleWorlds).toEqual(['listing-w']);
  });

  it('shows the world author answer beside an association that already exists', async () => {
    vi.mocked(WorldStorageService.getUserWorlds).mockResolvedValue([{ _id: 'd1', name: 'Shared Lore', downloads: 0 }]);
    vi.mocked(WorldStorageService.fetchListingDetails).mockResolvedValue({
      anonymousLikes: false,
      changelog: null,
      visibility: 'public',
      compatibleWorlds: [{ id: 'listing-w', name: 'Sedge Landing', reviewState: 'unreviewed' }],
    });
    view(bookPayload, 'lib-d');

    await userEvent.click(await screen.findByLabelText('Shared Lore (d1, 0 downloads)'));

    await waitFor(() => expect(screen.getByLabelText('Offer as add-on for Sedge Landing')).toBeChecked());
    expect(screen.getByText('Unreviewed')).toBeInTheDocument();
  });

  it('offers nothing at all once the author chooses Unlisted', async () => {
    view(bookPayload, 'lib-d');

    await userEvent.click(await screen.findByLabelText('Offer as add-on for Sedge Landing'));
    await userEvent.click(screen.getByRole('radio', { name: 'Unlisted' }));

    expect(screen.getByLabelText('Offer as add-on for Sedge Landing')).toBeDisabled();
    expect(screen.getByText(/An unlisted dictionary can't be an add-on/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Publish' }));

    await waitFor(() => expect(WorldStorageService.publishItem).toHaveBeenCalled());
    const body = sent(vi.mocked(WorldStorageService.publishItem).mock.calls[0]);
    expect(body.visibility).toBe('unlisted');
    expect(body.compatibleWorlds).toEqual([]);
  });

  it('removes an association whose local link is gone', async () => {
    vi.mocked(WorldStorageService.worldsLinking).mockResolvedValue([]);
    vi.mocked(WorldStorageService.getUserWorlds).mockResolvedValue([{ _id: 'd1', name: 'Shared Lore', downloads: 0 }]);
    vi.mocked(WorldStorageService.fetchListingDetails).mockResolvedValue({
      anonymousLikes: false,
      changelog: null,
      visibility: 'public',
      compatibleWorlds: [{ id: 'listing-w', name: 'Sedge Landing', reviewState: 'approved' }],
    });
    view(bookPayload, 'lib-d');

    await userEvent.click(await screen.findByLabelText('Shared Lore (d1, 0 downloads)'));

    await screen.findByText(/Pending removal\./);
    await userEvent.click(screen.getByRole('button', { name: 'Publish' }));

    await waitFor(() => expect(WorldStorageService.publishItem).toHaveBeenCalled());
    expect(sent(vi.mocked(WorldStorageService.publishItem).mock.calls[0]).compatibleWorlds).toEqual([]);
  });

  it('leaves an unlisted listing unlisted when the author never touches the control', async () => {
    // The control reads from the listing rather than from state that outlives a close, so a dialog
    // opened after publishing something public cannot silently list an unlisted listing.
    vi.mocked(WorldStorageService.getUserWorlds).mockResolvedValue([{ _id: 'd1', name: 'Shared Lore', downloads: 0 }]);
    vi.mocked(WorldStorageService.fetchListingDetails)
      .mockResolvedValue({ anonymousLikes: false, changelog: null, visibility: 'unlisted', compatibleWorlds: [] });
    view(bookPayload, 'lib-d');

    await userEvent.click(await screen.findByLabelText('Shared Lore (d1, 0 downloads)'));
    await screen.findByText(/An unlisted dictionary can't be an add-on/);
    await userEvent.click(screen.getByRole('button', { name: 'Publish' }));

    await waitFor(() => expect(WorldStorageService.publishItem).toHaveBeenCalled());
    expect(sent(vi.mocked(WorldStorageService.publishItem).mock.calls[0])).not.toHaveProperty('visibility');
  });

  it('says nothing about compatibility for a component no world links', async () => {
    vi.mocked(WorldStorageService.worldsLinking).mockResolvedValue([]);
    view(bookPayload, 'lib-d');

    await screen.findByText('Compatible Worlds');
    await userEvent.click(screen.getByRole('button', { name: 'Publish' }));

    await waitFor(() => expect(WorldStorageService.publishItem).toHaveBeenCalled());
    const body = sent(vi.mocked(WorldStorageService.publishItem).mock.calls[0]);
    expect(body).not.toHaveProperty('compatibleWorlds');
    expect(body).not.toHaveProperty('visibility');
  });
});
