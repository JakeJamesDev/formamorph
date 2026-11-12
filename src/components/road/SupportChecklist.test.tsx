import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PATREON_PAGE_URL } from '@/components/PatreonSection';
import { isPatreonPageOpened } from '@/lib/firstTimeFlowStore';
import { openExternal } from '@/lib/openExternal';
import { requestSignIn } from '@/lib/signInStore';
import { FORMAMORPH_AI_PRESET_ID } from '@/lib/textEndpointPresets';
import { PatreonService, type PatreonStatus } from '@/services/PatreonService';
import { funnelPosts } from '@/test/funnelPosts';
import { RoadSceneHost } from './RoadSceneHost';
import { closeRoadScene, openRoadScene } from './roadSceneStore';

const world = vi.hoisted(() => ({
  signedIn: false,
  attested: false,
  activePreset: 'default',
  requireAttestation: vi.fn(),
  selectTextEndpointPreset: vi.fn(), refreshHostedState: vi.fn(),
}));

vi.mock('@/lib/openExternal', () => ({ openExternal: vi.fn() }));
vi.mock('@/lib/signInStore', () => ({ requestSignIn: vi.fn() }));
vi.mock('@/contexts/AgeGateContext', () => ({
  useAgeGate: () => ({ attested: world.attested, requireAttestation: world.requireAttestation }),
}));
vi.mock('@/contexts/SettingsContext', () => ({
  useSettings: () => ({ activeTextEndpointPresetId: world.activePreset, selectTextEndpointPreset: world.selectTextEndpointPreset, refreshHostedState: world.refreshHostedState }),
}));
vi.mock('@/services/AuthService', () => ({
  default: { isAuthenticated: () => world.signedIn, onSessionChanged: () => () => {} },
}));
vi.mock('@/services/PatreonService', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/PatreonService')>()),
  PatreonService: { getStatus: vi.fn(), startLink: vi.fn() },
}));

const UNLINKED: PatreonStatus = { linked: false };
const NO_TIER: PatreonStatus = { linked: true, tier: null, since: null, showFlair: true };
const PLEDGED: PatreonStatus = { linked: true, tier: 'supporter', since: null, showFlair: true };

const dialog = () => screen.queryByRole('dialog', { name: 'Set Up Formamorph AI' });
const row = (id: string) => document.querySelector(`[data-step="${id}"]`)!;
const doneRows = () => [...document.querySelectorAll('[data-step][data-done="true"]')].map((el) => el.getAttribute('data-step'));
const status = (next: PatreonStatus) => vi.mocked(PatreonService.getStatus).mockResolvedValue(next);

/** Opens the checklist and lets the first status read answer. */
const open = async () => {
  render(<RoadSceneHost />);
  await act(async () => { openRoadScene('locked', 'checklist'); });
};

beforeEach(() => {
  localStorage.clear();
  world.signedIn = false;
  world.attested = false;
  world.activePreset = 'default';
  vi.mocked(PatreonService.getStatus).mockReset();
});

afterEach(() => {
  act(() => closeRoadScene());
  cleanup();
  vi.clearAllMocks();
});

describe('Support checklist', () => {
  it('opens on the checklist and shows every step before the first is done', async () => {
    await open();
    expect(dialog()).not.toBeNull();
    expect([...document.querySelectorAll('[data-step]')].map((el) => el.getAttribute('data-step'))).toEqual(['signIn', 'pledge', 'link', 'switch']);
    expect(doneRows()).toEqual([]);
    expect(PatreonService.getStatus).not.toHaveBeenCalled();
  });

  it('signed out: Sign In asks for the sign-in', async () => {
    await open();
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));
    expect(requestSignIn).toHaveBeenCalledTimes(1);
  });

  it('signed in without the 18+ check: Sign In asks for the attestation', async () => {
    world.signedIn = true;
    status(UNLINKED);
    await open();
    expect(doneRows()).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));
    expect(world.requireAttestation).toHaveBeenCalledTimes(1);
    expect(requestSignIn).not.toHaveBeenCalled();
  });

  it('a signed-in player starts past step one, and Open Patreon records the visit', async () => {
    world.signedIn = true;
    world.attested = true;
    status(UNLINKED);
    await open();
    expect(doneRows()).toEqual(['signIn']);
    expect(isPatreonPageOpened()).toBe(false);
    fireEvent.click(screen.getAllByRole('button', { name: 'Open Patreon' }).at(-1)!);
    expect(openExternal).toHaveBeenCalledWith(PATREON_PAGE_URL);
    expect(isPatreonPageOpened()).toBe(true);
  });

  it('a return from Patreon with no link makes Link Patreon the main action', async () => {
    world.signedIn = true;
    world.attested = true;
    localStorage.setItem('FORMAMORPH_patreonPageOpened', '1');
    status(UNLINKED);
    vi.mocked(PatreonService.startLink).mockResolvedValue('https://patreon.example/authorize');
    await open();
    expect(doneRows()).toEqual(['signIn']);
    const main = screen.getAllByRole('button', { name: 'Link Patreon' }).at(-1)!;
    await act(async () => { fireEvent.click(main); });
    expect(PatreonService.startLink).toHaveBeenCalledTimes(1);
    expect(openExternal).toHaveBeenCalledWith('https://patreon.example/authorize');
  });

  it('a failed link start says why and stays put', async () => {
    world.signedIn = true;
    world.attested = true;
    localStorage.setItem('FORMAMORPH_patreonPageOpened', '1');
    status(UNLINKED);
    vi.mocked(PatreonService.startLink).mockRejectedValue(new Error('Patreon didn’t respond.'));
    await open();
    await act(async () => { fireEvent.click(screen.getAllByRole('button', { name: 'Link Patreon' }).at(-1)!); });
    expect(screen.getByRole('alert').textContent).toBe('Patreon didn’t respond.');
    expect(doneRows()).toEqual(['signIn']);
  });

  it('a link with no tier finishes the link, leaves the pledge open and returns the main action to Patreon', async () => {
    world.signedIn = true;
    world.attested = true;
    localStorage.setItem('FORMAMORPH_patreonPageOpened', '1');
    status(NO_TIER);
    await open();
    expect(doneRows()).toEqual(['signIn', 'link']);
    expect(row('pledge').getAttribute('aria-current')).toBe('step');
    expect(screen.getAllByRole('button', { name: 'Open Patreon' }).length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'Link Patreon' })).toBeNull();
  });

  it('a link with a tier finishes the pledge and the link together, and Switch selects Formamorph AI, reads its state and stays open', async () => {
    world.signedIn = true;
    world.attested = true;
    status(PLEDGED);
    await open();
    expect(doneRows()).toEqual(['signIn', 'pledge', 'link']);
    fireEvent.click(screen.getByRole('button', { name: 'Switch to Formamorph AI' }));
    expect(world.selectTextEndpointPreset).toHaveBeenCalledWith(FORMAMORPH_AI_PRESET_ID);
    expect(world.refreshHostedState).toHaveBeenCalled();
    expect(dialog()).not.toBeNull();
  });

  it('every step done: the page says so, and Done closes and changes no preset', async () => {
    world.signedIn = true;
    world.attested = true;
    world.activePreset = FORMAMORPH_AI_PRESET_ID;
    status(PLEDGED);
    await open();
    expect(doneRows()).toEqual(['signIn', 'pledge', 'link', 'switch']);
    expect(screen.getByRole('dialog', { name: 'You’re All Set' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Finish Later' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(world.selectTextEndpointPreset).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('re-reads on focus, so a player back from Patreon sees the finished link', async () => {
    world.signedIn = true;
    world.attested = true;
    status(UNLINKED);
    await open();
    expect(doneRows()).toEqual(['signIn']);
    status(PLEDGED);
    await act(async () => { window.dispatchEvent(new Event('focus')); });
    await waitFor(() => expect(doneRows()).toEqual(['signIn', 'pledge', 'link']));
  });

  it('Finish Later returns to the story and writes nothing', async () => {
    world.signedIn = true;
    world.attested = true;
    status(PLEDGED);
    await open();
    fireEvent.click(screen.getByRole('button', { name: 'Finish Later' }));
    expect(dialog()).toBeNull();
    expect(world.selectTextEndpointPreset).not.toHaveBeenCalled();
    expect(isPatreonPageOpened()).toBe(false);
  });

  it('a later open starts from the live state, so Finish Later loses no progress', async () => {
    world.signedIn = true;
    world.attested = true;
    status(PLEDGED);
    await open();
    fireEvent.click(screen.getByRole('button', { name: 'Finish Later' }));
    await act(async () => { openRoadScene('locked', 'checklist'); });
    await waitFor(() => expect(doneRows()).toEqual(['signIn', 'pledge', 'link']));
  });
});

describe('Support checklist funnel steps', () => {
  const openPatreon = () => fireEvent.click(screen.getAllByRole('button', { name: 'Open Patreon' }).at(-1)!);

  beforeEach(() => {
    world.signedIn = true;
    world.attested = true;
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('offline (test)'))));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    window.location.hash = '';
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });

  it('credits the Patreon click to the source that opened the checklist', async () => {
    status(UNLINKED);
    await open();
    openPatreon();
    expect(funnelPosts()).toEqual(['locked_patreon_click']);
  });

  it('credits the latest open: one source opens and closes, a second opens the levels, walks to the checklist and clicks', async () => {
    status(UNLINKED);
    render(<RoadSceneHost />);
    await act(async () => { openRoadScene('demo'); });
    fireEvent.click(screen.getByRole('button', { name: 'Keep Playing' }));
    await act(async () => { openRoadScene('engine'); });
    fireEvent.click(screen.getByRole('button', { name: 'Support on Patreon' }));
    openPatreon();
    expect(funnelPosts()).toEqual(['demo_see_levels', 'engine_see_levels', 'engine_patreon_click']);
  });

  it('credits the finished checklist to the source that opened it', async () => {
    world.activePreset = FORMAMORPH_AI_PRESET_ID;
    status(PLEDGED);
    render(<RoadSceneHost />);
    await act(async () => { openRoadScene('setup', 'checklist'); });
    await waitFor(() => expect(doneRows()).toEqual(['signIn', 'pledge', 'link', 'switch']));
    expect(funnelPosts()).toEqual(['setup_checklist_finished']);
  });

  it('sends nothing from a scene no entry point opened', async () => {
    status(UNLINKED);
    window.location.hash = '#dev?modal=road&tab=checklist';
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    render(<RoadSceneHost />);
    await act(async () => {});
    openPatreon();
    expect(openExternal).toHaveBeenCalledWith(PATREON_PAGE_URL);
    expect(funnelPosts()).toEqual([]);
  });
});
