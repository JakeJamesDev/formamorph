import React, { useRef } from 'react';
import type { BubbleAction } from '@/lib/bubbleActions';
import { CONTINUE_CHOICE, choiceRuns } from '@/lib/choices';
import { QUOTE_CLASS } from '@/lib/quoteSegments';
import { BubbleActionButton, BubbleMenu } from './BubbleMenu';

// Unsent player bubbles: dashed and light until hover, focus, or selection fill them (without the dialogue color).
const BUBBLE = [
  'ml-auto block w-fit max-w-[85%] rounded-2xl rounded-br-sm border border-dashed border-primary/60 bg-primary/10',
  'px-3 py-2 text-left text-foreground transition-colors',
  'hover:border-solid hover:bg-primary hover:text-primary-foreground',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-foreground',
  'focus-visible:border-solid focus-visible:bg-primary focus-visible:text-primary-foreground',
  'data-[selected]:border-solid data-[selected]:bg-primary data-[selected]:text-primary-foreground',
  '[&:is(:hover,:focus-visible,[data-selected])_.dialogue-quote]:!text-inherit',
  'disabled:pointer-events-none disabled:opacity-50',
].join(' ');

/** The choice text, with its bold and quoted runs. */
function ChoiceText({ choice }: { choice: string }) {
  // One inline wrapper: as separate flex items the runs would drop the spaces at their edges.
  return (
    <span>
      {choiceRuns(choice).map((run, i) => {
        const text = run.quoted ? <span className={QUOTE_CLASS}>{run.text}</span> : run.text;
        return run.bold ? <strong key={i}>{text}</strong> : <React.Fragment key={i}>{text}</React.Fragment>;
      })}
    </span>
  );
}

/** The press handlers of one choice button: the Pages stage-and-append contract. */
type ChoicePress = (choice: string) => Pick<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  'onClick' | 'onPointerDown' | 'onPointerUp' | 'onPointerLeave' | 'onPointerCancel'
>;

/**
 * The latest turn's choices in Chat, as unsent player bubbles. The block's actions show as icons under the
 * choices and in its right-click menu.
 */
export function ChatChoices({ choices, showContinue, disabled, isSelected, choicePress, actions }: {
  choices: string[];
  showContinue: boolean;
  disabled: boolean;
  /** Whether the choice's text is staged in the input. */
  isSelected: (choice: string) => boolean;
  choicePress: ChoicePress;
  actions: BubbleAction[];
}) {
  // A touch long press on a choice appends it, so that press never reaches the block's menu.
  const touchPress = useRef(false);
  const all = showContinue ? [...choices, CONTINUE_CHOICE] : choices;
  if (all.length === 0 && actions.length === 0) return null;

  return (
    <BubbleMenu actions={actions} disabled={disabled}>
      <div data-testid="chat-choices" className="mt-3 flex flex-col gap-2">
        {all.map((choice, index) => {
          const press = choicePress(choice);
          return (
            <button
              key={index}
              type="button"
              className={BUBBLE}
              data-selected={isSelected(choice) ? '' : undefined}
              disabled={disabled}
              {...press}
              onPointerDown={(event) => {
                press.onPointerDown?.(event);
                touchPress.current = event.pointerType !== 'mouse';
                if (touchPress.current) event.stopPropagation();
              }}
              onContextMenu={(event) => {
                if (touchPress.current) event.stopPropagation();
                touchPress.current = false;
              }}
            >
              {choice === CONTINUE_CHOICE ? choice : <ChoiceText choice={choice} />}
            </button>
          );
        })}
        {actions.length > 0 && (
          <div className="flex justify-end">
            {actions.map((action) => <BubbleActionButton key={action.key} action={action} />)}
          </div>
        )}
      </div>
    </BubbleMenu>
  );
}
