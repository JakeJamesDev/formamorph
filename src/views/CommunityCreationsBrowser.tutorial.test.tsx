import { useState } from 'react';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import CommunityCreationsBrowser from './CommunityCreationsBrowser';
import { TUTORIAL_APPEAR_DELAY_MS, resetTutorials, seenTutorials, useTutorial } from '@/lib/tutorials';
import type { WorldRecord } from '@/components/WorldDetails';

/**
 * The Community Creations tour, through the real browser JSX. `tutorials.test.ts` covers the store; what
 * these guard is the wiring — that the entries chain, that using a control counts as reading its
 * explanation, and that an entry whose control cannot be used waits rather than being spent.
 */

vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));

vi.mock('@/services/AuthService', () => ({
  default: { token: 'test-token', getCurrentUser: () => ({ username: 'reader' }) },
}));

vi.mock('@/services/WorldStorageService', () => ({
  default: {
    API_URL: 'https://example.test/api',
    setRemoteWorldLiked: vi.fn(async () => ({ liked: true, likes: 1 })),
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

// Renders its open flag rather than nothing: the like tutorial is anchored inside a card that opens
// this modal when clicked, so whether it opened is the thing under test.
vi.mock('@/components/community/RemoteWorldDetailsModal', () => ({
  RemoteWorldDetailsModal: ({ open }: { open: boolean }) => <div>{open ? 'details:open' : 'details:closed'}</div>,
}));

const listing = (over: Record<string, unknown> = {}) => ({
  _id: 'w1',
  id: 'w1',
  kind: 'world',
  name: 'Sedge Landing',
  description: 'A blurb.',
  author: { id: 'author-1', username: 'alice' },
  tags: ['forest'],
  likes: 3,
  ...over,
});

const reader = { id: 'u1', username: 'reader', accountType: 'normal' } as unknown as WorldRecord;

const renderBrowser = ({ signedIn = true, open = true } = {}) =>
  render(
    <CommunityCreationsBrowser
      open={open}
      onOpenChange={() => {}}
      worlds={[]}
      setWorlds={() => {}}
      entities={[]}
      dictionaries={[]}
      refreshEntities={() => {}}
      refreshDictionaries={() => {}}
      isAuthenticated={signedIn}
      currentUser={signedIn ? reader : null}
      openImageViewer={() => {}}
    />
  );

/** Past the appear delay, with React flushing the state change it schedules. */
const settle = () => act(() => { vi.advanceTimersByTime(TUTORIAL_APPEAR_DELAY_MS + 50); });

/** The tour's forward button: Next everywhere but the last step, which says Got It. */
const gotIt = () => fireEvent.click(screen.getByRole('button', { name: /^(Next|Got It)$/ }));
const back = () => fireEvent.click(screen.getByRole('button', { name: 'Previous' }));

beforeEach(() => {
  // jsdom has no `matchMedia`; the browser reads it for the mobile layout switch.
  window.matchMedia = ((query: string) => ({
    matches: false, media: query, onchange: null,
    addEventListener: () => {}, removeEventListener: () => {},
    addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;

  catalog.items = [listing()];
  localStorage.clear();
  resetTutorials();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ success: true }) } as unknown as Response)));
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Community Creations tour', () => {
  it('holds off until the appear delay, then explains the content types first', () => {
    renderBrowser();
    expect(screen.queryByText('Worlds, Entities & Dictionaries')).not.toBeInTheDocument();
    settle();
    expect(screen.getByText('Worlds, Entities & Dictionaries')).toBeInTheDocument();
  });

  it('waits for the browser to open rather than for the app to start', () => {
    const view = renderBrowser({ open: false });
    settle();
    expect(screen.queryByText('Worlds, Entities & Dictionaries')).not.toBeInTheDocument();

    view.rerender(
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
    // The delay restarts from the open, so the popover still arrives as a change rather than as part of
    // the browser's first paint.
    act(() => { vi.advanceTimersByTime(TUTORIAL_APPEAR_DELAY_MS - 100); });
    expect(screen.queryByText('Worlds, Entities & Dictionaries')).not.toBeInTheDocument();

    settle();
    expect(screen.getByText('Worlds, Entities & Dictionaries')).toBeInTheDocument();
  });

  it('takes the tour over from the screen it opened on top of', () => {
    // The main menu behind it runs its own tutorial. Both anchored at once puts two explanations on the
    // same glass, one of them pointing at a control the browser is covering.
    const Menu = () => {
      const { active } = useTutorial('mainMenu');
      return <div>{active ? `menu:${active.title}` : 'menu:none'}</div>;
    };
    render(<Menu />);
    renderBrowser();
    settle();

    expect(screen.getByText('menu:none')).toBeInTheDocument();
    expect(screen.getByText('Worlds, Entities & Dictionaries')).toBeInTheDocument();
  });

  it('hands the tour back when the browser closes', () => {
    const Menu = () => {
      const { active } = useTutorial('mainMenu');
      return <div>{active ? `menu:${active.title}` : 'menu:none'}</div>;
    };
    render(<Menu />);
    const browser = renderBrowser();
    settle();
    browser.unmount();
    settle();

    expect(screen.getByText('menu:Sign In')).toBeInTheDocument();
  });

  it('chains straight to the filters once the tabs are acknowledged', () => {
    renderBrowser();
    settle();
    gotIt();
    expect(screen.queryByText('Worlds, Entities & Dictionaries')).not.toBeInTheDocument();
    expect(screen.getByText('Narrow the Catalog')).toBeInTheDocument();
  });

  it('counts switching tabs as reading the tabs explanation', () => {
    renderBrowser();
    settle();
    fireEvent.pointerDown(screen.getByRole('tab', { name: 'Entities' }));
    expect(seenTutorials()).toContain('community-kind-tabs');
    expect(screen.queryByText('Worlds, Entities & Dictionaries')).not.toBeInTheDocument();
  });

  it('reaches the like heart third, on a card the reader can actually like', () => {
    renderBrowser();
    settle();
    gotIt(); // tabs
    gotIt(); // filters
    expect(screen.getByText('Show Some Love')).toBeInTheDocument();
  });

  it('advances the like step without opening the world behind it', () => {
    // The heart sits inside a card that opens on click, and Radix portals the popover out of that card
    // in the DOM only — React still bubbles the button's click to the card's handler.
    renderBrowser();
    settle();
    gotIt(); // tabs
    gotIt(); // filters
    expect(screen.getByText('Show Some Love')).toBeInTheDocument();

    gotIt(); // the like step's own Next
    expect(screen.getByText('details:closed')).toBeInTheDocument();
    expect(screen.getByText('Search Shortcuts')).toBeInTheDocument();
  });

  it('leaves the world behind the like step closed when stepping back too', () => {
    renderBrowser();
    settle();
    gotIt();
    gotIt();
    back();
    expect(screen.getByText('details:closed')).toBeInTheDocument();
  });

  it('stands down while a world is open over the control it explains', async () => {
    // The note is portaled to <body>, so the world's dialog does not cover it — on a small screen it
    // ends up floating over that dialog, pointing at a header the reader can no longer see.
    renderBrowser();
    settle();
    expect(screen.getByText('Worlds, Entities & Dictionaries')).toBeInTheDocument();

    // What Radix does to the browser's own dialog when a modal opens above it.
    const browserDialog = document.querySelector('[role="tablist"]')!.closest('[role="dialog"]')!;
    await act(async () => {
      browserDialog.setAttribute('aria-hidden', 'true');
      await Promise.resolve();
    });
    expect(screen.queryByText('Worlds, Entities & Dictionaries')).not.toBeInTheDocument();

    await act(async () => {
      browserDialog.removeAttribute('aria-hidden');
      await Promise.resolve();
    });
    expect(screen.getByText('Worlds, Entities & Dictionaries')).toBeInTheDocument();
    // Standing down is not reading: it must still be owed.
    expect(seenTutorials()).not.toContain('community-kind-tabs');
  });

  it('counts liking something as reading the like explanation', () => {
    renderBrowser();
    settle();
    gotIt();
    gotIt();
    fireEvent.click(screen.getByRole('button', { name: /^Like —/ }));
    expect(seenTutorials()).toContain('community-like');
  });

  it('holds the like explanation for a signed-out reader instead of spending it', () => {
    renderBrowser({ signedIn: false });
    settle();
    gotIt(); // tabs
    gotIt(); // filters

    // Nothing signed-out can be liked, so the tour steps over it — and leaves it unseen for a visit
    // that can show it.
    expect(screen.queryByText('Show Some Love')).not.toBeInTheDocument();
    expect(screen.getByText('Search Shortcuts')).toBeInTheDocument();
    expect(seenTutorials()).not.toContain('community-like');
  });

  it('holds the like explanation when every card on the page is the reader’s own', () => {
    catalog.items = [listing({ author: { id: 'u1', username: 'reader' } })];
    renderBrowser();
    settle();
    gotIt();
    gotIt();
    expect(screen.queryByText('Show Some Love')).not.toBeInTheDocument();
    // The tour has to move past it, not stall on an entry with nowhere to anchor.
    expect(screen.getByText('Search Shortcuts')).toBeInTheDocument();
    expect(seenTutorials()).not.toContain('community-like');
  });

  it('counts the steps and walks back through them', () => {
    renderBrowser();
    settle();
    expect(screen.getByText('1 / 5')).toBeInTheDocument();
    // Nowhere to go back to from the first one.
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();

    gotIt();
    expect(screen.getByText('2 / 5')).toBeInTheDocument();

    back();
    expect(screen.getByText('Worlds, Entities & Dictionaries')).toBeInTheDocument();
    expect(screen.getByText('1 / 5')).toBeInTheDocument();
  });

  it('leaves a step read after going back to re-read it', () => {
    // Back is a second look, not an un-reading: the tour must not become a loop the reader can't leave.
    renderBrowser();
    settle();
    gotIt();
    back();
    expect(seenTutorials()).toContain('community-kind-tabs');
  });

  it('sizes the tour to what it can actually show', () => {
    // Signed out, the like step is held — so the count must say four, not five with one unreachable.
    renderBrowser({ signedIn: false });
    settle();
    expect(screen.getByText('1 / 4')).toBeInTheDocument();
  });

  it('retires for good once the whole tour is acknowledged', () => {
    const view = renderBrowser();
    settle();
    gotIt(); // tabs
    gotIt(); // filters
    gotIt(); // like
    gotIt(); // search prefixes
    gotIt(); // hidden
    expect(screen.queryByRole('button', { name: /^(Next|Got It)$/ })).not.toBeInTheDocument();

    view.unmount();
    renderBrowser();
    settle();
    expect(screen.queryByRole('button', { name: /^(Next|Got It)$/ })).not.toBeInTheDocument();
  });
});
