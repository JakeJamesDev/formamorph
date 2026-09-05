import { vi } from 'vitest';
import AuthService from '@/services/AuthService';

/** Minimal fetch Response stub — the same shape AuthService's own tests use. */
export const res = (body: unknown, ok = true, status = 200): Response =>
  ({ ok, status, json: async () => body } as unknown as Response);

/** Put the page at a URL, the way a rewritten route arrives. */
export const at = (url: string) => window.history.replaceState(null, '', url);

/**
 * Reset everything an account page reads before it renders: the stored session, the singleton holding
 * it, the address bar, and `fetch`. `console.error` is silenced because AuthService logs every refusal,
 * and the refusals are what these tests are for.
 */
export const resetAccountPage = (url: string) => {
  localStorage.clear();
  AuthService.logout();
  at(url);
  vi.stubGlobal('fetch', vi.fn());
  vi.spyOn(console, 'error').mockImplementation(() => {});
};
