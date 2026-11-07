/** Canned merge views for the dev route (`#dev?modal=profileMerge&tab=offer|run|result`). Nothing is written. */
import type { ProfileMergeView } from '@/components/menu/profileMergeView';
import type { CategoryPlan, MergeItem } from '@/lib/profileMerge/engine';
import { MERGE_KEYS, type MergeKey } from '@/lib/profileMerge/keys';

const items = (prefix: string, n: number): MergeItem[] =>
  Array.from({ length: n }, (_, i) => ({ id: `${prefix}-${i}`, label: `${prefix} ${i + 1}`, size: (i + 1) * 100 }));

const plan = (key: MergeKey, label: string, add: number, replace: number, keep: number): CategoryPlan => ({
  key, label, stamped: true, unit: 'items', add: items(`${key}-new`, add), replace: items(`${key}-old`, replace), keep: items(`${key}-kept`, keep),
});

const unstamped = (key: MergeKey, label: string, add: number, keep: number): CategoryPlan => ({
  ...plan(key, label, add, 0, keep), stamped: false,
});

const PLANS: CategoryPlan[] = [
  unstamped(MERGE_KEYS.statTemplates, 'Stat Templates', 2, 1),
  plan(MERGE_KEYS.dictionaries, 'Dictionaries', 2, 0, 1),
  plan(MERGE_KEYS.entities, 'Entities', 5, 1, 3),
  unstamped(MERGE_KEYS.mascotImages, 'Mascot Images', 1, 2),
  plan(MERGE_KEYS.avatars, 'Avatars', 2, 1, 1),
  plan(MERGE_KEYS.worlds, 'Worlds', 3, 1, 2),
  plan(MERGE_KEYS.saves, 'Saves', 12, 0, 4),
  {
    key: MERGE_KEYS.models, label: 'Local Models', stamped: false, unit: 'bytes', last: true,
    add: [
      { id: 'a.gguf', label: 'a.gguf', size: 2_400_000_000 },
      { id: 'b.gguf', label: 'b.gguf', size: 7_380_000_000 },
    ],
    replace: [], keep: [{ id: 'c.gguf', label: 'c.gguf', size: 4_100_000_000 }],
  },
];

/** The sample view for a dialog step. */
export function devProfileMergeView(step: string | undefined): ProfileMergeView {
  if (step === 'run') {
    return {
      step: 'run',
      plans: PLANS,
      progress: {
        [MERGE_KEYS.dictionaries]: { key: MERGE_KEYS.dictionaries, done: 2, total: 2 },
        [MERGE_KEYS.entities]: { key: MERGE_KEYS.entities, done: 6, total: 6 },
        [MERGE_KEYS.worlds]: { key: MERGE_KEYS.worlds, done: 1, total: 4 },
        [MERGE_KEYS.models]: { key: MERGE_KEYS.models, done: 3_100_000_000, total: 9_780_000_000 },
      },
    };
  }
  if (step === 'result') {
    return {
      step: 'result',
      results: [
        { key: MERGE_KEYS.settings, label: 'Settings and Sign-In', added: 14, replaced: 0, kept: 31, skipped: [] },
        { key: MERGE_KEYS.statTemplates, label: 'Stat Templates', added: 2, replaced: 0, kept: 1, skipped: [] },
        { key: MERGE_KEYS.dictionaries, label: 'Dictionaries', added: 2, replaced: 0, kept: 1, skipped: [] },
        { key: MERGE_KEYS.entities, label: 'Entities', added: 5, replaced: 1, kept: 3, skipped: [] },
        { key: MERGE_KEYS.mascotImages, label: 'Mascot Images', added: 1, replaced: 0, kept: 2, skipped: [] },
        { key: MERGE_KEYS.avatars, label: 'Avatars', added: 2, replaced: 1, kept: 1, skipped: [] },
        { key: MERGE_KEYS.worlds, label: 'Worlds', added: 2, replaced: 1, kept: 2, skipped: [{ label: 'Sedge Landing', reason: 'There isn’t enough storage space' }] },
        { key: MERGE_KEYS.saves, label: 'Saves', added: 12, replaced: 0, kept: 4, skipped: [] },
        { key: MERGE_KEYS.models, label: 'Local Models', added: 1, replaced: 0, kept: 1, skipped: [{ label: 'b.gguf', reason: 'The file is in use' }] },
      ],
    };
  }
  return { step: 'offer', plans: PLANS };
}
