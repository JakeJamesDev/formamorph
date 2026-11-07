// @vitest-environment jsdom
import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';

const gate = vi.hoisted(() => ({ attested: true }));
vi.mock('@/lib/apiBase', () => ({ API_BASE_URL: 'https://api.test/api' }));
vi.mock('@/lib/hostedAi/hostedUrls', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/hostedAi/hostedUrls')>()),
  HOSTED_AI_AVAILABLE: true,
}));
vi.mock('@/contexts/AgeGateContext', () => ({
  useAgeGate: () => ({ attested: gate.attested }),
}));

import { DailyInstallSender } from '@/components/DailyInstallSender';
import { UpdateRequiredGate } from '@/components/modals/UpdateRequiredDialog';
import { SettingsProvider, useSettings } from '@/contexts/SettingsContext';

const URL_SENT = 'https://api.test/api/active-installs';
const DAY_KEY = 'FORMAMORPH_dailySendDay';

let setSwitch: (on: boolean) => void = () => {};
function SwitchHandle() {
  setSwitch = useSettings().setDailySendEnabled;
  return null;
}

const tree = (children: ReactNode) => <SettingsProvider><SwitchHandle />{children}</SettingsProvider>;

describe('DailyInstallSender', () => {
  const fetchMock = vi.fn<typeof fetch>();
  const sends = () => fetchMock.mock.calls.filter(([input]) => String(input) === URL_SENT);
  const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

  beforeEach(() => {
    // One device across tests: the Install module holds its id in memory, so storage keeps it too.
    const install = localStorage.getItem('FORMAMORPH_installId');
    localStorage.clear();
    if (install) localStorage.setItem('FORMAMORPH_installId', install);
    gate.attested = true;
    fetchMock.mockReset().mockImplementation(async () => new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('sends on start with the client header, mounted after the client-version gate as in the app', async () => {
    const { unmount } = render(tree(<><UpdateRequiredGate /><DailyInstallSender /></>));
    await flush();
    expect(sends()).toHaveLength(1);
    expect(new Headers(sends()[0][1]?.headers).get('X-Formamorph-Client')).toMatch(/^\S+ \w+$/);
    unmount();
  });

  it('is on by default for an install that already has other settings', async () => {
    localStorage.setItem('FORMAMORPH_autosaveEnabled', 'true');
    const { unmount } = render(tree(<DailyInstallSender />));
    await flush();
    expect(sends()).toHaveLength(1);
    unmount();
  });

  it('tries again on focus after a failed send, and the switch stops the next attempt at once', async () => {
    fetchMock.mockImplementationOnce(async () => { throw new TypeError('offline'); });
    const { unmount } = render(tree(<DailyInstallSender />));
    await flush();
    expect(sends()).toHaveLength(1);

    act(() => setSwitch(false));
    await act(async () => { window.dispatchEvent(new Event('focus')); });
    await flush();
    expect(sends()).toHaveLength(1);

    act(() => setSwitch(true));
    await act(async () => { window.dispatchEvent(new Event('focus')); });
    await flush();
    expect(sends()).toHaveLength(2);
    expect(localStorage.getItem(DAY_KEY)).not.toBeNull();
    unmount();
  });

  it('tries again when the app becomes visible after a failed send', async () => {
    fetchMock.mockImplementationOnce(async () => { throw new TypeError('offline'); });
    const { unmount } = render(tree(<DailyInstallSender />));
    await flush();
    expect(sends()).toHaveLength(1);

    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')); });
    await flush();
    expect(sends()).toHaveLength(1);

    visibility.mockReturnValue('visible');
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')); });
    await flush();
    expect(sends()).toHaveLength(2);
    unmount();
  });

  it('sends once the age gate is passed, and not before', async () => {
    gate.attested = false;
    const { rerender, unmount } = render(tree(<DailyInstallSender />));
    await flush();
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')); });
    expect(sends()).toHaveLength(0);

    gate.attested = true;
    rerender(tree(<DailyInstallSender />));
    await flush();
    expect(sends()).toHaveLength(1);
    unmount();
  });
});
