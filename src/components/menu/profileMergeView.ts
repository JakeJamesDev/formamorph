import type { CategoryPlan, CategoryResult, MergeProgress } from '@/lib/profileMerge/engine';

/** The merge dialog's three steps, in the order a merge reaches them. */
export const PROFILE_MERGE_STEPS = ['offer', 'run', 'result'] as const;

export type ProfileMergeView =
  | { step: 'offer'; plans: CategoryPlan[] }
  | { step: 'run'; plans: CategoryPlan[]; progress: Record<string, MergeProgress> }
  | { step: 'result'; results: CategoryResult[]; error?: string };
