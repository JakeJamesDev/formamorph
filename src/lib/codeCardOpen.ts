import { createContext, useContext } from 'react';
import type { CodeCardItem } from '@/lib/codeCards';

/** Opens a card's item in the World Editor. */
export type OpenCodeCardItem = (item: CodeCardItem) => void;

/** Provided by the World Editor. A host that must not navigate away provides null. */
export const CodeCardOpenContext = createContext<OpenCodeCardItem | null>(null);

/** The World Editor's Open, or undefined where a card has no Open. */
export function useCodeCardOpen(): OpenCodeCardItem | undefined {
  return useContext(CodeCardOpenContext) ?? undefined;
}
