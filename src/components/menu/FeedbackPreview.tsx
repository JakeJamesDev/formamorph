import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { parseFeedbackLinks, type FeedbackLink, type FeedbackLinkPlace } from '@/lib/feedbackLinks';
import FeedbackService from '@/services/FeedbackService';
import type { FeedbackLinkTarget } from '@/types';
import { FeedbackLinkContext, FeedbackMarkdown } from './FeedbackMarkdown';

/** How long typing must pause before the links it finished are looked up. */
export const PREVIEW_LOOKUP_PAUSE_MS = 500;

const keyOf = ({ kind, ref }: { kind: string; ref: string }) => `${kind}:${ref}`;

/**
 * The Preview of a comment box: markdown with chips for the links the server has answered for, and every other
 * link as typed. Opening asks for all the links; after that, a pause asks for each new one that text follows.
 */
export function FeedbackPreview({ text }: { text: string }) {
  const place = useContext(FeedbackLinkContext);
  const [targets, setTargets] = useState<FeedbackLinkTarget[]>([]);
  const opened = useRef(false);
  const asked = useRef(new Set<string>());
  const lifetime = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    lifetime.current = controller;
    const askedLinks = asked.current;
    return () => {
      controller.abort();
      opened.current = false;
      askedLinks.clear();
    };
  }, []);

  useEffect(() => {
    const links = parseFeedbackLinks(text);
    const ask = (source: string, wanted: FeedbackLink[]) => {
      const signal = lifetime.current?.signal;
      wanted.forEach((link) => asked.current.add(keyOf(link)));
      FeedbackService.resolveLinks(source, signal)
        .then((resolved) => {
          if (signal?.aborted) return;
          const answered = new Set(resolved.map(keyOf));
          setTargets((current) => [...current.filter((target) => !answered.has(keyOf(target))), ...resolved]);
        })
        // A link that failed stays as typed until the pane opens again.
        .catch(() => {});
    };

    if (!opened.current) {
      opened.current = true;
      if (links.length > 0) ask(text, links);
      return;
    }
    const timer = setTimeout(() => {
      const fresh = links.filter((link) => link.end < text.length && !asked.current.has(keyOf(link)));
      if (fresh.length > 0) ask(fresh.map((link) => text.slice(link.start, link.end)).join(' '), fresh);
    }, PREVIEW_LOOKUP_PAUSE_MS);
    return () => clearTimeout(timer);
  }, [text]);

  const draftPlace = useMemo<FeedbackLinkPlace>(() => ({
    ...place,
    staysOnPage: true,
    openThread: place.threadOpensAbove ? place.openThread : undefined,
    openListing: undefined,
  }), [place]);

  return (
    <FeedbackLinkContext.Provider value={draftPlace}>
      <FeedbackMarkdown text={text} targets={targets} typedUntilResolved />
    </FeedbackLinkContext.Provider>
  );
}
