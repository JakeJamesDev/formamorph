import type { ReactNode } from 'react';
import { GripVertical, PersonStanding, ScanFace, SendHorizontal, Square, X } from 'lucide-react';
import { AttachImagesButton } from '@/components/AttachImagesButton';
import { AttachmentThumbs } from '@/components/game/AttachmentThumbs';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tip } from '@/components/ui/tooltip';
import { Hint } from '@/components/ui/typography';
import { withoutAttachment } from '@/lib/actionAttachments';
import type { SurfaceRoute } from '@/lib/surface/surfaceRoute';
import type { Guide } from '@/lib/formaquestion/guide';
import type { HelpSettings, HelpSettingsChange } from '@/lib/formaquestion/helpSettings';
import type { MascotSide } from '@/lib/formaquestion/windowBox';
import { useAttachmentIntake } from '@/lib/useAttachmentIntake';
import { ASSISTANT_BUBBLE, BUBBLE, FLOATING, PILL_BUTTON, TOP_FADE } from './floatingPieces';
import { cn } from '@/lib/utils';
import { Answer } from './AskParts';
import { HELD_LINE, useAskSend, useFollowEnd } from './useAskParts';
import { ResizeGrip } from './FormaquestionFrame';
import { targetAttribute } from '@/lib/surface/surfaceTargets';
import { ScrollArrow } from './ScrollArrow';
import type { PillFade } from './usePillFade';
import { FormaquestionMenu, type MenuActions } from './FormaquestionMenu';
import type { HelpChat } from './useHelpChat';
import type { DragHandlers } from './usePointerDrag';

export type MenuProps = MenuActions & { container?: HTMLElement };

/** The desktop pill's switch between the whole Mascot and its head. */
export interface HeadToggle {
  showingHead: boolean;
  onToggle: () => void;
}

/** The only chrome: it moves the window, swaps the Mascot's view, holds the ⋮ menu, and closes the window. */
export function Pill({ move, large, headToggle, menu, onClose, fade }: {
  move?: DragHandlers;
  large: boolean;
  headToggle?: HeadToggle;
  menu: MenuProps;
  onClose: () => void;
  /** Fades the pill out when idle. Null keeps it up. */
  fade?: PillFade | null;
}) {
  const headLabel = headToggle?.showingHead ? 'Show Full Mascot' : 'Show Head Only';
  const { className: fadeClass, ...fading } = fade?.props ?? {};
  return (
    <div
      data-fq-drag=""
      {...move}
      {...fading}
      className={cn(FLOATING, 'flex shrink-0 select-none items-center self-end rounded-full border bg-background p-0.5', move && 'cursor-move touch-none', fadeClass)}
    >
      {move && <GripVertical aria-hidden className="mx-0.5 h-4 w-4 text-muted-foreground" />}
      {headToggle && (
        <Tip tip={headLabel}>
          <button type="button" aria-label={headLabel} onClick={headToggle.onToggle} className={cn(PILL_BUTTON, large ? 'h-12 w-12' : 'h-8 w-8')}>
            {headToggle.showingHead ? <PersonStanding aria-hidden className="h-4 w-4" /> : <ScanFace aria-hidden className="h-4 w-4" />}
          </button>
        </Tip>
      )}
      <FormaquestionMenu {...menu} onOpenChange={fade?.onMenuOpenChange} large={large} round />
      <Tip tip={large ? 'Close' : 'Close (F1)'}>
        <button type="button" aria-label="Close Formaquestion" onClick={onClose} className={cn(PILL_BUTTON, large ? 'h-12 w-12' : 'h-8 w-8')}>
          <X aria-hidden className="h-4 w-4" />
        </button>
      </Tip>
    </div>
  );
}

export function AskPill({ draft, onDraftChange, chat }: { draft: string; onDraftChange: (text: string) => void; chat: HelpChat }) {
  const { busy, held, readsImages, pending, setPending, stop } = chat;
  const { attaching, dragOver, attachFiles, intakeProps } = useAttachmentIntake({ enabled: readsImages, pending, setPending });
  const { canSend, send, onKeyDown } = useAskSend(draft, onDraftChange, chat);
  return (
    <div className="flex shrink-0 flex-col gap-1" {...intakeProps}>
      {readsImages && pending.length > 0 && (
        <AttachmentThumbs attachments={pending} onRemove={(id) => setPending((prev) => withoutAttachment(prev, id))} className="pointer-events-auto self-end" />
      )}
      <div
        className={cn(FLOATING, 'flex items-end gap-1 rounded-3xl border bg-background p-1 shadow-lg focus-within:ring-2 focus-within:ring-inset focus-within:ring-ring', readsImages ? 'pl-1' : 'pl-4', dragOver && 'ring-2 ring-inset ring-ring')}
        {...targetAttribute('formaquestion.ask', 'question-field')}
      >
        {readsImages && (
          <AttachImagesButton attaching={attaching} onFiles={(files) => void attachFiles(files)} variant="ghost" className="h-9 w-9 shrink-0 rounded-full" />
        )}
        <textarea
          data-fq-autofocus=""
          aria-label="Ask a Question"
          placeholder="Ask a Question"
          value={draft}
          rows={1}
          onChange={(event) => onDraftChange(event.target.value)}
          onKeyDown={onKeyDown}
          className="max-h-32 min-w-0 flex-1 resize-none self-center bg-transparent py-1.5 text-label outline-none [field-sizing:content] placeholder:text-muted-foreground"
        />
        {busy ? (
          <Tip tip="Stop">
            <Button variant="outline" size="icon" className="h-9 w-9 shrink-0 rounded-full" onClick={stop}>
              <Square aria-hidden className="h-4 w-4" />
            </Button>
          </Tip>
        ) : (
          <Tip tip="Send">
            <Button size="icon" className="h-9 w-9 shrink-0 rounded-full" disabled={!canSend} onClick={send}>
              <SendHorizontal aria-hidden className="h-4 w-4" />
            </Button>
          </Tip>
        )}
      </div>
      {held && !busy && <Hint className={cn(BUBBLE, 'self-end border bg-background')}>{HELD_LINE}</Hint>}
    </div>
  );
}

/**
 * The minimal chrome's chat column: a pill, the conversation as floating bubbles, and the ask field. No frame,
 * no title bar, no tabs. Older bubbles fade out at the top, and no scroll bar draws.
 */
export function MinimalChat({ guide, failed, onRetry, chat, settings, onSettingsChange, draft, onDraftChange, onOpen, onGo, move, resize, large, head, headSide = 'left', headToggle, menu, onClose, height }: {
  /** Null until the docs load. */
  guide: Guide | null;
  failed: boolean;
  onRetry: () => void;
  chat: HelpChat;
  settings: HelpSettings;
  onSettingsChange: (change: HelpSettingsChange) => void;
  draft: string;
  onDraftChange: (text: string) => void;
  /** Opens a docs section that an answer links to. */
  onOpen: (id: string) => void;
  /** Opens the surface an answer's Take Me There names. */
  onGo: (route: SurfaceRoute) => void;
  /** Pointer handlers for the pill, where the window moves. */
  move?: DragHandlers;
  /** Pointer handlers for the corner grip under the ask field. */
  resize?: DragHandlers;
  /** Sheet-size controls. */
  large: boolean;
  /** The Mascot's head view, drawn at the pill's end on the Mascot's side. */
  head?: ReactNode;
  headSide?: MascotSide;
  headToggle?: HeadToggle;
  /** The ⋮ menu's actions, as the framed window's title bar menu takes them. */
  menu: MenuProps;
  onClose: () => void;
  /** The column's height, when a taller Mascot makes the shared box taller. Unset fills the box. */
  height?: number;
}) {
  const { viewportRef, onScroll, away, toEnd } = useFollowEnd(chat.exchanges);
  // The grip takes a strip under the ask field, clear of the Send button.
  return (
    <div data-fq-piece="column" className={cn('relative flex h-full min-h-0 min-w-0 flex-1 flex-col gap-2', resize && 'pb-3')} style={height === undefined ? undefined : { height }}>
      {/* The Scrim: a panel of the app background, inset past the column. It sits behind every piece of the window, whose section is its own stacking context. */}
      {settings.scrimOpacity > 0 && (
        <div
          aria-hidden
          data-fq-scrim=""
          className="pointer-events-none absolute -inset-3 -z-10 rounded-2xl bg-background"
          style={{ opacity: settings.scrimOpacity / 100 }}
        />
      )}
      <div className={cn('flex shrink-0 items-end gap-2', headSide === 'right' ? 'justify-start' : 'justify-end')}>
        {headSide === 'left' && head}
        <Pill move={move} large={large} headToggle={headToggle} menu={menu} onClose={onClose} />
        {headSide === 'right' && head}
      </div>
      <div className="relative min-h-0 flex-1">
      {/* A grid content wrapper lets the log fill a short column, so the bubbles sit at its foot. */}
      <ScrollArea
        className={cn('h-full', TOP_FADE)}
        viewportRef={viewportRef}
        viewportProps={{ 'data-fq-scroll': 'conversation', onScroll, className: '[&>div]:!grid [&>div]:min-h-full' }}
      >
        <div role="log" aria-label="Conversation" aria-busy={chat.busy} className="flex min-h-full flex-col justify-end gap-2 px-1 pb-1 pt-8">
          {!guide && (failed ? (
            <div role="alert" className={cn(ASSISTANT_BUBBLE, 'flex flex-col items-start gap-2')}>
              <span>The guide did not load</span>
              <Button variant="outline" size="sm" onClick={onRetry}>Try Again</Button>
            </div>
          ) : (
            <Hint role="status" className={ASSISTANT_BUBBLE}>Loading the guide…</Hint>
          ))}
          {guide && chat.exchanges.length === 0 && <Hint className={ASSISTANT_BUBBLE}>Ask how to do something in Formamorph</Hint>}
          {guide && chat.exchanges.map((exchange) => (
            <div key={exchange.id} className="flex flex-col gap-2">
              <div className="ml-10 flex flex-col items-end gap-2 self-end">
                <AttachmentThumbs attachments={exchange.images} className="pointer-events-auto" />
                <p data-fq-bubble="question" className={cn(BUBBLE, 'whitespace-pre-wrap rounded-br-sm bg-primary text-primary-foreground [overflow-wrap:anywhere]')}>{exchange.question}</p>
              </div>
              <div data-fq-bubble="answer" className={ASSISTANT_BUBBLE}>
                <Answer guide={guide} exchange={exchange} settings={settings} onSettingsChange={onSettingsChange} onOpen={onOpen} onGo={onGo} />
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
      <ScrollArrow shown={away} onClick={toEnd} />
      </div>
      <AskPill draft={draft} onDraftChange={onDraftChange} chat={chat} />
      {resize && <ResizeGrip resize={resize} className="pointer-events-auto" />}
    </div>
  );
}
