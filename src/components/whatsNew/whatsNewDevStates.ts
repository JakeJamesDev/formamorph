/** The What's New dev route's canned builds, picked with `tab=…`. */
export const WHATS_NEW_DEV_STATES = ['web', 'upToDate', 'update'] as const;
export type WhatsNewDevState = (typeof WHATS_NEW_DEV_STATES)[number];
