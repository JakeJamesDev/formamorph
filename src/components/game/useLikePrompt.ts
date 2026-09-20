import { useCallback, useEffect, useRef, useState } from 'react';
import { parseTurns } from '@/lib/turnBanding';
import { listingToAskAbout, type LikePromptWorld } from '@/lib/likePrompt';
import { promptedListings } from '@/lib/likePromptStore';
import WorldStorageService from '@/services/WorldStorageService';
import type { ChatMessage } from '@/types';

/**
 * When the in-game like prompt is due, and which listing it is about.
 *
 * The trigger is a committed turn rather than a render or a load: a save restored past the threshold is
 * asked after its next turn, not the moment it opens, and a player browsing back through old pages is
 * asked nothing at all.
 *
 * The world's provenance is read once per world and held, because it cannot change during a playthrough
 * and reading it pulls the whole stored record.
 *
 * @param worldId - The local world record being played
 * @param turnCommitNonce - Bumped once per committed turn by the caller
 * @param history - The flat chat history the turn count is derived from
 */
export function useLikePrompt(worldId: string | null, turnCommitNonce: number, history: ChatMessage[]) {
  const [listingId, setListingId] = useState<string | null>(null);
  const linkRef = useRef<{ worldId: string; link: LikePromptWorld } | null>(null);

  // The history as of the last render, read at the commit rather than tracked by it: the count matters
  // once per turn, and following every page change would run the parse for nothing.
  const historyRef = useRef(history);
  useEffect(() => { historyRef.current = history; });

  // The card records the mark, because only it knows which outcomes earn one. This just stops offering
  // the listing; whether a later turn offers it again follows from the mark the card did or did not leave.
  const closed = useCallback(() => setListingId(null), []);

  useEffect(() => {
    if (turnCommitNonce === 0 || !worldId) return;
    let current = true;

    void (async () => {
      if (linkRef.current?.worldId !== worldId) {
        const link = await WorldStorageService.getWorldListingLink(worldId).catch(() => ({}));
        if (!current) return;
        linkRef.current = { worldId, link: { id: worldId, ...link } };
      }

      setListingId(listingToAskAbout({
        world: linkRef.current.link,
        turns: parseTurns(historyRef.current).length,
        online: navigator.onLine,
        prompted: promptedListings(),
      }));
    })();

    return () => { current = false; };
  }, [turnCommitNonce, worldId]);

  return { listingId, closed };
}
