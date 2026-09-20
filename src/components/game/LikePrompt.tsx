import { useEffect, useRef, useState } from 'react';
import { Heart } from 'lucide-react';
import { toast } from 'react-toastify';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ADDRESS_CAP_REACHED, refusalAnswer } from '@/lib/anonymousLikes';
import { markListingPrompted } from '@/lib/likePromptStore';
import AuthService from '@/services/AuthService';
import WorldStorageService, { AnonymousLikeRefused } from '@/services/WorldStorageService';

interface LikePromptProps {
  /** The listing to ask about. Null asks nothing. */
  listingId: string | null;
  /** The world's name, for the question. */
  worldName: string;
  /** The card is finished with this listing, answered or not, so the caller can stop offering it. */
  onClosed?: () => void;
  /** Where the listing's state comes from. The dev-router serves a canned one; play uses the server. */
  readListing?: (listingId: string) => Promise<ListingLikeState>;
  className?: string;
}

/** What the server says about one listing and this reader. */
type ListingLikeState = Awaited<ReturnType<typeof WorldStorageService.fetchListingLikeState>>;

/** What the prompt is doing: reading the listing, asking, sending the like, or finished with it. */
type PromptPhase = 'reading' | 'asking' | 'sending' | 'closed';

/**
 * The one card that asks a player whether they enjoy a downloaded world.
 *
 * It asks once per listing and never blocks play: both actions close it, and either way this device
 * stops asking about that listing. The mark is the point. A prompt that returned after an answer would
 * be nagware, and a like the player never chose to give is worth nothing to the author.
 *
 * Every refusal the player cannot act on closes the card in silence. Some outcomes are not answers at
 * all: nothing reached the server, and this connection has already given the listing its share. Those
 * close the card with no mark, so a later turn asks again rather than lose a like the player meant to
 * give.
 */
export function LikePrompt({
  listingId, worldName, onClosed, readListing, className,
}: LikePromptProps) {
  const [phase, setPhase] = useState<PromptPhase>('reading');
  // For the press handler, which outlives no effect of its own.
  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

  /** Take the card down, leaving no mark, so a later turn asks about this listing again. */
  const close = () => {
    onClosed?.();
    setPhase('closed');
  };

  /** Take the card down and record that this listing has had its one ask. */
  const answer = (id: string) => {
    markListingPrompted(id);
    close();
  };

  // Read the listing before asking about it. A listing the player already likes, one they published, and
  // one that has gone quiet are each answered without ever showing a card.
  useEffect(() => {
    if (!listingId) return;
    setPhase('reading');
    let current = true;

    void (async () => {
      const read = readListing ?? ((id: string) => WorldStorageService.fetchListingLikeState(id));
      const state = await read(listingId);
      if (!current) return;

      if (state.status === 'unreachable') {
        close();
        return;
      }
      if (state.status === 'gone' || state.liked || state.ownListing) {
        answer(listingId);
        return;
      }
      // The heart's own rule (`mayPressHeart`) answers whether a press is allowed, including a press that
      // empties a heart. This card only ever adds a like, so it asks the narrower question: a guest needs
      // a server that takes one. The operator can switch that on, so it is not an answer either.
      if (!AuthService.isAuthenticated() && !state.anonymousLikes) {
        close();
        return;
      }

      setPhase('asking');
    })();

    return () => { current = false; };
    // The callbacks are stable for a given listing; re-reading on every render would loop the request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listingId]);

  if (!listingId || phase === 'reading' || phase === 'closed') return null;

  const like = async () => {
    setPhase('sending');
    try {
      if (AuthService.isAuthenticated()) await WorldStorageService.setRemoteWorldLiked(listingId, true);
      else await WorldStorageService.setAnonymousWorldLiked(listingId, true);
      if (mountedRef.current) answer(listingId);
      return;
    } catch (error) {
      if (!mountedRef.current) return;

      // One map over the refusal codes, shared with the heart in Community Creations, so the two never
      // disagree about what a code means. What each answer costs here is this card's own: `silent` covers
      // the guards a player cannot act on, and those are answers.
      if (error instanceof AnonymousLikeRefused) {
        switch (refusalAnswer(error.code)) {
          case 'silent':
            answer(listingId);
            return;
          case 'cap':
            toast.info(`${ADDRESS_CAP_REACHED} Log in from the main menu to add yours.`);
            close();
            return;
          // The operator switched the feature off since the read. There is no sign-in here to send the
          // guest to, so the card goes quietly and a later turn asks again.
          case 'signIn':
            close();
            return;
        }
      }

      toast.error("That like didn't send. Try again on a later turn.");
      close();
    }
  };

  return (
    <div
      role="group"
      aria-label="Like this world"
      data-testid="like-prompt"
      className={cn(
        'flex flex-col sm:flex-row sm:items-center gap-3 rounded-lg border bg-card px-4 py-3 shadow-sm',
        'animate-in fade-in slide-in-from-bottom-1 motion-reduce:animate-none',
        className,
      )}
    >
      <span className="hidden sm:flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
        <Heart className="h-6 w-6" aria-hidden />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-label font-semibold truncate">Enjoying {worldName}?</span>
        <span className="block text-meta text-muted-foreground">Give it a like so the author knows</span>
      </span>
      <div className="flex shrink-0 gap-2">
        <Button variant="outline" size="sm" onClick={() => answer(listingId)}>Not Now</Button>
        <Button size="sm" disabled={phase === 'sending'} onClick={like}>
          <Heart className="mr-2 h-4 w-4" aria-hidden />
          Like
        </Button>
      </div>
    </div>
  );
}
