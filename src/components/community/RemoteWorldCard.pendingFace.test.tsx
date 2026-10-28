import { render, screen, cleanup, waitFor, act } from '@testing-library/react';
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { RemoteWorldCard } from './RemoteWorldCard';
import { type WorldRecord } from '@/components/WorldDetails';
import ReviewService from '@/services/ReviewService';

vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));
vi.mock('@/lib/useCachedThumbnail', () => ({ CachedThumbnail: () => <div data-testid="live-thumb" /> }));

const THUMB_URL = '/api/reviews/w1/thumbnail';

const world = (over: Record<string, unknown> = {}): WorldRecord => ({
  id: 'w1', name: 'Sedge Landing', description: 'A drowned coastal town.', kind: 'world',
  author: { id: 'u1', username: 'wren_hallow' }, tags: [], downloads: 0, comment_count: 0,
  thumbnail_file: 'live.webp', moderation_state: 'approved', has_pending_update: true,
  pending_preview: { name: 'Sedge Landing Reborn', thumbnail_url: THUMB_URL, queued_at: '2026-10-01T00:00:00.000Z' },
  ...over,
}) as unknown as WorldRecord;

// A partial user: the card reads only these fields.
const admin = { id: 'a1', username: 'root-admin', accountType: 'admin' } as unknown as WorldRecord;

const show = (record: WorldRecord, inReviewGroup: boolean) => render(
  <RemoteWorldCard
    world={record} downloadState="none" downloadProgress={undefined}
    isAuthenticated currentUser={admin} onView={() => {}} inReviewGroup={inReviewGroup}
  />,
);

// jsdom has no object URLs; the hook turns the read blob into one.
const urlApi = URL as unknown as Record<string, unknown>;

beforeEach(() => {
  urlApi.createObjectURL = () => 'blob:pending';
  urlApi.revokeObjectURL = () => {};
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  delete urlApi.createObjectURL;
  delete urlApi.revokeObjectURL;
});

describe('the pending face of a pinned update card', () => {
  it('shows the pending name and thumbnail, with the live thumbnail until the read ends', async () => {
    const read = vi.spyOn(ReviewService, 'fetchPendingThumbnail').mockResolvedValue(new Blob(['png']));
    show(world(), true);

    expect(screen.getByText('Sedge Landing Reborn')).toBeTruthy();
    expect(screen.queryByText('Sedge Landing')).toBeNull();
    expect(screen.getByTestId('live-thumb')).toBeTruthy();
    expect(screen.getByText('Update Pending')).toBeTruthy();

    await waitFor(() => expect(screen.getByAltText('Sedge Landing Reborn').getAttribute('src')).toBe('blob:pending'));
    expect(read).toHaveBeenCalledWith(THUMB_URL, expect.anything());
    expect(screen.queryByTestId('live-thumb')).toBeNull();
  });

  it('keeps the live thumbnail when the read fails', async () => {
    const read = vi.spyOn(ReviewService, 'fetchPendingThumbnail').mockRejectedValue(new Error('gone'));
    show(world(), true);

    await waitFor(() => expect(read).toHaveBeenCalled());
    await expect(read.mock.results[0].value).rejects.toThrow('gone');
    await act(async () => {});

    expect(screen.getByText('Sedge Landing Reborn')).toBeTruthy();
    expect(screen.getByTestId('live-thumb')).toBeTruthy();
    expect(screen.queryByAltText('Sedge Landing Reborn')).toBeNull();
  });

  it('keeps the live thumbnail when the preview has no thumbnail URL', () => {
    const read = vi.spyOn(ReviewService, 'fetchPendingThumbnail');
    show(world({ pending_preview: { name: 'Sedge Landing Reborn' } }), true);

    expect(screen.getByText('Sedge Landing Reborn')).toBeTruthy();
    expect(screen.getByTestId('live-thumb')).toBeTruthy();
    expect(read).not.toHaveBeenCalled();
  });

  it('shows the live face outside the review group', () => {
    const read = vi.spyOn(ReviewService, 'fetchPendingThumbnail');
    show(world(), false);

    expect(screen.getByText('Sedge Landing')).toBeTruthy();
    expect(screen.queryByText('Sedge Landing Reborn')).toBeNull();
    expect(screen.getByTestId('live-thumb')).toBeTruthy();
    expect(read).not.toHaveBeenCalled();
  });

  it('shows the live face for a row without a preview', () => {
    show(world({ pending_preview: undefined }), true);

    expect(screen.getByText('Sedge Landing')).toBeTruthy();
    expect(screen.getByTestId('live-thumb')).toBeTruthy();
  });

  it('shows the live face for a new listing that carries a preview', () => {
    show(world({ moderation_state: 'pending', has_pending_update: false }), true);

    expect(screen.getByText('Sedge Landing')).toBeTruthy();
    expect(screen.queryByText('Sedge Landing Reborn')).toBeNull();
  });
});
