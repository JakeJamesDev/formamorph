import { useState } from 'react';
import { render, screen, cleanup } from '@testing-library/react';
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

const { catalog, useThumbnailPreload } = vi.hoisted(() => ({
  catalog: { items: [] as Record<string, unknown>[] },
  useThumbnailPreload: vi.fn(),
}));

vi.mock('@/lib/useCachedThumbnail', () => ({
  useThumbnailPreload,
  CachedThumbnail: () => null,
}));

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

/** The page preload warms stored thumbnails; a flagged entity's stand-in is never one of them. */

const entity = (id: string, over: Record<string, unknown> = {}) => ({
  _id: id,
  id,
  kind: 'entity',
  name: `Entity ${id}`,
  thumbnail_file: `${id}.png`,
  author: { id: 'author-1', username: 'alice' },
  tags: [],
  ...over,
});

const reader = { id: 'u1', username: 'reader', accountType: 'normal' } as unknown as WorldRecord;

const renderBrowser = () =>
  render(
    <CommunityCreationsBrowser
      open
      onOpenChange={() => {}}
      initialTab="entity"
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
    />
  );

/** Every file any preload call asked to warm. */
const preloaded = () =>
  new Set(useThumbnailPreload.mock.calls.flatMap(([items]) => (items as { file: string }[]).map((i) => i.file)));

beforeEach(() => {
  // jsdom has no `matchMedia`; the browser reads it for the mobile layout switch.
  window.matchMedia = ((query: string) => ({
    matches: false, media: query, onchange: null,
    addEventListener: () => {}, removeEventListener: () => {},
    addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;

  catalog.items = [entity('e1', { placeholder: true }), entity('e2', { placeholder: false })];
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ success: true }) } as unknown as Response)));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  useThumbnailPreload.mockClear();
});

describe('the page’s thumbnail preload', () => {
  it('warms an unflagged entity’s thumbnail and skips a flagged one', async () => {
    renderBrowser();
    await screen.findByText('Entity e1');

    expect(preloaded().has('e2.png')).toBe(true);
    expect(preloaded().has('e1.png')).toBe(false);
  });
});
