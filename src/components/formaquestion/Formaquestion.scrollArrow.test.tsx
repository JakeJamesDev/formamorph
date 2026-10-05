import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { sseReply } from '@/test/aiTextFixtures';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDocsIndex } from '@/lib/docs/docsIndex';
import { helpAi } from '@/test/helpAiFixture';
import { stubReducedMotion } from '@/test/reducedMotion';
import { storeFramedWindow, storeMinimalWindow, stubHelpStream } from '@/test/helpFixtures';
import type { HelpAi } from './useHelpAi';

const ai = vi.hoisted(() => ({ current: null as unknown as HelpAi }));
vi.mock('./useHelpAi', () => ({ useHelpAi: () => ai.current }));
vi.mock('@/components/theme-provider', () => ({ useTheme: () => ({ resolvedTheme: 'dark' }) }));
import { Formaquestion } from './Formaquestion';

const loadFixture = () => Promise.resolve(createDocsIndex({ pages: { Traits: '# Traits\n\nText.\n' }, sidebar: '- [Traits](Traits)\n' }));

/** A 400px viewport over 1000px of conversation: the arrow shows from 200px away. */
const CLIENT_HEIGHT = 400;
const SCROLL_HEIGHT = 1000;

const scroller = () => document.querySelector<HTMLElement>('[data-fq-scroll="conversation"]')!;
const arrow = () => screen.queryByRole('button', { name: 'Scroll to End' });

async function openChat() {
  render(<Formaquestion loadIndex={loadFixture} />);
  fireEvent.click(screen.getByRole('button', { name: 'Help' }));
  await screen.findByRole('textbox', { name: 'Ask a Question' });
  const box = scroller();
  let top = 0;
  Object.defineProperty(box, 'clientHeight', { configurable: true, value: CLIENT_HEIGHT });
  Object.defineProperty(box, 'scrollHeight', { configurable: true, value: SCROLL_HEIGHT });
  Object.defineProperty(box, 'scrollTop', { configurable: true, get: () => top, set: (value: number) => { top = value; } });
  /** Moves the player to a scroll position, as a wheel or a drag does. */
  return (to: number) => act(() => { top = to; fireEvent.scroll(box); });
}

beforeEach(() => {
  localStorage.clear();
  ai.current = helpAi({ revalidate: vi.fn(async () => true) });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe.each([
  ['framed', () => storeFramedWindow()],
  ['minimal', () => storeMinimalWindow()],
])('the scroll arrow in the %s chrome', (chrome, prepare) => {
  beforeEach(prepare);

  it('shows past half a viewport from the end and hides within it', async () => {
    const scrollTo = await openChat();
    expect(scroller().closest('[data-fq-piece="column"]') !== null).toBe(chrome === 'minimal');
    scrollTo(SCROLL_HEIGHT - CLIENT_HEIGHT);
    expect(arrow()).toBeNull();
    scrollTo(100);
    expect(arrow()).toBeInTheDocument();
    scrollTo(SCROLL_HEIGHT - CLIENT_HEIGHT - CLIENT_HEIGHT / 2);
    expect(arrow()).toBeNull();
  });

  it('scrolls to the end on a click and leaves', async () => {
    const scrollTo = await openChat();
    scrollTo(0);
    fireEvent.click(arrow()!);
    expect(scroller().scrollTop).toBe(SCROLL_HEIGHT);
    expect(arrow()).toBeNull();
  });

  it('leaves when a new question takes the player to the end', async () => {
    stubHelpStream(sseReply('Done.'));
    const scrollTo = await openChat();
    scrollTo(0);
    expect(arrow()).toBeInTheDocument();
    await userEvent.type(screen.getByRole('textbox', { name: 'Ask a Question' }), 'How do I add a trait?');
    await userEvent.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => expect(arrow()).toBeNull());
    expect(scroller().scrollTop).toBe(SCROLL_HEIGHT);
  });

  it('draws without animation under reduced motion', async () => {
    stubReducedMotion();
    const scrollTo = await openChat();
    scrollTo(0);
    expect(arrow()!.className).not.toContain('animate-in');
  });
});

describe('the scroll arrow', () => {
  it('animates its entry when motion is allowed', async () => {
    storeFramedWindow();
    const scrollTo = await openChat();
    scrollTo(0);
    expect(arrow()!.className).toContain('animate-in');
  });
});
