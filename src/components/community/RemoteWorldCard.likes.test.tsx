import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { RemoteWorldCard } from './RemoteWorldCard';
import { type WorldRecord } from '@/components/WorldDetails';

vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));
vi.mock('@/lib/useCachedThumbnail', () => ({ CachedThumbnail: () => <div data-testid="thumb" /> }));

/**
 * The heart on a catalog card.
 *
 * Downloads count how many people tried something, likes how many were glad they did — so the control has
 * to reach somebody who could press it and nobody who couldn't: not a signed-out visitor, and not the
 * author, whose own like the server refuses anyway.
 */

const world = (over: Record<string, unknown> = {}): WorldRecord => ({
  id: 'w1',
  name: 'Sedge Landing',
  description: 'A drowned coastal town.',
  kind: 'world',
  author: { id: 'u1', username: 'wren_hallow' },
  tags: [],
  downloads: 7,
  comment_count: 2,
  likes: 3,
  ...over,
}) as unknown as WorldRecord;

const show = (record: WorldRecord, props: Record<string, unknown> = {}) =>
  render(
    <RemoteWorldCard
      world={record}
      downloadState="none"
      downloadProgress={undefined}
      isAuthenticated
      currentUser={{ id: 'me', username: 'reader' } as unknown as WorldRecord}
      onView={() => {}}
      onHideWorld={() => {}}
      onHideAuthor={() => {}}
      onHideTag={() => {}}
      onContextualDownload={() => {}}
      onDelete={() => {}}
      {...props}
    />
  );

/** The heart, whether it is a button or a plain count. Both are named by their count. */
const heart = () => screen.getByLabelText(/\d+ likes?$/i);

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('the like count on a card', () => {
  it('sits beside the downloads and comments it is there to be compared with', () => {
    show(world(), { onLike: vi.fn() });

    // All three read off one row, which is the point of the comparison.
    const row = heart().closest('div');
    expect(row?.textContent).toContain('3');
    expect(row?.textContent).toContain('7');
    expect(row?.textContent).toContain('2');
  });

  it('reads zero for something nobody has liked', () => {
    show(world({ likes: undefined }), { onLike: vi.fn() });

    expect(screen.getByRole('button', { name: /Like — 0 likes/ })).toBeTruthy();
  });

  it('says it is yours once you have liked it', () => {
    show(world({ liked: true }), { onLike: vi.fn() });

    expect(screen.getByRole('button', { name: /Unlike/ }).getAttribute('aria-pressed')).toBe('true');
  });

  it('is unpressed when you have not', () => {
    show(world({ liked: false }), { onLike: vi.fn() });

    expect(screen.getByRole('button', { name: /^Like —/ }).getAttribute('aria-pressed')).toBe('false');
  });
});

describe('who can press it', () => {
  it('offers the toggle to a signed-in reader', () => {
    show(world(), { onLike: vi.fn() });

    expect(screen.getByRole('button', { name: /Like —/ })).toBeTruthy();
  });

  it('is a plain count for a signed-out visitor', () => {
    // They can read the number; there is nothing for them to press.
    show(world(), { onLike: vi.fn(), isAuthenticated: false, currentUser: null });

    expect(screen.queryByRole('button', { name: /Like —/ })).toBeNull();
    expect(heart().textContent).toContain('3');
  });

  it('is a plain count on your own listing', () => {
    // Otherwise the number says how much somebody has published rather than how many people liked it.
    show(world(), { onLike: vi.fn(), currentUser: { id: 'u1', username: 'wren_hallow' } });

    expect(screen.queryByRole('button', { name: /Like —/ })).toBeNull();
    expect(heart().textContent).toContain('3');
  });

  it('recognizes your own listing by name when the ids disagree', () => {
    show(world(), { onLike: vi.fn(), currentUser: { id: 'other-id', username: 'wren_hallow' } });

    expect(screen.queryByRole('button', { name: /Like —/ })).toBeNull();
  });
});

describe('pressing it', () => {
  it('asks for the opposite of what it is now', async () => {
    const onLike = vi.fn().mockResolvedValue(undefined);
    const record = world({ liked: false });
    show(record, { onLike });

    fireEvent.click(screen.getByRole('button', { name: /Like —/ }));

    await waitFor(() => expect(onLike).toHaveBeenCalledWith(record, true));
  });

  it('asks to take the like back once it is on', async () => {
    const onLike = vi.fn().mockResolvedValue(undefined);
    show(world({ liked: true }), { onLike });

    fireEvent.click(screen.getByRole('button', { name: /Unlike/ }));

    await waitFor(() => expect(onLike.mock.calls[0][1]).toBe(false));
  });

  it('does not also open the listing it sits on', () => {
    // The whole card is clickable.
    const onView = vi.fn();
    show(world(), { onLike: vi.fn().mockResolvedValue(undefined), onView });

    fireEvent.click(screen.getByRole('button', { name: /Like —/ }));

    expect(onView).not.toHaveBeenCalled();
  });

  it('leaves the heart alone when the server refuses', async () => {
    const onLike = vi.fn().mockRejectedValue(new Error('You cannot like your own listing'));
    show(world({ liked: false }), { onLike });

    fireEvent.click(screen.getByRole('button', { name: /Like —/ }));

    await waitFor(() => expect(onLike).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: /^Like — 3 likes/ }).getAttribute('aria-pressed')).toBe('false');
  });
});
