import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { jellyDipMs } from '@/lib/formaquestion/mascotTransition';
import { resetTierNamesForTest, seedTierNamesForTest } from '@/lib/tierNames';
import { stubReducedMotion } from '@/test/reducedMotion';
import { checklistRows } from '@/lib/supportChecklist';
import { RoadScene } from './RoadScene';
import { ROAD_LEVELS, ROAD_SAMPLES } from './roadLevels';
import { RoadFire } from './RoadFire';
import { CHANGE_JELLY, ENTER_JELLY } from './useMorphieJelly';
import type { SupportChecklistModel } from './useSupportChecklist';

const NAMES = { supporter: 'Ember', supporter_plus: 'Blaze', supporter_top: 'Pyre' };
const PRICES = { supporter: 500, supporter_plus: 1000, supporter_top: 2050 };

const model = (doneCount: number, run = vi.fn()): SupportChecklistModel => ({
  rows: checklistRows({ signedIn: doneCount > 0, attested: doneCount > 0, patreon: undefined, patreonOpened: false, onFormamorphAi: false }),
  doneCount,
  main: { action: 'signIn', label: 'Sign In', busy: false, run },
  linkNow: null,
  openPatreon: null,
  notice: null,
});

const scene = (props: Partial<Parameters<typeof RoadScene>[0]> = {}) =>
  render(<RoadScene onKeepPlaying={vi.fn()} checklist={model(0)} {...props} />);

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
    expect(screen.getByText('More turns each week')).toBeTruthy();
    expect(screen.getByText("Twice Ember's room for large worlds and long stories")).toBeTruthy();
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
    expect(text).not.toMatch(/\d[\d,]*\s*(turns?|tokens|messages)/i);
  });

  it('shows the player action above both replies, unedited apart from the rendered italics', () => {
    scene();
    const action = screen.getByText(ROAD_SAMPLES.action);
    const demo = screen.getByText('Demo AI').parentElement!;
    const hosted = screen.getByText('Formamorph AI').parentElement!;
    expect(action.compareDocumentPosition(demo) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(demo.compareDocumentPosition(hosted) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const words = (text: string) => text.replace(/\*/g, '').split(/\s+/).filter(Boolean);
    for (const [block, sample] of [[demo, ROAD_SAMPLES.demo], [hosted, ROAD_SAMPLES.hosted]] as const) {
      const shown = [...block.querySelectorAll('p')].map((paragraph) => paragraph.textContent).join(' ');
      expect(words(shown)).toEqual(words(sample.text));
      expect(block.querySelectorAll('p').length).toBe(sample.text.split('\n\n').length);
      expect(block.textContent).not.toContain('*');
    }
    expect(demo.querySelector('em')?.textContent).toBe('humility');
  });

  it('shows each level its own line with the server names, and no word-for-word line', () => {
    stubReducedMotion();
    scene({ initialTier: 'supporter' });
    ROAD_LEVELS.forEach((level) => {
      pick(NAMES[level.tier]);
      expect(screen.getByText(level.line((tier) => NAMES[tier]))).toBeTruthy();
      expect(screen.queryByText(/word for word/)).toBeNull();
    });
    pick(NAMES.supporter_plus);
    expect(screen.getByText("More turns each week, and twice Ember's room for large worlds")).toBeTruthy();
  });

  it('leads with narration quality and names support as a reason to pledge', () => {
    scene();
    expect(screen.getByRole('heading', { name: 'Better Narration for Your Stories' })).toBeTruthy();
    expect(screen.getByText('Whatever the perks are worth to you, every pledge helps keep the updates coming')).toBeTruthy();
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
    scene({ onKeepPlaying });
    const keep = screen.getByRole('button', { name: 'Keep Playing' });
    const support = screen.getByRole('button', { name: 'Support on Patreon' });
    expect(keep.compareDocumentPosition(support) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(keep);
    expect(onKeepPlaying).toHaveBeenCalledTimes(1);
    fireEvent.click(support);
    expect(screen.getByRole('heading', { name: 'Set Up Formamorph AI' })).not.toBeNull();
    expect(onKeepPlaying).toHaveBeenCalledTimes(1);
  });

  it('treats Escape as Keep Playing', () => {
    const onKeepPlaying = vi.fn();
    scene({ onKeepPlaying });
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onKeepPlaying).toHaveBeenCalledTimes(1);
  });

  it('follows the theme, with no forced dark page', () => {
    scene();
    expect(screen.getByRole('dialog').classList.contains('dark')).toBe(false);
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

describe('RoadScene checklist', () => {
  const rerender = (view: ReturnType<typeof render>, done: number) =>
    view.rerender(<RoadScene onKeepPlaying={vi.fn()} initialView="checklist" checklist={model(done)} />);

  it('keeps Finish Later before the main action', () => {
    const run = vi.fn();
    const onKeepPlaying = vi.fn();
    scene({ initialView: 'checklist', checklist: model(0, run), onKeepPlaying });
    const later = screen.getByRole('button', { name: 'Finish Later' });
    const main = screen.getByRole('button', { name: 'Sign In' });
    expect(later.compareDocumentPosition(main) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(later);
    fireEvent.click(main);
    expect(onKeepPlaying).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it.each([[0, 'supporter'], [1, 'supporter'], [2, 'supporter_plus'], [3, 'supporter_plus'], [4, 'supporter_top']])(
    'shows the %s-step fire for %s',
    (done, tier) => {
      stubReducedMotion();
      scene({ initialView: 'checklist', checklist: model(done) });
      expect(shownFire()).toBe(tier);
    },
  );

  it('plays the Jelly on each finished step and moves no row', () => {
    vi.useFakeTimers();
    const view = render(<RoadScene onKeepPlaying={vi.fn()} initialView="checklist" checklist={model(0)} />);
    act(() => { vi.advanceTimersByTime(ENTER_JELLY.durationMs + 100); });
    const order = () => [...document.querySelectorAll('[data-step]')].map((row) => row.getAttribute('data-step'));
    const before = order();
    rerender(view, 1);
    act(() => { vi.advanceTimersByTime(jellyDipMs(CHANGE_JELLY) - 1); });
    expect(morphie().style.transform).toMatch(/^scale\(/);
    expect(order()).toEqual(before);
    act(() => { vi.advanceTimersByTime(CHANGE_JELLY.durationMs + 100); });
    expect(morphie().style.transform).toBe('');
    expect(document.querySelector('[data-step="signIn"]')?.getAttribute('data-done')).toBe('true');
    expect(order()).toEqual(before);
  });
});
