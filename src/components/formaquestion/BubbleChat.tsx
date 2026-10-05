import { useCallback, useEffect, useId, useLayoutEffect, useRef, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { AttachmentThumbs } from '@/components/game/AttachmentThumbs';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tip } from '@/components/ui/tooltip';
import { Hint } from '@/components/ui/typography';
import type { SurfaceRoute } from '@/lib/surface/surfaceRoute';
import type { BubbleHeights, BubbleLayout, BubbleTail, GripCorner } from '@/lib/formaquestion/bubbleLayout';
import type { Guide } from '@/lib/formaquestion/guide';
import type { HelpSettings, HelpSettingsChange } from '@/lib/formaquestion/helpSettings';
import type { WindowBox } from '@/lib/formaquestion/windowBox';
import { cn } from '@/lib/utils';
import { AnswerBody, AnswerToggles } from './AskParts';
import { BUBBLE, FLOATING, TOP_FADE } from './floatingPieces';
import { AskPill, Pill, type HeadToggle, type MenuProps } from './MinimalChat';
import { useAnswerFolds } from './useAnswerFolds';
import type { BubblePage } from './useBubblePage';
import { usePillFade, type PillFadeProps } from './usePillFade';
import { ScrollArrow } from './ScrollArrow';
import { useFollowEnd } from './useAskParts';
import type { HelpChat, HelpExchange } from './useHelpChat';
import type { DragHandlers } from './usePointerDrag';

/** The assistant bubble's surface, with no tail corner: the tail is its own piece. */
const ANSWER_SURFACE = cn(FLOATING, 'rounded-2xl border bg-popover text-label text-popover-foreground');
/** The pill's surface, for the strip's controls. */
const STRIP_SURFACE = cn(FLOATING, 'flex items-center rounded-full border bg-background');
/** A paging chevron: a round button that takes no press while disabled. */
const CHEVRON = cn(STRIP_SURFACE, 'h-8 w-8 shrink-0 justify-center text-muted-foreground hover:text-foreground disabled:pointer-events-none disabled:opacity-50');
const TAIL_SIZE = 14;

/** Each tail is a square turned 45°: the two edges that meet at the point carry the border. */
const TAIL_EDGES: Record<BubbleTail['points'], string> = {
  right: 'border-r border-t',
  left: 'border-b border-l',
  down: 'border-b border-r',
};

/** A corner grip: the drag area on the corner of its box, with an L mark that opens toward the box. A `fade` makes it fade with the pill. */
function Grip({ corner, handlers, name, fade }: { corner: GripCorner; handlers: DragHandlers; name: string; fade?: PillFadeProps | null }) {
  const { className: fadeClass, ...fading } = fade ?? {};
  return (
    <div {...{ [`data-fq-${name}`]: corner }} aria-hidden {...handlers} {...fading} className={cn('pointer-events-auto absolute z-10 h-5 w-5 touch-none', GRIP_PLACE[corner], fadeClass)}>
      <span className={cn('absolute h-2 w-2 border-muted-foreground/60', GRIP_MARK[corner])} />
    </div>
  );
}

const GRIP_PLACE: Record<GripCorner, string> = {
  nw: '-left-1 -top-1 cursor-nwse-resize',
  ne: '-right-1 -top-1 cursor-nesw-resize',
  sw: '-bottom-1 -left-1 cursor-nesw-resize',
  se: '-bottom-1 -right-1 cursor-nwse-resize',
};
const GRIP_MARK: Record<GripCorner, string> = {
  nw: 'left-1 top-1 border-l-2 border-t-2',
  ne: 'right-1 top-1 border-r-2 border-t-2',
  sw: 'bottom-1 left-1 border-b-2 border-l-2',
  se: 'bottom-1 right-1 border-b-2 border-r-2',
};

type Place = (box: WindowBox, sized?: boolean) => CSSProperties;

/**
 * The bubble with its tail, and the strip under it: the paging chevrons at both ends, and between them the
 * answer's Thinking toggle, its Sources popover and Take Me There (Q14, Q22). The bubble and the strip share the folds. Without
 * an exchange the bubble shows only the guide's load state, and no strip draws.
 */
function Speech({ layout, place, page, exchange, guide, failed, onRetry, chat, settings, onSettingsChange, onOpen, onGo, resize, contentRef }: {
  layout: BubbleLayout;
  place: Place;
  page: BubblePage;
  exchange: HelpExchange | undefined;
  guide: Guide | null;
  failed: boolean;
  onRetry: () => void;
  chat: HelpChat;
  settings: HelpSettings;
  onSettingsChange: (change: HelpSettingsChange) => void;
  onOpen: (id: string) => void;
  onGo: (route: SurfaceRoute) => void;
  resize: DragHandlers;
  contentRef: RefObject<HTMLDivElement>;
}) {
  const folds = useAnswerFolds(exchange, settings, onSettingsChange);
  // The bubble follows an answer as it streams, and opens a finished answer at its top.
  const { viewportRef, onScroll, away, toEnd } = useFollowEnd(exchange ? [exchange] : []);
  const writing = useRef(exchange?.status === 'writing');
  // Keyed per exchange, so this runs once per page, after the follow effect's scroll to the end.
  useEffect(() => {
    if (!writing.current && viewportRef.current) viewportRef.current.scrollTop = 0;
  }, [viewportRef]);
  const waitingId = useId();
  const { group, tail, grip } = layout;
  return (
    <>
      {/* Drawn before the bubble, so the bubble covers its inner half and it never covers the text or the scroll bar. */}
      <span
        aria-hidden
        data-fq-tail={tail.points}
        className={cn('pointer-events-none absolute rotate-45 bg-popover', TAIL_EDGES[tail.points])}
        style={{ left: tail.x - group.x - TAIL_SIZE / 2, top: tail.y - group.y - TAIL_SIZE / 2, width: TAIL_SIZE, height: TAIL_SIZE }}
      />
      {/* A long answer's bubble fades out at the top, box and all, as Minimal's bubbles do; the padding keeps its first line clear of the fade. */}
      <div data-fq-piece="bubble" className={cn(ANSWER_SURFACE, layout.scrolls && TOP_FADE)} style={place(layout.bubble)}>
        <ScrollArea
          className="h-full rounded-2xl"
          viewportRef={viewportRef}
          viewportProps={{ 'data-fq-scroll': 'conversation', onScroll }}
        >
          <div ref={contentRef} role="log" aria-label="Conversation" aria-busy={page.newest && chat.busy} className={cn('px-3 py-2', layout.scrolls && 'pt-8')}>
            {!guide && (failed ? (
              <div role="alert" className="flex flex-col items-start gap-2">
                <span>The guide did not load</span>
                <Button variant="outline" size="sm" onClick={onRetry}>Try Again</Button>
              </div>
            ) : (
              <Hint role="status">Loading the guide…</Hint>
            ))}
            {guide && exchange && (
              <div data-fq-bubble="answer">
                <AnswerBody guide={guide} exchange={exchange} settings={settings} onSettingsChange={onSettingsChange} onOpen={onOpen} onGo={onGo} folds={folds} toggles={false} />
              </div>
            )}
          </div>
        </ScrollArea>
        <ScrollArrow shown={away} onClick={toEnd} />
      </div>
      {/* On the chat room's corner, as Minimal's grip is on its box; outside the bubble, so the fade never hides it. */}
      <div className="pointer-events-none" style={place(layout.chat)}>
        <Grip corner={grip} handlers={resize} name="resize" />
      </div>
      {guide && exchange && (
        <div data-fq-strip="" className="flex items-center gap-2" style={place(layout.strip)}>
          {/* Always drawn, disabled at the ends, so the strip never shifts (Q12). */}
          <Tip tip="Previous Answer">
            <button type="button" aria-label="Previous Answer" disabled={!page.previous} onClick={page.previous} className={CHEVRON}>
              <ChevronLeft aria-hidden className="h-4 w-4" />
            </button>
          </Tip>
          <div className="flex min-w-0 flex-wrap items-center gap-2 [&>*]:pointer-events-auto">
            <AnswerToggles guide={guide} exchange={exchange} folds={folds} onOpen={onOpen} onGo={onGo} />
          </div>
          <Tip tip="Next Answer">
            <button
              type="button"
              aria-label="Next Answer"
              aria-describedby={page.waiting ? waitingId : undefined}
              disabled={!page.next}
              onClick={page.next}
              className={cn(CHEVRON, 'relative ml-auto')}
            >
              <ChevronRight aria-hidden className="h-4 w-4" />
              {/* A new answer writes on a later page. */}
              {page.waiting && <span aria-hidden data-fq-mark="" className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-primary" />}
            </button>
          </Tip>
          {page.waiting && <span id={waitingId} className="sr-only">A new answer is writing</span>}
        </div>
      )}
    </>
  );
}

/**
 * The bubble chrome: the Mascot speaks the newest answer from a bubble whose tail points at her head. The strip
 * under it holds the chevrons, the answer's toggles and Take Me There; the question and the ask input stand at
 * her feet. The layout places every piece; this draws them and reports the heights the layout stacks.
 */
export function BubbleChat({
  layout, page, mascot, headView, guide, failed, onRetry, chat, settings, onSettingsChange, draft, onDraftChange, onOpen, onGo,
  move, resize, mascotResize, headToggle, menu, onClose, onHeights, reader,
}: {
  layout: BubbleLayout;
  /** The page of the conversation on show (Q2). */
  page: BubblePage;
  /** The Mascot: her whole body, or her head in head view. */
  mascot: ReactNode;
  headView: boolean;
  /** Null until the docs load. */
  guide: Guide | null;
  failed: boolean;
  onRetry: () => void;
  chat: HelpChat;
  settings: HelpSettings;
  onSettingsChange: (change: HelpSettingsChange) => void;
  draft: string;
  onDraftChange: (text: string) => void;
  onOpen: (id: string) => void;
  onGo: (route: SurfaceRoute) => void;
  /** Pointer handlers for her body and the pill, where the window moves. */
  move: DragHandlers;
  /** Pointer handlers for the bubble's grip, which sets the chat width and height. */
  resize: DragHandlers;
  /** Pointer handlers for her grip, which sets her scale. */
  mascotResize: DragHandlers;
  headToggle?: HeadToggle;
  menu: MenuProps;
  onClose: () => void;
  onHeights: (heights: BubbleHeights) => void;
  reader?: ReactNode;
}) {
  const { exchange } = page;
  const contentRef = useRef<HTMLDivElement>(null);
  const questionRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLDivElement>(null);
  const reported = useRef('');
  const report = useRef(onHeights);
  report.current = onHeights;

  // The layout stacks the pieces at their natural heights; a change of any of them lays the group out again.
  const measure = useCallback(() => {
    const heights = {
      // The bubble's box holds its 1px border on both sides around the content.
      content: (contentRef.current?.offsetHeight ?? 0) + 2,
      question: questionRef.current?.offsetHeight ?? 0,
      input: inputRef.current?.offsetHeight ?? 0,
    };
    const key = `${heights.content}:${heights.question}:${heights.input}`;
    if (key === reported.current) return;
    reported.current = key;
    report.current(heights);
  }, []);
  // Each commit can change the text; an image loading or the field growing changes a height between commits.
  useLayoutEffect(measure);
  const speaking = exchange !== undefined || guide === null;
  useLayoutEffect(() => {
    const observer = new ResizeObserver(measure);
    for (const element of [contentRef.current, questionRef.current, inputRef.current]) if (element) observer.observe(element);
    return () => observer.disconnect();
  }, [measure, speaking, exchange?.id]);

  const { group } = layout;
  const place: Place = (box, sized = true) => ({
    position: 'absolute',
    left: box.x - group.x,
    top: box.y - group.y,
    width: box.w,
    ...(sized ? { height: box.h } : {}),
  });
  const columnTop = speaking ? layout.chat.y : (layout.pillRow ?? layout.input).y;
  // The pill and her grip fade when idle over her head; head view keeps its pill (Q4).
  const fade = usePillFade(!headView);
  const hover = fade && { onPointerEnter: fade.props.onPointerEnter, onPointerLeave: fade.props.onPointerLeave };
  const pill = <Pill move={move} large={false} headToggle={headToggle} menu={menu} onClose={onClose} fade={fade} />;

  return (
    <>
      {/* The Scrim: a panel of the app background behind the column, as under Minimal. */}
      {settings.scrimOpacity > 0 && (
        <div
          aria-hidden
          data-fq-scrim=""
          className="pointer-events-none absolute -z-10 rounded-2xl bg-background"
          style={{
            ...place({ x: layout.input.x - 12, y: columnTop - 12, w: layout.input.w + 24, h: layout.input.y + layout.input.h - columnTop + 24 }),
            opacity: settings.scrimOpacity / 100,
          }}
        />
      )}
      {speaking && (
        <Speech
          key={exchange?.id}
          layout={layout}
          place={place}
          page={page}
          exchange={exchange}
          guide={guide}
          failed={failed}
          onRetry={onRetry}
          chat={chat}
          settings={settings}
          onSettingsChange={onSettingsChange}
          onOpen={onOpen}
          onGo={onGo}
          resize={resize}
          contentRef={contentRef}
        />
      )}
      {exchange && (
        // The question leans toward her, so it mirrors with the group (Q6).
        <div ref={questionRef} role="note" aria-label="Your Question" className={cn('flex flex-col gap-1', layout.side === 'right' ? 'items-end' : 'items-start')} style={place(layout.question, false)}>
          <AttachmentThumbs attachments={exchange.images} className="pointer-events-auto" />
          <p data-fq-bubble="question" className={cn(BUBBLE, 'max-w-full whitespace-pre-wrap bg-primary text-primary-foreground [overflow-wrap:anywhere]')}>{exchange.question}</p>
        </div>
      )}
      <div ref={inputRef} style={place(layout.input, false)}>
        <AskPill draft={draft} onDraftChange={onDraftChange} chat={chat} />
      </div>
      {headView && layout.pillRow ? (
        <div className={cn('flex items-end gap-2', layout.side === 'right' ? 'flex-row-reverse' : 'flex-row')} style={place(layout.pillRow)}>
          <div data-fq-body="" {...move} className="pointer-events-auto cursor-move touch-none">{mascot}</div>
          {pill}
        </div>
      ) : (
        <>
          <div data-fq-body="" {...move} {...hover} className="pointer-events-auto flex cursor-move touch-none items-end" style={place(layout.her)}>{mascot}</div>
          {/* The pill stands over her head, inside her bounds. */}
          <div className="flex justify-center" style={place(layout.her, false)}>{pill}</div>
        </>
      )}
      {/* Her grip, on her top corner on the bubble side (Q19). */}
      <div className="pointer-events-none" style={place(layout.her)}>
        <Grip corner={layout.mascotGrip} handlers={mascotResize} name="mascot-resize" fade={fade?.props} />
      </div>
      {reader && layout.reader && <div className="flex" style={place(layout.reader)}>{reader}</div>}
    </>
  );
}
