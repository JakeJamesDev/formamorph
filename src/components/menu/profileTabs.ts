/** Tabs on the profile dialog. Guarded against the dev-router ledger by `devRouter.test.ts`. */
export const PROFILE_TABS = ['messages', 'bugs', 'terms'] as const;
export type ProfileTab = (typeof PROFILE_TABS)[number];
