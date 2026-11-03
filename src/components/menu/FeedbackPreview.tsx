import { useContext, useEffect, useMemo, useState } from 'react';
import { MarkdownRenderer } from '@/components/game/MarkdownRenderer';
import { parseFeedbackLinks } from '@/lib/feedbackLinks';
import FeedbackService from '@/services/FeedbackService';
import type { FeedbackLinkTarget } from '@/types';
import { FeedbackLinkContext, FeedbackMarkdown, type FeedbackLinkPlace } from './FeedbackMarkdown';

/**
 * The Preview of a comment box: plain markdown, then chips once the server resolves the text.
 *
 * The request runs once per mount, and a pane mounts each time it opens. Text changed since then stays plain.
 * `threadOpensAbove` says the surface's `openThread` opens above the box, so it keeps the draft and stays.
 */
export function FeedbackPreview({ text, threadOpensAbove = false }: { text: string; threadOpensAbove?: boolean }) {
  const place = useContext(FeedbackLinkContext);
  const [openedText] = useState(text);
  const [targets, setTargets] = useState<FeedbackLinkTarget[] | null>(null);

  useEffect(() => {
    if (parseFeedbackLinks(openedText).length === 0) return;
    const request = new AbortController();
    FeedbackService.resolveLinks(openedText, request.signal)
      .then((resolved) => { if (!request.signal.aborted) setTargets(resolved); })
      // Preview stays plain.
      .catch(() => {});
    return () => request.abort();
  }, [openedText]);

  const draftPlace = useMemo<FeedbackLinkPlace>(() => ({
    ...place,
    keepsDraft: true,
    openThread: threadOpensAbove ? place.openThread : undefined,
    openListing: undefined,
  }), [place, threadOpensAbove]);

  if (!targets || text !== openedText) return <MarkdownRenderer text={text} />;
  return (
    <FeedbackLinkContext.Provider value={draftPlace}>
      <FeedbackMarkdown text={text} targets={targets} />
    </FeedbackLinkContext.Provider>
  );
}

/** The listing comment box's Preview: its thread opener is the Feedback dialog, above the modal. */
export function ListingCommentPreview({ text }: { text: string }) {
  return <FeedbackPreview text={text} threadOpensAbove />;
}
