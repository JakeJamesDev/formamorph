import { createContext } from 'react';
import type { NodeKey } from 'lexical';

/** The slot an open chip keeps its value in. */
export const VALUE_SLOT = 'value';

/** Which way a chevron steps through a placeholder's values. */
export type StepDirection = -1 | 1;

/** What an open chip shows: its value's raw text, and the header's name for that value. */
export interface OpenValueView {
  text: string;
  label: string;
  /** Open the previous (-1) or next (1) value. Absent when there is no other value to open. */
  step?: (direction: StepDirection) => void;
  /** Store new text for the open value. Absent when the value is on no list or nothing can be written. */
  write?: (text: string) => void;
  /** Names the value `write` stores to. Copies that share it mirror one another. */
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
