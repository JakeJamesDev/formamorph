/** The Test Bench's instrument tabs, in order. Single source of truth: the Bench's tab strip renders from
 *  this, and the dev-router ledger (`DEV_MODAL_TABS.worldEditorBench`) is guarded against the built ones in
 *  `devRouter.test.ts` — so landing an instrument without making it routable fails the test. */
export const BENCH_TABS = [
  { value: 'issues', label: 'Issues' },
  { value: 'triggers', label: 'Triggers', unbuilt: true },
  { value: 'aiContext', label: 'AI Context', unbuilt: true },
  { value: 'opening', label: 'Opening', unbuilt: true },
] as const;

export type BenchTab = (typeof BENCH_TABS)[number]['value'];

/** The tabs an author can actually stand on — what the dev-router can route to. */
export const BUILT_BENCH_TABS = BENCH_TABS.filter((t) => !('unbuilt' in t && t.unbuilt)).map((t) => t.value);

/** Narrow an arbitrary string (a dev-route param) to a tab that exists and is built. */
export function asBenchTab(value: string | undefined): BenchTab | null {
  return BUILT_BENCH_TABS.some((t) => t === value) ? (value as BenchTab) : null;
}
