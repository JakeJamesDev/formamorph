import React, { useRef } from 'react';
import type { BubbleAction } from '@/lib/bubbleActions';
import { CONTINUE_CHOICE, choiceRuns, choiceWordCount, splitWords } from '@/lib/choices';
import { QUOTE_CLASS } from '@/lib/quoteSegments';
import { BubbleActionButton, BubbleMenu } from './BubbleMenu';
import { useRowReveal, type RowReveal } from '@/lib/useRowReveal';

// Unsent player bubbles: dashed and light. Hover and focus tint them; only the staged choice takes the fill.
const BUBBLE = [
  'ml-auto block w-fit max-w-[85%] rounded-2xl rounded-br-sm border border-dashed border-primary/60 bg-primary/10',
  'px-3 py-2 text-left text-foreground transition-colors',
  'hover:border-solid hover:bg-primary/25',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary',
  'focus-visible:border-solid focus-visible:bg-primary/25',
  // Staged wins over hover and focus, and the ring takes the fill's foreground.
  'data-[selected]:border-solid data-[selected]:bg-primary data-[selected]:text-primary-foreground',
  'data-[selected]:hover:bg-primary data-[selected]:focus-visible:bg-primary data-[selected]:focus-visible:ring-primary-foreground',
  '[&[data-selected]_.dialogue-quote]:!text-inherit',
  'disabled:pointer-events-none disabled:opacity-50',
].join(' ');

/**
 * The choice text, with its bold and quoted runs. `plainQuotes` gives the quotes the surrounding color.
 * `word` gives each word its entrance, numbered across the runs.
 */
export function ChoiceText({ choice, plainQuotes = false, word }: {
  choice: string;
  plainQuotes?: boolean;
  word?: (index: number) => React.CSSProperties | undefined;
}) {
  let n = 0;
  const words = (text: string): React.ReactNode =>
    word ? splitWords(text).map((piece) => { const i = n++; return <span key={i} style={word(i)}>{piece}</span>; }) : text;
  // One inline wrapper: as separate flex items the runs would drop the spaces at their edges.
  return (
    <span>
      {choiceRuns(choice).map((run, i) => {
        const text = run.quoted
          ? <span className={QUOTE_CLASS} style={plainQuotes ? { color: 'inherit' } : undefined}>{words(run.text)}</span>
          : words(run.text);
        return run.bold ? <strong key={i}>{text}</strong> : <React.Fragment key={i}>{text}</React.Fragment>;
      })}
    </span>
  );
}

/** The press handlers of one choice button: the Pages stage-and-append contract. */
export type ChoicePress = (choice: string) => Pick<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  'onClick' | 'onPointerDown' | 'onPointerUp' | 'onPointerLeave' | 'onPointerCancel'
>;

/**
 * The latest turn's choices in Chat, as unsent player bubbles. The block's actions show as icons under the
 * choices and in its right-click menu.
 */
export function ChatChoices({ choices, showContinue, disabled, isSelected, choicePress, actions, stream = false }: {
  choices: string[];
  /** Stream new choices in word by word, as after a live turn's narration. */
  stream?: boolean;
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
  const reveal: RowReveal = useRowReveal(all, choiceWordCount, stream);
  if (all.length === 0 && actions.length === 0) return null;

  return (
    <BubbleMenu actions={actions} disabled={disabled}>
      <div data-testid="chat-choices" className="mt-3 flex flex-col gap-2">
        {all.map((choice, index) => {
          if (!reveal.shown(index)) return null;
          const press = choicePress(choice);
          return (
            <button
              key={index}
              type="button"
              className={BUBBLE}
              style={reveal.row(index)}
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
              {!reveal.streaming && choice === CONTINUE_CHOICE
                ? choice
                : <ChoiceText choice={choice} word={reveal.streaming ? (w) => reveal.word(index, w) : undefined} />}
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
