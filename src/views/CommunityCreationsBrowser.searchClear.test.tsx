import { useState } from 'react';
import { render, screen, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import CommunityCreationsBrowser from './CommunityCreationsBrowser';
import { stubMatchMedia } from '@/test/serverEvents';
import type { WorldRecord } from '@/components/WorldDetails';

vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));

vi.mock('@/services/AuthService', () => ({
  default: { token: 'test-token', isAuthenticated: () => true, getCurrentUser: () => ({ username: 'reader' }) },
}));

vi.mock('@/services/WorldStorageService', () => ({
  default: {
    API_URL: 'https://example.test/api',
    readListingDetails: vi.fn(async () => ({ status: 'unreachable' })),
    fetchComments: vi.fn(async () => ({ data: [], total: 0, pagination: {} })),
  },
}));

vi.mock('@/services/EventService', () => ({
  default: { fetchActive: vi.fn(async () => []), fetchList: vi.fn(async () => []) },
}));

vi.mock('@/lib/useCatalogSync', () => ({
  useCatalogSync: () => {
    const [remoteWorlds, setRemoteWorlds] = useState<Record<string, unknown>[]>([]);
    return { remoteWorlds, setRemoteWorlds, isLoadingRemoteWorlds: false, isSyncingCatalog: false, loadCatalog: vi.fn() };
  },
}));

vi.mock('@/components/community/RemoteWorldDetailsModal', () => ({ RemoteWorldDetailsModal: () => null }));

const reader = { id: 'u1', username: 'reader', accountType: 'normal' } as unknown as WorldRecord;

beforeEach(() => {
  localStorage.clear();
  stubMatchMedia(false);
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ success: true }) } as unknown as Response)));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('the Community search box', () => {
  it('clears the typed text with the X and keeps the filter chips made from earlier prefixes', async () => {
    const user = userEvent.setup();
    render(
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
        currentUser={reader}
        openImageViewer={() => {}}
      />,
    );
    const header = (await screen.findByRole('heading', { name: 'Community Creations' })).closest('header')!;
    const box = within(header).getByPlaceholderText(/^Search worlds/);
    expect(within(header).queryByText(/ember/)).toBeNull();
    // A space finishes the `tag:` token into a chip; the rest stays as typed text.
    await user.type(box, 'tag:ember lantern');
    expect(box).toHaveValue('lantern');
    expect(within(header).getByText(/ember/)).toBeInTheDocument();

    await user.click(within(header).getByRole('button', { name: 'Clear Search' }));

    expect(box).toHaveValue('');
    expect(box).toHaveFocus();
    expect(within(header).getByText(/ember/)).toBeInTheDocument();
  });
});
