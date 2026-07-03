/**
 * Build-time feature flags.
 *
 * COMMUNITY_ENABLED gates every feature that talks to the remote worlds server — the Discover browser,
 * login/auth, publishing, and the catalog-tag sync. The hosted GitHub Pages build sets
 * VITE_ENABLE_COMMUNITY=false so no user-uploaded content is discoverable and the site never contacts the
 * server; every other build (dev, desktop) leaves it unset, so the flag defaults to enabled.
 */
export const COMMUNITY_ENABLED = import.meta.env.VITE_ENABLE_COMMUNITY !== 'false';
