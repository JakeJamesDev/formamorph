import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDocsIndex } from '@/lib/docs/docsIndex';
import { sseFrame, sseReply } from '@/test/aiTextFixtures';
import { helpAi } from '@/test/helpAiFixture';
import { storeMinimalWindow, stubHelpStream } from '@/test/helpFixtures';
import type { HelpAi } from './useHelpAi';

const SETTINGS_KEY = 'FORMAMORPH_helpSettings';
const stored = () => JSON.parse(localStorage.getItem(SETTINGS_KEY)!) as { sourcesOpen: boolean; thinkingOpen: boolean };

const ai = vi.hoisted(() => ({ current: null as unknown as HelpAi }));
vi.mock('./useHelpAi', () => ({ useHelpAi: () => ai.current }));
vi.mock('@/components/theme-provider', () => ({ useTheme: () => ({ resolvedTheme: 'dark' }) }));
import { Formaquestion } from './Formaquestion';

const PAGES = {
  Traits: '# 🧬 Traits\n\nA trait changes a stat.\n\n## How to Add a Trait\n\n1. Open the **Traits** tab.\n',
};
const loadFixture = () => Promise.resolve(createDocsIndex({ pages: PAGES, sidebar: '- [Traits](Traits)\n' }));
const conversation = () => screen.getByRole('log', { name: 'Conversation' });

async function openAsk() {
  render(<Formaquestion loadIndex={loadFixture} />);
  fireEvent.click(screen.getByRole('button', { name: 'Help' }));
  return screen.findByRole('textbox', { name: 'Ask a Question' });
}

async function send(field: HTMLElement, question: string) {
  await userEvent.type(field, question);
  await userEvent.click(screen.getByRole('button', { name: 'Send' }));
}

const REASONING = 'The player wants the Traits page.';
/** A native reasoning model: the scratchpad streams in its own field, then the answer. */
const reasoned = () => [sseFrame({ reasoning_content: REASONING }), ...sseReply('Select **Add Trait**.')];
/** The toggle reads "Thinking…" while the model reasons, then "Thought for Ns". */
const THINKING = /^(Thinking…|Thought for \d+s)$/;
const thinkingToggles = () => within(conversation()).getAllByRole('button', { name: THINKING });

beforeEach(() => {
  localStorage.clear();
  // The conversation column holds each answer's toggles; Bubble moves them to its strip.
  storeMinimalWindow();
  ai.current = helpAi({ revalidate: vi.fn(async () => true) });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('the Thinking block of an answer', () => {
  it('starts closed above the answer and shows the reasoning text when opened', async () => {
    stubHelpStream(reasoned());
    const field = await openAsk();
    await send(field, 'How do I add a trait?');
    const toggle = await within(conversation()).findByRole('button', { name: THINKING });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(conversation()).not.toHaveTextContent(REASONING);
    // The chevron points right while closed and down while open.
    expect(toggle.querySelector('svg')).not.toHaveClass('rotate-90');

    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(toggle.querySelector('svg')).toHaveClass('rotate-90');
    expect(conversation()).toHaveTextContent(REASONING);
    // Above the answer text.
    const text = conversation().textContent!;
    expect(text.indexOf(REASONING)).toBeLessThan(text.indexOf('Select Add Trait.'));
  });

  it('shows no block for an answer with no reasoning', async () => {
    stubHelpStream(sseReply('Select **Add Trait**.'));
    const field = await openAsk();
    await send(field, 'How do I add a trait?');
    await within(conversation()).findByRole('button', { name: 'Sources' });
    expect(within(conversation()).queryByRole('button', { name: THINKING })).toBeNull();
  });

  it('shows inline reasoning in the block and keeps it out of the answer text', async () => {
    stubHelpStream(sseReply('<think>Check the Traits tab.</think>Select **Add Trait**.'));
    const field = await openAsk();
    await send(field, 'How do I add a trait?');
    await userEvent.click(await within(conversation()).findByRole('button', { name: THINKING }));
    const block = within(conversation()).getByRole('group', { name: 'Thinking' });
    expect(block).toHaveTextContent('Check the Traits tab.');
    expect(conversation().textContent!.match(/Check the Traits tab\./g)).toHaveLength(1);
  });

  it('follows its own default apart from Sources, and a later answer takes it', async () => {
    stubHelpStream(reasoned());
    const field = await openAsk();
    await send(field, 'How do I add a trait?');
    await userEvent.click(await within(conversation()).findByRole('button', { name: THINKING }));
    expect(stored()).toMatchObject({ thinkingOpen: true, sourcesOpen: true });
    expect(within(conversation()).getByRole('button', { name: 'Sources' })).toHaveAttribute('aria-expanded', 'true');

    await send(field, 'and then?');
    await vi.waitFor(() => expect(thinkingToggles()).toHaveLength(2));
    expect(thinkingToggles()[1]).toHaveAttribute('aria-expanded', 'true');

    await userEvent.click(thinkingToggles()[1]);
    expect(thinkingToggles()[0]).toHaveAttribute('aria-expanded', 'true');
    expect(stored()).toMatchObject({ thinkingOpen: false, sourcesOpen: true });
  });

  it('keeps its default across a remount', async () => {
    stubHelpStream(reasoned());
    const field = await openAsk();
    await send(field, 'How do I add a trait?');
    await userEvent.click(await within(conversation()).findByRole('button', { name: THINKING }));
    cleanup();

    const again = await openAsk();
    await send(again, 'How do I add a trait?');
    expect(await within(conversation()).findByRole('button', { name: THINKING })).toHaveAttribute('aria-expanded', 'true');
  });

  it('keeps the waiting line while the model reasons and no answer text exists', async () => {
    const encoder = new TextEncoder();
    let finish = () => {};
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(sseFrame({ reasoning_content: REASONING })));
        finish = () => {
          for (const chunk of sseReply('Select **Add Trait**.')) controller.enqueue(encoder.encode(chunk));
          controller.close();
        };
      },
    });
    stubHelpStream(() => new Response(body, { headers: { 'Content-Type': 'text/event-stream' } }));
    const field = await openAsk();
    await send(field, 'How do I add a trait?');
    // The header pulses while the model reasons, and the time shows once the answer starts.
    await within(conversation()).findByRole('button', { name: 'Thinking…' });
    // The pulsing header is the wait line while the model reasons.
    expect(conversation()).not.toHaveTextContent('Waiting for your AI…');

    await act(async () => { finish(); });
    await vi.waitFor(() => expect(conversation()).toHaveTextContent('Select Add Trait.'));
    expect(within(conversation()).getByRole('button', { name: /^Thought for \d+s$/ })).toBeInTheDocument();
    expect(within(conversation()).queryByRole('button', { name: 'Thinking…' })).toBeNull();
  });
});
