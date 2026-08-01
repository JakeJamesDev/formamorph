/** Sub-tabs on Admin Panel → Feedback, one per branch. Guarded by `devRouter.test.ts`. */
export const FEEDBACK_TABS = ['bugs', 'suggestions'] as const;
export type FeedbackTab = (typeof FEEDBACK_TABS)[number];
