import { createContext } from 'react';

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
}

/** Token → the value its chip opens on, for the Values tab. */
export const OpenValuesContext = createContext<Record<string, OpenValueView>>({});
