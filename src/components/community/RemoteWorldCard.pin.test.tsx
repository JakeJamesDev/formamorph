import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { RemoteWorldCard } from './RemoteWorldCard';
import { type WorldRecord } from '@/components/WorldDetails';

vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));
vi.mock('@/lib/useCachedThumbnail', () => ({ CachedThumbnail: () => <div data-testid="thumb" /> }));

const world = (over: Record<string, unknown> = {}): WorldRecord => ({
  id: 'w1', name: 'Sedge Landing', description: 'A drowned coastal town.', kind: 'world',
  author: { id: 'u1', username: 'wren_hallow' }, tags: [], downloads: 0, comment_count: 0, ...over,
}) as unknown as WorldRecord;

const admin = { id: 'a1', username: 'root-admin', accountType: 'admin' } as unknown as WorldRecord;
const moderator = { id: 'm1', username: 'a-mod', accountType: 'mod' } as unknown as WorldRecord;
const author = { id: 'u1', username: 'wren_hallow', accountType: 'normal' } as unknown as WorldRecord;
const PINNED = { pinned_at: '2026-04-01T00:00:00.000Z' };

const show = (record: WorldRecord, currentUser: WorldRecord | null, onTogglePin = vi.fn()) => {
  render(
    <RemoteWorldCard
      world={record} downloadState="none" downloadProgress={undefined}
      isAuthenticated={Boolean(currentUser)} currentUser={currentUser}
      onView={() => {}} onTogglePin={onTogglePin}
    />,
  );

  return onTogglePin;
};

afterEach(cleanup);

describe('the Pinned mark', () => {
  it('shows on a pinned card for any reader', () => {
    show(world(PINNED), null);

    expect(screen.getByText('Pinned')).toBeTruthy();
  });

  it('is absent on an unpinned card', () => {
    show(world(), admin);

    expect(screen.queryByText('Pinned')).toBeNull();
  });
});

describe('the Pin control', () => {
  it.each([['an admin', admin], ['a moderator', moderator]])('is offered to %s on a listing they did not publish', (_who, user) => {
    const onTogglePin = show(world(), user);
    fireEvent.click(screen.getByRole('button', { name: 'Pin Sedge Landing' }));

    expect(onTogglePin).toHaveBeenCalledTimes(1);
  });

  it('offers Unpin on a pinned card', () => {
    show(world(PINNED), admin);

    expect(screen.getByRole('button', { name: 'Unpin Sedge Landing' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Pin Sedge Landing' })).toBeNull();
  });

  it.each([['the author', author], ['a signed-out reader', null]])('is hidden from %s', (_who, user) => {
    show(world(), user);

    expect(screen.queryByRole('button', { name: /^(Un)?[Pp]in / })).toBeNull();
  });
});
