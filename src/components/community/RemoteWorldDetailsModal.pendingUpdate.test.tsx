// Must load before the service singleton, whose constructor opens IndexedDB.
import 'fake-indexeddb/auto';
import { render, screen, fireEvent, cleanup, waitFor, within } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { toast } from 'react-toastify';
import { RemoteWorldDetailsModal } from './RemoteWorldDetailsModal';
import WorldStorageService from '@/services/WorldStorageService';
import ReviewService from '@/services/ReviewService';
import type { ChangelogEntry } from '@/lib/listingChangelog';
import type { PendingUpdate } from '@/lib/listingModeration';
import type { WorldRecord } from '@/components/WorldDetails';

vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));
vi.mock('@/lib/useCachedThumbnail', () => ({ useCachedThumbnail: () => ({ src: '' }) }));
vi.mock('@/components/game/MarkdownRenderer', () => ({
  MarkdownRenderer: ({ text }: { text: string }) => <div>{text}</div>,
}));
vi.mock('@/components/prompt/PromptField', () => ({
  default: ({ value, onChange, ariaLabel }: { value: string; onChange: (v: string) => void; ariaLabel?: string }) => (
    <textarea aria-label={ariaLabel} value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));

const world = (over: Record<string, unknown> = {}): WorldRecord => ({
  id: 'w1',
  name: 'Sedge Landing',
  description: 'A drowned coastal town.',
  kind: 'world',
  author: { id: 'author-1', username: 'wren_hallow' },
  tags: [],
  downloads: 0,
  moderation_state: 'approved',
  ...over,
}) as unknown as WorldRecord;

const author = { id: 'author-1', username: 'wren_hallow', accountType: 'normal' } as unknown as WorldRecord;
const stranger = { id: 'reader-1', username: 'reader', accountType: 'normal' } as unknown as WorldRecord;

const mod = { id: 'mod-1', username: 'warden', accountType: 'mod' } as unknown as WorldRecord;

const liveEntry: ChangelogEntry = {
  id: 'e1', world_id: 'w1', title: 'Update 1', body: 'The drowned quarter.', entry_date: '2026-08-01',
  created_at: '2026-08-01T12:00:00.000Z', updated_at: '2026-08-01T12:00:00.000Z',
};

const nameChange: PendingUpdate = {
  fields: { name: { approved: 'Sedge Landing', pending: 'Sedge Harbor' } },
  changelog: [],
  content_changed: false,
};

const serve = (pendingUpdate: PendingUpdate | null, changelog: ChangelogEntry[] = []) =>
  vi.spyOn(WorldStorageService, 'readListingDetails')
    .mockResolvedValue({ status: 'ok', details: { anonymousLikes: false, changelog, pendingUpdate } });

const show = (props: Record<string, unknown> = {}) =>
  render(
    <RemoteWorldDetailsModal
      open
      onOpenChange={() => {}}
      world={world({ has_pending_update: true })}
      collapsed={false}
      onToggleCollapsed={() => {}}
      isAuthenticated
      openImageViewer={() => {}}
      downloadStateForWorld={() => 'update'}
      downloadProgress={{}}
      onContextualDownload={() => {}}
      currentUser={author}
      {...props}
    />
  );

const section = () => screen.findByRole('region', { name: 'Pending Update' });

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(WorldStorageService, 'fetchComments').mockResolvedValue({ success: true, data: [], pagination: {}, total: 0 });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe('the Pending Update section', () => {
  it('marks the listing and compares live with pending for the author', async () => {
    serve(nameChange);
    show();

    expect(screen.getByText('Update Pending')).toBeTruthy();
    fireEvent.click(within(await section()).getByRole('button', { name: /Compare/ }));

    const table = await screen.findByRole('table', { name: 'Changed Fields' });
    const row = within(table).getByRole('rowheader', { name: 'Name' }).closest('tr') as HTMLElement;
    expect(within(row).getAllByRole('cell').map((cell) => cell.textContent)).toEqual(['Sedge Landing', 'Sedge Harbor']);
  });

  it('is not offered to a viewer who is neither the author nor staff', async () => {
    serve(nameChange);
    show({ currentUser: stranger });

    await waitFor(() => expect(WorldStorageService.readListingDetails).toHaveBeenCalled());
    await screen.findByText(/no comments yet/i);
    expect(screen.queryByRole('region', { name: 'Pending Update' })).toBeNull();
  });

  it('lets staff compare, without Discard Update', async () => {
    serve(nameChange);
    show({ currentUser: mod });

    const region = await section();
    expect(within(region).queryByRole('button', { name: /Discard Update/ })).toBeNull();
    fireEvent.click(within(region).getByRole('button', { name: /Compare/ }));

    const table = await screen.findByRole('table', { name: 'Changed Fields' });
    const row = within(table).getByRole('rowheader', { name: 'Name' }).closest('tr') as HTMLElement;
    expect(within(row).getAllByRole('cell').map((cell) => cell.textContent)).toEqual(['Sedge Landing', 'Sedge Harbor']);
  });

  it('is not offered to staff where moderation is not available', async () => {
    serve(nameChange);
    show({
      currentUser: mod,
      capabilities: { localLibrary: true, deviceDownloads: false, likes: true, comments: true, moderation: false, reports: true },
    });

    await waitFor(() => expect(WorldStorageService.readListingDetails).toHaveBeenCalled());
    await screen.findByText(/no comments yet/i);
    expect(screen.queryByRole('region', { name: 'Pending Update' })).toBeNull();
  });

  it('keeps Discard Update for the author', async () => {
    serve(nameChange);
    show();

    expect(within(await section()).getByRole('button', { name: /Discard Update/ })).toBeTruthy();
  });

  it('asks before it discards, and sends nothing when the author cancels', async () => {
    serve(nameChange);
    const discard = vi.spyOn(ReviewService, 'discardUpdate').mockResolvedValue(true);
    show();

    fireEvent.click(within(await section()).getByRole('button', { name: /Discard Update/ }));
    const confirm = await screen.findByRole('alertdialog');
    fireEvent.click(within(confirm).getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(discard).not.toHaveBeenCalled();
  });

  it('discards on confirm, then drops the section and the marker and tells the caller', async () => {
    serve(nameChange);
    const discard = vi.spyOn(ReviewService, 'discardUpdate').mockResolvedValue(true);
    const onPendingUpdateChange = vi.fn();
    show({ onPendingUpdateChange });

    fireEvent.click(within(await section()).getByRole('button', { name: /Discard Update/ }));
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Discard Update' }));

    await waitFor(() => expect(screen.queryByRole('region', { name: 'Pending Update' })).toBeNull());
    expect(discard).toHaveBeenCalledWith('w1');
    expect(screen.queryByText('Update Pending')).toBeNull();
    expect(onPendingUpdateChange).toHaveBeenCalledWith(expect.objectContaining({ id: 'w1' }), false);
    expect(toast.success).toHaveBeenCalledWith('Update discarded');
  });

  it('drops the section when a mod already decided on the update', async () => {
    serve(nameChange);
    vi.spyOn(ReviewService, 'discardUpdate').mockResolvedValue(false);
    show();

    fireEvent.click(within(await section()).getByRole('button', { name: /Discard Update/ }));
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Discard Update' }));

    await waitFor(() => expect(screen.queryByRole('region', { name: 'Pending Update' })).toBeNull());
    expect(toast.info).toHaveBeenCalledWith('This update is no longer waiting for review');
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('keeps the section when the discard fails', async () => {
    serve(nameChange);
    vi.spyOn(ReviewService, 'discardUpdate').mockRejectedValue(new Error('Server down'));
    show();

    fireEvent.click(within(await section()).getByRole('button', { name: /Discard Update/ }));
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Discard Update' }));

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(await section()).toBeTruthy();
  });

  it('says nothing after the modal unmounts mid-discard', async () => {
    serve(nameChange);
    let settle: () => void = () => {};
    vi.spyOn(ReviewService, 'discardUpdate').mockReturnValue(new Promise<boolean>((resolve) => { settle = () => resolve(true); }));
    const onPendingUpdateChange = vi.fn();
    const { unmount } = show({ onPendingUpdateChange });

    fireEvent.click(within(await section()).getByRole('button', { name: /Discard Update/ }));
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Discard Update' }));
    unmount();
    settle();
    await Promise.resolve();

    expect(toast.success).not.toHaveBeenCalled();
    expect(onPendingUpdateChange).not.toHaveBeenCalled();
  });
});

describe('held changelog entries', () => {
  it('lists an entry the update adds as pending, before the live ones', async () => {
    serve({ ...nameChange, changelog: [{ op: 'create', id: 'n1', title: 'Update 2', body: 'New wing.', date: '2026-10-20' }] }, [liveEntry]);
    show();

    const held = await screen.findByText('Update 2');
    expect(within(held.parentElement as HTMLElement).getByText('Pending')).toBeTruthy();
    expect(within(screen.getByText('Update 1').parentElement as HTMLElement).queryByText('Pending')).toBeNull();
  });

  it('shows an entry the server held as pending, and marks the live listing as updated', async () => {
    serve(null, [liveEntry]);
    vi.spyOn(WorldStorageService, 'createChangelogEntry').mockResolvedValue({
      id: 'n1', world_id: 'w1', title: 'Update 2', body: 'New wing.', entry_date: '2026-10-20',
      created_at: '', updated_at: '', pending: true,
    });
    const onPendingUpdateChange = vi.fn();
    show({ world: world(), onPendingUpdateChange });

    fireEvent.click(await screen.findByRole('button', { name: /add entry/i }));
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Update 2' } });
    fireEvent.change(screen.getByLabelText('What changed'), { target: { value: 'New wing.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Entry' }));

    const held = await screen.findByText('Update 2');
    expect(within(held.parentElement as HTMLElement).getByText('Pending')).toBeTruthy();
    expect(screen.getByText('Update Pending')).toBeTruthy();
    expect(onPendingUpdateChange).toHaveBeenCalledWith(expect.objectContaining({ id: 'w1' }), true);
  });

  it('counts a held delete against the 100-entry cap, as the server does', async () => {
    const full = Array.from({ length: 100 }, (_, i) => ({ ...liveEntry, id: `e${i}`, title: `Update ${i}` }));
    serve({ ...nameChange, changelog: [{ op: 'delete', id: 'e0' }] }, full);
    show();

    expect(await screen.findByRole('button', { name: /add entry/i })).toBeEnabled();
  });

  it('hands back nothing after the modal unmounts mid-write', async () => {
    serve(null, [liveEntry]);
    let settle: () => void = () => {};
    vi.spyOn(WorldStorageService, 'deleteChangelogEntry').mockReturnValue(new Promise((resolve) => {
      settle = () => resolve({ fields: {}, content_changed: false, changelog: [{ op: 'delete', id: 'e1' }] });
    }));
    const onPendingUpdateChange = vi.fn();
    const { unmount } = show({ world: world(), onPendingUpdateChange });

    fireEvent.click(await screen.findByRole('button', { name: /delete update 1/i }));
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: /confirm|delete/i }));
    unmount();
    settle();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(onPendingUpdateChange).not.toHaveBeenCalled();
    expect(toast.info).not.toHaveBeenCalled();
  });

  it('keeps a live entry whose delete the server held, and says when it goes', async () => {
    serve(null, [liveEntry]);
    vi.spyOn(WorldStorageService, 'deleteChangelogEntry').mockResolvedValue({
      fields: {}, content_changed: false, changelog: [{ op: 'delete', id: 'e1' }],
    });
    show({ world: world() });

    fireEvent.click(await screen.findByRole('button', { name: /delete update 1/i }));
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: /confirm|delete/i }));

    await waitFor(() => expect(toast.info).toHaveBeenCalledWith('Your change shows after a mod approves the update'));
    expect(screen.getByText('Update 1')).toBeTruthy();
    expect(screen.getByText('Update Pending')).toBeTruthy();
  });
});
