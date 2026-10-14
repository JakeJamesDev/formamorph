import { createContext, useContext } from 'react';
import type { CodeCardItem } from '@/lib/codeCards';
import type { CodeUse } from '@/lib/codeUses';

/** Opens a card's item in the World Editor. */
export type OpenCodeCardItem = (item: CodeCardItem) => void;

/** Where a card's links lead in the World Editor. */
export interface CodeCardNavigation {
  open: OpenCodeCardItem;
  /** Shows a use's box with the caret on its line. */
  goToUse: (use: CodeUse) => void;
}

/** Provided by the World Editor. A host that must not navigate away provides null, which hides Open and Find
 *  All Uses together. */
export const CodeCardNavigationContext = createContext<CodeCardNavigation | null>(null);

/** The World Editor's navigation, or undefined where a card has no Open or Find All Uses. */
export function useCodeCardNavigation(): CodeCardNavigation | undefined {
  return useContext(CodeCardNavigationContext) ?? undefined;
}
