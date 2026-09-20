import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useLikePrompt } from './useLikePrompt';
import { LIKE_PROMPT_TURNS } from '@/lib/likePrompt';
import { markListingPrompted } from '@/lib/likePromptStore';
import WorldStorageService from '@/services/WorldStorageService';
import type { ChatMessage } from '@/types';

/**
 * What makes the prompt due.
 *
 * The rules themselves belong to `lib/likePrompt`; what this guards is the trigger. A committed turn is
 * the only thing that asks, so a save restored past the threshold is asked on its next turn rather than
 * greeted with a card, and a browsed history asks nothing.
 */

vi.mock('@/services/WorldStorageService', () => ({
  default: {
    getWorldListingLink: vi.fn(async () => ({ sourceId: 'listing-1', downloadedAt: '2026-09-19T00:00:00.000Z' })),
  },
}));

const service = vi.mocked(WorldStorageService);

/** A history of `turns` completed user→assistant pairs, as `parseTurns` reads them. */
function history(turns: number): ChatMessage[] {
  return Array.from({ length: turns }).flatMap((_, i) => ([
    { role: 'user', content: `action ${i}` },
    { role: 'assistant', content: JSON.stringify({ narration: `turn ${i}`, choices: [], stat_changes: [] }) },
  ])) as ChatMessage[];
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

describe('when the like prompt comes due', () => {
  it('asks nothing on load, however many turns the restored save holds', async () => {
    const { result } = renderHook(() => useLikePrompt('world-1', 0, history(LIKE_PROMPT_TURNS + 20)));

    await waitFor(() => expect(service.getWorldListingLink).not.toHaveBeenCalled());
    expect(result.current.listingId).toBeNull();
  });

  it('asks on the first turn committed after a save restored past the threshold', async () => {
    const past = history(LIKE_PROMPT_TURNS + 20);
    const { result, rerender } = renderHook(
      ({ nonce, msgs }) => useLikePrompt('world-1', nonce, msgs),
      { initialProps: { nonce: 0, msgs: past } },
    );
    expect(result.current.listingId).toBeNull();

    rerender({ nonce: 1, msgs: past });

    await waitFor(() => expect(result.current.listingId).toBe('listing-1'));
  });

  it('asks nothing on a committed turn below the threshold', async () => {
    const { result } = renderHook(() => useLikePrompt('world-1', 1, history(LIKE_PROMPT_TURNS - 1)));

    await waitFor(() => expect(service.getWorldListingLink).toHaveBeenCalledWith('world-1'));
    expect(result.current.listingId).toBeNull();
  });

  it('asks nothing about a listing this device has already answered for', async () => {
    markListingPrompted('listing-1');
    const { result } = renderHook(() => useLikePrompt('world-1', 1, history(LIKE_PROMPT_TURNS)));

    await waitFor(() => expect(service.getWorldListingLink).toHaveBeenCalled());
    expect(result.current.listingId).toBeNull();
  });

  it('reads the world it is playing once, not once a turn', async () => {
    const msgs = history(LIKE_PROMPT_TURNS);
    const { result, rerender } = renderHook(
      ({ nonce }) => useLikePrompt('world-1', nonce, msgs),
      { initialProps: { nonce: 1 } },
    );
    await waitFor(() => expect(result.current.listingId).toBe('listing-1'));

    rerender({ nonce: 2 });
    rerender({ nonce: 3 });

    await waitFor(() => expect(result.current.listingId).toBe('listing-1'));
    expect(service.getWorldListingLink).toHaveBeenCalledTimes(1);
  });

  it('stops offering a listing the card has closed', async () => {
    const { result } = renderHook(() => useLikePrompt('world-1', 1, history(LIKE_PROMPT_TURNS)));
    await waitFor(() => expect(result.current.listingId).toBe('listing-1'));

    act(() => result.current.closed());

    expect(result.current.listingId).toBeNull();
  });

  it('offers the listing again on a later turn when the card left no mark', async () => {
    const msgs = history(LIKE_PROMPT_TURNS);
    const { result, rerender } = renderHook(
      ({ nonce }) => useLikePrompt('world-1', nonce, msgs),
      { initialProps: { nonce: 1 } },
    );
    await waitFor(() => expect(result.current.listingId).toBe('listing-1'));
    // The card gave up without marking: a like that could not be sent is not an answer.
    act(() => result.current.closed());
    expect(result.current.listingId).toBeNull();

    rerender({ nonce: 2 });

    await waitFor(() => expect(result.current.listingId).toBe('listing-1'));
  });

  it('does not offer the listing again once the card has marked it', async () => {
    const msgs = history(LIKE_PROMPT_TURNS);
    const { result, rerender } = renderHook(
      ({ nonce }) => useLikePrompt('world-1', nonce, msgs),
      { initialProps: { nonce: 1 } },
    );
    await waitFor(() => expect(result.current.listingId).toBe('listing-1'));
    // What the card does on an answer: the mark first, then the close.
    act(() => { markListingPrompted('listing-1'); result.current.closed(); });

    rerender({ nonce: 2 });

    await waitFor(() => expect(service.getWorldListingLink).toHaveBeenCalled());
    expect(result.current.listingId).toBeNull();
  });

  it('asks nothing about a world that came from no listing', async () => {
    service.getWorldListingLink.mockResolvedValue({});
    const { result } = renderHook(() => useLikePrompt('world-1', 1, history(LIKE_PROMPT_TURNS)));

    await waitFor(() => expect(service.getWorldListingLink).toHaveBeenCalled());
    expect(result.current.listingId).toBeNull();
  });

  it('asks nothing when the world record cannot be read', async () => {
    service.getWorldListingLink.mockRejectedValue(new Error('store closed'));
    const { result } = renderHook(() => useLikePrompt('world-1', 1, history(LIKE_PROMPT_TURNS)));

    await waitFor(() => expect(service.getWorldListingLink).toHaveBeenCalled());
    expect(result.current.listingId).toBeNull();
  });

  it('asks nothing offline, where a like could only fail', async () => {
    const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const { result } = renderHook(() => useLikePrompt('world-1', 1, history(LIKE_PROMPT_TURNS)));

    await waitFor(() => expect(service.getWorldListingLink).toHaveBeenCalled());
    expect(result.current.listingId).toBeNull();
    online.mockRestore();
  });
});
