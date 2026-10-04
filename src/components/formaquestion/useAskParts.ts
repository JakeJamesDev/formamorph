import { useEffect, useRef, useState, type KeyboardEvent, type UIEvent } from 'react';
import { showsScrollArrow } from '@/lib/formaquestion/windowBox';
import type { HelpChat, HelpExchange } from './useHelpChat';

/** How near the end, in pixels, the conversation must be for new text to keep it at the end. */
const FOLLOW_SLACK = 48;

/**
 * Keeps the conversation's scroller at the end: a new question goes there, and a growing answer stays
 * there unless the player scrolled up. `away` drives the scroll arrow, and `toEnd` resumes following.
 */
export function useFollowEnd(exchanges: readonly HelpExchange[]) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const following = useRef(true);
  const [away, setAway] = useState(false);
  const last = exchanges.at(-1);
  useEffect(() => { following.current = true; }, [exchanges.length]);
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    if (following.current) viewport.scrollTop = viewport.scrollHeight;
    setAway(showsScrollArrow(viewport));
  }, [exchanges.length, last?.answer, last?.reasoning, last?.status]);
  const onScroll = (event: UIEvent<HTMLDivElement>) => {
    const viewport = event.currentTarget;
    const { scrollHeight, scrollTop, clientHeight } = viewport;
    following.current = scrollHeight - scrollTop - clientHeight <= FOLLOW_SLACK;
    setAway(showsScrollArrow(viewport));
  };
  const toEnd = () => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    following.current = true;
    viewport.scrollTop = viewport.scrollHeight;
    setAway(false);
  };
  return { viewportRef, onScroll, away, toEnd };
}

/** The ask field's sending: the draft goes to the chat on Send or Enter, while no question runs and no turn holds it. */
export function useAskSend(draft: string, onDraftChange: (text: string) => void, chat: HelpChat) {
  const question = draft.trim();
  const canSend = !chat.busy && !chat.held && question.length > 0;
  const send = () => {
    if (!canSend) return;
    chat.ask(question);
    onDraftChange('');
  };
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter sends. Shift+Enter, and Enter that confirms composed text, add to the question.
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    send();
  };
  return { canSend, send, onKeyDown };
}

/** The line under the ask field while a game turn holds it. */
export const HELD_LINE = 'Wait for the game turn to finish to send a question';
