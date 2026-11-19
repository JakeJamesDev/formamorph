import { optionItemLines, optionRowLines, type OptionRowLinesWorld } from '@/lib/optionStatRowLines';
import { cn } from '@/lib/utils';
import { StatChangeItem } from './StatChangeItem';
import type { OptionStatChange, PersonaRef, Placement } from '@/types';

/** The Option context a list needs: the world's stats and entities, and whether this is the in-play tab. */
export interface OptionRowsView {
  world: OptionRowLinesWorld;
  /** The in-play tab leaves starting rows out. */
  play?: boolean;
  /** Who the player plays as, which decides where each Starting Item goes. */
  persona?: PersonaRef;
}

/** One Option value's stat rows under its name, in the trait-list form ("Gold: +100"), then its Starting Items
 *  outside the in-play tab. Draws nothing when no row is readable. `lead` names a Boolean's state ("When On"). */
export function OptionStatRowList({ rows, items, view, resolveText, lead, className }: {
  rows: readonly OptionStatChange[] | undefined;
  items?: readonly Placement[];
  view: OptionRowsView | undefined;
  resolveText: (text: string) => string;
  lead?: string;
  className?: string;
}) {
  if (!view) return null;
  const lines = optionRowLines(rows, view.world, { play: view.play, resolveText });
  const itemLines = view.play ? [] : optionItemLines(items, view.world, view.persona, resolveText);
  if (!lines.length && !itemLines.length) return null;
  return (
    <>
      {lead && <span className="mt-2 block text-meta text-muted-foreground">{lead}</span>}
      <ul className={cn('mt-1 list-inside list-disc text-helper text-muted-foreground', className)} data-testid="option-stat-rows">
        {lines.map((line, index) => <StatChangeItem key={index} label={line.label} value={line.value} type={line.type} />)}
        {itemLines.map((line, index) => <li key={`item-${index}`}>{line}</li>)}
      </ul>
    </>
  );
}
