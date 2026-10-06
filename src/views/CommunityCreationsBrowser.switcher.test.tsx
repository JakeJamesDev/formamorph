import { useState } from 'react';
import { render, screen, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import CommunityCreationsBrowser from './CommunityCreationsBrowser';
import { COMMUNITY_NAV_RAIL_KEY } from '@/lib/browseTabs';
import { stubMatchMedia } from '@/test/serverEvents';
import type { WorldRecord } from '@/components/WorldDetails';

/**
 * The section switcher itself: a rail on landscape, a dropdown on portrait. The contest/events/tutorial
 * suites drive it incidentally to reach a tab; this file is about the switcher's own shape.
 */

vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));

vi.mock('@/services/AuthService', () => ({
  default: { token: 'test-token', isAuthenticated: () => true, getCurrentUser: () => ({ username: 'reader' }) },
}));

vi.mock('@/services/WorldStorageService', () => ({
  // A card the pointer rests on prefetches its listing through these two.
  default: {
    API_URL: 'https://example.test/api',
    readListingDetails: vi.fn(async () => ({ status: 'unreachable' })),
    fetchComments: vi.fn(async () => ({ data: [], total: 0, pagination: {} })),
  },
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
      models={[]}
      refreshEntities={() => {}}
      refreshDictionaries={() => {}}
      refreshModels={() => {}}
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

  const rail = () => screen.findByRole('tablist', { name: 'Community Sections' });
  /** The rail's rows in order, read as tab names and separators. */
  const railSequence = (list: HTMLElement) => Array.from(list.children).map((child) =>
    (child.getAttribute('role') === 'tab' ? child.textContent : child.hasAttribute('data-rail-separator') ? '|' : '?'));

  it('lists the catalog kinds in kind order, with Prompts after a line', async () => {
    renderBrowser();

    expect(railSequence(await rail())).toEqual(['Worlds', 'Entities', 'Dictionaries', 'Avatars', '|', 'Prompts']);
  });

  it('selects the active tab, and switches the section on click', async () => {
    catalog.items = [{ _id: 'e-1', id: 'e-1', name: 'A Wren', kind: 'entity', tags: [], author: { id: 'a1', username: 'wren_hallow' } }];
    renderBrowser();

    const list = await rail();
    const worlds = within(list).getByRole('tab', { name: 'Worlds' });
    const entities = within(list).getByRole('tab', { name: 'Entities' });
    expect(worlds).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByText('A Wren')).not.toBeInTheDocument();

    await userEvent.click(entities);

    expect(entities).toHaveAttribute('aria-selected', 'true');
    expect(worlds).toHaveAttribute('aria-selected', 'false');
    expect(await screen.findByText('A Wren')).toBeInTheDocument();
  });

  it('moves along the rail with the arrow keys', async () => {
    renderBrowser();

    const list = await rail();
    await userEvent.click(within(list).getByRole('tab', { name: 'Worlds' }));
    await userEvent.keyboard('{ArrowDown}');

    expect(within(list).getByRole('tab', { name: 'Entities' })).toHaveAttribute('aria-selected', 'true');
  });

  it('draws no Contest tab on a server running no contests', async () => {
    renderBrowser();
    expect(within(await rail()).queryByRole('tab', { name: 'Contest' })).not.toBeInTheDocument();
  });

  it('adds Contest after a line while a contest exists', async () => {
    server.contests = [runningContest()];
    renderBrowser();

    await within(await rail()).findByRole('tab', { name: 'Contest' });
    expect(railSequence(await rail())).toEqual(['Worlds', 'Entities', 'Dictionaries', 'Avatars', '|', 'Prompts', '|', 'Contest']);
  });

  it('starts expanded and remembers a collapse across a remount', async () => {
    const { unmount } = renderBrowser();
    await rail();
    expect(screen.getByRole('button', { name: 'Collapse' })).toHaveAttribute('aria-expanded', 'true');

    await userEvent.click(screen.getByRole('button', { name: 'Collapse' }));
    unmount();
    renderBrowser();
    await rail();

    expect(screen.getByRole('button', { name: 'Expand' })).toHaveAttribute('aria-expanded', 'false');
  });

  it('stores its collapse under its own key only', async () => {
    renderBrowser();
    await rail();
    await userEvent.click(screen.getByRole('button', { name: 'Collapse' }));

    expect(Object.keys(localStorage).filter((key) => /navrail/i.test(key))).toEqual([COMMUNITY_NAV_RAIL_KEY]);
  });
});

describe('the desktop header', () => {
  beforeEach(() => stubMatchMedia(false));

  const header = async () => (await screen.findByRole('heading', { name: 'Community Creations' })).closest('header')!;

  it('holds the title row and the filter bar above the rail, never beside it', async () => {
    renderBrowser();
    const block = await header();
    const list = await screen.findByRole('tablist', { name: 'Community Sections' });

    expect(within(block).getByPlaceholderText(/^Search worlds/)).toBeInTheDocument();
    expect(within(block).getByRole('button', { name: /Add Filter/ })).toBeInTheDocument();
    expect(block.contains(list)).toBe(false);
    expect(block.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('ends the title row with the sort select, the order toggle, then refresh', async () => {
    renderBrowser();
    const block = await header();

    const sort = within(block).getByRole('combobox');
    const order = within(block).getByRole('button', { name: 'Descending' });
    const refresh = within(block).getByRole('button', { name: 'Refresh catalog' });
    const follows = (a: Node, b: Node) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
    expect(follows(sort, order)).toBe(true);
    expect(follows(order, refresh)).toBe(true);
  });
});

describe('the section switcher on portrait (the dropdown)', () => {
  beforeEach(() => stubMatchMedia(true));

  it('shows the current section on the closed trigger instead of a rail', async () => {
    renderBrowser();

    expect(screen.queryByRole('tab', { name: 'Entities' })).not.toBeInTheDocument();
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

  it('offers the Prompts section with its icon', async () => {
    renderBrowser();

    const trigger = await screen.findByRole('combobox');
    await userEvent.click(trigger);

    const prompts = screen.getByRole('option', { name: 'Prompts' });
    expect(prompts.querySelector('svg')).not.toBeNull();
    await userEvent.click(prompts);

    expect(trigger).toHaveTextContent('Prompts');
  });

  it('offers every catalog kind, Avatars included', async () => {
    renderBrowser();

    const trigger = await screen.findByRole('combobox');
    await userEvent.click(trigger);

    const avatars = screen.getByRole('option', { name: 'Avatars' });
    expect(avatars.querySelector('svg')).not.toBeNull();
    await userEvent.click(avatars);

    expect(trigger).toHaveTextContent('Avatars');
  });
});

describe('every catalog kind saves into its own library, never falls back to another', () => {
  beforeEach(() => stubMatchMedia(false));

  /** One listing of `kind`, shaped as the catalog serves it. */
  const listed = (kind: string) => ({
    _id: `${kind}-1`,
    id: `${kind}-1`,
    name: `A ${kind}`,
    kind,
    description: '',
    tags: [],
    author: { id: 'a1', username: 'wren_hallow' },
    downloads: 0,
    likes: 0,
  });

  it('offers Save on an Avatar card, keyed to its own model library', async () => {
    // Avatars became browsable (ticket 04) before the model download instance existed (ticket 05).
    // Without it, the card's Save either offered nothing or ran the dictionary importer over a VRM —
    // the pre-05 fallback in `downloadFor` sent every non-entity kind to the dictionary library.
    catalog.items = [listed('model')];
    renderBrowser();

    await userEvent.click(await screen.findByRole('tab', { name: 'Avatars' }));

    expect(await screen.findByText('A model')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /download this avatar/i })).toBeInTheDocument();
  });

  it('still offers Save on a Dictionary, whose library landed earlier', async () => {
    catalog.items = [listed('dictionary')];
    renderBrowser();

    await userEvent.click(await screen.findByRole('tab', { name: 'Dictionaries' }));

    expect(await screen.findByText('A dictionary')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /download this dictionary/i })).toBeInTheDocument();
  });
});

describe('the Prompts section', () => {
  beforeEach(() => stubMatchMedia(false));

  const prompt = {
    _id: 'p-1', id: 'p-1', name: 'Slow Burn', kind: 'prompt', description: 'Tuned for small models.',
    tags: ['slow burn'], models: ['Cydonia-24B'], author: { id: 'a1', username: 'wren_hallow' },
    // The server gives every kind a stand-in thumbnail file; a prompt card must not ask for it.
    thumbnail_file: 'placeholder-prompt.png', downloads: 0, likes: 0,
  };

  it('shows a prompt listing as a card with the kind icon and no image request', async () => {
    catalog.items = [prompt];
    renderBrowser();

    await userEvent.click(await screen.findByRole('tab', { name: 'Prompts' }));

    expect(await screen.findByText('Slow Burn')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Prompt' })).toBeInTheDocument();
    expect(document.querySelector('img')).toBeNull();
    expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).includes('/thumbnails/'))).toBe(false);
  });

  it('keeps prompts out of the Worlds section', async () => {
    catalog.items = [prompt];
    renderBrowser();

    await screen.findByRole('tab', { name: 'Worlds' });
    expect(screen.queryByText('Slow Burn')).not.toBeInTheDocument();
  });

  it('shows its empty state when the server has no prompts', async () => {
    renderBrowser();

    await userEvent.click(await screen.findByRole('tab', { name: 'Prompts' }));

    expect(await screen.findByText(/No prompts available/)).toBeInTheDocument();
  });
});
