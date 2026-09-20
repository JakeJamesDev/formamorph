import { Fragment } from 'react';
import type { BubbleAction } from '@/lib/bubbleActions';
import { CONTINUE_CHOICE } from '@/lib/choices';
import { BubbleActionButton } from './BubbleMenu';
import { ChoiceText, type ChoicePress } from './ChatChoices';

const ROW = [
  'flex min-w-0 flex-1 items-start px-3 py-2 text-left text-foreground transition-colors',
  'hover:bg-primary/10',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary',
  'aria-pressed:bg-primary aria-pressed:text-primary-foreground aria-pressed:focus-visible:ring-primary-foreground',
  'disabled:pointer-events-none',
].join(' ');

/** Choice rows, a separated continue action, and the block's action icons. */
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
  const actionButtons = actions.map((action) => (
    <BubbleActionButton key={action.key} action={action} className={showContinue ? 'h-auto w-10 rounded-none border-0' : undefined} />
  ));

  return (
    <div data-testid="choice-rows" className="mt-4">
      {rows.length > 0 && (
        <div className="overflow-hidden rounded-md border border-border">
          {rows.map((choice, index) => {
            const isContinue = index === choices.length;
            const selected = isContinue ? continueSelected : isSelected(choice, index);
            return (
              <Fragment key={index}>
                {isContinue && choices.length > 0 && (
                  <div className="mx-3 mt-2 mb-1.5 flex items-center gap-3 text-foreground" aria-hidden>
                    <span className="h-hairline flex-1 bg-current" />
                    <span className="text-helper">or</span>
                    <span className="h-hairline flex-1 bg-current" />
                  </div>
                )}
                <div className="flex items-stretch">
                  <button
                    type="button"
                    className={`${ROW}${!isContinue && index > 0 ? ' border-t border-border' : ''}${disabled && !selected ? ' opacity-50' : ''}`}
                    aria-pressed={selected}
                    disabled={disabled}
                    {...choicePress(choice)}
                  >
                    {/* On the primary fill the dialogue color loses contrast, so a picked row's quotes inherit. */}
                    <span className="min-w-0 flex-1 break-words">
                      {isContinue ? choice : <ChoiceText choice={choice} plainQuotes={selected} />}
                    </span>
                  </button>
                  {isContinue && actions.length > 0 && (
                    <>
                      <span aria-hidden className="my-2 w-hairline shrink-0 bg-border" />
                      <div className="flex shrink-0">{actionButtons}</div>
                    </>
                  )}
                </div>
              </Fragment>
            );
          })}
        </div>
      )}
      {!showContinue && actions.length > 0 && (
        <div className="flex justify-end">
          {actionButtons}
        </div>
      )}
    </div>
  );
}
