/**
 * The profile merge engine: plans which AppData items come into the folder's profile, then copies them one at
 * a time. Free of storage, so tests feed snapshots in and read the plan and the copies out.
 */

/** What a category's progress counts: items copied, or bytes moved. */
export type MergeUnit = 'items' | 'bytes';

/** One stored item as a snapshot lists it. */
export interface MergeItem {
  id: string;
  label: string;
  /** An ISO time: newer wins. Absent on an item with no stamp. */
  stamp?: string;
  /** Bytes, for the smallest-first order. */
  size: number;
}

/** How a category compares items. */
export interface MergeCategoryInfo {
  key: string;
  label: string;
  /** Stamped categories replace an older folder copy; unstamped ones copy only what the folder lacks. */
  stamped: boolean;
  unit: MergeUnit;
}

/** A category's storage: both snapshots, and the copy of one item. */
export interface MergeCategory extends MergeCategoryInfo {
  /** The folder's items. Sizes may be 0: the order reads the AppData side. */
  target(): Promise<MergeItem[]>;
  /** The AppData profile's items. */
  source(): Promise<MergeItem[]>;
  /** Read one item from the AppData profile and write it into the folder's profile. */
  copy(item: MergeItem): Promise<void>;
  /** Runs once after the category's last copy, with the items added. */
  finish?(added: MergeItem[]): Promise<void>;
}

export type MergeSnapshot = Record<string, MergeItem[]>;

export interface CategoryPlan extends MergeCategoryInfo {
  /** Items the folder lacks. */
  add: MergeItem[];
  /** Items whose AppData copy is newer. */
  replace: MergeItem[];
  /** Items the folder keeps. */
  keep: MergeItem[];
}

const bySize = (a: MergeItem, b: MergeItem) => a.size - b.size || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

const timeOf = (stamp: string | undefined): number => (stamp ? Date.parse(stamp) : NaN);

/** Whether the AppData copy replaces the folder's. Equal or missing stamps keep the folder's copy. */
export const sourceIsNewer = (source: MergeItem, target: MergeItem): boolean => {
  const s = timeOf(source.stamp);
  const t = timeOf(target.stamp);
  return Number.isFinite(s) && Number.isFinite(t) && s > t;
};

/** Items a plan copies. */
export const writesOf = (plan: CategoryPlan): MergeItem[] => [...plan.add, ...plan.replace];

/** The weight of a category's copies in its own unit. */
const weightOf = (unit: MergeUnit, item: MergeItem): number => (unit === 'bytes' ? item.size : 1);

/**
 * Plan the merge: per category, what is new, what replaces the folder's copy, and what is kept. Items run
 * smallest first, and categories run by the bytes they copy, smallest first.
 */
export function planMerge(categories: MergeCategoryInfo[], source: MergeSnapshot, target: MergeSnapshot): CategoryPlan[] {
  const plans = categories.map((info): CategoryPlan => {
    const held = new Map((target[info.key] ?? []).map((item) => [item.id, item] as const));
    const plan: CategoryPlan = { ...info, add: [], replace: [], keep: [] };
    for (const item of source[info.key] ?? []) {
      const mine = held.get(item.id);
      if (!mine) plan.add.push(item);
      else if (info.stamped && sourceIsNewer(item, mine)) plan.replace.push(item);
      else plan.keep.push(item);
    }
    plan.add.sort(bySize);
    plan.replace.sort(bySize);
    plan.keep.sort(bySize);
    return plan;
  });
  const bytes = (plan: CategoryPlan) => writesOf(plan).reduce((sum, item) => sum + item.size, 0);
  return plans
    .map((plan, index) => ({ plan, index, bytes: bytes(plan) }))
    .sort((a, b) => a.bytes - b.bytes || a.index - b.index)
    .map(({ plan }) => plan);
}

/** True when no category copies anything. */
export const planIsEmpty = (plans: CategoryPlan[]): boolean => plans.every((plan) => writesOf(plan).length === 0);

/** Each category's copies in the plan's order, smallest first across new and replaced items. */
export const copyOrder = (plan: CategoryPlan): MergeItem[] => writesOf(plan).sort(bySize);

export interface MergeProgress {
  key: string;
  done: number;
  total: number;
}

export interface SkippedItem {
  label: string;
  reason: string;
}

export interface CategoryResult {
  key: string;
  label: string;
  added: number;
  replaced: number;
  kept: number;
  skipped: SkippedItem[];
}

/** An error's message, for the result list. */
export const reasonOf = (err: unknown): string => (err instanceof Error && err.message ? err.message : String(err));

/** A copy failure that ends the run, such as the AppData profile no longer answering. */
export class MergeHalt extends Error {
  override name = 'MergeHalt';
}

/**
 * Copy the plan, one item at a time: each copy finishes before the next item is read. A failed item is skipped
 * with its reason. A `MergeHalt` or an aborted signal ends the run and rejects.
 */
export async function applyMerge(
  plans: CategoryPlan[],
  categories: Pick<MergeCategory, 'key' | 'copy' | 'finish'>[],
  onProgress: (progress: MergeProgress) => void = () => {},
  signal?: AbortSignal,
): Promise<CategoryResult[]> {
  const byKey = new Map(categories.map((category) => [category.key, category] as const));
  const results: CategoryResult[] = [];
  for (const plan of plans) {
    const category = byKey.get(plan.key);
    if (!category) throw new Error(`No storage for ${plan.key}`);
    const items = copyOrder(plan);
    const replacing = new Set(plan.replace.map((item) => item.id));
    const total = items.reduce((sum, item) => sum + weightOf(plan.unit, item), 0);
    const result: CategoryResult = { key: plan.key, label: plan.label, added: 0, replaced: 0, kept: plan.keep.length, skipped: [] };
    const added: MergeItem[] = [];
    let done = 0;
    onProgress({ key: plan.key, done, total });
    for (const item of items) {
      signal?.throwIfAborted();
      try {
        await category.copy(item);
        if (replacing.has(item.id)) result.replaced += 1;
        else {
          result.added += 1;
          added.push(item);
        }
      } catch (err) {
        if (err instanceof MergeHalt) throw err;
        result.skipped.push({ label: item.label, reason: reasonOf(err) });
      }
      done += weightOf(plan.unit, item);
      onProgress({ key: plan.key, done, total });
    }
    if (category.finish && added.length) {
      try {
        await category.finish(added);
      } catch (err) {
        result.skipped.push({ label: plan.label, reason: reasonOf(err) });
      }
    }
    results.push(result);
  }
  return results;
}

/** Read both snapshots of every category. */
export async function snapshotsOf(categories: MergeCategory[]): Promise<{ source: MergeSnapshot; target: MergeSnapshot }> {
  const source: MergeSnapshot = {};
  const target: MergeSnapshot = {};
  for (const category of categories) {
    source[category.key] = await category.source();
    target[category.key] = await category.target();
  }
  return { source, target };
}
