import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDocsIndex } from '@/lib/docs/docsIndex';
import { helpAi } from '@/test/helpAiFixture';
import { storeMinimalWindow } from '@/test/helpFixtures';
import { stubReducedMotion } from '@/test/reducedMotion';
import type { HelpAi } from './useHelpAi';
import { PILL_FADE_DELAY_MS } from './usePillFade';

const ai = vi.hoisted(() => ({ current: null as unknown as HelpAi }));
vi.mock('./useHelpAi', () => ({ useHelpAi: () => ai.current }));
vi.mock('@/components/theme-provider', () => ({ useTheme: () => ({ resolvedTheme: 'dark' }) }));
import { Formaquestion } from './Formaquestion';

const loadFixture = () => Promise.resolve(createDocsIndex({ pages: { Settings: '# ⚙️ Settings\n\nSettings hold your options.\n' }, sidebar: '- [Settings](Settings)\n' }));

const helpWindow = () => screen.getByRole('dialog', { name: 'Formaquestion' });
const pill = () => helpWindow().querySelector<HTMLElement>('[data-fq-drag]')!;
const body = () => helpWindow().querySelector<HTMLElement>('[data-fq-body]')!;
const grip = () => helpWindow().querySelector<HTMLElement>('[data-fq-mascot-resize]')!;
const fadeOf = (element: HTMLElement) => element.getAttribute('data-fq-fade');

const wait = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });
const hover = (target: HTMLElement) => fireEvent.pointerEnter(target);
const unhover = (target: HTMLElement) => fireEvent.pointerLeave(target);
/** Moves focus into the first control of the pill, as a Tab does. */
const focusPill = () => act(() => pill().querySelector<HTMLElement>('button')!.focus());

/**
 * Opens the window on the fake clock that `beforeEach` installs. Testing Library's async helpers wait on a real
 * zero-delay timeout, which the fake holds back, so this flushes and queries synchronously.
 */
async function openWindow() {
  render(<Formaquestion loadIndex={loadFixture} />);
  fireEvent.click(screen.getByRole('button', { name: 'Help' }));
  await act(async () => {});
  screen.getByRole('textbox', { name: 'Ask a Question' });
}

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('innerWidth', 1600);
  vi.stubGlobal('innerHeight', 900);
  ai.current = helpAi({ revalidate: vi.fn(async () => true), requestSurface: vi.fn() });
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('the pill fade under Bubble', () => {
  it('shows on open, then hides after the delay', async () => {
    await openWindow();
    expect(fadeOf(pill())).toBe('shown');
    expect(fadeOf(grip())).toBe('shown');

    wait(PILL_FADE_DELAY_MS - 1);
    expect(fadeOf(pill())).toBe('shown');
    wait(1);
    expect(fadeOf(pill())).toBe('hidden');
    expect(pill()).toHaveClass('opacity-0');
    // Her grip hides and shows with the pill.
    expect(fadeOf(grip())).toBe('hidden');
    expect(grip()).toHaveClass('opacity-0');
  });

  it.each([
    ['the pill', pill],
    ['her body', body],
    ['her grip', grip],
  ])('returns on hover over %s, and hides again after the pointer leaves', async (_name, target) => {
    await openWindow();
    wait(PILL_FADE_DELAY_MS);
    expect(fadeOf(pill())).toBe('hidden');

    hover(target());
    expect(fadeOf(pill())).toBe('shown');
    expect(fadeOf(grip())).toBe('shown');
    wait(PILL_FADE_DELAY_MS * 3);
    expect(fadeOf(pill())).toBe('shown');

    unhover(target());
    wait(PILL_FADE_DELAY_MS - 1);
    expect(fadeOf(pill())).toBe('shown');
    wait(1);
    expect(fadeOf(pill())).toBe('hidden');
    expect(fadeOf(grip())).toBe('hidden');
  });

  it('returns on keyboard focus inside the pill, and hides again after focus leaves', async () => {
    await openWindow();
    wait(PILL_FADE_DELAY_MS);
    expect(fadeOf(pill())).toBe('hidden');

    focusPill();
    expect(pill()).toContainElement(document.activeElement as HTMLElement);
    expect(fadeOf(pill())).toBe('shown');
    wait(PILL_FADE_DELAY_MS * 3);
    expect(fadeOf(pill())).toBe('shown');

    act(() => (document.activeElement as HTMLElement).blur());
    wait(PILL_FADE_DELAY_MS);
    expect(fadeOf(pill())).toBe('hidden');
  });

  it('stays up with her grip while the ⋮ menu is open, and hides after it closes', async () => {
    await openWindow();
    hover(pill());
    fireEvent.click(within(pill()).getByRole('button', { name: 'More Actions' }));
    wait(1);
    const menu = screen.getByRole('menu');
    // Neither the pointer nor focus holds the pill; the open menu does.
    unhover(pill());
    act(() => (document.activeElement as HTMLElement).blur());
    expect(screen.getByRole('menu')).toBe(menu);
    wait(PILL_FADE_DELAY_MS * 3);
    expect(fadeOf(pill())).toBe('shown');
    expect(fadeOf(grip())).toBe('shown');

    // The menu unmounts under the pointer and its focus, which sends no leave or blur event.
    fireEvent.keyDown(menu, { key: 'Escape' });
    wait(PILL_FADE_DELAY_MS);
    expect(screen.queryByRole('menu')).toBeNull();
    expect(fadeOf(pill())).toBe('hidden');
    expect(fadeOf(grip())).toBe('hidden');
  });

  it('takes no presses while hidden, so a click cannot land on a control that is not showing', async () => {
    await openWindow();
    expect(pill()).not.toHaveClass('!pointer-events-none');
    wait(PILL_FADE_DELAY_MS);
    expect(pill()).toHaveClass('!pointer-events-none');
    expect(grip()).toHaveClass('!pointer-events-none');
  });

  it('does not stay up for focus that a press left behind', async () => {
    await openWindow();
    wait(PILL_FADE_DELAY_MS);
    const matches = Element.prototype.matches;
    vi.spyOn(Element.prototype, 'matches').mockImplementation(function (this: Element, selector: string) {
      return selector === ':focus-visible' ? false : matches.call(this, selector);
    });

    focusPill();
    expect(fadeOf(pill())).toBe('hidden');
  });

  it('keeps the pill and her grip up on a touch screen', async () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query.includes('coarse'), media: query, addEventListener: () => {}, removeEventListener: () => {},
    }));
    await openWindow();
    wait(PILL_FADE_DELAY_MS * 3);
    expect(pill()).not.toHaveAttribute('data-fq-fade');
    expect(pill()).not.toHaveClass('opacity-0');
    expect(grip()).not.toHaveClass('opacity-0');
  });

  it('fades with a transition, and shows and hides with none under reduced motion', async () => {
    await openWindow();
    expect(pill()).toHaveClass('transition-opacity');
    expect(grip()).toHaveClass('transition-opacity');
    cleanup();

    stubReducedMotion();
    await openWindow();
    wait(PILL_FADE_DELAY_MS);
    expect(fadeOf(pill())).toBe('hidden');
    expect(pill()).toHaveClass('opacity-0');
    expect(pill()).not.toHaveClass('transition-opacity');
    expect(grip()).not.toHaveClass('transition-opacity');
  });
});

describe('the chromes whose pill never fades', () => {
  it('keeps the head view pill up', async () => {
    localStorage.setItem('formamorph.formaquestion.mascotView', 'head');
    await openWindow();
    wait(PILL_FADE_DELAY_MS * 3);
    expect(pill()).not.toHaveAttribute('data-fq-fade');
    expect(pill()).not.toHaveClass('opacity-0');
  });

  it('keeps the pill up when the Mascot swaps to her head, and fades it again on her whole body', async () => {
    await openWindow();
    fireEvent.click(within(pill()).getByRole('button', { name: 'Show Head Only' }));
    wait(PILL_FADE_DELAY_MS * 3);
    expect(pill()).not.toHaveAttribute('data-fq-fade');

    fireEvent.click(within(pill()).getByRole('button', { name: 'Show Full Mascot' }));
    expect(fadeOf(pill())).toBe('shown');
    wait(PILL_FADE_DELAY_MS);
    expect(fadeOf(pill())).toBe('hidden');
  });

  it('fades on her whole body even when the pointer was over the pill as it swapped to her head', async () => {
    await openWindow();
    hover(pill());
    fireEvent.click(within(pill()).getByRole('button', { name: 'Show Head Only' }));
    fireEvent.click(within(pill()).getByRole('button', { name: 'Show Full Mascot' }));
    wait(PILL_FADE_DELAY_MS);
    expect(fadeOf(pill())).toBe('hidden');
  });

  it.each(['minimal', 'full'] as const)('keeps the %s chrome pieces up', async (chatStyle) => {
    storeMinimalWindow({ chatStyle });
    await openWindow();
    wait(PILL_FADE_DELAY_MS * 3);
    expect(document.querySelector('[data-fq-fade]')).toBeNull();
    expect(document.querySelector('[data-fq-drag]')).not.toHaveClass('opacity-0');
  });
});
