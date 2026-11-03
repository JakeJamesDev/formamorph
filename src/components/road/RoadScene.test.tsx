import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { jellyDipMs } from '@/lib/formaquestion/mascotTransition';
import { resetTierNamesForTest, seedTierNamesForTest } from '@/lib/tierNames';
import { stubReducedMotion } from '@/test/reducedMotion';
import { RoadScene } from './RoadScene';
import { RoadFire } from './RoadFire';
import { CHANGE_JELLY, ENTER_JELLY } from './useMorphieJelly';

const NAMES = { supporter: 'Ember', supporter_plus: 'Blaze', supporter_top: 'Pyre' };
const PRICES = { supporter: 500, supporter_plus: 1000, supporter_top: 2050 };

const scene = (props: Partial<Parameters<typeof RoadScene>[0]> = {}) =>
  render(<RoadScene onKeepPlaying={vi.fn()} onSupport={vi.fn()} {...props} />);

const litCount = () => document.querySelectorAll('[data-moment][data-lit="true"]').length;
const shownFire = () => document.querySelector('[data-fire]')?.getAttribute('data-fire');
const visibleLayers = () =>
  [...document.querySelectorAll<HTMLElement>('[data-look]:not([hidden]) [data-layer]')].map((layer) => layer.dataset.layer);
const morphie = () => document.querySelector<HTMLElement>('[data-morphie]')!;
const pick = (name: string) => fireEvent.click(screen.getByRole('radio', { name: new RegExp(name) }));

beforeEach(() => {
  seedTierNamesForTest(NAMES, PRICES);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  resetTierNamesForTest();
});

describe('RoadScene levels', () => {
  it.each([
    ['Ember', 3, 'supporter', ['arms-no-wave', 'arms-no-thinking', 'mouth-small-o']],
    ['Blaze', 7, 'supporter_plus', ['arms-no-wave', 'arms-thinking', 'eyes-wide', 'mouth-small-o']],
    ['Pyre', 12, 'supporter_top', ['arms-no-wave', 'arms-no-thinking', 'eyes-heart', 'mouth-open']],
  ])('%s lights its moments and shows its own fire and look', (name, lit, tier, layers) => {
    stubReducedMotion();
    scene({ initialTier: 'supporter' });
    pick(name);
    expect(litCount()).toBe(lit);
    expect(shownFire()).toBe(tier);
    expect(visibleLayers()).toEqual(layers);
  });

  it('opens on the middle level', () => {
    scene();
    expect(screen.getByRole('radio', { name: /Blaze/ }).getAttribute('data-state')).toBe('on');
    expect(shownFire()).toBe('supporter_plus');
  });

  it('never mirrors Morphie or draws a blush or a wave', () => {
    scene();
    const layers = [...document.querySelectorAll<HTMLElement>('[data-layer]')].map((layer) => layer.dataset.layer);
    expect(layers).not.toContain('blush');
    expect(layers).not.toContain('arms-wave');
    expect(document.querySelector('[data-morphie] .-scale-x-100')).toBeNull();
    expect(morphie().closest('.-scale-x-100')).toBeNull();
  });

  it('states what the picked level includes, with the server names', () => {
    scene();
    expect(screen.getByText('Your support includes:')).toBeTruthy();
    expect(screen.getByText("Formamorph AI, with twice Ember's memory, so it keeps more of your story in mind")).toBeTruthy();
    expect(screen.getByText('A Blaze badge and name color, and a place on the Supporters wall')).toBeTruthy();
  });

  it('keeps the levels apart when the server has named none', () => {
    seedTierNamesForTest({});
    scene();
    const group = screen.getByRole('radiogroup', { name: 'Level' });
    for (const name of ['Spark', 'Flame', 'Beacon']) expect(within(group).getByText(name)).toBeTruthy();
    expect(within(group).queryByText('Member')).toBeNull();
  });

  it('shows no turn count or allowance amount', () => {
    scene();
    const text = document.body.textContent ?? '';
    expect(text).not.toMatch(/\bturns?\b/i);
    expect(text).not.toMatch(/\d+\s*(tokens|messages)/i);
  });

  it('renders the side-by-side block from its fixed data', () => {
    scene();
    expect(screen.getByText('A sample from the Demo AI goes here.')).toBeTruthy();
    expect(screen.getByText('A sample from Formamorph AI goes here.')).toBeTruthy();
  });
});

describe('RoadScene prices', () => {
  it('shows each price from whole cents and from cents with a remainder', () => {
    scene();
    expect(screen.getByRole('radio', { name: /Ember/ }).textContent).toContain('$5 a month');
    expect(screen.getByRole('radio', { name: /Pyre/ }).textContent).toContain('$20.50 a month');
  });

  it('hides only the price that is null', () => {
    seedTierNamesForTest(NAMES, { supporter: 500 });
    scene();
    expect(screen.getByRole('radio', { name: /Ember/ }).textContent).toContain('$5 a month');
    const unpriced = screen.getByRole('radio', { name: /Blaze/ });
    expect(unpriced.textContent).toBe('Blaze');
    expect(unpriced.querySelectorAll('span')).toHaveLength(1);
  });

  it('shows no price and still works without the field', () => {
    seedTierNamesForTest(NAMES);
    scene();
    expect(document.querySelector('[role="dialog"]')?.textContent).not.toContain('$');
    pick('Pyre');
    expect(screen.getByRole('radio', { name: /Pyre/ }).getAttribute('data-state')).toBe('on');
  });
});

describe('RoadScene actions', () => {
  it('keeps the negative action first, and each action calls its handler', () => {
    const onKeepPlaying = vi.fn();
    const onSupport = vi.fn();
    scene({ onKeepPlaying, onSupport });
    const keep = screen.getByRole('button', { name: 'Keep Playing' });
    const support = screen.getByRole('button', { name: 'Support on Patreon' });
    expect(keep.compareDocumentPosition(support) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(keep);
    fireEvent.click(support);
    expect(onKeepPlaying).toHaveBeenCalledTimes(1);
    expect(onSupport).toHaveBeenCalledTimes(1);
  });

  it('treats Escape as Keep Playing', () => {
    const onKeepPlaying = vi.fn();
    scene({ onKeepPlaying });
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onKeepPlaying).toHaveBeenCalledTimes(1);
  });

  it('stays dark in the light theme', () => {
    scene();
    expect(screen.getByRole('dialog').classList.contains('dark')).toBe(true);
  });
});

describe('RoadScene Jelly', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('holds the old level until the dip, then swaps', () => {
    scene();
    act(() => { vi.advanceTimersByTime(ENTER_JELLY.durationMs + 100); });
    pick('Pyre');
    expect(shownFire()).toBe('supporter_plus');
    act(() => { vi.advanceTimersByTime(jellyDipMs(CHANGE_JELLY) - 5); });
    expect(shownFire()).toBe('supporter_plus');
    act(() => { vi.advanceTimersByTime(10); });
    expect(shownFire()).toBe('supporter_top');
    expect(litCount()).toBe(12);
  });

  it('swaps and rests by timer even when no frame ever runs', () => {
    vi.stubGlobal('requestAnimationFrame', () => 0);
    scene();
    act(() => { vi.advanceTimersByTime(ENTER_JELLY.durationMs + 100); });
    morphie().style.transform = 'scale(1, 0.9)';
    pick('Ember');
    act(() => { vi.advanceTimersByTime(CHANGE_JELLY.durationMs + 100); });
    expect(shownFire()).toBe('supporter');
    expect(morphie().style.transform).toBe('');
  });

  it('lands an interrupted change on the last pick', () => {
    scene();
    act(() => { vi.advanceTimersByTime(ENTER_JELLY.durationMs + 100); });
    pick('Pyre');
    act(() => { vi.advanceTimersByTime(40); });
    pick('Ember');
    act(() => { vi.advanceTimersByTime(CHANGE_JELLY.durationMs + 100); });
    expect(shownFire()).toBe('supporter');
    expect(litCount()).toBe(3);
  });
});

describe('RoadScene reduced motion', () => {
  it('swaps at once with no transform on Morphie', () => {
    vi.useFakeTimers();
    stubReducedMotion();
    scene();
    pick('Pyre');
    expect(shownFire()).toBe('supporter_top');
    expect(morphie().style.transform).toBe('');
    act(() => { vi.advanceTimersByTime(CHANGE_JELLY.durationMs); });
    expect(morphie().style.transform).toBe('');
  });

  it.each(['supporter', 'supporter_plus', 'supporter_top'] as const)('stops the motion of the %s fire', (tier) => {
    const { container, unmount } = render(<RoadFire tier={tier} />);
    const motion = () => container.querySelectorAll('animate, .road-ember, .road-twinkle, .road-rays').length;
    expect(motion()).toBeGreaterThan(0);
    unmount();
    stubReducedMotion();
    const still = render(<RoadFire tier={tier} />);
    expect(still.container.querySelector('svg')).toBeTruthy();
    expect(still.container.querySelectorAll('animate, .road-ember, .road-twinkle, .road-rays').length).toBe(0);
  });

  it('drops the transitions on the road', () => {
    stubReducedMotion();
    scene();
    for (const moment of document.querySelectorAll<SVGElement>('[data-moment], [data-light]')) {
      expect(moment.style.transition).toBe('');
    }
  });
});
