/**
 * The world's prompt for one pass, shown against the prompt Formamorph ships for that pass: one flowing
 * document with the world's additions tinted and the default's removals struck through in place. The
 * baseline is always the shipped default, never the player's own preset — the question this answers is
 * "what did this author change", which a player's customized preset would muddy.
 */
import { useMemo, type ReactNode } from 'react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { TokenChip } from '@/components/prompt/TokenChip';
import { placeholderVocabulary, type ChipVocabulary } from '@/lib/chipVocabulary';
import { decodePlaceholderToken, parsePlaceholderText } from '@/lib/placeholders';
import type { PlaceholderOwners } from '@/lib/placeholderHomes';
import { promptWordDiff } from '@/lib/promptDiff';
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
  const base = SHIPPED_PROMPT_DEFAULTS[kind];
  const parts = useMemo(
    () => (mode === 'changes' ? promptWordDiff(base, text) : null), [base, text, mode],
  );
  const vocab = useMemo<ChipVocabulary>(() => {
    const inner = placeholderVocabulary(placeholders, { owners });
    const known = new Set(placeholders.map((p) => p.id));
    return {
      ...inner,
      display: (t) => (known.has(decodePlaceholderToken(t)?.id ?? '') ? inner.display?.(t) : UNKNOWN_PLACEHOLDER_LABEL),
    };
  }, [placeholders, owners]);
  const chips = (value: string) => withPlaceholderChips(value, vocab);

  if (!parts) return <pre className={PROMPT_PRE_CLASS}>{chips(text)}</pre>;

  return (
    <pre className={PROMPT_PRE_CLASS}>
      {parts.map((part, i) =>
        part.added ? (
          <ins key={i} className="no-underline bg-emerald-500/25 rounded-[2px]">{chips(part.value)}</ins>
        ) : part.removed ? (
          <del
            key={i}
            // A chip is inline-flex, which the strikethrough does not reach, so it takes its own.
            className="bg-red-500/10 text-red-600 dark:text-red-400 line-through decoration-red-500/70 rounded-[2px] [&_[data-chip]]:line-through"
          >
            {chips(part.value)}
          </del>
        ) : (
          <span key={i}>{chips(part.value)}</span>
        ),
      )}
    </pre>
  );
}
