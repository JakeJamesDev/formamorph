import React, { useEffect, useMemo, useRef } from 'react';
import { ArrowDown } from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useGameplay } from '@/contexts/GameplayContext';
import { useSettings } from '@/contexts/SettingsContext';
import { useGameplayText } from '@/lib/gameplayTextStore';
import { useLiveReasoning } from '@/lib/reasoningStreamStore';
import { revealActive, revealAnimName, revealVars } from '@/lib/narrationRevealConfig';
import { parseTurnContent } from '@/lib/turnDigest';
import { parseSavedReasoning, type SavedReasoning } from '@/lib/savedReasoning';
import { dataUrlImageSize } from '@/lib/imageBytes';
import { MarkdownRenderer } from './MarkdownRenderer';
import { useChatPin } from './useChatPin';
import { useReadingLine } from './useReadingLine';
import { READING_LINE } from '@/lib/chatReadingLine';
import { ReasoningBlock } from './ReasoningBlock';
import { BubbleActionRow } from './BubbleActionRow';
import type { BubbleAction } from '@/lib/bubbleActions';
import type { ChatMessage } from '@/types';

// A first guess at a turn's height, until it mounts and measures.
const ESTIMATED_TURN_PX = 400;
// Open-at-bottom gives up after this many frames if the bottom never holds.
const MAX_AIM_FRAMES = 30;
// Scene images show at most this tall, as in Pages (`max-h-72`).
const IMAGE_MAX_REM = 18;

/** One turn of the list: the player's action (null on the opening) and the narration message, once it exists. */
interface ChatTurn {
  action: string | null;
  narration?: ChatMessage;
  turnId?: string;
  reasoning: SavedReasoning | null;
}

/** What the panel needs to build one narration bubble's actions. `text` is the narration's markdown source. */
export interface ChatBubbleTurn {
  index: number;
  isLatest: boolean;
  live: boolean;
  hasImage: boolean;
  text: string;
}

/** The flat history as turns of two messages: the action, then the narration that answers it. */
function chatTurns(history: ChatMessage[]): ChatTurn[] {
  const turns: ChatTurn[] = [];
  for (let i = 0; i * 2 < history.length; i++) {
    const narration = history[i * 2 + 1];
    turns.push({
      // The opening's action is the hidden "START GAME" proxy, not something the player wrote.
      action: i === 0 ? null : (history[i * 2]?.content ?? null),
      narration,
      turnId: narration ? parseTurnContent(narration.content)?.turnId : undefined,
      reasoning: narration ? parseSavedReasoning(narration.content) : null,
    });
  }
  return turns;
}

/** A scene image in a box sized from its header, so the text below does not move when it decodes. */
function InlineSceneImage({ src }: { src: string }) {
  const size = useMemo(() => dataUrlImageSize(src), [src]);
  const ratio = size ? size.width / size.height : 1;
  return (
    <div
      className="mx-auto max-w-full overflow-hidden rounded-md border bg-muted"
      style={{ aspectRatio: size ? `${size.width} / ${size.height}` : '1 / 1', width: `min(100%, ${IMAGE_MAX_REM * ratio}rem)` }}
    >
      <img src={src} alt="Scene illustration" className="h-full w-full object-contain" />
    </div>
  );
}

/**
 * The Chat body of the narration panel: every turn in one virtualized list, the action as a bubble on the
 * right and the narration as a full-width block. Opens at the latest turn. `latestFooter` renders under the
 * latest turn's narration.
 */
export function ChatNarration({ parseAssistantMessage, latestFooter, actionsFor }: {
  parseAssistantMessage: (content: string) => string;
  latestFooter?: React.ReactNode;
  /** The actions of one committed narration bubble. */
  actionsFor?: (turn: ChatBubbleTurn) => BubbleAction[];
}) {
  const { fullMessageHistory, isRevealingNarration, isWaitingForAI, sceneImages, currentPage, totalPages, setUserPage } = useGameplay();
  const { revealSpec, revealEasing, showReasoning } = useSettings();
  const gameplayText = useGameplayText();
  const liveReasoning = useLiveReasoning();
  const revealOn = revealActive(revealSpec);
  const revealAnim = revealAnimName(revealSpec);
  const revealStyle = revealVars(revealSpec) as React.CSSProperties;

  const turns = useMemo(() => chatTurns(fullMessageHistory), [fullMessageHistory]);
  const turnsRef = useRef(turns);
  turnsRef.current = turns;
  const scroller = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: turns.length,
    getScrollElement: () => scroller.current,
    estimateSize: () => ESTIMATED_TURN_PX,
    overscan: 3,
    // Keyed by index: a turn keeps its key while its narration arrives, so its measured size carries over.
    // A measure inside a ref callback cannot flush, and React warns on each one.
    useFlushSync: false,
  });
  // Native scroll anchoring corrects for turns in flow; a second correction would interrupt a wheel scroll.
  virtualizer.shouldAdjustScrollPositionOnItemSizeChange = () => false;

  // The past turn the panels show at mount, so a switch from Pages opens on it; null follows the latest.
  const openTurn = useRef(currentPage < totalPages ? currentPage - 1 : null);
  // True while the open aim places the list, so the barrier drops its scrolls.
  const opening = useRef(false);

  // A game opens at the bottom, or with a past viewed turn on the reading line, re-aimed until it holds
  // while the turns above it measure.
  const gameKey = fullMessageHistory[1]?.content ?? null;
  useEffect(() => {
    if (gameKey === null) return;
    const target = openTurn.current;
    openTurn.current = null;
    let frame = 0;
    let tries = 0;
    let stable = 0;
    const aim = () => {
      const el = scroller.current;
      if (!el) { opening.current = false; return; }
      const index = target ?? turnsRef.current.length - 1;
      const turn = el.querySelector(`[data-index="${index}"]`);
      if (!turn) {
        stable = 0;
        virtualizer.scrollToIndex(index, { align: target === null ? 'end' : 'start' });
      } else {
        const max = el.scrollHeight - el.clientHeight;
        const offset = el.scrollTop + turn.getBoundingClientRect().top - el.getBoundingClientRect().top;
        const goal = target === null ? max : Math.min(max, Math.max(0, offset - el.clientHeight * READING_LINE));
        if (Math.abs(el.scrollTop - goal) < 2) stable += 1;
        else { stable = 0; el.scrollTop = goal; }
      }
      if (stable < 3 && ++tries < MAX_AIM_FRAMES) frame = requestAnimationFrame(aim);
      else opening.current = false;
    };
    opening.current = true;
    aim();
    return () => { cancelAnimationFrame(frame); opening.current = false; };
  }, [gameKey, virtualizer]);

  const items = virtualizer.getVirtualItems();
  const before = items.length ? items[0].start : 0;
  const after = items.length ? virtualizer.getTotalSize() - items[items.length - 1].end : 0;
  const lastIndex = turns.length - 1;
  const { pinnedIndex, showJump, jumpToLatest, isProgrammaticScroll } = useChatPin({
    scroller, virtualizer, history: fullMessageHistory, gameKey, lastIndex,
  });
  // The barrier writes the same page state as the Pager: the latest turn follows (null), a past one pins.
  useReadingLine(scroller, {
    viewedIndex: currentPage - 1,
    latestIndex: lastIndex,
    onViewedTurn: (index) => setUserPage(index >= lastIndex ? null : index + 1),
    isProgrammaticScroll,
    isPlacing: () => opening.current,
  });
  const streaming = isWaitingForAI || isRevealingNarration;

  return (
    <div className="relative flex min-h-0 flex-grow flex-col">
      <div ref={scroller} data-chat-scroller className="min-h-0 flex-grow overflow-y-auto [container-type:size] [overflow-anchor:auto]">
        <div className="mx-auto max-w-3xl px-2">
          <div style={{ height: before, overflowAnchor: 'none' }} />
          {items.map((item) => {
            const turn = turns[item.index];
            const isLatest = item.index === lastIndex;
            const liveReveal = isLatest && isRevealingNarration && !!turn.narration;
            const reasoningLive = isLatest && !!liveReasoning.text;
            const reasoning = reasoningLive ? liveReasoning : turn.reasoning;
            const narrationText = liveReveal ? gameplayText : turn.narration ? parseAssistantMessage(turn.narration.content) : '';
            const images = (!liveReveal && turn.turnId && sceneImages[turn.turnId]) || [];
            return (
              <article
                key={item.key}
                data-index={item.index}
                ref={virtualizer.measureElement}
                aria-label={`Turn ${item.index + 1}`}
                className="flow-root py-3"
                style={{
                  // The submitted turn fills the viewport, so the list is tall enough to pin its top. The unit
                  // follows the scroller in the same layout, so a resize never clamps the pinned offset.
                  minHeight: item.index === pinnedIndex ? '100cqh' : undefined,
                  // A streaming turn only grows at its end; an anchor inside it would drag the view along.
                  overflowAnchor: isLatest && streaming ? 'none' : undefined,
                }}
              >
                {turn.action !== null && (
                  // No dialogue color: the quote color loses contrast on the primary fill.
                  <div className="mb-3 ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-primary-foreground">
                    <MarkdownRenderer text={turn.action} />
                  </div>
                )}
                {(turn.narration || (showReasoning && reasoning?.text)) && (
                  <div className="rounded-lg border border-border bg-card px-3.5 py-2.5" style={revealStyle}>
                    {showReasoning && reasoning?.text && (
                      <ReasoningBlock text={reasoning.text} ms={reasoning.ms} active={reasoningLive && liveReasoning.active} />
                    )}
                    {turn.narration && (
                      <div data-testid="narration">
                        {/* Streamdown memoizes on source position, not text, so committed text keys by its content. */}
                        <MarkdownRenderer
                          key={liveReveal ? 'live' : `committed:${narrationText}`}
                          text={narrationText}
                          animate={liveReveal && revealOn}
                          animation={revealAnim}
                          easing={revealEasing}
                          dialogue
                        />
                      </div>
                    )}
                    {images.length > 0 && (
                      <div className="mt-2.5 flex flex-col gap-2">
                        {images.map((src, i) => <InlineSceneImage key={i} src={src} />)}
                      </div>
                    )}
                    {turn.narration && actionsFor && (() => {
                      const actions = actionsFor({ index: item.index, isLatest, live: liveReveal, hasImage: images.length > 0, text: narrationText });
                      return actions.length > 0 && <BubbleActionRow turnNumber={item.index + 1} actions={actions} />;
                    })()}
                  </div>
                )}
                {isLatest && latestFooter}
                <div data-content-end />
              </article>
            );
          })}
          <div style={{ height: after, overflowAnchor: 'none' }} />
        </div>
      </div>
      {showJump && (
        <button
          type="button"
          onClick={jumpToLatest}
          className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-meta shadow-md hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        >
          <ArrowDown className="h-4 w-4" aria-hidden />
          <span>Jump to Latest</span>
          {streaming && <span className="text-muted-foreground">· New Text Below</span>}
        </button>
      )}
    </div>
  );
}
