import { useState } from 'react';
import { render, screen, fireEvent, cleanup, waitFor, within } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import CommunityCreationsBrowser from './CommunityCreationsBrowser';
import type { WorldRecord } from '@/components/WorldDetails';

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

const listing = (over: Record<string, unknown> = {}) => ({
  _id: 'w1',
  id: 'w1',
  kind: 'world',
  name: 'Sedge Landing',
  description: 'A blurb.',
  author: { id: 'author-1', username: 'alice' },
  tags: ['forest', 'mystery'],
  ...over,
});

const reader = { id: 'u1', username: 'reader', accountType: 'normal' } as unknown as WorldRecord;

const renderBrowser = () =>
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
    />
  );

/** Open the Hidden panel; hands back the panel itself and its two chip fields. */
const openHiddenPanel = async () => {
  renderBrowser();
  fireEvent.click(await screen.findByRole('button', { name: /^Hidden/ }));

  // Scoped to the panel: the catalog's tags are also chips on the listing behind it, so an unscoped
  // query for one would find the card and pass whatever the panel is doing.
  const panel = (await screen.findByText('Tags')).closest('[role="dialog"]') as HTMLElement;

  return { panel, fields: within(panel).getAllByPlaceholderText(/tag…|author…/) };
};

beforeEach(() => {
  // jsdom has no `matchMedia`; the browser reads it for the mobile layout switch.
  window.matchMedia = ((query: string) => ({
    matches: false, media: query, onchange: null,
    addEventListener: () => {}, removeEventListener: () => {},
    addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;

  catalog.items = [listing()];
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ success: true }) } as unknown as Response)));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('the Hidden panel', () => {
  it('does not put the cursor in a field on open', async () => {
    // Both fields open their suggestion list on focus, so a field focused on open covers the panel with
    // a list of every tag in the catalog — the reader asked to see what is hidden, not to type.
    const { fields } = await openHiddenPanel();

    for (const field of fields) {
      expect(document.activeElement).not.toBe(field);
    }
  });

  it('leaves its own contents visible, with no suggestion list over them', async () => {
    // The symptom rather than the cause: whatever holds focus, the list must not be up on arrival.
    const { panel } = await openHiddenPanel();

    expect(within(panel).getByText('Authors')).toBeTruthy();
    expect(within(panel).queryByRole('button', { name: 'forest' })).toBeNull();
  });

  it('still opens the list once the reader focuses a field themselves', async () => {
    // The panel must not have bought its quiet arrival by breaking the autocomplete.
    const { panel, fields } = await openHiddenPanel();

    fireEvent.focus(fields[0]);

    await waitFor(() => expect(within(panel).getByRole('button', { name: 'forest' })).toBeTruthy());
  });
});
