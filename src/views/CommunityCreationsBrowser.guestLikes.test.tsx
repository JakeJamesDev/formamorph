import { useState } from 'react';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { toast } from 'react-toastify';
import CommunityCreationsBrowser from './CommunityCreationsBrowser';
import { AnonymousLikeRefused } from '@/services/WorldStorageService';
import WorldStorageService from '@/services/WorldStorageService';
import { ANONYMOUS_LIKE_CODES } from '@/lib/anonymousLikes';
import { APP_COMMUNITY_CAPABILITIES, WEBSITE_COMMUNITY_CAPABILITIES } from '@/lib/communityBrowserCapabilities';
import type { WorldRecord } from '@/components/WorldDetails';

/**
 * The heart a guest presses, through the real browser JSX.
 *
 * The press used to be a sign-in wall and most guests stopped at it. What these guard is where one press
 * now goes: to the anonymous route where a guest may give a like, to sign-in where they may not, and back
 * to sign-in when the server says the feature has since been switched off.
 */

vi.mock('react-toastify', () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

vi.mock('@/services/AuthService', () => ({
  default: { token: null, getCurrentUser: () => null },
}));

vi.mock('@/services/WorldStorageService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/WorldStorageService')>();
  return {
    ...actual,
    default: {
      API_URL: 'https://example.test/api',
      setRemoteWorldLiked: vi.fn(async () => ({ liked: true, likes: 9 })),
      setAnonymousWorldLiked: vi.fn(async () => ({ liked: true, likes: 4 })),
    },
  };
});

const sync = vi.hoisted(() => ({ items: [] as Record<string, unknown>[], anonymousLikes: true }));

vi.mock('@/lib/useCatalogSync', () => ({
  useCatalogSync: () => {
    const [remoteWorlds, setRemoteWorlds] = useState(sync.items);
    const [anonymousLikes, setAnonymousLikes] = useState(sync.anonymousLikes);
    return {
      remoteWorlds,
      setRemoteWorlds,
      isLoadingRemoteWorlds: false,
      isSyncingCatalog: false,
      catalogSettled: true,
      loadCatalog: vi.fn(),
      anonymousLikes,
      setAnonymousLikes,
    };
  },
}));

// The contest archive is another test's subject, and there is no server here for it to read.
vi.mock('@/lib/useContests', () => ({ useContests: () => ({ contests: [], loaded: true }) }));

// The details window is its own test's subject; here it only has to not fetch.
vi.mock('@/components/community/RemoteWorldDetailsModal', () => ({
  RemoteWorldDetailsModal: () => null,
}));

const listing = {
  _id: 'w1',
  id: 'w1',
  kind: 'world',
  name: 'Sedge Landing',
  description: 'A drowned coastal town.',
  author: { id: 'author-1', username: 'wren_hallow' },
  tags: [],
  likes: 3,
};

const renderBrowser = (props: Record<string, unknown> = {}) =>
  render(
    <CommunityCreationsBrowser
      open
      onOpenChange={() => {}}
      capabilities={APP_COMMUNITY_CAPABILITIES}
      worlds={[]}
      setWorlds={() => {}}
      entities={[]}
      dictionaries={[]}
      models={[]}
      refreshEntities={() => {}}
      refreshDictionaries={() => {}}
      refreshModels={() => {}}
      isAuthenticated={false}
      currentUser={null}
      openImageViewer={() => {}}
      {...props}
    />
  );

/** The heart on the one card, whether it is a button or a plain count. */
const heart = () => screen.getByLabelText(/\d+ likes?$/i);
const press = () => fireEvent.click(heart());

const anonymousRoute = () => vi.mocked(WorldStorageService.setAnonymousWorldLiked);
const accountRoute = () => vi.mocked(WorldStorageService.setRemoteWorldLiked);

/** A refusal the server would answer with, held until the test releases it. */
const refuse = (code: string) => {
  anonymousRoute().mockRejectedValueOnce(new AnonymousLikeRefused(code, 'No'));
};

beforeEach(() => {
  sync.items = [listing];
  sync.anonymousLikes = true;
  window.matchMedia = ((query: string) => ({
    matches: false, media: query, onchange: null,
    addListener: () => {}, removeListener: () => {},
    addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
  vi.clearAllMocks();
  anonymousRoute().mockResolvedValue({ liked: true, likes: 4 });
  accountRoute().mockResolvedValue({ liked: true, likes: 9 });
});

afterEach(() => {
  cleanup();
});

describe('where a guest\'s press goes', () => {
  it('records the like on the anonymous route when the server takes one', async () => {
    renderBrowser();

    press();

    await waitFor(() => expect(anonymousRoute()).toHaveBeenCalledWith('w1', true));
    expect(accountRoute()).not.toHaveBeenCalled();
  });

  it('fills the heart before the server answers, so the press reads as done', async () => {
    let answer: (state: { liked: boolean; likes: number }) => void = () => {};
    anonymousRoute().mockReturnValueOnce(new Promise((res) => { answer = res; }));
    renderBrowser();

    press();

    // Still in the air, and the count has already moved.
    await waitFor(() => expect(screen.getByRole('button', { name: /Unlike — 4 likes/ })).toBeTruthy());
    answer({ liked: true, likes: 12 });
    // The server's own number wins over the guess.
    await waitFor(() => expect(screen.getByRole('button', { name: /Unlike — 12 likes/ })).toBeTruthy());
  });

  it('sends the guest to sign-in when this server takes no anonymous like', async () => {
    sync.anonymousLikes = false;
    const onGuestLike = vi.fn();
    renderBrowser({ onGuestLike });

    press();

    await waitFor(() => expect(onGuestLike).toHaveBeenCalled());
    expect(anonymousRoute()).not.toHaveBeenCalled();
  });

  it('still sends the clear when the server stops taking new likes, so a like can always be taken back', async () => {
    sync.items = [{ ...listing, liked: true, likes: 4 }];
    sync.anonymousLikes = false;
    anonymousRoute().mockResolvedValue({ liked: false, likes: 3 });
    const onGuestLike = vi.fn();
    renderBrowser({ onGuestLike });

    press();

    await waitFor(() => expect(anonymousRoute()).toHaveBeenCalledWith('w1', false));
    expect(onGuestLike).not.toHaveBeenCalled();
  });

  it('sends the guest to sign-in on the website, where an Install means nothing', async () => {
    const onGuestLike = vi.fn();
    renderBrowser({ capabilities: WEBSITE_COMMUNITY_CAPABILITIES, onGuestLike });

    press();

    await waitFor(() => expect(onGuestLike).toHaveBeenCalled());
    expect(anonymousRoute()).not.toHaveBeenCalled();
  });

  it('sends a website guest to sign-in even on a heart that shows filled', async () => {
    // The server marks a guest's `liked` from the account that claimed their Install, so a website
    // visitor who signed in once and out again sees a filled heart. It is their account's Like, and
    // only their account may take it off.
    sync.items = [{ ...listing, liked: true, likes: 4 }];
    const onGuestLike = vi.fn();
    renderBrowser({ capabilities: WEBSITE_COMMUNITY_CAPABILITIES, onGuestLike });

    press();

    await waitFor(() => expect(onGuestLike).toHaveBeenCalled());
    expect(anonymousRoute()).not.toHaveBeenCalled();
  });

  it('uses the account route once there is a session', async () => {
    renderBrowser({ isAuthenticated: true, currentUser: { id: 'u1', username: 'reader' } as unknown as WorldRecord });

    press();

    await waitFor(() => expect(accountRoute()).toHaveBeenCalledWith('w1', true));
    expect(anonymousRoute()).not.toHaveBeenCalled();
  });
});

describe('a heart the account behind this Install already filled', () => {
  // Signing out is not a second like. The server answers the press 200 with a code, `liked: true` and the
  // count it already had, because the listing really is liked — by the account that claimed this Install.

  it('leaves the heart filled and the count alone on a clear press', async () => {
    sync.items = [{ ...listing, liked: true, likes: 9 }];
    anonymousRoute().mockResolvedValue({ liked: true, likes: 9 });
    renderBrowser();

    press();

    await waitFor(() => expect(anonymousRoute()).toHaveBeenCalledWith('w1', false));
    await waitFor(() => expect(screen.getByRole('button', { name: /Unlike — 9 likes/ })).toBeTruthy());
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('raises no count on a like press, and says nothing about it', async () => {
    // The heart reads empty only against a catalog read before the Claim landed. The press still answers
    // with the truth, so the number the reader ends on is the one the listing has.
    sync.items = [{ ...listing, liked: false, likes: 9 }];
    anonymousRoute().mockResolvedValue({ liked: true, likes: 9 });
    renderBrowser();

    press();

    await waitFor(() => expect(anonymousRoute()).toHaveBeenCalledWith('w1', true));
    await waitFor(() => expect(screen.getByRole('button', { name: /Unlike — 9 likes/ })).toBeTruthy());
    expect(toast.error).not.toHaveBeenCalled();
    expect(toast.info).not.toHaveBeenCalled();
  });
});

describe('what a refusal does to the heart', () => {
  it('puts the heart back and sends the guest to sign-in when the setting went off mid-visit', async () => {
    refuse(ANONYMOUS_LIKE_CODES.OFF);
    const onGuestLike = vi.fn();
    renderBrowser({ onGuestLike });

    press();

    await waitFor(() => expect(onGuestLike).toHaveBeenCalled());
    expect(heart().textContent).toContain('3');
    // The stale answer is corrected, so the next press does not try the route again.
    await waitFor(() => expect(screen.queryByRole('button', { name: /Unlike/ })).toBeNull());
  });

  it('sends a refused clear to sign-in, which is what the server answers until its ticket 12 lands', async () => {
    // The clear is attempted whatever the flag says, because a like must always be removable. The
    // server refuses it with the same switched-off code today, so the press lands on the fallback.
    sync.items = [{ ...listing, liked: true, likes: 4 }];
    sync.anonymousLikes = false;
    refuse(ANONYMOUS_LIKE_CODES.OFF);
    const onGuestLike = vi.fn();
    renderBrowser({ onGuestLike });

    press();

    await waitFor(() => expect(anonymousRoute()).toHaveBeenCalledWith('w1', false));
    await waitFor(() => expect(onGuestLike).toHaveBeenCalled());
    // The like it could not remove is still shown as given.
    expect(screen.getByRole('button', { name: /Unlike — 4 likes/ })).toBeTruthy();
  });

  it('says one thing about the cap, and offers sign-in as the way past it', async () => {
    refuse(ANONYMOUS_LIKE_CODES.ADDRESS_CAP);
    const onGuestLike = vi.fn();
    renderBrowser({ onGuestLike });

    press();

    await waitFor(() => expect(toast.info).toHaveBeenCalled());
    expect(heart().textContent).toContain('3');

    // The toast's own action is what reaches sign-in; the press itself does not.
    expect(onGuestLike).not.toHaveBeenCalled();
    const { getByRole } = render(<>{vi.mocked(toast.info).mock.calls[0][0] as React.ReactNode}</>);
    fireEvent.click(getByRole('button', { name: 'Login' }));
    expect(onGuestLike).toHaveBeenCalled();
  });

  it('puts the heart back and says nothing about an author\'s own listing', async () => {
    // The guest signed out of the account that published this. Only the server can know that.
    refuse(ANONYMOUS_LIKE_CODES.ACCOUNT_OWN_LISTING);
    const onGuestLike = vi.fn();
    renderBrowser({ onGuestLike });

    press();

    await waitFor(() => expect(anonymousRoute()).toHaveBeenCalled());
    await waitFor(() => expect(heart().textContent).toContain('3'));
    expect(toast.info).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
    expect(onGuestLike).not.toHaveBeenCalled();
  });

  it('puts the heart back and says nothing about a listing that has gone', async () => {
    refuse(ANONYMOUS_LIKE_CODES.NOT_VISIBLE);
    renderBrowser();

    press();

    await waitFor(() => expect(anonymousRoute()).toHaveBeenCalled());
    await waitFor(() => expect(heart().textContent).toContain('3'));
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('tells the guest when the request never reached the server', async () => {
    anonymousRoute().mockRejectedValueOnce(new TypeError('Failed to fetch'));
    renderBrowser();

    press();

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(heart().textContent).toContain('3');
  });
});
