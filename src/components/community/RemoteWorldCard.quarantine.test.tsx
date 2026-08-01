import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RemoteWorldCard } from './RemoteWorldCard';
import { type WorldRecord } from '@/components/WorldDetails';

vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));

// The thumbnail loader reaches for IndexedDB and the network; neither is what this file is about.
vi.mock('@/lib/useCachedThumbnail', () => ({
  CachedThumbnail: () => <div data-testid="thumb" />,
}));

const world = (over: Record<string, unknown> = {}): WorldRecord => ({
  id: 'w1',
  name: 'Sedge Landing',
  description: 'A drowned coastal town.',
  kind: 'world',
  author: { id: 'u1', username: 'wren_hallow' },
  tags: [],
  downloads: 0,
  comment_count: 0,
  ...over,
}) as unknown as WorldRecord;

const admin = { id: 'a1', username: 'root-admin', accountType: 'admin' } as unknown as WorldRecord;
const author = { id: 'u1', username: 'wren_hallow', accountType: 'normal' } as unknown as WorldRecord;

const quarantined = (over: Record<string, unknown> = {}) => world({
  quarantined_at: '2026-08-01T00:00:00.000Z',
  quarantine_expires_at: '2126-08-08T00:00:00.000Z',
  ...over,
});

const show = (record: WorldRecord, currentUser: WorldRecord | null, props: Record<string, unknown> = {}) =>
  render(
    <RemoteWorldCard
      world={record}
      downloadState="none"
      downloadProgress={undefined}
      isAuthenticated={Boolean(currentUser)}
      currentUser={currentUser}
      onView={() => {}}
      onHideWorld={() => {}}
      onHideAuthor={() => {}}
      onHideTag={() => {}}
      onContextualDownload={() => {}}
      onDelete={() => {}}
      {...props}
    />
  );

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('the quarantine badge', () => {
  it('says so, and says when it dies', async () => {
    // Only the author and admins ever see this card, so the deadline is stated rather than hinted at.
    show(quarantined(), author);

    expect(screen.getByText('Quarantined')).toBeTruthy();
    expect(screen.getByText(/Deleted on/)).toBeTruthy();
    expect(screen.getByText(/days left/)).toBeTruthy();
  });

  it('is absent on an ordinary listing', () => {
    show(world(), author);

    expect(screen.queryByText('Quarantined')).toBeNull();
  });

  it('says nothing about a date it does not have', () => {
    show(quarantined({ quarantine_expires_at: null }), author);

    expect(screen.getByText('Quarantined')).toBeTruthy();
    expect(screen.queryByText(/Deleted on/)).toBeNull();
  });
});

describe('the admin controls', () => {
  it('offers quarantine on something not yet quarantined', () => {
    show(world(), admin, { onQuarantine: () => {}, onRelease: () => {} });

    expect(screen.getByLabelText('Quarantine Sedge Landing')).toBeTruthy();
    expect(screen.queryByLabelText('Release Sedge Landing')).toBeNull();
  });

  it('offers release once it is', () => {
    show(quarantined(), admin, { onQuarantine: () => {}, onRelease: () => {} });

    expect(screen.getByLabelText('Release Sedge Landing')).toBeTruthy();
    expect(screen.queryByLabelText('Quarantine Sedge Landing')).toBeNull();
  });

  it('offers no quarantine to the author of an ordinary listing', () => {
    // The case that isolates the admin check: on a quarantined listing the button is hidden anyway.
    show(world(), author, { onQuarantine: () => {}, onRelease: () => {} });

    expect(screen.queryByLabelText('Quarantine Sedge Landing')).toBeNull();
  });

  it('offers neither to the author of the listing', () => {
    // They can still delete their own; hiding it pending changes is the team's call.
    show(quarantined(), author, { onQuarantine: () => {}, onRelease: () => {} });

    expect(screen.queryByLabelText('Quarantine Sedge Landing')).toBeNull();
    expect(screen.queryByLabelText('Release Sedge Landing')).toBeNull();
  });

  it('hands the whole listing to the caller, not just its id', async () => {
    // The dialog names what is being quarantined and decides whether to write to its author, so an id
    // alone would send it back to the catalog to look both up.
    const onQuarantine = vi.fn();
    show(world(), admin, { onQuarantine, onRelease: () => {} });

    fireEvent.click(screen.getByLabelText('Quarantine Sedge Landing'));

    expect(onQuarantine).toHaveBeenCalledWith(expect.objectContaining({ id: 'w1', name: 'Sedge Landing' }));
  });

  it('does not open the listing when a control is clicked', async () => {
    // The controls sit inside the card, which is itself a button.
    const onView = vi.fn();
    show(quarantined(), admin, { onView, onRelease: () => {}, onQuarantine: () => {} });

    fireEvent.click(screen.getByLabelText('Release Sedge Landing'));

    expect(onView).not.toHaveBeenCalled();
  });
});
