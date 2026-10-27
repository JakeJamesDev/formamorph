import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { MyFeedbackSection } from '@/components/menu/MyFeedbackSection';
import { FeedbackThreadView } from '@/components/menu/FeedbackThreadView';
import type { FeedbackTab } from '@/components/menu/feedbackTabs';
import { UserProfileContext, type UserProfileContextValue } from '@/contexts/userProfileStore';
import { WEBSITE_FEEDBACK_CAPABILITIES, type FeedbackNotify } from '@/lib/feedbackCapabilities';
import { DetailedError } from '@/lib/errorDetails';
import AuthService from '@/services/AuthService';
import type { FeedbackThread } from '@/types';
import { Button } from '@/components/ui/button';
import { leaveTo } from '../leaveSite';
import { signInTo } from '../nextPath';
import { navigateSite, replaceSite, useSiteLocation } from '../router';
import {
  DEFAULT_FEEDBACK_BOARD, feedbackBoardPath, feedbackTarget, feedbackThreadPath,
  type FeedbackBoard, type FeedbackTarget,
} from '../feedbackPath';
import { NoteLine, type Note } from '../components/NoteLine';
import { SiteAgeGate } from '../components/SiteAgeGate';
import { SiteLayout } from '../components/SiteLayout';
import { NotFoundPage } from './NotFoundPage';

/** The board a thread of this type is listed on. */
const boardOf = (thread: FeedbackThread): FeedbackBoard =>
  thread.type === 'question' ? 'questions' : DEFAULT_FEEDBACK_BOARD;

const here = () => `${window.location.pathname}${window.location.search}`;

/** A name opens the site's own profile page. */
const PROFILE_LINKS: UserProfileContextValue = {
  openProfile: (_userId, username) => { if (username) leaveTo(`/u/${encodeURIComponent(username)}`); },
  setListingOpener: () => {},
};

/** The Votable boards, read-only for a guest. The warning gate stays outside, so nothing fetches before it. */
export function FeedbackPage() {
  const { pathname, search } = useSiteLocation();
  const target = feedbackTarget(pathname, search);

  if (target.status === 'invalid') return <NotFoundPage />;

  return (
    <SiteAgeGate>
      <FeedbackSession target={target} />
    </SiteAgeGate>
  );
}

/** Remounts the board on every session change, so a sign-out reads as a guest at once. */
function FeedbackSession({ target }: { target: Exclude<FeedbackTarget, { status: 'invalid' }> }) {
  const [token, setToken] = useState(AuthService.token);
  useEffect(() => AuthService.onSessionChanged(() => setToken(AuthService.token)), []);

  return <FeedbackBoardPage key={token ?? 'guest'} target={target} guest={!token} />;
}

interface FeedbackBoardPageProps {
  target: Exclude<FeedbackTarget, { status: 'invalid' }>;
  guest: boolean;
}

function FeedbackBoardPage({ target, guest }: FeedbackBoardPageProps) {
  const [board, setBoard] = useState<FeedbackBoard>(target.status === 'board' ? target.board : DEFAULT_FEEDBACK_BOARD);
  const [missing, setMissing] = useState<string | null>(null);
  // The server refused a guest read: it predates guest reads.
  const [refused, setRefused] = useState(false);
  const [note, setNote] = useState<Note>(null);
  // Back from a thread opened off the board is the browser's Back; from a direct link it is the thread's board.
  const openedFromBoard = useRef(false);
  const boardScroll = useRef<number | null>(null);

  const threadId = target.status === 'thread' ? target.id : null;

  const targetBoard = target.status === 'board' ? target.board : null;
  useEffect(() => {
    if (targetBoard) setBoard(targetBoard);
  }, [targetBoard]);

  // Before paint, so the board never shows at the thread's offset first.
  useLayoutEffect(() => {
    if (threadId) {
      window.scrollTo(0, 0);
    } else if (boardScroll.current !== null) {
      window.scrollTo(0, boardScroll.current);
      boardScroll.current = null;
    }
  }, [threadId]);

  const notify = useCallback<FeedbackNotify>((message, kind, error) => {
    if (error instanceof DetailedError && error.status === 401) {
      // The server reads any token as a sign-in, so a stale one is cleared and the board reloads as a guest once.
      if (AuthService.token) AuthService.logout();
      else setRefused(true);
      return;
    }
    setNote({ kind, text: message });
  }, []);

  const signInHere = useCallback(() => leaveTo(signInTo(here())), []);

  const openThread = useCallback((id: string) => {
    openedFromBoard.current = true;
    boardScroll.current = window.scrollY;
    setNote(null);
    navigateSite(feedbackThreadPath(id));
  }, []);

  const changeBoard = useCallback((tab: FeedbackTab) => {
    if (tab === 'suggestions' || tab === 'questions') replaceSite(feedbackBoardPath(tab));
  }, []);
  const tabControl = useMemo(() => ({ tab: board, onTabChange: changeBoard }), [board, changeBoard]);

  const back = useCallback(() => {
    if (openedFromBoard.current) {
      openedFromBoard.current = false;
      window.history.back();
    } else {
      navigateSite(feedbackBoardPath(board));
    }
  }, [board]);

  const loaded = useCallback((thread: FeedbackThread) => setBoard(boardOf(thread)), []);

  const unavailable = useCallback(() => {
    if (threadId) setMissing(threadId);
  }, [threadId]);

  if (threadId && missing === threadId) return <NotFoundPage />;

  return (
    <UserProfileContext.Provider value={PROFILE_LINKS}>
      <SiteLayout surface>
        <div className="mx-auto w-full max-w-[900px] px-4 py-8 sm:px-6">
          <h1 className="text-display font-semibold tracking-tight">Feedback</h1>
          <p className="mt-2 text-body text-muted-foreground">Suggestions and questions from Formamorph players.</p>

          <div className="mt-4"><NoteLine note={note} /></div>

          {refused ? (
            <div className="mt-6 space-y-4 rounded-xl border border-border bg-card p-6">
              <p className="text-body">Sign in to read suggestions and questions.</p>
              <Button asChild><a href={signInTo(here())}>Sign In</a></Button>
            </div>
          ) : (
            <>
              {threadId && (
                <FeedbackThreadView
                  key={threadId}
                  threadId={threadId}
                  onBack={back}
                  notify={notify}
                  capabilities={WEBSITE_FEEDBACK_CAPABILITIES}
                  onGuestWrite={guest ? signInHere : undefined}
                  onLoaded={loaded}
                  onUnavailable={unavailable}
                />
              )}
              {/* Hidden, not unmounted, under an open thread: Back returns to the same search, filters and page. */}
              <div hidden={threadId !== null}>
                <MyFeedbackSection
                  active={threadId === null}
                  notify={notify}
                  capabilities={WEBSITE_FEEDBACK_CAPABILITIES}
                  onGuestWrite={guest ? signInHere : undefined}
                  tabControl={tabControl}
                  onOpenThread={openThread}
                />
              </div>
            </>
          )}
        </div>
      </SiteLayout>
    </UserProfileContext.Provider>
  );
}

