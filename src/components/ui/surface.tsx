/**
 * How a screen, dialog or tab strip says that it is open. The app provides the surface registry as the
 * reporter. With no reporter, as on the account site, a report does nothing. This file imports nothing
 * from the app, so the shared dialog and tab wrappers stay leaves.
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

/** Where reports go. The surface registry is one. */
export interface SurfaceReporter {
  /**
   * Sets what the entry at this place shows. A greater place is above a smaller one. A screen or dialog
   * has no layer. A tab names the place of the screen or dialog it is in.
   */
  report(place: number, id: string | null, layer: number | null): void;
  clear(place: number): void;
}

/**
 * The names a report accepts. The app narrows `id` to its surface ids and `ledger` to its tab ledgers
 * in `src/lib/surface/surfaceNames.ts`; with no narrowing, any text is accepted.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface SurfaceNames {}
export type SurfaceIdName = SurfaceNames extends { id: infer Id extends string } ? Id : string;
export type SurfaceLedgerName = SurfaceNames extends { ledger: infer Ledger extends string } ? Ledger : string;

export const SurfaceReporterContext = createContext<SurfaceReporter | null>(null);

/** The place of the screen or dialog a tab is in. */
const LayerContext = createContext<number | null>(null);

let lastPlace = 0;

/**
 * Reports an entry while the caller is mounted. The place is taken during the first render, where a
 * parent runs before its children, so an outer tab stays under the tab inside it.
 */
function useReport(id: string | null, layer: number | null): number {
  const reporter = useContext(SurfaceReporterContext);
  const [place] = useState(() => ++lastPlace);
  useEffect(() => reporter?.report(place, id, layer), [reporter, place, id, layer]);
  useEffect(() => () => reporter?.clear(place), [reporter, place]);
  return place;
}

/**
 * Reports a screen or dialog as open while it is mounted. Mount it when the surface opens, not before:
 * the one that mounts last is on top. Tabs inside it report as its tabs. With no id it reports nothing,
 * and the tabs inside it stay out of the screen under it.
 */
export function SurfaceLayer({ id, children }: { id?: SurfaceIdName; children?: ReactNode }) {
  const place = useReport(id ?? null, null);
  return <LayerContext.Provider value={place}>{children}</LayerContext.Provider>;
}

/** Reports the active tab of a tabbed surface. No tab, or a tab the ledger does not list, reports nothing. */
// eslint-disable-next-line react-refresh/only-export-components
export function useSurfaceTab(ledger: SurfaceLedgerName | undefined, tab: string | null | undefined): void {
  const layer = useContext(LayerContext);
  // A tab outside every screen and dialog has no place in the stack.
  useReport(layer !== null && ledger && tab ? `${ledger}.${tab}` : null, layer);
}

/** Reports a tab from inside its screen or dialog, for a tab that no shared strip shows. */
export function SurfaceTab({ ledger, tab }: { ledger: SurfaceLedgerName; tab: string | null | undefined }) {
  useSurfaceTab(ledger, tab);
  return null;
}
