import type { Supporter } from '@/services/PatreonService';

/** DEV: a canned Supporters wall (`#dev?modal=credits&tab=supporters&fixture=supporters`). */
export const DEV_SUPPORTERS: Supporter[] = [
  { id: 'dev-1', username: 'wren_hallow', avatarUrl: null, tier: 'supporter_top', since: '2025-01-15T00:00:00.000Z' },
  { id: 'dev-2', username: 'Tamsin', avatarUrl: null, tier: 'supporter_plus', since: '2025-03-02T00:00:00.000Z' },
  { id: 'dev-3', username: 'Odalys Fenn', avatarUrl: null, tier: 'supporter_plus', since: '2025-06-20T00:00:00.000Z' },
  { id: 'dev-4', username: 'moss_and_ink', avatarUrl: null, tier: 'supporter', since: '2025-08-11T00:00:00.000Z' },
  { id: 'dev-5', username: 'Ilya', avatarUrl: null, tier: 'supporter', since: null },
];
