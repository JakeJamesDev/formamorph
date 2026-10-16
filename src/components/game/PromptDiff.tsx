/**
 * The world's prompt for one pass, shown against the prompt Formamorph ships for that pass: one flowing
 * document with the world's additions tinted and the default's removals struck through in place. The
 * baseline is always the shipped default, never the player's own preset — the question this answers is
 * "what did this author change", which a player's customized preset would muddy.
 */
import { Fragment, useMemo, type ReactNode } from 'react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { TokenChip } from '@/components/prompt/TokenChip';
import { placeholderVocabulary, type ChipVocabulary } from '@/lib/chipVocabulary';
import { decodePlaceholderToken, parsePlaceholderText } from '@/lib/placeholders';
import type { PlaceholderOwners } from '@/lib/placeholderHomes';
import { promptWordDiff, type PromptDiffPart } from '@/lib/promptDiff';
import { SHIPPED_PROMPT_DEFAULTS, type WorldPromptKind } from '@/lib/worldPrompt';
import type { Placeholder } from '@/types';

/** Changes = the diff against the shipped default; Raw = the world's text exactly as authored. */
export type PromptDiffMode = 'changes' | 'raw';

/** Shared `pre` treatment: the text as authored, prompt chips as their raw tokens, wrapped rather than scrolled. */
const PROMPT_PRE_CLASS = 'text-label font-mono whitespace-pre-wrap';

/** A placeholder chip whose definition the world no longer carries. */
const UNKNOWN_PLACEHOLDER_LABEL = 'Placeholder';

const NO_PLACEHOLDERS: readonly Placeholder[] = [];

/** `text` with each placeholder token drawn as its chip. The diff keeps tokens whole, so no part holds half of one. */
function withPlaceholderChips(text: string, vocab: ChipVocabulary): ReactNode {
  if (!text.includes('{{ph:')) return text;
  return parsePlaceholderText(text).map((seg, i) =>
    seg.type === 'variable' && decodePlaceholderToken(seg.token)
      ? <TokenChip key={i} token={seg.token} vocab={vocab} />
      : seg.type === 'variable' ? seg.token : seg.value,
  );
}

/**
 * The Changes/Raw switch, sized to sit beside a dialog title rather than on a row of its own. A value
 * picker over the pass tabs' panel rather than a second tab set, so it carries no dangling `aria-controls`.
 * The coloring's legend is the dialog's own description text, not this control's job.
 */
export function PromptDiffModeToggle({
  mode, onModeChange,
}: {
  mode: PromptDiffMode;
  onModeChange: (mode: PromptDiffMode) => void;
}) {
  return (
    <ToggleGroup
      type="single"
      value={mode}
      className="h-8"
      // A single ToggleGroup clears its value when the active item is clicked again; one of the two
      // views is always showing, so an empty result is ignored rather than stored.
      onValueChange={(v) => { if (v) onModeChange(v as PromptDiffMode); }}
    >
      <ToggleGroupItem value="changes" className="px-2 py-0.5 text-meta">Changes</ToggleGroupItem>
      <ToggleGroupItem value="raw" className="px-2 py-0.5 text-meta">Raw</ToggleGroupItem>
    </ToggleGroup>
  );
}

/**
 * How a diff run is marked. A changed line shows faintly tinted, old above new; the words that actually
 * differ inside it are solid, in black so they read in either theme. Removals stay struck through.
 */
const DIFF_PART_CLASS = {
  added: 'no-underline bg-emerald-500/15 rounded-[2px]',
  addedChanged: 'no-underline bg-emerald-400 text-black rounded-[2px]',
  // A chip is inline-flex, which the strikethrough does not reach, so it takes its own.
  removed: 'bg-red-500/10 text-red-600 dark:text-red-400 line-through decoration-red-500/70 rounded-[2px] [&_[data-chip]]:line-through',
  removedChanged: 'bg-red-400 text-black line-through decoration-black/60 rounded-[2px] [&_[data-chip]]:line-through',
} as const;

/** The runs of a diff, marked as added, removed or unchanged; `render` draws a run's text (its chips, say). */
export function DiffParts({ parts, render = (value) => value }: {
  parts: readonly PromptDiffPart[];
  render?: (value: string) => ReactNode;
}) {
  return parts.map((part, i) =>
    part.added ? (
      <ins key={i} className={part.changed ? DIFF_PART_CLASS.addedChanged : DIFF_PART_CLASS.added}>{render(part.value)}</ins>
    ) : part.removed ? (
      <Fragment key={i}>
        <del className={part.changed ? DIFF_PART_CLASS.removedChanged : DIFF_PART_CLASS.removed}>{render(part.value)}</del>
        {/* The new lines start under the old ones. Old lines that end the text carry no break of their own. */}
        {parts[i + 1]?.added && !part.value.endsWith('\n') ? '\n' : null}
      </Fragment>
    ) : (
      <span key={i}>{render(part.value)}</span>
    ),
  );
}

/**
 * Two prompt texts as one flowing document: `base` is the default, `text` the changed one. `renderChips`
 * draws the chips of a run; the diff keeps each chip whole, so no run holds half of one.
 */
export function PromptDiffView({
  base, text, mode, renderChips,
}: {
  base: string;
  text: string;
  mode: PromptDiffMode;
  renderChips: (value: string) => ReactNode;
}) {
  const parts = useMemo(
    () => (mode === 'changes' ? promptWordDiff(base, text) : null), [base, text, mode],
  );

  if (!parts) return <pre className={PROMPT_PRE_CLASS}>{renderChips(text)}</pre>;

  return <pre className={PROMPT_PRE_CLASS}><DiffParts parts={parts} render={renderChips} /></pre>;
}

export function PromptDiff({
  kind, text, mode, placeholders = NO_PLACEHOLDERS, owners,
}: {
  kind: WorldPromptKind;
  text: string;
  mode: PromptDiffMode;
  /** Every placeholder the world carries, so a placeholder chip reads as its name. */
  placeholders?: readonly Placeholder[];
  owners?: PlaceholderOwners;
}) {
  const vocab = useMemo<ChipVocabulary>(() => {
    const inner = placeholderVocabulary(placeholders, { owners });
    const known = new Set(placeholders.map((p) => p.id));
    return {
      ...inner,
      display: (t) => (known.has(decodePlaceholderToken(t)?.id ?? '') ? inner.display?.(t) : UNKNOWN_PLACEHOLDER_LABEL),
    };
  }, [placeholders, owners]);

  return (
    <PromptDiffView
      base={SHIPPED_PROMPT_DEFAULTS[kind]}
      text={text}
      mode={mode}
      renderChips={(value) => withPlaceholderChips(value, vocab)}
    />
  );
}
