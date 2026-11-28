import { afterEach, describe, expect, it, vi } from 'vitest';
import AuthService from './AuthService';
import HostedAiAdminService from './HostedAiAdminService';

afterEach(() => { vi.unstubAllGlobals(); });

describe('fetchInstallMonths', () => {
  it('reads the months of the active installs route', async () => {
    const months = [{ month: '2026-01', languages: { device: [{ language: 'fr', count: 2 }], ai: [{ language: 'en', count: 2 }] } }];
    const fetchMock = vi.fn(async (url: string) => (url === `${AuthService.API_URL}/active-installs?days=1`
      ? new Response(JSON.stringify({ success: true, data: { days: [], months } }))
      : new Response('{}', { status: 404 })));
    vi.stubGlobal('fetch', fetchMock);

    await expect(HostedAiAdminService.fetchInstallMonths()).resolves.toEqual(months);
  });

  it('rejects a refused read', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"error":"refused"}', { status: 403 })));

    await expect(HostedAiAdminService.fetchInstallMonths()).rejects.toThrow('refused');
  });
});
