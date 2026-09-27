import { useState } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { toast } from 'react-toastify';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import CommunityCreationsBrowser from './CommunityCreationsBrowser';
import { ThemedToastContainer } from '@/components/ThemedToastContainer';
import { closeErrorDetails } from '@/lib/errorDetails';
import type { WorldRecord } from '@/components/WorldDetails';

vi.mock('@/components/theme-provider', () => ({ useTheme: () => ({ resolvedTheme: 'dark' }) }));

vi.mock('@/services/AuthService', () => ({
  default: { token: 'secret-bearer-token', getCurrentUser: () => ({ username: 'root-admin' }) },
}));

vi.mock('@/services/WorldStorageService', () => ({
  default: { API_URL: 'https://example.test/api' },
}));

// The catalog list is the fixture; the real hook fetches and caches through IndexedDB.
const catalog = vi.hoisted(() => ({ items: [] as Record<string, unknown>[] }));

vi.mock('@/lib/useCatalogSync', () => ({
  useCatalogSync: () => {
    const [remoteWorlds, setRemoteWorlds] = useState(catalog.items);
    return { remoteWorlds, setRemoteWorlds, isLoadingRemoteWorlds: false, isSyncingCatalog: false, loadCatalog: vi.fn() };
  },
}));

vi.mock('@/components/community/RemoteWorldDetailsModal', () => ({ RemoteWorldDetailsModal: () => null }));

const admin = { id: 'admin-1', username: 'root-admin', accountType: 'admin' } as unknown as WorldRecord;

const renderBrowser = () =>
  render(
    <>
      <ThemedToastContainer />
      <CommunityCreationsBrowser
        open
        onOpenChange={() => {}}
        worlds={[]}
        setWorlds={() => {}}
        entities={[]}
        dictionaries={[]}
        models={[]}
        refreshEntities={() => {}}
        refreshDictionaries={() => {}}
        refreshModels={() => {}}
        isAuthenticated
        currentUser={admin}
        openImageViewer={() => {}}
      />
    </>
  );

beforeEach(() => {
  // jsdom has no `matchMedia`; the browser reads it for the mobile layout switch.
  window.matchMedia = ((query: string) => ({
    matches: false, media: query, onchange: null,
    addEventListener: () => {}, removeEventListener: () => {},
    addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;

  catalog.items = [{
    _id: 'w1', id: 'w1', kind: 'world', name: 'Sedge Landing', description: 'A blurb.',
    author: { id: 'author-1', username: 'alice' }, tags: [],
  }];
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const response = new Response(JSON.stringify({ success: false, error: 'Not authorized to delete this' }), {
      status: 403, statusText: 'Forbidden',
    });
    Object.defineProperty(response, 'url', { value: String(input) });
    return response;
  }));
});

afterEach(() => {
  act(() => {
    toast.dismiss();
    closeErrorDetails();
  });
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('a refused delete in Community Creations', () => {
  it('keeps the toast words and names the route, status and server reason in Error Details', async () => {
    renderBrowser();
    fireEvent.click(await screen.findByLabelText('Delete world'));
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm' }));

    await screen.findByText('Failed to delete world');
    fireEvent.click(await screen.findByRole('button', { name: 'View Details →' }));
    const details = (await screen.findByRole('dialog', { name: 'Error Details' })).textContent ?? '';

    expect(details).toContain('Route: https://example.test/api/worlds/w1');
    expect(details).toContain('Status: 403 Forbidden');
    expect(details).toContain('Not authorized to delete this');
    expect(details).not.toContain('secret-bearer-token');
  });
});
