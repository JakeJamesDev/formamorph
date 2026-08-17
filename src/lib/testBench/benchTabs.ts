/** The Test Bench's instrument tabs, in order. Single source of truth: the Bench's tab strip renders from
 *  this, and the dev-router ledger (`DEV_MODAL_TABS.worldEditorBench`) is guarded against the built ones in
 *  `devRouter.test.ts` — so landing an instrument without making it routable fails the test. */
export const BENCH_TABS = [
  { value: 'issues', label: 'Issues' },
  { value: 'triggers', label: 'Triggers' },
  { value: 'aiContext', label: 'AI Context' },
  { value: 'opening', label: 'Opening' },
] as const;

export type BenchTab = (typeof BENCH_TABS)[number]['value'];

/** Every instrument is built, so the whole strip is routable. */
export const BUILT_BENCH_TABS = BENCH_TABS.map((t) => t.value);

/** Narrow an arbitrary string (a dev-route param) to a tab that exists. */
export function asBenchTab(value: string | undefined): BenchTab | null {
  return BUILT_BENCH_TABS.some((t) => t === value) ? (value as BenchTab) : null;
}
