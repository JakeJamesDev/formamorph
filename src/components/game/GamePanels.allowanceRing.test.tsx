import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderMiddlePanel, type PanelHarness, type Settings } from '@/test/gamePanels';
import { TooltipProvider } from '@/components/ui/tooltip';
import { SettingsProvider } from '@/contexts/SettingsContext';
import { AllowanceRing } from './AllowanceRing';
import { DEV_MODAL_TABS } from '@/lib/devRoutes';
import { allowanceTone } from '@/lib/hostedAi/allowanceFigure';
import { DEV_ALLOWANCE_ROUTES } from '@/lib/hostedAi/devHostedSamples';
import { hostedSession } from '@/lib/hostedAi/hostedSession';
import { HOSTED_STATE_URL } from '@/lib/hostedAi/hostedUrls';
import { FORMAMORPH_AI_PRESET_ID, textEndpointPresetCodec } from '@/lib/textEndpointPresets';
import AuthService from '@/services/AuthService';

vi.mock('@/views/VRMViewer', () => import('@/test/stubs/vrmViewer'));
vi.mock('@/lib/useTtsPlayback', () => import('@/test/stubs/ttsPlayback'));
vi.mock('@/contexts/AgeGateContext', () => ({ useAgeGate: () => ({ requireAttestation: vi.fn() }) }));
vi.mock('@/contexts/PrivacyPolicyContext', () => ({ usePrivacyPolicy: () => ({ checkNow: vi.fn() }) }));

const STATE = {
  tier: 'supporter', state: 'ready', window: 24000, maxTokens: 600, tokenMargin: 800,
  model: { id: 'entry-7', capabilities: {} },
  percentUsed: 32, turnsLeft: 41, resetAt: '2026-11-09T00:00:00.000Z', acknowledged: [], warnThresholds: [75, 90],
  breakdown: { narration: 70, choices: 30 }, breakdownThreshold: 10,
};
const TURNS = [{ action: 'I look around.', narration: 'A quiet room.', turnId: 't1' }];
const USAGE = { resetAt: STATE.resetAt, turnsLeft: 30 };

let served: Record<string, unknown>;
let refusal: { status: number; body: unknown } | null;
let stateReads: number;

beforeEach(async () => {
  served = STATE;
  refusal = null;
  stateReads = 0;
  vi.stubGlobal('fetch', vi.fn(async (input: string) => {
    if (input !== HOSTED_STATE_URL) return new Response('{}', { status: 404 });
    stateReads += 1;
    if (refusal) return new Response(JSON.stringify(refusal.body), { status: refusal.status });
    return new Response(JSON.stringify({ success: true, data: served }));
  }));
  AuthService.token = 'token-a';
  hostedSession.reset();
  await hostedSession.refresh();
  stateReads = 0;
});
afterEach(() => {
  vi.unstubAllGlobals();
  AuthService.token = null;
  hostedSession.reset();
});

const onHosted = (settings: Settings) => settings.selectTextEndpointPreset(FORMAMORPH_AI_PRESET_ID);

const ring = () => screen.findByRole('button', { name: /Formamorph AI Allowance/ });
const fillTone = (el: HTMLElement) => el.querySelector('[data-allowance-fill]')?.getAttribute('data-allowance-fill') ?? null;

async function renderRing() {
  const view = renderMiddlePanel({}, { turns: TURNS, settings: onHosted });
  await ring();
  return view;
}
const setBusy = (view: Pick<PanelHarness<unknown>, 'gameplay'>, busy: boolean) => act(() => { view.gameplay().setIsWaitingForAI(busy); });
const usage = (percentUsed: number) => act(() => { hostedSession.noteUsage({ ...USAGE, percentUsed }); });

async function openPopover() {
  await userEvent.click(await ring());
  return screen.findByRole('dialog');
}

describe('Allowance Ring: when it shows', () => {
  it('shows for a narration prompt on Formamorph AI', async () => {
    await renderRing();
    expect((await ring()).getAttribute('aria-label')).toBe('Formamorph AI Allowance: 32% used');
  });

  it('shows for one prompt pinned to Formamorph AI', async () => {
    const view = renderMiddlePanel({}, { turns: TURNS });
    await screen.findByRole('button', { name: 'Send' });
    expect(screen.queryByRole('button', { name: /Formamorph AI Allowance/ })).toBeNull();
    // Routing lives on a user prompt preset, so one is made active first.
    act(() => { view.settings().selectPreset(view.settings().addPreset('Routed')); });
    act(() => { view.settings().setPromptEndpoint('choices', FORMAMORPH_AI_PRESET_ID); });
    expect(await ring()).toBeTruthy();
  });

  it('stays away, and reads nothing, when no prompt uses Formamorph AI', async () => {
    renderMiddlePanel({}, { turns: TURNS });
    await screen.findByRole('button', { name: 'Send' });
    expect(screen.queryByRole('button', { name: /Formamorph AI Allowance/ })).toBeNull();
    expect(stateReads).toBe(0);
  });

  it('sits between Help and Send', async () => {
    await renderRing();
    const names = screen.getAllByRole('button').map((b) => b.getAttribute('aria-label'));
    const at = names.findIndex((n) => n?.startsWith('Formamorph AI Allowance'));
    expect(names[at - 1]).toBe('About How to Play');
    expect(names[at + 1]).toBe('Send');
  });
});

describe('Allowance Ring: the figure', () => {
  it('holds during a turn and moves when the turn commits', async () => {
    const view = await renderRing();
    setBusy(view, true);
    usage(40);
    act(() => { hostedSession.settleTurn(); });
    expect((await ring()).getAttribute('aria-label')).toContain('32%');
    setBusy(view, false);
    expect((await ring()).getAttribute('aria-label')).toContain('40%');
  });

  it('holds during a turn and moves when the turn is stopped', async () => {
    const view = await renderRing();
    setBusy(view, true);
    usage(38);
    expect((await ring()).getAttribute('aria-label')).toContain('32%');
    // A stopped turn commits nothing, so no settle runs; the busy edge alone releases the figure.
    setBusy(view, false);
    expect((await ring()).getAttribute('aria-label')).toContain('38%');
  });

  it('holds a refusal that lands during a turn until the turn ends', async () => {
    const view = await renderRing();
    setBusy(view, true);
    act(() => { hostedSession.noteRefusal({ code: 'paused', presetState: 'paused' } as never); });
    expect((await ring()).getAttribute('aria-label')).toContain('32%');
    setBusy(view, false);
    const el = await ring();
    expect(el.getAttribute('aria-label')).toBe('Formamorph AI Allowance');
    expect(fillTone(el)).toBeNull();
  });

  it('ignores a usage event alone outside a turn, and takes it with the next read', async () => {
    await renderRing();
    usage(36);
    expect((await ring()).getAttribute('aria-label')).toContain('32%');
    served = { ...STATE, percentUsed: 36 };
    await act(async () => { await hostedSession.refresh(); });
    expect((await ring()).getAttribute('aria-label')).toContain('36%');
  });

  it('takes a background usage event at the next turn end', async () => {
    const view = await renderRing();
    usage(36);
    setBusy(view, true);
    setBusy(view, false);
    expect((await ring()).getAttribute('aria-label')).toContain('36%');
  });

  it('takes a state change outside a turn', async () => {
    await renderRing();
    act(() => { hostedSession.noteRefusal({ code: 'paused', presetState: 'paused' } as never); });
    const el = await ring();
    expect(el.getAttribute('aria-label')).toBe('Formamorph AI Allowance');
    expect(fillTone(el)).toBeNull();
  });

  it('keeps holding through a remount, as a mobile tab change or Hide UI causes', async () => {
    localStorage.setItem('FORMAMORPH_textEndpointPresets', textEndpointPresetCodec.serialize({ activeId: FORMAMORPH_AI_PRESET_ID, presets: [] }));
    const tree = (busy: boolean) => (
      <TooltipProvider><SettingsProvider><AllowanceRing busy={busy} /></SettingsProvider></TooltipProvider>
    );
    const first = render(tree(false));
    first.rerender(tree(true));
    usage(45);
    first.unmount();

    const second = render(tree(true));
    expect((await ring()).getAttribute('aria-label')).toContain('32%');
    second.rerender(tree(false));
    expect((await ring()).getAttribute('aria-label')).toContain('45%');

    usage(50);
    second.unmount();
    render(tree(false));
    expect((await ring()).getAttribute('aria-label')).toContain('45%');
  });

  it('holds through a read made during a turn', async () => {
    const view = await renderRing();
    setBusy(view, true);
    served = { ...STATE, percentUsed: 50 };
    await act(async () => { await hostedSession.refresh(); });
    expect((await ring()).getAttribute('aria-label')).toContain('32%');
    setBusy(view, false);
    expect((await ring()).getAttribute('aria-label')).toContain('50%');
  });
});

describe('Allowance Ring: color', () => {
  it.each([
    [74.9, 'normal'], [75, 'warning'], [89.9, 'warning'], [90, 'destructive'], [99.9, 'destructive'],
  ])('at %s%% draws %s', async (percentUsed, tone) => {
    served = { ...STATE, percentUsed };
    await hostedSession.refresh();
    await renderRing();
    expect(fillTone(await ring())).toBe(tone);
  });

  it('draws destructive when the allowance is used', async () => {
    served = { ...STATE, state: 'exhausted', percentUsed: 100, turnsLeft: 0 };
    await hostedSession.refresh();
    await renderRing();
    expect(fillTone(await ring())).toBe('destructive');
  });

  it('keeps warning for every value below the highest, and changes nothing with no thresholds', () => {
    expect(allowanceTone(60, [50, 75, 90])).toBe('warning');
    expect(allowanceTone(80, [50, 75, 90])).toBe('warning');
    expect(allowanceTone(90, [50, 75, 90])).toBe('destructive');
    expect(allowanceTone(95, null)).toBe('normal');
    expect(allowanceTone(100, null)).toBe('destructive');
  });
});

describe('Allowance Ring: the button', () => {
  it('opens from the keyboard', async () => {
    await renderRing();
    (await ring()).focus();
    await userEvent.keyboard('{Enter}');
    expect(await screen.findByRole('dialog')).toBeTruthy();
  });
});

describe('Allowance Ring: the popover', () => {
  it('reads the state on open and shows percent, turns left, reset day and breakdown', async () => {
    await renderRing();
    expect(stateReads).toBe(0);
    served = { ...STATE, percentUsed: 33, turnsLeft: 40 };
    const dialog = await openPopover();
    await waitFor(() => expect(stateReads).toBe(1));
    await waitFor(() => expect(dialog.textContent).toContain('33% used'));
    expect(dialog.textContent).toContain('About 40 turns left');
    expect(dialog.textContent).toMatch(/Resets \w+ at /);
    expect(within(dialog).getByText('Narration')).toBeTruthy();
    expect((await ring()).getAttribute('aria-label')).toContain('33%');
  });

  it('shows the live read during a turn while the ring holds, then reads once more at the turn end', async () => {
    const view = await renderRing();
    setBusy(view, true);
    served = { ...STATE, percentUsed: 45 };
    const dialog = await openPopover();
    await waitFor(() => expect(dialog.textContent).toContain('45% used'));
    expect(screen.getByRole('button', { name: /Formamorph AI Allowance/, hidden: true }).getAttribute('aria-label')).toContain('32%');
    const reads = stateReads;
    served = { ...STATE, percentUsed: 47 };
    setBusy(view, false);
    await waitFor(() => expect(dialog.textContent).toContain('47% used'));
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
    expect(stateReads).toBe(reads + 1);
    expect(screen.getByRole('button', { name: /Formamorph AI Allowance/, hidden: true }).getAttribute('aria-label')).toContain('47%');
  });

  it('reads nothing at a turn end while closed', async () => {
    const view = await renderRing();
    setBusy(view, true);
    setBusy(view, false);
    expect(stateReads).toBe(0);
  });

  it.each([
    ['paused', 'paused for everyone', 'Check Again'],
    ['locked', 'for Patreon Supporters', 'Support on Patreon'],
  ])('%s shows no fill, the reason and its action', async (state, reason, action) => {
    served = { ...STATE, state, percentUsed: null, turnsLeft: null, breakdown: null, breakdownThreshold: null };
    await hostedSession.refresh();
    await renderRing();
    const el = await ring();
    expect(fillTone(el)).toBeNull();
    expect(el.getAttribute('aria-label')).toBe('Formamorph AI Allowance');
    const dialog = await openPopover();
    await waitFor(() => expect(dialog.textContent).toContain(reason));
    expect(within(dialog).getByRole('button', { name: action })).toBeTruthy();
    expect(dialog.querySelector('[data-hosted-usage]')).toBeNull();
  });

  it('shows no fill in an app-derived state', async () => {
    AuthService.token = null;
    hostedSession.reset();
    await renderRing();
    const el = await ring();
    expect(fillTone(el)).toBeNull();
    const dialog = await openPopover();
    expect(within(dialog).getByRole('button', { name: 'Sign In' })).toBeTruthy();
  });

  it('holds Switch Back and the Patreon link at the end of the allowance', async () => {
    served = { ...STATE, state: 'exhausted', percentUsed: 100, turnsLeft: 0 };
    await hostedSession.refresh();
    await renderRing();
    const dialog = await openPopover();
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Switch Back' })).toBeTruthy());
    expect(within(dialog).getByRole('button', { name: 'Support on Patreon' })).toBeTruthy();
  });

  it('routes every dev state the ring can show', () => {
    expect([...DEV_MODAL_TABS.gameViewerAllowance].sort()).toEqual(Object.keys(DEV_ALLOWANCE_ROUTES).sort());
  });

  it('shows the empty state early in a week', async () => {
    served = { ...STATE, percentUsed: 0, breakdown: {} };
    await hostedSession.refresh();
    await renderRing();
    const dialog = await openPopover();
    await waitFor(() => expect(dialog.textContent).toContain('Nothing used yet this week'));
  });
});
