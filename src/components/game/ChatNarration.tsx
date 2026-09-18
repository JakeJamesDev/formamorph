import React, { useEffect, useMemo, useRef } from 'react';
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
import { ReasoningBlock } from './ReasoningBlock';
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
 * right and the narration as a full-width block. Opens at the latest turn.
 */
export function ChatNarration({ parseAssistantMessage }: { parseAssistantMessage: (content: string) => string }) {
  const { fullMessageHistory, isRevealingNarration, sceneImages } = useGameplay();
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

  // A new game opens at the bottom, re-aimed until it holds while the turns above it measure.
  const gameKey = fullMessageHistory[1]?.content ?? null;
  useEffect(() => {
    if (gameKey === null) return;
    let frame = 0;
    let tries = 0;
    let stable = 0;
    const aim = () => {
      const el = scroller.current;
      if (!el) return;
      const last = turnsRef.current.length - 1;
      if (!el.querySelector(`[data-index="${last}"]`)) {
        stable = 0;
        virtualizer.scrollToIndex(last, { align: 'end' });
      } else {
        const bottom = el.scrollHeight - el.clientHeight;
        if (Math.abs(el.scrollTop - bottom) < 2) stable += 1;
        else { stable = 0; el.scrollTop = bottom; }
      }
      if (stable < 3 && ++tries < MAX_AIM_FRAMES) frame = requestAnimationFrame(aim);
    };
    aim();
    return () => cancelAnimationFrame(frame);
  }, [gameKey, virtualizer]);

  const items = virtualizer.getVirtualItems();
  const before = items.length ? items[0].start : 0;
  const after = items.length ? virtualizer.getTotalSize() - items[items.length - 1].end : 0;
  const lastIndex = turns.length - 1;

  return (
    <div ref={scroller} data-chat-scroller className="min-h-0 flex-grow overflow-y-auto [overflow-anchor:auto]">
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
                </div>
              )}
            </article>
          );
        })}
        <div style={{ height: after, overflowAnchor: 'none' }} />
      </div>
    </div>
  );
}
