import { useEffect, useRef, useState } from "react";
import { ChevronUp } from "lucide-react";
import { FEEDBACK_SEARCH_DELAY_MS } from "@/components/menu/FeedbackSearchInput";
import { FEEDBACK_STATUS_STYLES } from "@/lib/feedbackPresentation";
import { useMountedRef } from "@/lib/useMountedRef";
import { cn } from "@/lib/utils";
import FeedbackService from "@/services/FeedbackService";
import type { FeedbackThread } from "@/types";

/** Trimmed title length before the list searches. */
export const SIMILAR_MIN_CHARS = 3;
/** How many matches the list shows. */
export const SIMILAR_LIMIT = 5;

interface SimilarQuestionsProps {
  /** The draft title, searched as typed. */
  title: string;
  /** Opens one match. */
  onOpen: (id: string) => void;
  /** Bumped by the caller to search the same title again, so counts stay current after an opened match closes. */
  refreshKey?: number;
}

/** Questions that match the draft title, listed under the title field so a player can find an existing one. */
export function SimilarQuestions({ title, onOpen, refreshKey = 0 }: SimilarQuestionsProps) {
  const [matches, setMatches] = useState<FeedbackThread[]>([]);
  const mounted = useMountedRef();
  // Only the newest request may write the list; an older one that resolves late is dropped.
  const latest = useRef(0);

  const term = title.trim();

  useEffect(() => {
    const request = ++latest.current;
    if (term.length < SIMILAR_MIN_CHARS) {
      setMatches([]);
      return;
    }
    const timer = setTimeout(() => {
      FeedbackService.list({ type: 'question', scope: 'all', search: term, limit: SIMILAR_LIMIT })
        .then(({ threads }) => {
          if (mounted.current && request === latest.current) setMatches(threads);
        })
        .catch(() => {
          if (mounted.current && request === latest.current) setMatches([]);
        });
    }, FEEDBACK_SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [term, refreshKey, mounted]);

  if (!matches.length) return null;

  return (
    <section aria-labelledby="similarQuestionsHeading" className="space-y-1">
      <h3 id="similarQuestionsHeading" className="text-meta font-medium text-muted-foreground">Similar Questions</h3>
      <ul className="divide-y rounded-md border">
        {matches.map((thread) => {
          const style = FEEDBACK_STATUS_STYLES[thread.status];
          return (
            <li key={thread.id}>
              <button
                type="button"
                onClick={() => onOpen(thread.id)}
                className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-accent/50 min-w-0"
              >
                <span
                  className={cn('flex shrink-0 items-center gap-0.5 text-meta tabular-nums text-muted-foreground', thread.voted && 'text-primary font-bold')}
                  aria-label={thread.votes === 1 ? '1 vote' : `${thread.votes} votes`}
                >
                  <ChevronUp className={cn('h-3 w-3', thread.voted && 'fill-current')} />
                  {thread.votes}
                </span>
                <span className="flex-1 truncate text-label">{thread.title}</span>
                <span className={cn('shrink-0 px-2 inline-flex text-meta leading-5 font-semibold rounded-full', style.badge)}>
                  {style.label}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
