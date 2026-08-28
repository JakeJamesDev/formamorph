import { useMemo, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import type { AIRequestType } from '@/types';
import { CHIP_BASE } from '@/components/Chip';
import { TokenChip } from '@/components/prompt/TokenChip';
import { promptVocabulary } from '@/lib/chipVocabulary';
import { PROMPT_LABELS } from '@/lib/promptGroups';
import { resolveChipJump, resolveContextJump, resolvePromptJump, type PromptJumpTarget } from '@/lib/promptJump';
import {
  anatomyRegions,
  CONTEXT_HINTS,
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
 * Shared by the in-game AI Context viewer and the Settings Anatomy hub. The hub reads provenance: tinted
 * template runs, dimmed context, label chips, and a Chips mode that collapses every assembled run to the
 * chip that produced it. The viewer shows real turns and passes `plain`, which keeps this layout but draws
 * every byte verbatim — its dictionary and hydration marks are the only color there.
 *
 * Given `onJump`, an authored run becomes a button onto the editor that owns it, and in Chips mode a chip
 * becomes one too — onto its own placement in that editor, or onto the anatomy of the prompt that wrote it.
 */

/** How the request is drawn: as the template's chips, or as the bytes the model receives. */
export type AnatomyViewMode = 'chips' | 'resolved';

/**
 * Marks one run's own element, so the two views can be scrolled to the same place.
 *
 * Both draw exactly one of these per run, in the same order — a chip in one, the text it stands for in the
 * other — which is what lets a position captured in either be reproduced in the other. The pairing is by
 * construction here, not by a selector that happens to match the same count.
 */
export const ANATOMY_RUN_ATTR = 'data-anatomy-run';

/** The anatomy draws prompt-variable chips only, and never inserts one, so it needs no palette. */
const ANATOMY_VOCABULARY = promptVocabulary([]);

/** Per-source accent. Each has a light and a dark face, since both surfaces render in either theme.
 *  `markHot` and `chipEdge` dress a clickable run: hovering any piece of a source deepens the tint on
 *  every piece of it (state, not `hover:` — a template split by chips is several marks, and only the one
 *  under the pointer would light), and the label chip wears button chrome. Full literals per source —
 *  Tailwind cannot build class names at runtime. */
const SOURCE_STYLES: Record<AnatomySource, { chip: string; mark: string; markHot: string; chipEdge: string }> = {
  'system-template': { chip: 'bg-violet-500/15 text-violet-700 dark:text-violet-300', mark: 'bg-violet-400/20', markHot: 'bg-violet-400/40', chipEdge: 'border-violet-500/40' },
  'user-template': { chip: 'bg-amber-500/15 text-amber-700 dark:text-amber-300', mark: 'bg-amber-400/25', markHot: 'bg-amber-400/45', chipEdge: 'border-amber-500/40' },
  recap: { chip: 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300', mark: 'bg-cyan-400/20', markHot: 'bg-cyan-400/40', chipEdge: 'border-cyan-500/40' },
  now: { chip: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300', mark: 'bg-emerald-400/20', markHot: 'bg-emerald-400/40', chipEdge: 'border-emerald-500/40' },
  recall: { chip: 'bg-sky-500/15 text-sky-700 dark:text-sky-300', mark: 'bg-sky-400/20', markHot: 'bg-sky-400/40', chipEdge: 'border-sky-500/40' },
  direction: { chip: 'bg-rose-500/15 text-rose-700 dark:text-rose-300', mark: 'bg-rose-400/20', markHot: 'bg-rose-400/40', chipEdge: 'border-rose-500/40' },
};

const ROLE_LABELS: Record<AnatomyBlock['role'], string> = {
  system: 'system',
  user: 'user',
  assistant: 'assistant',
};

export interface RequestAnatomyViewProps {
  blocks: AnatomyBlock[];
  mode: AnatomyViewMode;
  /** Which kind of request these blocks are, so a click resolves to the prompt that owns the run. */
  type?: AIRequestType;
  /** Called with where a clicked run or chip leads. Absent leaves everything inert. */
  onJump?: (target: PromptJumpTarget) => void;
  /**
   * Optional enrichment for one slice of text — the AI-context viewer's dictionary and hydration
   * highlighting. Called per run, so a highlighter never has to know about runs; `start` is where the
   * slice begins in the block, which is what lets a highlighter address the block's own text. Absent
   * renders plain text.
   */
  renderText?: (text: string, block: AnatomyBlock, blockIndex: number, start: number) => ReactNode;
  /**
   * Verbatim rendering: every run's text draws unstyled, unnamed, and inert — no tint, no dim, no label
   * chips, no jumps. Keeps the regions, the chat stagger, and the font. The AI-context viewer reads this
   * way so its dictionary and hydration marks are the only color on the page.
   */
  plain?: boolean;
  /** Extra classes on the outer container. */
  className?: string;
}

function AuthoredRun({
  source,
  named,
  flat,
  onJump,
  hot,
  onHover,
  children,
}: {
  source: AnatomySource;
  named: boolean;
  /** Chips mode: the prose stays plain — with everything assembled collapsed to chips, all visible text
   *  is the player's own, so a tint would mark the whole page. The one label keeps the accent. */
  flat?: boolean;
  onJump?: () => void;
  /** Another piece of this source is under the pointer, so this one lights with it. */
  hot?: boolean;
  onHover?: (source: AnatomySource | null) => void;
  children: ReactNode;
}) {
  const style = SOURCE_STYLES[source];
  if (flat) {
    if (!named) return <>{children}</>;
    const labelClass = cn('mr-1 rounded-sm px-1 align-middle text-meta font-medium', style.chip);
    return (
      <>
        {onJump ? (
          <button
            type="button"
            onClick={onJump}
            title={`Open the ${SOURCE_LABELS[source]}`}
            className={cn(
              labelClass,
              'border shadow-sm cursor-pointer hover:brightness-125',
              'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
              style.chipEdge,
            )}
          >
            {SOURCE_LABELS[source]}
          </button>
        ) : (
          <span className={labelClass}>{SOURCE_LABELS[source]}</span>
        )}
        {children}
      </>
    );
  }
  const body = (
    <>
      {named && (
        <span
          className={cn(
            'mr-1 rounded-sm px-1 align-middle text-meta font-medium',
            style.chip,
            // On a clickable run the chip wears button chrome, so one small element per block carries the
            // affordance while the text itself stays a plain highlight.
            onJump && cn('border shadow-sm', style.chipEdge),
          )}
        >
          {SOURCE_LABELS[source]}
        </span>
      )}
      {children}
    </>
  );
  if (!onJump) return <mark className={cn('rounded-sm px-0.5 text-inherit', style.mark)}>{body}</mark>;
  // The mark itself is the control: a <button> is an atomic inline-block, which paints its background as
  // one rectangle to the container edge instead of wrapping per line the way highlighted text must. At
  // rest a clickable run looks like any other; the pointer and the deepened tint are the hover signal.
  return (
    <mark
      role="button"
      tabIndex={0}
      onClick={onJump}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onJump(); }
      }}
      onMouseEnter={() => onHover?.(source)}
      onMouseLeave={() => onHover?.(null)}
      onFocus={() => onHover?.(source)}
      onBlur={() => onHover?.(null)}
      title={`Open the ${SOURCE_LABELS[source]}`}
      className={cn(
        'rounded-sm px-0.5 text-inherit cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
        style.mark,
        hot && style.markHot,
      )}
    >
      {body}
    </mark>
  );
}

/** A run's own text, with the blank lines that join it to its neighbors peeled off either end. Those are
 *  assembly, not authorship: left inside the mark they put the label chip at the end of the line above and
 *  highlight an empty line below, and left inside a chip they vanish with the text the chip replaces. */
function peelBreaks(text: string): [string, string, string] {
  const lead = /^\s*/.exec(text)![0];
  if (lead.length === text.length) return [text, '', ''];
  const body = text.slice(lead.length).replace(/\s+$/, '');
  return [lead, body, text.slice(lead.length + body.length)];
}

/** What the app assembled, drawn as the bytes it is: dimmed, so it reads apart from the player's own text
 *  without anything being said about it. */
function ResolvedContext({ children }: { children: ReactNode }) {
  return (
    <span {...{ [ANATOMY_RUN_ATTR]: '' }} className="text-muted-foreground/70">
      <span className="opacity-70">{children}</span>
    </span>
  );
}

/** A run the app assembled, collapsed to its own chip: a short title-case name, the plain-words
 *  explanation in the tooltip. Deliberately unlike a template chip — nothing in an editor answers to it. */
function AssemblyChip({ label, title }: { label: string; title: string }) {
  return (
    <span
      title={title}
      className={cn(CHIP_BASE, 'border border-dashed border-muted-foreground/50 bg-muted/60 text-muted-foreground align-baseline')}
    >
      {label}
    </span>
  );
}

/** A chip's click and the tooltip that names where it goes, resolved as one so the two cannot disagree —
 *  a chip with nothing behind it gets neither. */
export interface ChipJump {
  go: () => void;
  destination: string;
}

/** A chip in the anatomy, clickable where it leads somewhere. The button is what carries the keyboard and
 *  the hover affordance; the pill inside it is the same one the editor draws. */
function ChipRun({ run, jumpTo }: { run: AnatomyRun; jumpTo?: (run: AnatomyRun) => ChipJump | undefined }) {
  const jump = jumpTo?.(run);
  const pill = run.chip ? (
    <TokenChip token={run.chip} vocab={ANATOMY_VOCABULARY} neutral title={jump?.destination} />
  ) : run.contextLabel ? (
    <AssemblyChip
      label={CONTEXT_LABELS[run.contextLabel]}
      title={jump?.destination ?? CONTEXT_HINTS[run.contextLabel]}
    />
  ) : null;
  if (!pill) return null;
  if (!jump) return pill;
  return (
    <button
      type="button"
      onClick={jump.go}
      title={jump.destination}
      className="rounded align-baseline hover:brightness-110 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
    >
      {pill}
    </button>
  );
}

/** One block's content, split at its run boundaries. Text outside every run (a request-layer suffix, or a
 *  capture from before the sidecar existed) renders plain rather than vanishing. */
function BlockBody({
  block,
  blockIndex,
  mode,
  plain,
  renderText,
  jumpTo,
  chipJumpTo,
}: {
  block: AnatomyBlock;
  blockIndex: number;
  mode: AnatomyViewMode;
  plain?: boolean;
  renderText?: RequestAnatomyViewProps['renderText'];
  /** What clicking a run of this source should do, or undefined where nothing owns it. */
  jumpTo?: (source: AnatomySource) => (() => void) | undefined;
  /** A chip's click and destination, or undefined where it leads nowhere. */
  chipJumpTo?: (run: AnatomyRun) => ChipJump | undefined;
}) {
  const draw = (text: string, start: number): ReactNode =>
    (renderText ? renderText(text, block, blockIndex, start) : text);
  // Which source is under the pointer, so every piece of it lights together — a template split by chips
  // is several marks, and lighting only the hovered one reads as disconnected fragments.
  const [hotSource, setHotSource] = useState<AnatomySource | null>(null);
  const parts: ReactNode[] = [];
  // A source is named once per block. A template broken up by a dozen chips is still one field, and a
  // dozen identical chips down the margin says nothing the first one didn't; the accent carries the rest.
  const named = new Set<AnatomySource>();
  let at = 0;
  block.runs.forEach((run, i) => {
    if (run.start > at) parts.push(<span key={`gap-${i}`}>{draw(block.content.slice(at, run.start), at)}</span>);
    const text = block.content.slice(run.start, run.end);
    if (plain) {
      parts.push(<span key={i} {...{ [ANATOMY_RUN_ATTR]: '' }}>{draw(text, run.start)}</span>);
      at = run.end;
      return;
    }
    // A chip's run is the value the chip injected, not the prose the author typed around it — so a run
    // carrying one is a chip wherever it came from.
    const authored = run.chip ? undefined : run.source;
    if (authored) {
      // The joins either side stay outside the mark, so the label chip leads the run's first real word.
      const [lead, body, tail] = peelBreaks(text);
      // An all-whitespace run draws no chip, so it must not spend the source's one naming either.
      const firstOfSource = !!body && !named.has(authored);
      if (body) named.add(authored);
      parts.push(
        <span key={i} {...{ [ANATOMY_RUN_ATTR]: '' }}>
          {lead ? draw(lead, run.start) : null}
          {body ? (
            <AuthoredRun
              source={authored}
              named={firstOfSource}
              flat={mode === 'chips'}
              onJump={jumpTo?.(authored)}
              hot={hotSource === authored}
              onHover={setHotSource}
            >
              {draw(body, run.start + lead.length)}
            </AuthoredRun>
          ) : null}
          {tail ? draw(tail, run.end - tail.length) : null}
        </span>,
      );
    } else if (mode === 'chips' && (run.chip || run.contextLabel)) {
      // The joins either side are the request's shape, so they survive the collapse — only the value the
      // run stands for is replaced by the chip that asked for it.
      const [lead, , tail] = peelBreaks(text);
      parts.push(
        <span key={i} {...{ [ANATOMY_RUN_ATTR]: '' }}>
          {lead || null}
          <ChipRun run={run} jumpTo={chipJumpTo} />
          {tail || null}
        </span>,
      );
    } else {
      parts.push(<ResolvedContext key={i}>{draw(text, run.start)}</ResolvedContext>);
    }
    at = run.end;
  });
  if (at < block.content.length) parts.push(<span key="tail">{draw(block.content.slice(at), at)}</span>);
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

export function RequestAnatomyView({ blocks, mode, type, onJump, renderText, plain, className }: RequestAnatomyViewProps) {
  const jumpTo = useMemo(
    () => (onJump && type
      ? (source: AnatomySource) => {
          const target = resolvePromptJump(source, type);
          return target ? () => onJump(target) : undefined;
        }
      : undefined),
    [onJump, type],
  );
  // A chip leads either to its own placement in the editor that holds it, or — for a block another prompt
  // wrote — to that prompt's anatomy.
  const chipJumpTo = useMemo(
    () => (onJump
      ? (run: AnatomyRun): ChipJump | undefined => {
          if (run.chip) {
            const target = run.source && type ? resolveChipJump(run.source, type, run.chip) : null;
            if (!target || !run.source) return undefined;
            return { go: () => onJump(target), destination: `Show this chip in the ${SOURCE_LABELS[run.source]}` };
          }
          if (run.contextLabel) {
            const target = resolveContextJump(run.contextLabel);
            if (!target) return undefined;
            return {
              go: () => onJump(target),
              destination: `${CONTEXT_HINTS[run.contextLabel]} — open the ${PROMPT_LABELS[target.tab]} prompt`,
            };
          }
          return undefined;
        }
      : undefined),
    [onJump, type],
  );
  const body = (block: AnatomyBlock, index: number) => (
    <BlockBody
      block={block}
      blockIndex={index}
      mode={mode}
      plain={plain}
      renderText={renderText}
      jumpTo={jumpTo}
      chipJumpTo={chipJumpTo}
    />
  );
  const { system, messages } = anatomyRegions(blocks);
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
              // Tinted apart the way a chat renders them: the player side carries the accent, the model
              // side stays neutral, so who each block came from reads at a glance.
              className={cn(
                'rounded-md border p-2',
                block.role === 'assistant'
                  ? 'mr-4 border-border bg-card sm:mr-6'
                  : 'ml-4 border-primary/40 bg-primary/10 sm:ml-6',
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
