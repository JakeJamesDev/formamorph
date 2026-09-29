import { createContext, useContext } from 'react';

export interface ListDetailBackTarget {
  onBack: () => void;
  label: string;
}

/** The pushed detail's back target, for its panel to place; `null` side by side and once placed. */
export const ListDetailBackContext = createContext<ListDetailBackTarget | null>(null);

/** Whether a pushed detail is waiting for its panel to place the back arrow. */
export function useListDetailBack(): boolean {
  return useContext(ListDetailBackContext) !== null;
}
