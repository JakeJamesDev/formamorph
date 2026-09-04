/** Sub-tabs on Admin Panel → Policies, one per authored popup. Guarded by `devRouter.test.ts`. */
export const POLICIES_TABS = ['uploadGate', 'tagNotice', 'privacyPolicy'] as const;
export type PoliciesTab = (typeof POLICIES_TABS)[number];
