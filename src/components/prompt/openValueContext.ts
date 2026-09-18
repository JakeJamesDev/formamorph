import { createContext } from 'react';
import type { NodeKey } from 'lexical';

/** The slot an open chip keeps its value in. */
export const VALUE_SLOT = 'value';

/** Which way a chevron steps through a placeholder's values. */
export type StepDirection = -1 | 1;

/** Where a value sits in its placeholder's list, and how to step to its neighbors. */
export interface OpenValuePager {
  /** Zero-based; the header counts from one. */
  index: number;
  count: number;
  /** What the open stop is: one of the placeholder's values, or a pin aimed at it. */
  unit: 'Value' | 'Pin';
  /** Open the previous (-1) or next (1) value. */
  step: (direction: StepDirection) => void;
}

/** What an open chip shows: its value's raw text, and what its header says about that value. */
export interface OpenValueView {
  text: string;
  /** The verbose name for the value, shown on the active header only. Empty where the value is on no list. */
  label: string;
  /** What the value is, shown in both header forms. Absent for an ordinary listed value. */
  mark?: 'Pinned' | 'No Values';
  /** The header's pager. Absent when there is nothing to step: a Variable, a pinned chip, an empty placeholder. */
  pager?: OpenValuePager;
  /** Store new text for the open value. Absent when nothing can be written. */
  write?: (text: string) => void;
  /** Names what `write` stores to. Copies that share it mirror one another. */
  valueKey?: string;
}

/** Token → the value its chip opens on, for the Values tab. */
export const OpenValuesContext = createContext<Record<string, OpenValueView>>({});

/**
 * The "Edit Value" path from a chip's flyout to its open value. The flyout asks, the Values tab opens, and
 * the value that answers takes the caret and settles the ask. A request outlives one render because the
 * value it names does not exist yet when the flyout makes it.
 */
export interface EditValueRelay {
  /** Asks for a chip's value. Absent where the field has no value to edit, which hides the flyout item. */
  ask: ((chip: NodeKey) => void) | null;
  /** The chip an ask named, while it waits for a value to answer. */
  asked: NodeKey | null;
  /** Answered: the caret has landed. */
  settle: () => void;
}

const NO_EDIT_VALUE: EditValueRelay = { ask: null, asked: null, settle: () => {} };

export const EditValueContext = createContext<EditValueRelay>(NO_EDIT_VALUE);

/**
 * Which value a field shows in its active form. A value holding the caret is active; with no caret in any
 * value, the header pressed last is. A press on a value that cannot take a caret marks it this way alone.
 */
export interface ActiveValueRelay {
  /** The chip whose header was pressed last, cleared once the caret lands anywhere else in the field. */
  pressed: NodeKey | null;
  press: (chip: NodeKey) => void;
  clear: () => void;
}

const NO_ACTIVE_VALUE: ActiveValueRelay = { pressed: null, press: () => {}, clear: () => {} };

export const ActiveValueContext = createContext<ActiveValueRelay>(NO_ACTIVE_VALUE);

/**
 * Which of a field's open values shows its active form, from the chip holding the caret and the chip whose
 * header took the last press. The caret wins, so the header follows where the author types. A caret the
 * field no longer holds decides nothing: a value that cannot take one keeps its press mark instead.
 */
export function activeValueKey(
  caretKey: NodeKey | null,
  fieldFocused: boolean,
  pressed: NodeKey | null,
): NodeKey | null {
  return fieldFocused && caretKey !== null ? caretKey : pressed;
}
