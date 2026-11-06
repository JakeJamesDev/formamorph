// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  remove: vi.fn<(id: string) => Promise<boolean>>(),
  seed: vi.fn(),
  saves: vi.fn(),
  linkToast: vi.fn(),
  toastError: vi.fn(),
  dismiss: vi.fn(),
}));

vi.mock('react-toastify', () => ({ toast: { dismiss: mocks.dismiss } }));
vi.mock('@/lib/linkToast', () => ({ linkToast: mocks.linkToast, toastError: mocks.toastError }));
vi.mock('@/lib/bundledWorldText', () => ({ bundledWorlds: {} }));
vi.mock('@/components/modals/dbUtils', () => ({ getAllSaveRecords: mocks.saves }));
vi.mock('@/lib/devRouter', () => ({ useDevRoute: () => null }));
vi.mock('@/services/WorldStorageService', () => ({
  default: { removeUnreadableWorld: mocks.remove, loadDefaultWorlds: mocks.seed },
}));

import { DEFAULT_WORLDS, readDeletedDefaultWorlds, tombstoneDefaultWorld } from '@/lib/defaultWorlds';
import { getUnreadableWorlds, reportUnreadableWorld, resetUnreadableWorlds, syncUnreadableWorlds } from '@/lib/unreadableWorlds';
import { UnreadableWorldsDialog } from './UnreadableWorldsDialog';

const onChanged = vi.fn();
const onOpenListing = vi.fn();
const mount = () => render(<UnreadableWorldsDialog onChanged={onChanged} onOpenListing={onOpenListing} />);

/** Follow the notice's Review link. */
const review = () => act(() => mocks.linkToast.mock.lastCall?.[2]());

const confirmIn = (name: string) => fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name }));

beforeEach(() => {
  resetUnreadableWorlds();
  localStorage.clear();
  vi.clearAllMocks();
  mocks.remove.mockResolvedValue(true);
  mocks.seed.mockResolvedValue({ failed: [], errors: [], updated: [] });
  mocks.saves.mockResolvedValue([]);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('UnreadableWorldsDialog', () => {
  it('raises one notice however many list reads report the same world', () => {
    mount();

    act(() => { syncUnreadableWorlds(['lost']); });
    act(() => { syncUnreadableWorlds(['lost']); });

    expect(mocks.linkToast).toHaveBeenCalledTimes(1);
    expect(mocks.linkToast.mock.lastCall?.[3]).toMatchObject({ autoClose: false });
  });

  it('raises no second notice when the menu mounts again', () => {
    const first = mount();
    act(() => { syncUnreadableWorlds(['lost']); });
    first.unmount();

    mount();

    expect(mocks.linkToast).toHaveBeenCalledTimes(1);
  });

  it('raises a notice for a world reported before the menu mounted', () => {
    syncUnreadableWorlds(['lost']);

    mount();

    expect(mocks.linkToast).toHaveBeenCalledTimes(1);
  });

  it('names a world from its saves', async () => {
    mocks.saves.mockResolvedValue([{ id: 's', name: 'Save', worldId: 'lost', currentState: { worldName: 'Old Marsh' } }]);
    mount();
    act(() => { syncUnreadableWorlds(['lost']); });
    review();

    expect(await screen.findByText('Old Marsh')).toBeTruthy();
  });

  it('still lists the world when its saves can not be read', async () => {
    mocks.saves.mockRejectedValue(new Error('NotReadableError'));
    mount();
    act(() => { syncUnreadableWorlds(['lost']); });
    review();

    expect(await screen.findByText('Unnamed World')).toBeTruthy();
  });

  it('removes a world with no other source only after the confirmation', async () => {
    mount();
    act(() => { syncUnreadableWorlds(['lost']); });
    review();

    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(mocks.remove).not.toHaveBeenCalled();
    confirmIn('Remove');

    await waitFor(() => expect(mocks.remove).toHaveBeenCalledWith('lost'));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(onOpenListing).not.toHaveBeenCalled();
    expect(mocks.seed).not.toHaveBeenCalled();
  });

  it('restores a bundled world from its seed', async () => {
    const seed = DEFAULT_WORLDS[0];
    tombstoneDefaultWorld(seed.id);
    mount();
    act(() => { syncUnreadableWorlds([seed.id]); });
    review();

    fireEvent.click(screen.getByRole('button', { name: 'Restore' }));
    confirmIn('Restore');

    await waitFor(() => expect(mocks.seed).toHaveBeenCalledWith([seed], {}));
    expect(mocks.remove).toHaveBeenCalledWith(seed.id);
    expect(readDeletedDefaultWorlds().has(seed.id)).toBe(false);
  });

  it('reports a bundled world that fails to reseed', async () => {
    const seed = DEFAULT_WORLDS[0];
    mocks.seed.mockResolvedValue({ failed: [seed.id], errors: [new Error(seed.id)], updated: [] });
    mount();
    act(() => { syncUnreadableWorlds([seed.id]); });
    review();

    fireEvent.click(screen.getByRole('button', { name: 'Restore' }));
    confirmIn('Restore');

    await waitFor(() => expect(mocks.toastError).toHaveBeenCalled());
  });

  it('opens the listing after removing a downloaded copy', async () => {
    mount();
    act(() => { reportUnreadableWorld({ id: 'copy', name: 'Marsh', sourceId: 'listing-1' }); });
    review();

    fireEvent.click(screen.getByRole('button', { name: 'Download Again' }));
    confirmIn('Remove and Open Listing');

    await waitFor(() => expect(onOpenListing).toHaveBeenCalledWith({ id: 'listing-1', kind: 'world' }));
    expect(mocks.remove).toHaveBeenCalledWith('copy');
  });

  it('opens no listing and reseeds nothing when the world reads again', async () => {
    mocks.remove.mockResolvedValue(false);
    mount();
    act(() => { reportUnreadableWorld({ id: 'copy', name: 'Marsh', sourceId: 'listing-1' }); });
    review();

    fireEvent.click(screen.getByRole('button', { name: 'Download Again' }));
    confirmIn('Remove and Open Listing');

    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(onOpenListing).not.toHaveBeenCalled();
  });

  it('opens no listing and refreshes nothing once the menu closes mid-repair', async () => {
    let finish!: (removed: boolean) => void;
    mocks.remove.mockReturnValue(new Promise<boolean>((resolve) => { finish = resolve; }));
    const view = mount();
    act(() => { reportUnreadableWorld({ id: 'copy', name: 'Marsh', sourceId: 'listing-1' }); });
    review();
    fireEvent.click(screen.getByRole('button', { name: 'Download Again' }));
    confirmIn('Remove and Open Listing');
    await waitFor(() => expect(mocks.remove).toHaveBeenCalled());

    view.unmount();
    await act(async () => { finish(true); });

    expect(onChanged).not.toHaveBeenCalled();
    expect(onOpenListing).not.toHaveBeenCalled();
  });

  it('dismisses the notice when no unreadable world remains', () => {
    mount();
    act(() => { syncUnreadableWorlds(['lost']); });
    mocks.dismiss.mockClear();

    act(() => { syncUnreadableWorlds([]); });

    expect(getUnreadableWorlds()).toEqual([]);
    expect(mocks.dismiss).toHaveBeenCalledWith('world-library-unreadable');
  });
});
