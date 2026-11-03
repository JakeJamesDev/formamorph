import { useContext, useEffect, useMemo, useState } from 'react';
import { MarkdownRenderer } from '@/components/game/MarkdownRenderer';
import { parseFeedbackLinks, type FeedbackLinkPlace } from '@/lib/feedbackLinks';
import FeedbackService from '@/services/FeedbackService';
import type { FeedbackLinkTarget } from '@/types';
import { FeedbackLinkContext, FeedbackMarkdown } from './FeedbackMarkdown';

/** The Preview of a comment box: plain markdown, then chips for the text as it stood when the pane opened. */
export function FeedbackPreview({ text }: { text: string }) {
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
    staysOnPage: true,
    openThread: place.threadOpensAbove ? place.openThread : undefined,
    openListing: undefined,
  }), [place]);

  if (!targets || text !== openedText) return <MarkdownRenderer text={text} />;
  return (
    <FeedbackLinkContext.Provider value={draftPlace}>
      <FeedbackMarkdown text={text} targets={targets} />
    </FeedbackLinkContext.Provider>
  );
}
