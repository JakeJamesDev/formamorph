/** Canned merge views for the dev route (`#dev?modal=profileMerge&tab=offer|run|result`). Nothing is written. */
import type { ProfileMergeView } from '@/components/menu/profileMergeView';
import type { CategoryPlan, MergeItem } from '@/lib/profileMerge/engine';

const items = (prefix: string, n: number): MergeItem[] =>
  Array.from({ length: n }, (_, i) => ({ id: `${prefix}-${i}`, label: `${prefix} ${i + 1}`, size: (i + 1) * 100 }));

const plan = (key: string, label: string, add: number, replace: number, keep: number): CategoryPlan => ({
  key, label, stamped: true, unit: 'items', add: items(`${key}-new`, add), replace: items(`${key}-old`, replace), keep: items(`${key}-kept`, keep),
});

const PLANS: CategoryPlan[] = [
  plan('dictionaries', 'Dictionaries', 2, 0, 1),
  plan('entities', 'Entities', 5, 1, 3),
  plan('worlds', 'Worlds', 3, 1, 2),
  plan('saves', 'Saves', 12, 0, 4),
];

/** The sample view for a dialog step. */
export function devProfileMergeView(step: string | undefined): ProfileMergeView {
  if (step === 'run') {
    return {
      step: 'run',
      plans: PLANS,
      progress: {
        dictionaries: { key: 'dictionaries', done: 2, total: 2 },
        entities: { key: 'entities', done: 6, total: 6 },
        worlds: { key: 'worlds', done: 1, total: 4 },
      },
    };
  }
  if (step === 'result') {
    return {
      step: 'result',
      results: [
        { key: 'dictionaries', label: 'Dictionaries', added: 2, replaced: 0, kept: 1, skipped: [] },
        { key: 'entities', label: 'Entities', added: 5, replaced: 1, kept: 3, skipped: [] },
        { key: 'worlds', label: 'Worlds', added: 2, replaced: 1, kept: 2, skipped: [{ label: 'Sedge Landing', reason: 'There isn’t enough storage space' }] },
        { key: 'saves', label: 'Saves', added: 12, replaced: 0, kept: 4, skipped: [] },
      ],
    };
  }
  return { step: 'offer', plans: PLANS };
}
