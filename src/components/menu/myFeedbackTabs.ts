/** Tabs in the Feedback dialog, one per branch. Guarded by `devRouter.test.ts`. */
export const MY_FEEDBACK_TABS = ['bugs', 'suggestions'] as const;
export type MyFeedbackTabKey = (typeof MY_FEEDBACK_TABS)[number];
