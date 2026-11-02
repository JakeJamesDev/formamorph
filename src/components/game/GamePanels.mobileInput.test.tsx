import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderMiddlePanel, type Settings } from '@/test/gamePanels';
import { hostedSession } from '@/lib/hostedAi/hostedSession';
import { HOSTED_STATE_URL } from '@/lib/hostedAi/hostedUrls';
import { FORMAMORPH_AI_PRESET_ID } from '@/lib/textEndpointPresets';
import AuthService from '@/services/AuthService';

vi.mock('@/views/VRMViewer', () => import('@/test/stubs/vrmViewer'));
vi.mock('@/lib/useTtsPlayback', () => import('@/test/stubs/ttsPlayback'));
vi.mock('@/contexts/AgeGateContext', () => ({ useAgeGate: () => ({ requireAttestation: vi.fn() }) }));
vi.mock('@/contexts/PrivacyPolicyContext', () => ({ usePrivacyPolicy: () => ({ checkNow: vi.fn() }) }));

const STATE = {
  tier: 'supporter', state: 'ready', window: 24000, maxTokens: 600, tokenMargin: 800,
  model: { id: 'entry-7', capabilities: {} },
  percentUsed: 95, turnsLeft: 2, resetAt: '2026-11-09T00:00:00.000Z', acknowledged: [], warnThresholds: [75, 90],
  breakdown: { narration: 100 }, breakdownThreshold: 10,
};
const TURNS = [{ action: 'I look around.', narration: 'A quiet room.', turnId: 't1' }];

const onHosted = (settings: Settings) => settings.selectTextEndpointPreset(FORMAMORPH_AI_PRESET_ID);
const help = () => screen.queryByRole('button', { name: 'About How to Play' });
const ring = () => screen.queryByRole('button', { name: /Formamorph AI Allowance/ });
const send = () => screen.getByRole('button', { name: 'Send' });
const field = () => screen.getByPlaceholderText(/Type your action/);

let restore: (() => void) | null = null;
/** Report a width to `useIsMobile`, which reads `innerWidth` once and then the media query. */
const atWidth = (width: number) => {
  const realMatchMedia = window.matchMedia;
  const realWidth = window.innerWidth;
  window.innerWidth = width;
  window.matchMedia = ((query: string) => ({
    matches: width < 768 && query.includes('max-width: 767px'),
    media: query, onchange: null,
    addEventListener: () => {}, removeEventListener: () => {},
    addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
  restore = () => { window.matchMedia = realMatchMedia; window.innerWidth = realWidth; };
};

beforeEach(async () => {
  vi.stubGlobal('fetch', vi.fn(async (input: string) => (
    input === HOSTED_STATE_URL ? new Response(JSON.stringify({ success: true, data: STATE })) : new Response('{}', { status: 404 })
  )));
  AuthService.token = 'token-a';
  hostedSession.reset();
  await hostedSession.refresh();
});
afterEach(() => {
  restore?.();
  restore = null;
  vi.unstubAllGlobals();
  AuthService.token = null;
  hostedSession.reset();
});

async function renderRow(overrides: Parameters<typeof renderMiddlePanel>[0] = {}) {
  const view = renderMiddlePanel(overrides, { turns: TURNS, settings: onHosted });
  await screen.findByRole('button', { name: /Formamorph AI Allowance/ });
  return view;
}

describe('Mobile input expansion', () => {
  it('hides Help and the ring on focus and keeps Send enabled', async () => {
    atWidth(375);
    await renderRow();
    await userEvent.click(field());
    expect(help()).toBeNull();
    // 95% is past the highest warning: the ring still stays hidden.
    expect(ring()).toBeNull();
    expect((send() as HTMLButtonElement).disabled).toBe(false);
  });

  it('restores both on blur and keeps the typed text', async () => {
    atWidth(375);
    await renderRow();
    await userEvent.click(field());
    await userEvent.keyboard('open the door');
    await userEvent.tab();
    expect(help()).not.toBeNull();
    expect(ring()).not.toBeNull();
    expect((field() as HTMLTextAreaElement).value).toBe('open the door');
  });

  it('sends the action when Send is tapped while focused', async () => {
    atWidth(375);
    const view = await renderRow();
    await userEvent.click(field());
    await userEvent.click(send());
    expect(view.props.handleSendAction).toHaveBeenCalledTimes(1);
  });

  it('keeps Send as the same last control of the row when the input collapses', async () => {
    atWidth(375);
    await renderRow();
    const sendBefore = send();
    // jsdom has no layout, so position reads as DOM order: Send is the row's last child before, during and after.
    const row = screen.getByTestId('action-input-wrap').parentElement as HTMLElement;
    const sendIsLast = () => row.lastElementChild?.contains(send()) === true;
    expect(sendIsLast()).toBe(true);
    await userEvent.click(field());
    expect(send()).toBe(sendBefore);
    expect(sendIsLast()).toBe(true);
    await userEvent.tab();
    expect(send()).toBe(sendBefore);
    expect(sendIsLast()).toBe(true);
  });

  it('keeps Help and the ring on a desktop width while the input has focus', async () => {
    atWidth(1280);
    await renderRow();
    await userEvent.click(field());
    expect(help()).not.toBeNull();
    expect(ring()).not.toBeNull();
  });

  it('shows Help and the ring again when the field is disabled mid-focus', async () => {
    atWidth(375);
    const view = await renderRow();
    await userEvent.click(field());
    expect(help()).toBeNull();
    act(() => { view.setProps({ disabled: true }); });
    expect(help()).not.toBeNull();
  });
});
