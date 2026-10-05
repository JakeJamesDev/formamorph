import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { ChevronRight, Info, SendHorizontal, Square } from 'lucide-react';
import { AttachImagesButton } from '@/components/AttachImagesButton';
import { AttachmentThumbs } from '@/components/game/AttachmentThumbs';
import { MarkdownRenderer } from '@/components/game/MarkdownRenderer';
import { ReasoningBody, ThinkingLabel } from '@/components/game/ReasoningBlock';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Tip } from '@/components/ui/tooltip';
import { Hint, Meta } from '@/components/ui/typography';
import { withoutAttachment } from '@/lib/actionAttachments';
import type { DocSection } from '@/lib/docs/docsIndex';
import type { SurfaceRoute } from '@/lib/surface/surfaceRoute';
import { withReaderLinks } from '@/lib/docs/docsReader';
import type { Guide } from '@/lib/formaquestion/guide';
import { helpRevealSpec, helpRevealTiming } from '@/lib/formaquestion/helpReveal';
import type { HelpSettings, HelpSettingsChange } from '@/lib/formaquestion/helpSettings';
import { revealActive, revealAnimName, revealVars } from '@/lib/narrationRevealConfig';
import { usePrefersReducedMotion } from '@/lib/usePrefersReducedMotion';
import { useAttachmentIntake } from '@/lib/useAttachmentIntake';
import { useAutoGrowTextarea } from '@/lib/useAutoGrowTextarea';
import { cn } from '@/lib/utils';
import { answerRoute } from './answerRoute';
import { SectionRows } from './GuideParts';
import { ScrollArrow } from './ScrollArrow';
import { FOCUS_RING, readerComponents } from './readerLinks';
import { CodeInsert } from './CodeInsert';
import type { SnippetActions } from './CodeSnippet';
import { targetAttribute } from '@/lib/surface/surfaceTargets';
import { answerList, useAnswerFolds, type AnswerFolds, type Fold } from './useAnswerFolds';
import type { HelpStage } from '@/lib/formaquestion/helpSession';
import type { HelpChat, HelpExchange, HelpStatus } from './useHelpChat';
import { HELD_LINE, useAskSend, useFollowEnd } from './useAskParts';

/** An answer's code blocks offer Insert beside Copy; guide pages offer Copy alone. */
const insertAction: SnippetActions = (block) => <CodeInsert block={block} />;

/** The most docs sections shown in place of an answer. */
const FALLBACK_RESULT_LIMIT = 5;

/** The ask field's one-line height, which matches the Send button, and the height it grows to before it scrolls. */
const ASK_FIELD_LINE_H = 40;
const ASK_FIELD_MAX_H = 240;

/** The line above the docs search that takes the place of an answer, or of the rest of one. */
/** The wait line of each stage, under the question until its answer text starts. */
const STAGE_LINE: Record<HelpStage, string> = {
  checking: 'Checking your AI…',
  searching: 'Searching the guide…',
  picking: 'Searching with your AI…',
  waiting: 'Waiting for your AI…',
  lookingUp: 'Looking up…',
};

function fallbackLine(status: Extract<HelpStatus, 'no-ai' | 'failed'>, partial: boolean, matched: boolean): string {
  const cause = status === 'no-ai' ? 'No AI is connected' : partial ? 'The answer did not finish' : 'The AI did not answer';
  return matched ? `${cause}. These guide sections match your question.` : `${cause}, and no guide section matches your question`;
}

/** A source under an answer: the page, then the section. It opens the section in the reader. */
function SourceLink({ guide, section, onOpen }: { guide: Guide; section: DocSection; onOpen: (id: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(section.id)}
      className={cn('inline-flex max-w-full items-center gap-1 rounded border bg-muted/40 px-1.5 py-0.5 text-meta text-muted-foreground hover:bg-accent hover:text-accent-foreground', FOCUS_RING)}
    >
      <span className="truncate">{guide.titleOf(section.page)}</span>
      <ChevronRight aria-hidden className="h-3 w-3 shrink-0" />
      <span className="truncate text-foreground">{section.label}</span>
    </button>
  );
}

/** Pattern 5: the line above an answer that did not come from the guide. */
function GeneralKnowledgeNotice() {
  return (
    <div className="flex items-start gap-2 rounded-md border border-warning/50 bg-warning/10 px-2 py-1.5 text-helper">
      <Info aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
      <span>This answer is not from the guide. It can be wrong about Formamorph.</span>
    </div>
  );
}

/** The toggle of a foldable block under or above an answer. The chevron points down while the block is open. */
function FoldToggle({ open, label, onToggle }: { open: boolean; label: ReactNode; onToggle: () => void }) {
  return (
    <button
      type="button"
      aria-expanded={open}
      onClick={onToggle}
      className={cn('flex w-fit items-center gap-1 rounded text-meta text-muted-foreground', FOCUS_RING)}
    >
      <ChevronRight aria-hidden className={cn('h-3 w-3 shrink-0 transition-transform motion-reduce:transition-none', open && 'rotate-90')} />
      {label}
    </button>
  );
}

/** The model's reasoning, muted, above its answer. The header pulses until the answer text starts. */
function Thinking({ text, ms, active, fold, toggles }: { text: string; ms: number; active: boolean; fold: Fold; toggles: boolean }) {
  if (!text) return null;
  if (!toggles) return fold.open ? <ReasoningBody text={text} className="[&_:first-child]:mt-0" /> : null;
  return (
    <div role="group" aria-label="Thinking" className="flex flex-col gap-1">
      <FoldToggle open={fold.open} label={<ThinkingLabel active={active} ms={ms} />} onToggle={fold.toggle} />
      {fold.open && <ReasoningBody text={text} className="[&_:first-child]:mt-0" />}
    </div>
  );
}

/** Opens the surface an answer's top source names. */
function TakeMeThere({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="outline" size="xs" className="h-6 px-1.5" onClick={onClick}>
      Take Me There
    </Button>
  );
}

/** The source links of an answer, wrapped. */
function SourceLinks({ guide, sections, onOpen }: { guide: Guide; sections: readonly DocSection[]; onOpen: (id: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1">
      {sections.map((section) => <SourceLink key={section.id} guide={guide} section={section} onOpen={onOpen} />)}
    </div>
  );
}

/** The answer's sources, or a flagged answer's nearest sections, in a popover from a button (Q22). A link closes it. */
function SourcesPopover({ guide, label, sections, onOpen }: { guide: Guide; label: string; sections: readonly DocSection[]; onOpen: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {/* As the Thinking toggle beside it; the chevron turns toward the popover above while it is open. */}
        <button type="button" className={cn('flex w-fit items-center gap-1 rounded text-meta text-muted-foreground', FOCUS_RING)}>
          <ChevronRight aria-hidden className={cn('h-3 w-3 shrink-0 transition-transform motion-reduce:transition-none', open && '-rotate-90')} />
          {`${label} (${sections.length})`}
        </button>
      </PopoverTrigger>
      {/* Inline, so it stays in the window's layer above every dialog. */}
      <PopoverContent portal={false} side="top" align="start" aria-label={label} className="pointer-events-auto w-80 p-2">
        <SourceLinks guide={guide} sections={sections} onOpen={(id) => { setOpen(false); onOpen(id); }} />
      </PopoverContent>
    </Popover>
  );
}

/** The answer's Thinking toggle, its Sources popover and its Take Me There, for a strip outside the answer. */
export function AnswerToggles({ guide, exchange, folds, onOpen, onGo }: {
  guide: Guide;
  exchange: HelpExchange;
  folds: AnswerFolds;
  onOpen: (id: string) => void;
  onGo: (route: SurfaceRoute) => void;
}) {
  const { listed, listLabel } = answerList(exchange);
  const route = answerRoute(exchange);
  return (
    <>
      {exchange.reasoning && (
        <FoldToggle
          open={folds.thinking.open}
          label={<ThinkingLabel active={exchange.status === 'writing' && !exchange.answer} ms={exchange.reasoningMs ?? 0} />}
          onToggle={folds.thinking.toggle}
        />
      )}
      {listed.length > 0 && <SourcesPopover guide={guide} label={listLabel} sections={listed} onOpen={onOpen} />}
      {listed.length > 0 && route && <TakeMeThere onClick={() => onGo(route)} />}
    </>
  );
}

interface AnswerProps {
  guide: Guide;
  exchange: HelpExchange;
  settings: HelpSettings;
  onSettingsChange: (change: HelpSettingsChange) => void;
  onOpen: (id: string) => void;
  onGo: (route: SurfaceRoute) => void;
}

/** One answer: its reasoning, text, wait line, fallback, sources and Take Me There. */
export function Answer(props: AnswerProps) {
  const folds = useAnswerFolds(props.exchange, props.settings, props.onSettingsChange);
  return <AnswerBody {...props} folds={folds} toggles />;
}

/** An answer at given folds. Without toggles it draws the answer and the open Thinking text; `AnswerToggles` draws the rest. */
export function AnswerBody({ guide, exchange, settings, onOpen, onGo, folds, toggles }: AnswerProps & { folds: AnswerFolds; toggles: boolean }) {
  const { answer, reasoning, reasoningMs, status, stage, question, flagged } = exchange;
  // The wait line hides while the model's reasoning streams: the Thinking header shows that wait.
  const waitLine = status === 'writing' && !answer && stage && !(reasoning && stage === 'waiting') ? STAGE_LINE[stage] : null;
  const { listed, listLabel } = answerList(exchange);
  const fold = folds.sources;
  const components = useMemo(() => readerComponents(onOpen, insertAction), [onOpen]);
  const reduceMotion = usePrefersReducedMotion();
  const spec = useMemo(() => helpRevealSpec(settings.reveal, reduceMotion), [settings.reveal, reduceMotion]);
  const timing = useMemo(() => helpRevealTiming(settings.reveal), [settings.reveal]);
  // A docs link that the model copies from a section opens that section here.
  const text = useMemo(() => withReaderLinks(answer, '', guide.resolve), [answer, guide]);
  const searched = status === 'no-ai' || status === 'failed';
  const route = answerRoute(exchange);
  const matches = useMemo(
    () => (searched ? guide.index.search(question, FALLBACK_RESULT_LIMIT) : []),
    [searched, guide, question],
  );
  return (
    <div className="flex flex-col gap-2 text-label">
      <Thinking text={reasoning} ms={reasoningMs ?? 0} active={status === 'writing' && !answer} fold={folds.thinking} toggles={toggles} />
      {flagged && answer && <GeneralKnowledgeNotice />}
      {answer && (
        <div data-reveal className="[&_:first-child]:mt-0" style={revealVars(spec) as CSSProperties}>
          <MarkdownRenderer
            text={text}
            animate={status === 'writing' && revealActive(spec)}
            animation={revealAnimName(spec)}
            easing={settings.reveal.easing}
            timing={timing}
            components={components}
          />
        </div>
      )}
      {/* The conversation is a log, which announces its own new text. */}
      {waitLine && <Hint>{waitLine}</Hint>}
      {status === 'stopped' && <Meta>Stopped</Meta>}
      {(status === 'no-ai' || status === 'failed') && (
        <div className="flex flex-col gap-1">
          <Hint>{fallbackLine(status, answer !== '', matches.length > 0)}</Hint>
          {matches.length > 0 && <SectionRows guide={guide} sections={matches} onOpen={onOpen} />}
        </div>
      )}
      {toggles && listed.length > 0 && (
        <div role="group" aria-label={listLabel} className="flex flex-col gap-1">
          {/* The footer row: the list's toggle, then Take Me There. */}
          <div className="flex flex-wrap items-center gap-2">
            <FoldToggle open={fold.open} label={fold.open ? listLabel : `${listLabel} (${listed.length})`} onToggle={fold.toggle} />
            {route && <TakeMeThere onClick={() => onGo(route)} />}
          </div>
          {fold.open && <SourceLinks guide={guide} sections={listed} onOpen={onOpen} />}
        </div>
      )}
    </div>
  );
}

function Conversation({ guide, exchanges, busy, settings, onSettingsChange, onOpen, onGo }: {
  guide: Guide;
  settings: HelpSettings;
  onSettingsChange: (change: HelpSettingsChange) => void;
  exchanges: readonly HelpExchange[];
  busy: boolean;
  onOpen: (id: string) => void;
  onGo: (route: SurfaceRoute) => void;
}) {
  const { viewportRef, onScroll, away, toEnd } = useFollowEnd(exchanges);
  return (
    <div className="relative min-h-0 flex-1">
    <ScrollArea
      className="h-full"
      viewportRef={viewportRef}
      viewportProps={{ 'data-fq-scroll': 'conversation', onScroll }}
    >
      <div role="log" aria-label="Conversation" aria-busy={busy} className="flex flex-col gap-3 p-3">
        {exchanges.length === 0 && <Hint className="py-6 text-center">Ask how to do something in Formamorph</Hint>}
        {exchanges.map((exchange) => (
          <div key={exchange.id} className="flex flex-col gap-3">
            <div className="ml-8 flex flex-col items-end gap-2 self-end">
              <AttachmentThumbs attachments={exchange.images} />
              <p className="whitespace-pre-wrap rounded-md bg-muted px-3 py-2 text-label [overflow-wrap:anywhere]">{exchange.question}</p>
            </div>
            <Answer guide={guide} exchange={exchange} settings={settings} onSettingsChange={onSettingsChange} onOpen={onOpen} onGo={onGo} />
          </div>
        ))}
      </div>
    </ScrollArea>
    <ScrollArrow shown={away} onClick={toEnd} />
    </div>
  );
}

function AskField({ draft, onDraftChange, chat }: {
  draft: string;
  onDraftChange: (text: string) => void;
  chat: HelpChat;
}) {
  const { busy, held, readsImages, pending, setPending, stop } = chat;
  const { attaching, dragOver, attachFiles, intakeProps } = useAttachmentIntake({ enabled: readsImages, pending, setPending });
  const grow = useAutoGrowTextarea(draft, ASK_FIELD_LINE_H, ASK_FIELD_MAX_H);
  const { canSend, send, onKeyDown } = useAskSend(draft, onDraftChange, chat);
  return (
    <div className={cn('flex shrink-0 flex-col gap-2 border-t p-3', dragOver && 'ring-2 ring-inset ring-ring')} {...intakeProps}>
      {readsImages && (
        <AttachmentThumbs attachments={pending} onRemove={(id) => setPending((prev) => withoutAttachment(prev, id))} className="pt-1.5" />
      )}
      <div className="flex items-end gap-2" {...targetAttribute('formaquestion.ask', 'question-field')}>
        {readsImages && (
          <AttachImagesButton attaching={attaching} onFiles={(files) => void attachFiles(files)} variant="outline" className="shrink-0" />
        )}
        <Textarea
          {...grow.fieldProps}
          data-fq-autofocus=""
          aria-label="Ask a Question"
          placeholder="Ask a Question"
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
          onKeyDown={onKeyDown}
          className={cn('h-10 min-h-10 resize-none leading-normal', grow.stateClass)}
        />
        {busy ? (
          <Tip tip="Stop">
            <Button variant="outline" size="icon" className="shrink-0" onClick={stop}>
              <Square aria-hidden className="h-4 w-4" />
            </Button>
          </Tip>
        ) : (
          <Tip tip="Send">
            <Button size="icon" className="shrink-0" disabled={!canSend} onClick={send}>
              <SendHorizontal aria-hidden className="h-4 w-4" />
            </Button>
          </Tip>
        )}
      </div>
      {/* Pattern 9: the reason sits under the field. */}
      {held && !busy && <Hint>{HELD_LINE}</Hint>}
    </div>
  );
}

/** The Ask part of the window: the conversation, and the field that adds a question to it. */
export function AskPanel({ guide, chat, settings, onSettingsChange, draft, onDraftChange, onOpen, onGo }: {
  guide: Guide;
  chat: HelpChat;
  settings: HelpSettings;
  onSettingsChange: (change: HelpSettingsChange) => void;
  draft: string;
  onDraftChange: (text: string) => void;
  onOpen: (id: string) => void;
  onGo: (route: SurfaceRoute) => void;
}) {
  return (
    <>
      <Conversation guide={guide} exchanges={chat.exchanges} busy={chat.busy} settings={settings} onSettingsChange={onSettingsChange} onOpen={onOpen} onGo={onGo} />
      <AskField draft={draft} onDraftChange={onDraftChange} chat={chat} />
    </>
  );
}
