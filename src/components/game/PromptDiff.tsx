/**
 * The world's prompt for one pass, shown against the prompt Formamorph ships for that pass: one flowing
 * document with the world's additions tinted and the default's removals struck through in place. The
 * baseline is always the shipped default, never the player's own preset — the question this answers is
 * "what did this author change", which a player's customized preset would muddy.
 */
import { useMemo } from 'react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { promptWordDiff } from '@/lib/promptDiff';
import { SHIPPED_PROMPT_DEFAULTS, type WorldPromptKind } from '@/lib/worldPrompt';

/** Changes = the diff against the shipped default; Raw = the world's text exactly as authored. */
export type PromptDiffMode = 'changes' | 'raw';

/** Shared `pre` treatment: the text as authored, chips as their raw tokens, wrapped rather than scrolled. */
const PROMPT_PRE_CLASS = 'text-label font-mono whitespace-pre-wrap';

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
  kind, text, mode,
}: {
  kind: WorldPromptKind;
  text: string;
  mode: PromptDiffMode;
}) {
  const base = SHIPPED_PROMPT_DEFAULTS[kind];
  const parts = useMemo(
    () => (mode === 'changes' ? promptWordDiff(base, text) : null), [base, text, mode],
  );

  if (!parts) return <pre className={PROMPT_PRE_CLASS}>{text}</pre>;

  return (
    <pre className={PROMPT_PRE_CLASS}>
      {parts.map((part, i) =>
        part.added ? (
          <ins key={i} className="no-underline bg-emerald-500/25 rounded-[2px]">{part.value}</ins>
        ) : part.removed ? (
          <del
            key={i}
            className="bg-red-500/10 text-red-600 dark:text-red-400 line-through decoration-red-500/70 rounded-[2px]"
          >
            {part.value}
          </del>
        ) : (
          <span key={i}>{part.value}</span>
        ),
      )}
    </pre>
  );
}
