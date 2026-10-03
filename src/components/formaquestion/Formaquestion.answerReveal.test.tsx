import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDocsIndex } from '@/lib/docs/docsIndex';
import { DEFAULT_HELP_REVEAL, type HelpReveal } from '@/lib/formaquestion/helpReveal';
import { DEFAULT_REVEAL_EASING, REVEAL_EASINGS } from '@/lib/narrationRevealConfig';
import { getRevealTiming, setRevealTiming } from '@/lib/revealTimingStore';
import { sseFrame } from '@/test/aiTextFixtures';
import { helpAi } from '@/test/helpAiFixture';
import { stubHelpStream } from '@/test/helpFixtures';
import type { HelpAi } from './useHelpAi';

const SETTINGS_KEY = 'FORMAMORPH_helpSettings';
const storedReveal = () => (JSON.parse(localStorage.getItem(SETTINGS_KEY)!) as { reveal: HelpReveal }).reveal;
const storeReveal = (reveal: Partial<HelpReveal>) =>
  localStorage.setItem(SETTINGS_KEY, JSON.stringify({ reveal: { ...DEFAULT_HELP_REVEAL, ...reveal } }));

const ai = vi.hoisted(() => ({ current: null as unknown as HelpAi }));
vi.mock('./useHelpAi', () => ({ useHelpAi: () => ai.current }));
vi.mock('@/components/theme-provider', () => ({ useTheme: () => ({ resolvedTheme: 'dark' }) }));
import { Formaquestion } from './Formaquestion';

const PAGES = { Traits: '# 🧬 Traits\n\nA trait changes a stat.\n\n## How to Add a Trait\n\n1. Open the **Traits** tab.\n' };
const loadFixture = () => Promise.resolve(createDocsIndex({ pages: PAGES, sidebar: '- [Traits](Traits)\n' }));
const conversation = () => screen.getByRole('log', { name: 'Conversation' });

async function openAsk() {
  render(<Formaquestion loadIndex={loadFixture} />);
  fireEvent.click(screen.getByRole('button', { name: 'Help' }));
  return screen.findByRole('textbox', { name: 'Ask a Question' });
}

/** Sends a question whose answer stays open, so the answer is still writing. */
async function askWriting(text = 'Open the Traits tab and select Add Trait.') {
  const field = await openAsk();
  const body = new ReadableStream<Uint8Array>({
    start(controller) { controller.enqueue(new TextEncoder().encode(sseFrame({ content: text }))); },
  });
  stubHelpStream(() => new Response(body, { headers: { 'Content-Type': 'text/event-stream' } }));
  await userEvent.type(field, 'How do I add a trait?');
  await userEvent.click(screen.getByRole('button', { name: 'Send' }));
  await vi.waitFor(() => expect(conversation()).toHaveTextContent('Add Trait'));
}

const animatedWords = () => Array.from(conversation().querySelectorAll<HTMLElement>('[data-sd-animate]'));
const wordStyle = (name: string) => animatedWords()[1].style.getPropertyValue(name);
/** The element that carries the reveal's effect variables for the answer. */
const revealBox = () => animatedWords()[0].closest<HTMLElement>('[data-reveal]')!;

/** Sets `prefers-reduced-motion` for the page. */
function stubReducedMotion(reduce: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: reduce && query.includes('reduce'), media: query,
    addEventListener: () => {}, removeEventListener: () => {},
  }));
}

beforeEach(() => {
  localStorage.clear();
  ai.current = helpAi({ revalidate: vi.fn(async () => true) });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Answer Reveal', () => {
  it('sets the next answer from the dialog, and leaves narration alone', async () => {
    await openAsk();
    await userEvent.click(screen.getByRole('button', { name: 'Formaquestion Settings' }));
    const settings = screen.getByRole('dialog', { name: 'Formaquestion Settings' });
    await userEvent.click(within(settings).getByRole('button', { name: /choose reveal animation/i }));
    const dialog = await screen.findByRole('dialog', { name: 'Answer reveal' });
    await userEvent.click(within(dialog).getByRole('checkbox', { name: /Blur/ }));

    expect(storedReveal()).toMatchObject({ fade: true, blur: true });
    expect(Object.keys(localStorage).filter((key) => key.includes('reveal'))).toEqual([]);
    cleanup();

    await askWriting();
    expect(wordStyle('--sd-animation')).toBe('sd-reveal-blur');
    expect(revealBox().style.getPropertyValue('--rl-blur')).toBe(`${DEFAULT_HELP_REVEAL.blurAmount}px`);
  });

  it("never reads narration's stored values", async () => {
    localStorage.setItem('FORMAMORPH_revealFade', 'false');
    localStorage.setItem('FORMAMORPH_revealEasing', REVEAL_EASINGS[2].value);
    await askWriting();
    expect(wordStyle('--sd-animation')).toBe('sd-reveal');
    expect(wordStyle('--sd-easing')).toBe(DEFAULT_REVEAL_EASING);
    expect(revealBox().style.getPropertyValue('--rl-o')).toBe('0');
  });

  it('draws with the stored easing and speed, which survive a reload', async () => {
    storeReveal({ easing: REVEAL_EASINGS[2].value, minDuration: 900, minStagger: 120 });
    await askWriting();
    expect(wordStyle('--sd-easing')).toBe(REVEAL_EASINGS[2].value);
    expect(wordStyle('--sd-duration')).toBe('900ms');
    expect(wordStyle('--sd-delay')).toBe('120ms');
  });

  it('takes the defaults for a bad stored value', async () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ reveal: { ...DEFAULT_HELP_REVEAL, easing: 'steps(3)', fade: 'yes' } }));
    await askWriting();
    expect(wordStyle('--sd-easing')).toBe(DEFAULT_REVEAL_EASING);
    expect(revealBox().style.getPropertyValue('--rl-o')).toBe('0');
  });

  it('shows an answer with no animation when every effect is off', async () => {
    storeReveal({ fade: false, move: false, scale: false, blur: false });
    await askWriting();
    expect(animatedWords()).toEqual([]);
  });

  it('drops Move and Scale under reduced motion, and keeps Fade', async () => {
    stubReducedMotion(true);
    storeReveal({ move: true, scale: true });
    await askWriting();
    expect(revealBox().style.getPropertyValue('--rl-o')).toBe('0');
    expect(revealBox().style.getPropertyValue('--rl-x')).toBe('');
    expect(revealBox().style.getPropertyValue('--rl-sx')).toBe('');
  });

  it("neither reads nor writes the game view's timing while a turn reveals", async () => {
    const turn = { duration: 1234, stagger: 77 };
    setRevealTiming(turn);
    storeReveal({ minDuration: 0, minStagger: 0 });
    await askWriting();
    expect(wordStyle('--sd-duration')).not.toBe('1234ms');
    expect(wordStyle('--sd-delay')).not.toBe('77ms');
    await act(async () => {});
    expect(getRevealTiming()).toBe(turn);
  });

  it('resets help to the defaults from the dialog', async () => {
    storeReveal({ fade: false, blur: true, easing: REVEAL_EASINGS[2].value });
    await openAsk();
    await userEvent.click(screen.getByRole('button', { name: 'Formaquestion Settings' }));
    await userEvent.click(within(screen.getByRole('dialog', { name: 'Formaquestion Settings' })).getByRole('button', { name: /choose reveal animation/i }));
    const dialog = await screen.findByRole('dialog', { name: 'Answer reveal' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Reset to defaults' }));
    await userEvent.click(await screen.findByRole('button', { name: /^(Reset|Confirm|Continue)$/ }));
    await waitFor(() => expect(storedReveal()).toEqual(DEFAULT_HELP_REVEAL));
  });
});
