import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { RemoteWorldCard } from './RemoteWorldCard';
import { type WorldRecord } from '@/components/WorldDetails';

vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));
vi.mock('@/lib/useCachedThumbnail', () => ({ CachedThumbnail: () => <div data-testid="thumb" /> }));
vi.mock('@/lib/supporterContent', () => {
  const snapshot = { status: 'ready', qualifies: false, entitled: [], installed: [] };
  return { supporterContent: { subscribe: () => () => {}, getSnapshot: () => snapshot, install: async () => {}, refresh: async () => {} } };
});

const future = new Date(Date.now() + 10 * 86_400_000).toISOString();
const world = (over: Record<string, unknown> = {}): WorldRecord => ({
  id: 'w1', name: 'Sedge Landing', description: 'A drowned coastal town.', kind: 'world',
  author: { id: 'u1', username: 'wren_hallow' }, tags: [], downloads: 0, comment_count: 0, ...over,
}) as unknown as WorldRecord;

const admin = { id: 'a1', username: 'root-admin', accountType: 'admin' } as unknown as WorldRecord;
const moderator = { id: 'm1', username: 'a-mod', accountType: 'mod' } as unknown as WorldRecord;

const show = (record: WorldRecord, user: WorldRecord | null, onEditSupporterEnd = vi.fn()) => {
  render(
    <RemoteWorldCard
      world={record} downloadState="none" downloadProgress={undefined}
      isAuthenticated={Boolean(user)} currentUser={user}
      onView={() => {}} onToggleSupporterOnly={() => {}} onEditSupporterEnd={onEditSupporterEnd}
    />,
  );

  return onEditSupporterEnd;
};

afterEach(cleanup);

describe('the Supporter-only end date on a card', () => {
  it('shows to every reader for a timed listing', () => {
    show(world({ supporter_only: true, supporter_until: future }), null);

    expect(screen.getByText(/^Supporter-only until/)).toBeTruthy();
  });

  it.each([
    ['an untimed Supporter-only listing', { supporter_only: true }],
    ['a listing with no flag', { supporter_until: future }],
  ])('shows nothing for %s', (_name, over) => {
    show(world(over), admin);

    expect(screen.queryByText(/Supporter-only until/)).toBeNull();
  });

  it('gives an admin a control that opens the editor', () => {
    const onEdit = show(world({ supporter_only: true, supporter_until: future }), admin);
    fireEvent.click(screen.getByRole('button', { name: 'Change the end date of Sedge Landing' }));

    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it('gives a moderator and a signed-out reader no control', () => {
    show(world({ supporter_only: true, supporter_until: future }), moderator);
    expect(screen.queryByRole('button', { name: /Change the end date/ })).toBeNull();
    cleanup();

    show(world({ supporter_only: true, supporter_until: future }), null);
    expect(screen.queryByRole('button', { name: /Change the end date/ })).toBeNull();
  });

  it('shows the normal Download when the payload has no Supporter-only flag', () => {
    render(
      <RemoteWorldCard
        world={world({ supporter_until: future })} downloadState="none" downloadProgress={undefined}
        isAuthenticated currentUser={moderator} onView={() => {}} onContextualDownload={() => {}}
      />,
    );

    expect(screen.getByRole('button', { name: 'Download this world' })).toBeTruthy();
  });
});
