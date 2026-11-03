import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { CHANGE_JELLY } from '@/components/road/useMorphieJelly';
import { jellyDipMs } from '@/lib/formaquestion/mascotTransition';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { closeRoadScene, isRoadSceneOpen, roadSceneStart } from '@/components/road/roadSceneStore';
import { hostedStateCopy } from '@/lib/hostedAi/hostedCopy';
import { resetTierNamesForTest, seedTierNamesForTest } from '@/lib/tierNames';
import type { HostedPresetState } from '@/lib/hostedAi/refusals';
import { HostedPresetStatus } from './HostedPresetStatus';

const settings = vi.hoisted(() => ({
  hostedAi: { presetState: 'locked', hosted: null } as { presetState: string; hosted: unknown },
  refreshHostedState: vi.fn(),
  switchBackFromHostedAi: vi.fn(),
}));

vi.mock('@/contexts/SettingsContext', () => ({ useSettings: () => settings }));
vi.mock('@/contexts/AgeGateContext', () => ({ useAgeGate: () => ({ requireAttestation: vi.fn() }) }));
vi.mock('@/contexts/PrivacyPolicyContext', () => ({ usePrivacyPolicy: () => ({ checkNow: vi.fn() }) }));

const PANEL_STATES: HostedPresetState[] = ['signed-out', 'age-gate', 'locked'];
const TEXT_STATES: HostedPresetState[] = ['ready', 'warned', 'exhausted', 'paused', 'privacy-required', 'suspended', 'unconfirmed', 'outdated', 'unavailable'];

const panel = () => document.querySelector('[data-locked-preset]');

beforeEach(() => {
  seedTierNamesForTest({ supporter: 'Ember', supporter_plus: 'Blaze', supporter_top: 'Pyre' }, {});
  settings.hostedAi = { presetState: 'locked', hosted: null };
});

afterEach(() => {
  cleanup();
  closeRoadScene();
  resetTierNamesForTest();
});

describe('HostedPresetStatus locked panel', () => {
  it.each(PANEL_STATES)('draws the levels panel for %s in place of the reason and button', (state) => {
    render(<HostedPresetStatus state={state} lockedPanel />);
    expect(panel()).not.toBeNull();
    expect(document.querySelectorAll('[data-fire]').length).toBeGreaterThan(0);
    expect(screen.getAllByRole('radio')).toHaveLength(3);
    // The panel carries its own actions.
    expect(screen.queryByRole('button', { name: /^(Sign In|Confirm Age)$/ })).toBeNull();
  });

  it.each(TEXT_STATES)('keeps the reason text and actions for %s', (state) => {
    render(<HostedPresetStatus state={state} lockedPanel />);
    expect(panel()).toBeNull();
    const copy = hostedStateCopy(state);
    if (copy) expect(screen.getByText((text) => text.startsWith(copy.reason))).toBeTruthy();
    if (copy?.action) expect(screen.getByRole('button', { name: copy.action.label })).toBeTruthy();
  });

  it('keeps the plain text and button without the lockedPanel prop', () => {
    render(<HostedPresetStatus state="locked" />);
    expect(panel()).toBeNull();
    expect(screen.getByRole('button', { name: 'Support on Patreon' })).toBeTruthy();
  });

  it('plays the Jelly on Morphie only and swaps the fire at the dip', () => {
    vi.useFakeTimers();
    try {
      render(<HostedPresetStatus state="locked" lockedPanel />);
      const fire = () => document.querySelector('[data-fire]')?.getAttribute('data-fire');
      expect(fire()).toBe('supporter_plus');
      fireEvent.click(screen.getByRole('radio', { name: /Pyre/ }));
      expect(fire()).toBe('supporter_plus');
      act(() => { vi.advanceTimersByTime(jellyDipMs(CHANGE_JELLY) + 1); });
      expect(fire()).toBe('supporter_top');
      const moved = [...document.querySelectorAll<HTMLElement>('[style*="transform: scale"]')];
      expect(moved.length).toBeGreaterThan(0);
      expect(moved.every((el) => el.hasAttribute('data-morphie'))).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('opens nothing by itself', () => {
    render(<HostedPresetStatus state="locked" lockedPanel />);
    expect(isRoadSceneOpen()).toBe(false);
  });

  it('See Levels opens the levels and Support on Patreon opens the checklist', () => {
    render(<HostedPresetStatus state="signed-out" lockedPanel />);
    fireEvent.click(screen.getByRole('button', { name: 'See Levels' }));
    expect(isRoadSceneOpen()).toBe(true);
    expect(roadSceneStart()).toBe('levels');
    closeRoadScene();
    fireEvent.click(screen.getByRole('button', { name: 'Support on Patreon' }));
    expect(roadSceneStart()).toBe('checklist');
  });

  it('shows the normal state once the player gains access', () => {
    const view = render(<HostedPresetStatus lockedPanel />);
    expect(panel()).not.toBeNull();
    settings.hostedAi = { presetState: 'ready', hosted: null };
    view.rerender(<HostedPresetStatus lockedPanel />);
    expect(panel()).toBeNull();
  });
});
