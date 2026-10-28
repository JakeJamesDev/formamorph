import { useState } from 'react';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import CommunityCreationsBrowser from './CommunityCreationsBrowser';
import type { WorldRecord } from '@/components/WorldDetails';

vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));

vi.mock('@/services/AuthService', () => ({
  default: { token: 'test-token', getCurrentUser: () => null },
}));

const setSupporterOnly = vi.hoisted(() => vi.fn(async (_id: string, value: boolean) => value));
vi.mock('@/services/WorldStorageService', () => ({
  default: { API_URL: 'https://example.test/api', setRemoteWorldSupporterOnly: setSupporterOnly },
}));

const catalog = vi.hoisted(() => ({ items: [] as Record<string, unknown>[] }));
vi.mock('@/lib/useCatalogSync', () => ({
  useCatalogSync: () => {
    const [remoteWorlds, setRemoteWorlds] = useState(catalog.items);
    return { remoteWorlds, setRemoteWorlds, isLoadingRemoteWorlds: false, isSyncingCatalog: false, loadCatalog: vi.fn(), resyncCatalog: () => {} };
  },
}));

vi.mock('@/components/community/RemoteWorldDetailsModal', () => ({ RemoteWorldDetailsModal: () => null }));

/** Changing who can download a listing from its card: opening a Supporter-only listing asks first. */

const admin = { id: 'admin-1', username: 'root-admin', accountType: 'admin' } as unknown as WorldRecord;

const listing = (supporterOnly: boolean) => ({
  _id: 'm1', id: 'm1', kind: 'world', name: 'Aster', description: '', tags: [], downloads: 0,
  author: { id: 'admin-1', username: 'root-admin' }, updated_at: '2026-10-01T00:00:00.000Z',
  supporter_only: supporterOnly,
});

const renderBrowser = () => render(
  <CommunityCreationsBrowser
    open onOpenChange={() => {}} worlds={[]} setWorlds={() => {}} entities={[]} dictionaries={[]} models={[]}
    refreshEntities={() => {}} refreshDictionaries={() => {}} refreshModels={() => {}}
    isAuthenticated currentUser={admin} openImageViewer={() => {}}
  />,
);

afterEach(() => {
  cleanup();
  setSupporterOnly.mockClear();
});

describe('the Supporter-only toggle in Community Creations', () => {
  it('asks before opening a Supporter-only listing, and changes nothing on Cancel', async () => {
    catalog.items = [listing(true)];
    renderBrowser();

    fireEvent.click(await screen.findByRole('button', { name: 'Remove Supporter-only from Aster' }));
    expect(await screen.findByRole('alertdialog', { name: 'Open to everyone?' })).toBeTruthy();
    expect(setSupporterOnly).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(setSupporterOnly).not.toHaveBeenCalled();
  });

  it('opens the listing once the admin confirms', async () => {
    catalog.items = [listing(true)];
    renderBrowser();

    fireEvent.click(await screen.findByRole('button', { name: 'Remove Supporter-only from Aster' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Open to All' }));
    await waitFor(() => expect(setSupporterOnly).toHaveBeenCalledWith('m1', false));
  });

  it('limits a listing to Supporters without asking', async () => {
    catalog.items = [listing(false)];
    renderBrowser();

    fireEvent.click(await screen.findByRole('button', { name: 'Make Supporter-only Aster' }));
    await waitFor(() => expect(setSupporterOnly).toHaveBeenCalledWith('m1', true));
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });
});
