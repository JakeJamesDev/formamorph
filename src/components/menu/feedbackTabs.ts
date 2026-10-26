import type { FeedbackType } from '@/types';

/** Tabs per branch in the Admin Panel's Feedback tab and the Feedback dialog. Guarded by `devRouter.test.ts`. */
export const FEEDBACK_TABS = ['bugs', 'suggestions', 'questions'] as const;
export type FeedbackTab = (typeof FEEDBACK_TABS)[number];

/** The branch each tab lists. */
export const FEEDBACK_TAB_TYPES: Record<FeedbackTab, FeedbackType> = {
  bugs: 'bug',
  suggestions: 'suggestion',
  questions: 'question',
};
