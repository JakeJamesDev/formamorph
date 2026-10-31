import { seedTierNamesForTest } from '@/lib/tierNames';

/** The names component tests expect on screen. They are fixtures, not the live Patreon titles. */
export const SAMPLE_TIER_NAMES = {
  supporter: 'Supporter',
  supporter_plus: 'Supporter+',
  supporter_top: 'Supporter++',
} as const;

/** Serve the sample names and skip the server read. */
export const seedSampleTierNames = () => seedTierNamesForTest(SAMPLE_TIER_NAMES);
