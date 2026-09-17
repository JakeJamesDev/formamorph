import { createContext } from 'react';

/** The slot an open chip keeps its value in. */
export const VALUE_SLOT = 'value';

/** What an open chip shows: its value's raw text, and the header's name for that value. */
export interface OpenValueView {
  text: string;
  label: string;
}

/** Token → the value its chip opens on, for the Values tab. */
export const OpenValuesContext = createContext<Record<string, OpenValueView>>({});
