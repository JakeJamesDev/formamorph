import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { toast } from 'react-toastify';
import { LikePrompt } from './LikePrompt';
import { ANONYMOUS_LIKE_CODES } from '@/lib/anonymousLikes';
import { promptedListings } from '@/lib/likePromptStore';
import WorldStorageService, { AnonymousLikeRefused } from '@/services/WorldStorageService';

/**
 * The in-game card, through its real JSX.
 *
 * What these guard is the mark: which answers stop this device asking about a listing, and which leave
 * the question open. Marking a failure would lose a like the player meant to give; not marking an answer
 * would turn the one ask into nagware.
 */

vi.mock('react-toastify', () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

const auth = vi.hoisted(() => ({ signedIn: false }));

vi.mock('@/services/AuthService', () => ({
  default: { isAuthenticated: () => auth.signedIn, getCurrentUser: () => null, token: null },
}));

vi.mock('@/services/WorldStorageService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/WorldStorageService')>();
  return {
    ...actual,
    default: {
      fetchListingLikeState: vi.fn(),
      setRemoteWorldLiked: vi.fn(),
      setAnonymousWorldLiked: vi.fn(),
    },
  };
});

const service = vi.mocked(WorldStorageService);

/** The ordinary case: a listing this reader may like, on a server that takes a guest's like. */
function readsAsLikeable() {
  service.fetchListingLikeState.mockResolvedValue({
    status: 'ok', liked: false, ownListing: false, anonymousLikes: true,
  });
}

beforeEach(() => {
  localStorage.clear();
  auth.signedIn = false;
  vi.clearAllMocks();
});
afterEach(cleanup);

/** Render the card and wait for the listing read to settle, whichever way it settles. */
async function show() {
  const onClosed = vi.fn();
  render(<LikePrompt listingId="listing-1" worldName="Sedge Landing" onClosed={onClosed} />);
  await waitFor(() => expect(service.fetchListingLikeState).toHaveBeenCalledWith('listing-1'));
  return onClosed;
}

describe('the in-game like prompt', () => {
  it('asks about a listing this reader may like', async () => {
    readsAsLikeable();
    await show();
    expect(await screen.findByText('Enjoying Sedge Landing?')).toBeInTheDocument();
  });

  it('sends a guest press to the anonymous route and stops asking', async () => {
    readsAsLikeable();
    service.setAnonymousWorldLiked.mockResolvedValue({ liked: true, likes: 4 });
    const onClosed = await show();

    fireEvent.click(await screen.findByRole('button', { name: /like/i }));

    await waitFor(() => expect(service.setAnonymousWorldLiked).toHaveBeenCalledWith('listing-1', true));
    expect(service.setRemoteWorldLiked).not.toHaveBeenCalled();
    await waitFor(() => expect(promptedListings().has('listing-1')).toBe(true));
    expect(onClosed).toHaveBeenCalled();
    expect(screen.queryByTestId('like-prompt')).not.toBeInTheDocument();
  });

  it("sends a signed-in press to the account route, so the player's liked list stays complete", async () => {
    auth.signedIn = true;
    readsAsLikeable();
    service.setRemoteWorldLiked.mockResolvedValue({ liked: true, likes: 4 });
    await show();

    fireEvent.click(await screen.findByRole('button', { name: /like/i }));

    await waitFor(() => expect(service.setRemoteWorldLiked).toHaveBeenCalledWith('listing-1', true));
    expect(service.setAnonymousWorldLiked).not.toHaveBeenCalled();
    await waitFor(() => expect(promptedListings().has('listing-1')).toBe(true));
  });

  it('stops asking when the player turns it down, and sends no like', async () => {
    readsAsLikeable();
    const onClosed = await show();

    fireEvent.click(await screen.findByRole('button', { name: 'Not Now' }));

    expect(promptedListings().has('listing-1')).toBe(true);
    expect(onClosed).toHaveBeenCalled();
    expect(service.setAnonymousWorldLiked).not.toHaveBeenCalled();
    expect(screen.queryByTestId('like-prompt')).not.toBeInTheDocument();
  });

  it('never asks about a listing the reader already likes, and stops asking about it', async () => {
    service.fetchListingLikeState.mockResolvedValue({
      status: 'ok', liked: true, ownListing: false, anonymousLikes: true,
    });
    const onClosed = await show();

    await waitFor(() => expect(onClosed).toHaveBeenCalled());
    expect(promptedListings().has('listing-1')).toBe(true);
    expect(screen.queryByTestId('like-prompt')).not.toBeInTheDocument();
  });

  it("never asks a signed-in author about their own listing", async () => {
    auth.signedIn = true;
    service.fetchListingLikeState.mockResolvedValue({
      status: 'ok', liked: false, ownListing: true, anonymousLikes: true,
    });
    await show();

    await waitFor(() => expect(promptedListings().has('listing-1')).toBe(true));
    expect(screen.queryByTestId('like-prompt')).not.toBeInTheDocument();
  });

  it('goes quiet about a listing that is no longer there', async () => {
    service.fetchListingLikeState.mockResolvedValue({ status: 'gone' });
    await show();

    await waitFor(() => expect(promptedListings().has('listing-1')).toBe(true));
    expect(screen.queryByTestId('like-prompt')).not.toBeInTheDocument();
  });

  it('leaves the question open when nothing answered', async () => {
    service.fetchListingLikeState.mockResolvedValue({ status: 'unreachable' });
    const onClosed = await show();

    await waitFor(() => expect(service.fetchListingLikeState).toHaveBeenCalled());
    expect(promptedListings().has('listing-1')).toBe(false);
    expect(onClosed).toHaveBeenCalled();
    expect(screen.queryByTestId('like-prompt')).not.toBeInTheDocument();
  });

  it('asks a guest nothing on a server that takes no anonymous like, and leaves the question open', async () => {
    service.fetchListingLikeState.mockResolvedValue({
      status: 'ok', liked: false, ownListing: false, anonymousLikes: false,
    });
    await show();

    await waitFor(() => expect(service.fetchListingLikeState).toHaveBeenCalled());
    expect(screen.queryByTestId('like-prompt')).not.toBeInTheDocument();
    expect(promptedListings().has('listing-1')).toBe(false);
  });

  it('still asks a signed-in player on a server that takes no anonymous like', async () => {
    auth.signedIn = true;
    service.fetchListingLikeState.mockResolvedValue({
      status: 'ok', liked: false, ownListing: false, anonymousLikes: false,
    });
    await show();

    expect(await screen.findByTestId('like-prompt')).toBeInTheDocument();
  });

  it('reports a like that did not send, and leaves the question open', async () => {
    readsAsLikeable();
    service.setAnonymousWorldLiked.mockRejectedValue(new TypeError('Failed to fetch'));
    const onClosed = await show();

    fireEvent.click(await screen.findByRole('button', { name: /like/i }));

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(promptedListings().has('listing-1')).toBe(false);
    expect(onClosed).toHaveBeenCalled();
  });

  it('offers the way past the connection cap, and leaves the question open', async () => {
    readsAsLikeable();
    service.setAnonymousWorldLiked.mockRejectedValue(
      new AnonymousLikeRefused(ANONYMOUS_LIKE_CODES.ADDRESS_CAP, 'capped'),
    );
    await show();

    fireEvent.click(await screen.findByRole('button', { name: /like/i }));

    await waitFor(() => expect(toast.info).toHaveBeenCalledWith(expect.stringContaining('Log in')));
    expect(promptedListings().has('listing-1')).toBe(false);
  });

  it('goes quiet about a listing that went quiet between the read and the press', async () => {
    readsAsLikeable();
    service.setAnonymousWorldLiked.mockRejectedValue(
      new AnonymousLikeRefused(ANONYMOUS_LIKE_CODES.NOT_VISIBLE, 'gone'),
    );
    await show();

    fireEvent.click(await screen.findByRole('button', { name: /like/i }));

    await waitFor(() => expect(promptedListings().has('listing-1')).toBe(true));
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("goes quiet about a guest's own listing, which only the press can discover", async () => {
    readsAsLikeable();
    service.setAnonymousWorldLiked.mockRejectedValue(
      new AnonymousLikeRefused(ANONYMOUS_LIKE_CODES.ACCOUNT_OWN_LISTING, 'yours'),
    );
    await show();

    fireEvent.click(await screen.findByRole('button', { name: /like/i }));

    await waitFor(() => expect(promptedListings().has('listing-1')).toBe(true));
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('says nothing about a switch-off between the read and the press, and leaves the question open', async () => {
    readsAsLikeable();
    service.setAnonymousWorldLiked.mockRejectedValue(
      new AnonymousLikeRefused(ANONYMOUS_LIKE_CODES.OFF, 'off'),
    );
    await show();

    fireEvent.click(await screen.findByRole('button', { name: /like/i }));

    await waitFor(() => expect(screen.queryByTestId('like-prompt')).not.toBeInTheDocument());
    expect(promptedListings().has('listing-1')).toBe(false);
    expect(toast.error).not.toHaveBeenCalled();
    expect(toast.info).not.toHaveBeenCalled();
  });

  it('asks nothing at all while there is no listing to ask about', () => {
    render(<LikePrompt listingId={null} worldName="Sedge Landing" />);
    expect(service.fetchListingLikeState).not.toHaveBeenCalled();
    expect(screen.queryByTestId('like-prompt')).not.toBeInTheDocument();
  });
});
