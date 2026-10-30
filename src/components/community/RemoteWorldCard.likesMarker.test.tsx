import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { RemoteWorldCard } from './RemoteWorldCard';
import { type WorldRecord } from '@/components/WorldDetails';

vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));

vi.mock('@/lib/useCachedThumbnail', () => ({
  CachedThumbnail: () => <div data-testid="thumb" />,
}));

const world = (over: Record<string, unknown> = {}): WorldRecord => ({
  id: 'w1', name: 'Sedge Landing', description: 'A drowned coastal town.', kind: 'world',
  author: { id: 'u1', username: 'wren_hallow' }, tags: [], downloads: 0, comment_count: 0,
  ...over,
}) as unknown as WorldRecord;

const admin = { id: 'a1', username: 'root-admin', accountType: 'admin' } as unknown as WorldRecord;
const player = { id: 'p1', username: 'bob', accountType: 'normal' } as unknown as WorldRecord;

const show = (record: WorldRecord, currentUser: WorldRecord | null, props: Record<string, unknown> = {}) =>
  render(
    <RemoteWorldCard
      world={record}
      downloadState="none"
      downloadProgress={undefined}
      isAuthenticated={Boolean(currentUser)}
      currentUser={currentUser}
      onView={() => {}}
      {...props}
    />,
  );

afterEach(cleanup);

describe('the Likes Marker on a card', () => {
  it('names the reason that fired', () => {
    show(world({ likes_marker: ['burst'] }), admin, { onOpenLikes: () => {} });

    expect(screen.getByRole('button', { name: /Likes marker: Burst/ })).toBeTruthy();
  });

  it('names both reasons when both fired', () => {
    show(world({ likes_marker: ['burst', 'flagged_share'] }), admin, { onOpenLikes: () => {} });

    expect(screen.getByRole('button', { name: /Likes marker: Burst and Flagged share/ })).toBeTruthy();
  });

  it('is absent on an unmarked listing', () => {
    show(world({ likes_marker: [] }), admin, { onOpenLikes: () => {} });

    expect(document.querySelector('[data-likes-marker]')).toBeNull();
  });

  it('is absent for a player, even when the row carries a marker and the handler is passed', () => {
    show(world({ likes_marker: ['burst'] }), player, { onOpenLikes: () => {} });

    expect(document.querySelector('[data-likes-marker]')).toBeNull();
  });

  it('is absent when the surface passes no handler', () => {
    show(world({ likes_marker: ['burst'] }), admin);

    expect(document.querySelector('[data-likes-marker]')).toBeNull();
  });

  it('hands the listing to the caller without opening it', () => {
    const onOpenLikes = vi.fn();
    const onView = vi.fn();
    show(world({ likes_marker: ['burst'] }), admin, { onOpenLikes, onView });

    fireEvent.click(screen.getByRole('button', { name: /Likes marker/ }));

    expect(onOpenLikes).toHaveBeenCalledWith(expect.objectContaining({ id: 'w1' }));
    expect(onView).not.toHaveBeenCalled();
  });
});
