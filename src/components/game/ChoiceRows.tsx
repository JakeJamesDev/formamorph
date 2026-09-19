import { ChevronRight } from 'lucide-react';
import type { BubbleAction } from '@/lib/bubbleActions';
import { CONTINUE_CHOICE } from '@/lib/choices';
import { BubbleActionButton } from './BubbleMenu';
import { ChoiceText, type ChoicePress } from './ChatChoices';

const ROW = [
  'flex w-full items-start gap-3 px-3 py-2 text-left text-foreground transition-colors',
  'hover:bg-primary/10',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary',
  'aria-pressed:bg-primary aria-pressed:text-primary-foreground aria-pressed:focus-visible:ring-primary-foreground',
  'disabled:pointer-events-none',
].join(' ');

/**
 * The viewed page's choices in Pages, as numbered rows. The continue choice is the last row, marked with a
 * chevron. The block's actions show as icons under the rows.
 */
export function ChoiceRows({ choices, showContinue, disabled, isSelected, continueSelected, choicePress, actions }: {
  choices: string[];
  showContinue: boolean;
  disabled: boolean;
  /** Whether a generated choice shows as picked: staged in the input, or taken on a past page. */
  isSelected: (choice: string, index: number) => boolean;
  /** Whether the continue row shows as picked. */
  continueSelected: boolean;
  choicePress: ChoicePress;
  actions: BubbleAction[];
}) {
  const rows = showContinue ? [...choices, CONTINUE_CHOICE] : choices;
  if (rows.length === 0 && actions.length === 0) return null;

  return (
    <div data-testid="choice-rows" className="mt-4">
      {rows.length > 0 && (
        <div className="divide-y divide-border overflow-hidden rounded-md border border-border">
          {rows.map((choice, index) => {
            const isContinue = index === choices.length;
            const selected = isContinue ? continueSelected : isSelected(choice, index);
            return (
              <button
                key={index}
                type="button"
                className={disabled && !selected ? `${ROW} opacity-50` : ROW}
                aria-pressed={selected}
                disabled={disabled}
                {...choicePress(choice)}
              >
                <span aria-hidden className="w-5 shrink-0 text-right tabular-nums text-muted-foreground [[aria-pressed=true]_&]:text-inherit">
                  {isContinue ? <ChevronRight className="inline h-4 w-4 align-[-0.2em]" /> : `${index + 1}.`}
                </span>
                {/* On the primary fill the dialogue color loses contrast, so a picked row's quotes inherit. */}
                <span className="min-w-0 flex-1 break-words">
                  {isContinue ? choice : <ChoiceText choice={choice} plainQuotes={selected} />}
                </span>
              </button>
            );
          })}
        </div>
      )}
      {actions.length > 0 && (
        <div className="flex justify-end">
          {actions.map((action) => <BubbleActionButton key={action.key} action={action} />)}
        </div>
      )}
    </div>
  );
}
