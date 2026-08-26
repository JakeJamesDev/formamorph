import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import type { AIRequestType } from '@/types';
import { resolvePromptJump, type PromptJumpTarget } from '@/lib/promptJump';
import {
  CONTEXT_LABELS,
  SOURCE_LABELS,
  type AnatomyBlock,
  type AnatomyRun,
  type AnatomySource,
} from '@/lib/requestAnatomy';

/**
 * One request drawn as its Request Anatomy: a hard System Prompt / Messages split, chat-staggered message
 * blocks inside Messages, the player's own prompt text highlighted and named by the editor that owns it,
 * everything the app assembled muted beneath it.
 *
 * Shared by the in-game AI Context viewer and the Settings Anatomy hub. They differ only in how much of a
 * context run survives: AI Context shows real turns, so the bytes are the point; the hub collapses context
 * to an explanation plus a one-line excerpt so the whole request reads in one scan.
 *
 * Given `onJump`, an authored run becomes a button onto the editor that owns it. Context runs never do —
 * the app assembled them, so there is nothing to open.
 */

/** How much of a context run is drawn. */
export type AnatomyContextMode = 'full' | 'preview';

/** Per-source accent. Each has a light and a dark face, since both surfaces render in either theme. */
const SOURCE_STYLES: Record<AnatomySource, { chip: string; mark: string }> = {
  'system-template': { chip: 'bg-violet-500/15 text-violet-700 dark:text-violet-300', mark: 'bg-violet-400/20' },
  'user-template': { chip: 'bg-amber-500/15 text-amber-700 dark:text-amber-300', mark: 'bg-amber-400/25' },
  recap: { chip: 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300', mark: 'bg-cyan-400/20' },
  now: { chip: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300', mark: 'bg-emerald-400/20' },
  recall: { chip: 'bg-sky-500/15 text-sky-700 dark:text-sky-300', mark: 'bg-sky-400/20' },
  direction: { chip: 'bg-rose-500/15 text-rose-700 dark:text-rose-300', mark: 'bg-rose-400/20' },
};

const ROLE_LABELS: Record<AnatomyBlock['role'], string> = {
  system: 'system',
  user: 'user',
  assistant: 'assistant',
};

/** How much of a context run's own text a preview shows before it stops being a glance. */
const EXCERPT_CHARS = 110;

export interface RequestAnatomyViewProps {
  blocks: AnatomyBlock[];
  mode: AnatomyContextMode;
  /** Which kind of request these blocks are, so a click resolves to the prompt that owns the run. */
  type?: AIRequestType;
  /** Called with the editor an authored run belongs to. Absent leaves every run inert. */
  onJump?: (target: PromptJumpTarget) => void;
  /**
   * Optional enrichment for one slice of text — the AI-context viewer's dictionary and hydration
   * highlighting. Called per run, so a highlighter never has to know about runs. Absent renders plain text.
   */
  renderText?: (text: string, block: AnatomyBlock, blockIndex: number) => ReactNode;
  /** Extra classes on the outer container. */
  className?: string;
}

function AuthoredRun({
  source,
  named,
  onJump,
  children,
}: {
  source: AnatomySource;
  named: boolean;
  onJump?: () => void;
  children: ReactNode;
}) {
  const style = SOURCE_STYLES[source];
  const body = (
    <>
      {named && (
        <span className={cn('mr-1 rounded-sm px-1 align-middle text-meta font-medium', style.chip)}>
          {SOURCE_LABELS[source]}
        </span>
      )}
      {children}
    </>
  );
  if (!onJump) return <mark className={cn('rounded-sm px-0.5 text-inherit', style.mark)}>{body}</mark>;
  // The mark itself is the control: a <button> is an atomic inline-block, which paints its background as
  // one rectangle to the container edge instead of wrapping per line the way highlighted text must.
  return (
    <mark
      role="button"
      tabIndex={0}
      onClick={onJump}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onJump(); }
      }}
      title={`Open the ${SOURCE_LABELS[source]}`}
      className={cn(
        'rounded-sm px-0.5 text-inherit cursor-pointer underline decoration-dotted underline-offset-2 hover:decoration-solid focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
        style.mark,
      )}
    >
      {body}
    </mark>
  );
}

/** The trailing blank lines a run carries are structure, not content — kept so the block still reads as
 *  the request, but never counted as part of an excerpt. */
function splitTrailingBreak(text: string): [string, string] {
  const body = text.replace(/\s+$/, '');
  return [body, text.slice(body.length)];
}

/** A run's own text, with the blank lines that join it to its neighbors peeled off either end. Those are
 *  assembly, not authorship: left inside the mark they put the label chip at the end of the line above and
 *  highlight an empty line below. */
function peelBreaks(text: string): [string, string, string] {
  const lead = /^\s*/.exec(text)![0];
  if (lead.length === text.length) return [text, '', ''];
  const [body, tail] = splitTrailingBreak(text.slice(lead.length));
  return [lead, body, tail];
}

function ContextRun({
  run,
  text,
  mode,
  midLine,
  children,
}: {
  run: AnatomyRun;
  text: string;
  mode: AnatomyContextMode;
  /** The run begins mid-line, so its explanation needs a line break of its own first. */
  midLine: boolean;
  children: ReactNode;
}) {
  // The explanation always stands on its own line, with the run's text starting directly on the next.
  const explanation = run.contextLabel ? (
    <>
      {midLine ? '\n' : null}
      <span className="italic">&lt;{CONTEXT_LABELS[run.contextLabel]}&gt;</span>
      {'\n'}
    </>
  ) : null;
  if (mode === 'full') {
    return (
      <span className="text-muted-foreground/70">
        {explanation}
        <span className="opacity-70">{children}</span>
      </span>
    );
  }
  const [body, trailing] = splitTrailingBreak(text);
  const firstLine = body.split('\n')[0];
  const cut = firstLine.length > EXCERPT_CHARS;
  const excerpt = cut ? firstLine.slice(0, EXCERPT_CHARS).trimEnd() : firstLine;
  // One ellipsis, whether the line was cut or there are more lines behind it.
  const more = cut || body.length > firstLine.length;
  return (
    <span className="text-muted-foreground/70">
      {explanation}
      <span className="opacity-70">{excerpt}{more ? ' …' : ''}</span>
      {trailing || ' '}
    </span>
  );
}

/** One block's content, split at its run boundaries. Text outside every run (a request-layer suffix, or a
 *  capture from before the sidecar existed) renders plain rather than vanishing. */
function BlockBody({
  block,
  blockIndex,
  mode,
  renderText,
  jumpTo,
}: {
  block: AnatomyBlock;
  blockIndex: number;
  mode: AnatomyContextMode;
  renderText?: RequestAnatomyViewProps['renderText'];
  /** What clicking a run of this source should do, or undefined where nothing owns it. */
  jumpTo?: (source: AnatomySource) => (() => void) | undefined;
}) {
  const draw = (text: string): ReactNode => (renderText ? renderText(text, block, blockIndex) : text);
  const parts: ReactNode[] = [];
  // A source is named once per block. A template broken up by a dozen chips is still one field, and a
  // dozen identical chips down the margin says nothing the first one didn't; the accent carries the rest.
  const named = new Set<AnatomySource>();
  let at = 0;
  block.runs.forEach((run, i) => {
    if (run.start > at) parts.push(<span key={`gap-${i}`}>{draw(block.content.slice(at, run.start))}</span>);
    const text = block.content.slice(run.start, run.end);
    if (run.source) {
      // The joins either side stay outside the mark, so the label chip leads the run's first real word.
      const [lead, body, tail] = peelBreaks(text);
      // An all-whitespace run draws no chip, so it must not spend the source's one naming either.
      const firstOfSource = !!body && !named.has(run.source);
      if (body) named.add(run.source);
      parts.push(
        <span key={i}>
          {lead ? draw(lead) : null}
          {body ? (
            <AuthoredRun source={run.source} named={firstOfSource} onJump={jumpTo?.(run.source)}>
              {draw(body)}
            </AuthoredRun>
          ) : null}
          {tail ? draw(tail) : null}
        </span>,
      );
    } else {
      const midLine = run.start > 0 && block.content[run.start - 1] !== '\n';
      parts.push(<ContextRun key={i} run={run} text={text} mode={mode} midLine={midLine}>{draw(text)}</ContextRun>);
    }
    at = run.end;
  });
  if (at < block.content.length) parts.push(<span key="tail">{draw(block.content.slice(at))}</span>);
  // Same size as the prompt editors and their preview panes — this is the same text, read side by side.
  return <p className="whitespace-pre-wrap break-words text-label">{parts}</p>;
}

function Region({ title, hint, children }: { title: string; hint: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-border">
      <header className="flex flex-wrap items-baseline gap-x-2 border-b border-border bg-muted/40 px-3 py-1.5">
        <h3 className="text-label font-semibold">{title}</h3>
        <span className="text-meta text-muted-foreground">{hint}</span>
      </header>
      <div className="p-3">{children}</div>
    </section>
  );
}

export function RequestAnatomyView({ blocks, mode, type, onJump, renderText, className }: RequestAnatomyViewProps) {
  const jumpTo = onJump && type
    ? (source: AnatomySource) => {
        const target = resolvePromptJump(source, type);
        return target ? () => onJump(target) : undefined;
      }
    : undefined;
  const body = (block: AnatomyBlock, index: number) => (
    <BlockBody block={block} blockIndex={index} mode={mode} renderText={renderText} jumpTo={jumpTo} />
  );
  const system = blocks.map((b, i) => [b, i] as const).filter(([b]) => b.role === 'system');
  const messages = blocks.map((b, i) => [b, i] as const).filter(([b]) => b.role !== 'system');
  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <Region title="System Prompt" hint="one block, sent first, sets the rules">
        {system.length === 0 ? (
          <p className="text-helper text-muted-foreground">This request sent no system prompt.</p>
        ) : (
          system.map(([block, i]) => <div key={i}>{body(block, i)}</div>)
        )}
      </Region>
      <Region title="Messages" hint="the conversation the AI continues">
        <div className="flex flex-col gap-2">
          {messages.map(([block, i]) => (
            <div
              key={i}
              // The player sends, the AI answers: the user's messages sit to the right, the assistant's
              // to the left, the way every chat the player has ever used is laid out.
              className={cn(
                'rounded-md border border-border p-2',
                block.role === 'assistant' ? 'mr-4 bg-card sm:mr-6' : 'ml-4 bg-muted/30 sm:ml-6',
              )}
            >
              <div className="mb-0.5 text-meta text-muted-foreground">{ROLE_LABELS[block.role]}</div>
              {body(block, i)}
            </div>
          ))}
        </div>
      </Region>
    </div>
  );
}
