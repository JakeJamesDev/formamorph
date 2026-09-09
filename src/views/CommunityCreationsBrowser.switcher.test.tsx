import { useState } from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import CommunityCreationsBrowser from './CommunityCreationsBrowser';
import { stubMatchMedia } from '@/test/serverEvents';
import type { WorldRecord } from '@/components/WorldDetails';

/**
 * The section switcher itself: a rail on landscape, a dropdown on portrait. The contest/events/tutorial
 * suites drive it incidentally to reach a tab; this file is about the switcher's own shape.
 */

vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));

vi.mock('@/services/AuthService', () => ({
  default: { token: 'test-token', getCurrentUser: () => ({ username: 'reader' }) },
}));

vi.mock('@/services/WorldStorageService', () => ({
  default: { API_URL: 'https://example.test/api' },
}));

const server = vi.hoisted(() => ({ contests: [] as unknown[] }));

vi.mock('@/services/EventService', () => ({
  default: {
    fetchActive: vi.fn(async () => []),
    fetchList: vi.fn(async () => server.contests),
  },
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

const runningContest = () => ({
  id: 'e1', type: 'contest', title: 'A Contest',
  startsAt: new Date(Date.now() - 60_000).toISOString(),
  endsAt: new Date(Date.now() + 60_000).toISOString(),
});

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

beforeEach(() => {
  localStorage.clear();
  catalog.items = [];
  server.contests = [];
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ success: true }) } as unknown as Response)));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('the section switcher on landscape (the rail)', () => {
  beforeEach(() => stubMatchMedia(false));

  it('lists the catalog kinds in kind order, with no header tabs', async () => {
    renderBrowser();

    const rows = await screen.findAllByRole('button', { name: /^(Worlds|Entities|Dictionaries)$/ });
    expect(rows.map((r) => r.textContent)).toEqual(['Worlds', 'Entities', 'Dictionaries']);
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
  });

  it('marks the active row current to assistive technology, and moves it on click', async () => {
    renderBrowser();

    const worlds = await screen.findByRole('button', { name: 'Worlds' });
    const entities = screen.getByRole('button', { name: 'Entities' });
    expect(worlds).toHaveAttribute('aria-current', 'true');
    expect(entities).not.toHaveAttribute('aria-current');

    await userEvent.click(entities);

    expect(entities).toHaveAttribute('aria-current', 'true');
    expect(worlds).not.toHaveAttribute('aria-current');
  });

  it('stays away on a server running no contests', async () => {
    renderBrowser();
    await screen.findByRole('button', { name: 'Worlds' });
    expect(screen.queryByRole('button', { name: 'Contest' })).not.toBeInTheDocument();
  });

  it('appears below a rule while a contest exists', async () => {
    server.contests = [runningContest()];
    renderBrowser();

    expect(await screen.findByRole('button', { name: 'Contest' })).toBeInTheDocument();
  });
});

describe('the section switcher on portrait (the dropdown)', () => {
  beforeEach(() => stubMatchMedia(true));

  it('shows the current section on the closed trigger instead of a rail', async () => {
    renderBrowser();

    expect(screen.queryByRole('button', { name: 'Entities' })).not.toBeInTheDocument();
    const trigger = await screen.findByRole('combobox');
    expect(trigger).toHaveTextContent('Worlds');
  });

  it('switches section by picking an option, each carrying its icon', async () => {
    renderBrowser();

    const trigger = await screen.findByRole('combobox');
    await userEvent.click(trigger);
    const entities = screen.getByRole('option', { name: 'Entities' });
    expect(entities.querySelector('svg')).not.toBeNull();
    await userEvent.click(entities);

    expect(trigger).toHaveTextContent('Entities');
  });
});
