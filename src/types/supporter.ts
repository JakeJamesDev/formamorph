/** The Patreon tiers that carry Supporter Flair. */
export type SupporterTier = 'supporter' | 'supporter_plus';

/** The `supporter` field of an author object. The server sends null for no flair, staff included. */
export interface SupporterFlair {
  tier: SupporterTier;
  /** When the current pledge started, or null when Patreon gave no date. */
  since: string | null;
}
