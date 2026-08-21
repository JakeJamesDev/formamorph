import { useState } from 'react';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import CommunityCreationsBrowser from './CommunityCreationsBrowser';
import { serverEvent, stubMatchMedia } from '@/test/serverEvents';
import type { WorldRecord } from '@/components/WorldDetails';
import type { ServerEvent } from '@/types';

vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));

vi.mock('@/services/AuthService', () => ({
  default: { token: 'test-token', getCurrentUser: () => ({ username: 'reader' }) },
}));

vi.mock('@/services/WorldStorageService', () => ({
  default: { API_URL: 'https://example.test/api' },
}));

const catalog = vi.hoisted(() => ({ items: [] as Record<string, unknown>[] }));

vi.mock('@/lib/useCatalogSync', () => ({
  useCatalogSync: () => {
    const [remoteWorlds, setRemoteWorlds] = useState(catalog.items);
    return {
      remoteWorlds,
      setRemoteWorlds,
      isLoadingRemoteWorlds: false,
      isSyncingCatalog: false,
      loadCatalog: vi.fn(),
    };
  },
}));

vi.mock('@/components/community/RemoteWorldDetailsModal', () => ({ RemoteWorldDetailsModal: () => null }));

const reader = { id: 'u1', username: 'reader', accountType: 'normal' } as unknown as WorldRecord;

const contest: ServerEvent = serverEvent();

const renderBrowser = (props: Partial<{ events: ServerEvent[]; onOpenEvent: (e: ServerEvent) => void }> = {}) =>
  render(
    <CommunityCreationsBrowser
      open
      onOpenChange={() => {}}
      worlds={[]}
      setWorlds={() => {}}
      entities={[]}
      dictionaries={[]}
      refreshEntities={() => {}}
      refreshDictionaries={() => {}}
      isAuthenticated
      currentUser={reader}
      openImageViewer={() => {}}
      {...props}
    />
  );

beforeEach(() => {
  localStorage.clear();
  stubMatchMedia();

  catalog.items = [];
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ success: true }) } as unknown as Response)));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('the event banner in the Community Creations header', () => {
  it('announces the running contest where the content lives', async () => {
    renderBrowser({ events: [contest], onOpenEvent: vi.fn() });

    expect(await screen.findByText('Winter World-Building Contest')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'View Entries' })).toBeInTheDocument();
  });

  it('is absent when nothing is running, so the header keeps its own height', async () => {
    renderBrowser();

    await waitFor(() => expect(screen.getByText('Community Creations')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Dismiss' })).not.toBeInTheDocument();
  });

  it('collapses to the chip here too, sharing the device-wide dismissal', async () => {
    const { unmount } = renderBrowser({ events: [contest], onOpenEvent: vi.fn() });

    fireEvent.click(await screen.findByRole('button', { name: 'Dismiss' }));
    expect(screen.getByRole('button', { name: /Winter World-Building Contest/ })).toHaveTextContent('12d');

    unmount();
    renderBrowser({ events: [contest], onOpenEvent: vi.fn() });

    expect(await screen.findByRole('button', { name: /Winter World-Building Contest/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Dismiss' })).not.toBeInTheDocument();
  });
});
