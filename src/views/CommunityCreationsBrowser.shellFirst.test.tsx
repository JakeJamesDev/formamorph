import { useLayoutEffect, useState, Profiler } from 'react';
import { render, screen, cleanup, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import CommunityCreationsBrowser from './CommunityCreationsBrowser';
import { stubMatchMedia } from '@/test/serverEvents';
import type { WorldRecord } from '@/components/WorldDetails';

/**
 * Opening the browser commits its window before its card grid. Commits are counted with a Profiler;
 * a card records the commit it mounted in, and the Profiler records the first commit that has the title.
 */

vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));

vi.mock('@/services/AuthService', () => ({
  default: { token: 'test-token', getCurrentUser: () => ({ username: 'reader' }) },
}));

vi.mock('@/services/WorldStorageService', () => ({
  default: { API_URL: 'https://example.test/api' },
}));

vi.mock('@/services/EventService', () => ({
  default: { fetchActive: vi.fn(async () => []), fetchList: vi.fn(async () => []) },
}));

const catalog = vi.hoisted(() => ({
  items: [] as Record<string, unknown>[],
  push: null as null | ((rows: Record<string, unknown>[]) => void),
}));

vi.mock('@/lib/useCatalogSync', () => ({
  useCatalogSync: () => {
    const [remoteWorlds, setRemoteWorlds] = useState(catalog.items);
    catalog.push = setRemoteWorlds;
    return {
      remoteWorlds,
      setRemoteWorlds,
      isLoadingRemoteWorlds: false,
      isSyncingCatalog: false,
      loadCatalog: vi.fn(),
    };
  },
}));

const trace = vi.hoisted(() => ({
  commits: 0,
  shellCommit: null as number | null,
  firstCardCommit: null as number | null,
  emptyStateCommits: [] as number[],
  renamedCommit: null as number | null,
}));

vi.mock('@/components/community/RemoteWorldCard', () => ({
  RemoteWorldCard: ({ world }: { world: { name: string } }) => {
    useLayoutEffect(() => {
      // The Profiler counts this commit after the layout effects run, hence the +1.
      trace.firstCardCommit ??= trace.commits + 1;
    }, []);
    return <div data-testid="card">{world.name}</div>;
  },
}));

vi.mock('@/components/community/RemoteWorldDetailsModal', () => ({ RemoteWorldDetailsModal: () => null }));

const reader = { id: 'u1', username: 'reader', accountType: 'normal' } as unknown as WorldRecord;

const listed = (n: number) => ({
  _id: `w-${n}`, id: `w-${n}`, name: `World ${n}`, kind: 'world', description: '', tags: [],
  author: { id: 'a1', username: 'wren_hallow' }, downloads: 0, likes: 0,
});

const rows = (count: number) => Array.from({ length: count }, (_, i) => listed(i));

const onRender = () => {
  trace.commits += 1;
  if (trace.shellCommit === null && screen.queryByText('Community Creations')) trace.shellCommit = trace.commits;
  if (screen.queryByText(/available\. Be the first|match your filters/)) trace.emptyStateCommits.push(trace.commits);
  if (trace.renamedCommit === null && screen.queryByText('Liked World')) trace.renamedCommit = trace.commits;
};

const Harness = ({ open }: { open: boolean }) => (
  <Profiler id="browser" onRender={onRender}>
    <CommunityCreationsBrowser
      open={open}
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
  </Profiler>
);

beforeEach(() => {
  stubMatchMedia(false);
  localStorage.clear();
  catalog.items = [];
  catalog.push = null;
  trace.commits = 0;
  trace.shellCommit = null;
  trace.firstCardCommit = null;
  trace.emptyStateCommits = [];
  trace.renamedCommit = null;
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ success: true }) } as unknown as Response)));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('the window commits before the card grid', () => {
  it('on an open that already holds cached rows', async () => {
    catalog.items = rows(3);
    const view = render(<Harness open={false} />);
    trace.commits = 0;

    view.rerender(<Harness open />);
    await screen.findAllByTestId('card');

    expect(trace.shellCommit).not.toBeNull();
    expect(trace.firstCardCommit).toBeGreaterThan(trace.shellCommit as number);
    expect(screen.getAllByTestId('card')).toHaveLength(3);
  });

  it('on a reopen after the grid was up, which is what the changelog claims', async () => {
    catalog.items = rows(3);
    const view = render(<Harness open={false} />);
    view.rerender(<Harness open />);
    await screen.findAllByTestId('card');
    await act(async () => {});
    view.rerender(<Harness open={false} />);
    await act(async () => {});
    trace.commits = 0;
    trace.shellCommit = null;
    trace.firstCardCommit = null;

    view.rerender(<Harness open />);
    await screen.findAllByTestId('card');

    expect(trace.shellCommit).not.toBeNull();
    expect(trace.firstCardCommit).toBeGreaterThan(trace.shellCommit ?? Infinity);
  });

  it('on fresh rows that arrive after the window mounts open', async () => {
    render(<Harness open />);
    await screen.findByText('Community Creations');
    trace.commits = 0;
    trace.firstCardCommit = null;

    await act(async () => { catalog.push?.(rows(3)); });
    await screen.findAllByTestId('card');

    // The arrival is not urgent work: the commit that holds the rows does not draw the cards.
    expect(trace.firstCardCommit).toBeGreaterThan(1);
  });

  it('but redraws a card at once after the grid is up, as a like press needs', async () => {
    catalog.items = rows(3);
    const view = render(<Harness open={false} />);
    view.rerender(<Harness open />);
    await screen.findAllByTestId('card');
    await act(async () => {});
    trace.commits = 0;

    await act(async () => { catalog.push?.([{ ...listed(0), name: 'Liked World' }, ...rows(3).slice(1)]); });

    expect(screen.getByText('Liked World')).toBeInTheDocument();
    expect(trace.renamedCommit).toBe(1);
  });

  it('and shows no empty state while rows exist but have not rendered', async () => {
    catalog.items = rows(3);
    const view = render(<Harness open={false} />);
    trace.commits = 0;

    view.rerender(<Harness open />);
    await screen.findAllByTestId('card');

    expect(trace.emptyStateCommits).toEqual([]);
  });

  it('and still shows the empty state for a catalog that has no rows', async () => {
    const view = render(<Harness open={false} />);

    view.rerender(<Harness open />);

    expect(await screen.findByText(/No worlds available/)).toBeInTheDocument();
  });
});
