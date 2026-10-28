import { render, screen, cleanup, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { toast } from 'react-toastify';

const store = vi.hoisted(() => {
  type Snap = { status: string; qualifies: boolean; entitled: { id: string; kind: string; revision: number }[]; installed: { id: string; kind: string; revision: number }[] };
  const listeners = new Set<() => void>();
  const state: { snap: Snap; install: (id: string) => Promise<void> } = {
    snap: { status: 'ready', qualifies: false, entitled: [], installed: [] },
    install: async () => {},
  };
  const refresh = vi.fn(async () => {});
  return {
    state,
    refresh,
    set(next: Snap) { state.snap = next; listeners.forEach((l) => l()); },
    module: {
      subscribe: (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; },
      getSnapshot: () => state.snap,
      install: (id: string) => state.install(id),
      refresh: () => refresh(),
    },
  };
});

vi.mock('@/lib/supporterContent', () => ({ supporterContent: store.module }));
vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));
vi.mock('@/lib/useCachedThumbnail', () => ({ CachedThumbnail: () => <div data-testid="thumb" /> }));

import { RemoteWorldCard } from './RemoteWorldCard';
import { SupporterListingButton } from './SupporterListingButton';
import { type WorldRecord } from '@/components/WorldDetails';

const ITEM = { id: 'excl', kind: 'mascot', revision: 1 };
const world = (over: Record<string, unknown> = {}): WorldRecord => ({
  id: 'excl', name: 'Aster', description: 'An exclusive.', kind: 'mascot', supporter_only: true,
  author: { id: 'u1', username: 'wren_hallow' }, tags: [], downloads: 0, comment_count: 0, likes: 2, ...over,
}) as unknown as WorldRecord;

const button = (over: { signedIn?: boolean; kind?: string; onSignIn?: () => void } = {}) =>
  render(<SupporterListingButton world={world()} kind={over.kind ?? 'mascot'} signedIn={over.signedIn ?? true} onSignIn={over.onSignIn} variant="details" />);

beforeEach(() => {
  store.state.install = async () => {};
  store.refresh.mockClear();
  store.set({ status: 'ready', qualifies: false, entitled: [], installed: [] });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('the Supporter-only button', () => {
  it('reads Sign In when signed out, even for a store that qualifies', () => {
    store.set({ status: 'ready', qualifies: true, entitled: [ITEM], installed: [] });
    const onSignIn = vi.fn();
    button({ signedIn: false, onSignIn });
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));

    expect(onSignIn).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Install' })).toBeNull();
  });

  it('reads Patreon for a signed-in account that does not qualify, opens the Patreon page and refreshes the check', () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    button();
    fireEvent.click(screen.getByRole('button', { name: 'Patreon' }));

    expect(open).toHaveBeenCalledWith(expect.stringContaining('patreon.com'), '_blank', 'noopener');
    expect(store.refresh).toHaveBeenCalledTimes(1);
  });

  it('shows a disabled Checking button, not Patreon, until the first check ends', () => {
    store.set({ status: 'checking', qualifies: false, entitled: [], installed: [] });
    button();

    expect(screen.getByRole('button', { name: 'Checking…' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Patreon' })).toBeNull();
  });

  it('installs through the module, then shows Installed', async () => {
    store.set({ status: 'ready', qualifies: true, entitled: [ITEM], installed: [] });
    const install = vi.fn(async (id: string) => {
      expect(id).toBe('excl');
      store.set({ status: 'ready', qualifies: true, entitled: [ITEM], installed: [ITEM] });
    });
    store.state.install = install;
    button();
    fireEvent.click(screen.getByRole('button', { name: 'Install' }));

    await waitFor(() => expect(screen.getByRole('button', { name: 'Installed' })).toBeDisabled());
    expect(install).toHaveBeenCalledTimes(1);
  });

  it('keeps Install and reports the error when the install fails', async () => {
    store.set({ status: 'ready', qualifies: true, entitled: [ITEM], installed: [] });
    store.state.install = async () => { throw new Error('offline'); };
    button();
    fireEvent.click(screen.getByRole('button', { name: 'Install' }));

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: 'Install' })).not.toBeDisabled();
  });

  it('shows Installed at once when the item is already installed', () => {
    store.set({ status: 'ready', qualifies: true, entitled: [ITEM], installed: [ITEM] });
    button();

    expect(screen.getByRole('button', { name: 'Installed' })).toBeDisabled();
  });

  it('is disabled with a not-supported label for a kind with no consumer', () => {
    store.set({ status: 'ready', qualifies: true, entitled: [{ ...ITEM, kind: 'world' }], installed: [] });
    button({ kind: 'world' });

    expect(screen.getByRole('button', { name: 'Not Supported Yet' })).toBeDisabled();
  });

  it('follows the store when the account stops qualifying', () => {
    store.set({ status: 'ready', qualifies: true, entitled: [ITEM], installed: [] });
    button();
    expect(screen.getByRole('button', { name: 'Install' })).toBeTruthy();

    act(() => store.set({ status: 'ready', qualifies: false, entitled: [], installed: [] }));

    expect(screen.getByRole('button', { name: 'Patreon' })).toBeTruthy();
  });
});

describe('a Supporter-only card', () => {
  const card = (record: WorldRecord, user: WorldRecord | null, extra: Record<string, unknown> = {}) =>
    render(
      <RemoteWorldCard
        world={record} downloadState="none" downloadProgress={undefined}
        isAuthenticated={Boolean(user)} currentUser={user}
        onView={() => {}} onContextualDownload={() => {}} {...extra}
      />,
    );
  const staff = { id: 'a1', username: 'root-admin', accountType: 'admin' } as unknown as WorldRecord;
  const player = { id: 'p1', username: 'reader', accountType: 'normal' } as unknown as WorldRecord;

  it('replaces the Download button with the Supporter button', () => {
    card(world(), player);

    expect(screen.getByRole('button', { name: 'Patreon' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Download/ })).toBeNull();
  });

  it('keeps the plain Download button on a listing that is not Supporter-only', () => {
    card(world({ supporter_only: false }), player);

    expect(screen.getByRole('button', { name: 'Download this mascot' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Patreon' })).toBeNull();
  });

  it('still lets a non-supporter like it', () => {
    const onLike = vi.fn();
    card(world(), player, { onLike, serverTakesLikes: true });
    fireEvent.click(screen.getByRole('button', { name: /like/i }));

    expect(onLike).toHaveBeenCalledTimes(1);
  });

  it('offers the Supporter-only toggle to admins only', () => {
    const onToggleSupporterOnly = vi.fn();
    const { unmount } = card(world(), staff, { onToggleSupporterOnly });
    fireEvent.click(screen.getByRole('button', { name: 'Remove Supporter-only from Aster' }));
    expect(onToggleSupporterOnly).toHaveBeenCalledTimes(1);
    unmount();

    for (const viewer of [player, { id: 'm1', username: 'a-mod', accountType: 'mod' } as unknown as WorldRecord]) {
      const shown = card(world(), viewer, { onToggleSupporterOnly });
      expect(screen.queryByRole('button', { name: /Supporter-only/ })).toBeNull();
      shown.unmount();
    }
  });

  it('offers to mark a listing that is not Supporter-only', () => {
    card(world({ supporter_only: false }), staff, { onToggleSupporterOnly: vi.fn() });

    expect(screen.getByRole('button', { name: 'Make Supporter-only Aster' })).toBeTruthy();
  });
});
