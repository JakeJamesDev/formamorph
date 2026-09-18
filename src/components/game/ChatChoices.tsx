import React from 'react';
import { ListRestart, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tip } from '@/components/ui/tooltip';
import { CONTINUE_CHOICE, choiceRuns } from '@/lib/choices';
import { QUOTE_CLASS } from '@/lib/quoteSegments';

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

/** The latest turn's choices in Chat, as unsent player bubbles, with the Re-generate Choices icon under them. */
export function ChatChoices({ choices, showContinue, disabled, isSelected, choicePress, onRegenerate, regenerating }: {
  choices: string[];
  showContinue: boolean;
  disabled: boolean;
  /** Whether the choice's text is staged in the input. */
  isSelected: (choice: string) => boolean;
  choicePress: ChoicePress;
  /** Absent when the choices request is off. */
  onRegenerate?: () => void;
  regenerating: boolean;
}) {
  const all = showContinue ? [...choices, CONTINUE_CHOICE] : choices;
  if (all.length === 0 && !onRegenerate) return null;

  return (
    <div data-testid="chat-choices" className="mt-3 flex flex-col gap-2">
      {all.map((choice, index) => (
        <button
          key={index}
          type="button"
          className={BUBBLE}
          data-selected={isSelected(choice) ? '' : undefined}
          disabled={disabled}
          {...choicePress(choice)}
        >
          {choice === CONTINUE_CHOICE ? choice : <ChoiceText choice={choice} />}
        </button>
      ))}
      {onRegenerate && (
        <div className="flex justify-end">
          <Tip tip="Re-generate Choices">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              aria-label="Re-generate Choices"
              aria-busy={regenerating || undefined}
              disabled={disabled}
              onClick={onRegenerate}
            >
              {regenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <ListRestart className="h-4 w-4" />}
            </Button>
          </Tip>
        </div>
      )}
    </div>
  );
}
