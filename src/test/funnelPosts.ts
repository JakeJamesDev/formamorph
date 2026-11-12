import { vi } from 'vitest';

/** The funnel step names posted through the stubbed `fetch`, in order. */
export const funnelPosts = (): string[] => vi.mocked(fetch).mock.calls
  .map(([url]) => String(url))
  .filter((url) => url.includes('/funnel/'))
  .map((url) => url.split('/funnel/')[1]);
