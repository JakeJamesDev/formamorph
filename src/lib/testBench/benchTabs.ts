import { BrainCircuit, Stethoscope, Zap } from 'lucide-react';
import { OpeningIcon } from '@/lib/elementIcons';

/** The Test Bench's instrument tabs, in order. Single source of truth: the Bench's tab strip renders from
 *  this, and the dev-router ledger (`DEV_MODAL_TABS.worldEditorBench`) is guarded against the built ones in
 *  `devRouter.test.ts` — so adding an instrument without making it routable fails the test. */
export const BENCH_TABS = [
  // lens: the parts of the Testing-as/at lens the instrument reads — the bar draws only those.
  // Issues runs the rule pass over the authored world as-is, so the lens has nothing to tell it.
  // Opening reads the persona and starts at its own Starting Location pick.
  { value: 'issues', label: 'Issues', icon: Stethoscope, lens: { persona: false, location: false } },
  { value: 'triggers', label: 'Triggers', icon: Zap, lens: { persona: true, location: true } },
  { value: 'aiContext', label: 'AI Context', icon: BrainCircuit, lens: { persona: true, location: true } },
  { value: 'opening', label: 'Opening', icon: OpeningIcon, lens: { persona: true, location: false } },
] as const;

export type BenchTab = (typeof BENCH_TABS)[number]['value'];

/** Every instrument is built, so the whole strip is routable. */
export const BUILT_BENCH_TABS = BENCH_TABS.map((t) => t.value);

/** Narrow an arbitrary string (a dev-route param) to a tab that exists. */
export function asBenchTab(value: string | undefined): BenchTab | null {
  return BUILT_BENCH_TABS.some((t) => t === value) ? (value as BenchTab) : null;
}
