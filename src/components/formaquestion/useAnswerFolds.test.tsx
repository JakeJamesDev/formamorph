import { act, cleanup, fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDocsIndex } from '@/lib/docs/docsIndex';
import { sseFrame, sseReply } from '@/test/aiTextFixtures';
import { renderAskPanel } from '@/test/askPanelBench';
import { helpAi } from '@/test/helpAiFixture';
import { storeFramedWindow, storeMinimalWindow, stubHelpStream } from '@/test/helpFixtures';
import type { HelpAi } from './useHelpAi';

const SETTINGS_KEY = 'FORMAMORPH_helpSettings';
const stored = () => JSON.parse(localStorage.getItem(SETTINGS_KEY)!) as { sourcesOpen: boolean; thinkingOpen: boolean };
const storedOpen = () => stored().sourcesOpen;

const ai = vi.hoisted(() => ({ current: null as unknown as HelpAi }));
vi.mock('./useHelpAi', () => ({ useHelpAi: () => ai.current }));

const PAGES = {
  Stats: '# 📊 Stats\n\nStats are numbers.\n\n## How to Add a Stat\n\n1. Open the **Stats** tab.\n',
  Traits: '# 🧬 Traits\n\nA trait changes a stat.\n\n## How to Add a Trait\n\n1. Open the **Traits** tab.\n',
};
const index = createDocsIndex({ pages: PAGES, sidebar: '- [Stats](Stats)\n- [Traits](Traits)\n' });
const conversation = () => screen.getByRole('log', { name: 'Conversation' });

async function openAsk() {
  renderAskPanel(index);
  return screen.findByRole('textbox', { name: 'Ask a Question' });
}

async function send(field: HTMLElement, question: string) {
  fireEvent.change(field, { target: { value: question } });
  await userEvent.click(screen.getByRole('button', { name: 'Send' }));
}

const toggles = () => within(conversation()).getAllByRole('button', { name: /^Sources/ });
const SOURCE_BUTTON = /How to Add a Trait/;

const REASONING = 'The player wants the Traits page.';
/** A native reasoning model: the scratchpad streams in its own field, then the answer. */
const reasoned = () => [sseFrame({ reasoning_content: REASONING }), ...sseReply('Select **Add Trait**.')];
/** The toggle names the Mascot, on here: "Morphie is thinking…" while the model reasons, then "Morphie thought for Ns". */
const THINKING = /^(Morphie is thinking…|Morphie thought for \d+s)$/;
const thinkingToggles = () => within(conversation()).getAllByRole('button', { name: THINKING });

beforeEach(() => {
  localStorage.clear();
  ai.current = helpAi({ revalidate: vi.fn(async () => true) });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('the Sources fold of an answer', () => {
  beforeEach(() => { storeFramedWindow(); });

  it('starts open with a toggle that exposes its state, and the count shows once collapsed', async () => {
    stubHelpStream(sseReply('Select **Add Trait**.'));
    const field = await openAsk();
    await send(field, 'How do I add a trait?');
    const toggle = await within(conversation()).findByRole('button', { name: 'Sources' });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(within(conversation()).getByRole('button', { name: SOURCE_BUTTON })).toBeInTheDocument();

    await userEvent.click(toggle);
    const collapsed = within(conversation()).getByRole('button', { name: /^Sources \(\d+\)$/ });
    expect(collapsed).toHaveAttribute('aria-expanded', 'false');
    expect(within(conversation()).queryByRole('button', { name: SOURCE_BUTTON })).toBeNull();
  });

  it('changes one answer only, and a later answer starts in the clicked state', async () => {
    stubHelpStream(sseReply('Select **Add Trait**.'));
    const field = await openAsk();
    await send(field, 'How do I add a trait?');
    await within(conversation()).findByRole('button', { name: 'Sources' });
    await send(field, 'and then?');
    await vi.waitFor(() => expect(toggles()).toHaveLength(2));

    await userEvent.click(toggles()[0]);
    expect(toggles()[0]).toHaveAttribute('aria-expanded', 'false');
    expect(toggles()[1]).toHaveAttribute('aria-expanded', 'true');

    await send(field, 'How do I add a trait again?');
    await vi.waitFor(() => expect(toggles()).toHaveLength(3));
    expect(toggles()[2]).toHaveAttribute('aria-expanded', 'false');
    expect(toggles()[1]).toHaveAttribute('aria-expanded', 'true');
  });

  it('gives an answer that is still writing the default that is set when its sources arrive', async () => {
    stubHelpStream(sseReply('Select **Add Trait**.'));
    const field = await openAsk();
    await send(field, 'How do I add a trait?');
    await within(conversation()).findByRole('button', { name: 'Sources' });

    const encoder = new TextEncoder();
    let finish = () => {};
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(sseFrame({ content: '1. Open the **Stats** tab.' })));
        finish = () => controller.close();
      },
    });
    stubHelpStream(() => new Response(body, { headers: { 'Content-Type': 'text/event-stream' } }));
    await send(field, 'How do I add a stat?');
    await vi.waitFor(() => expect(conversation()).toHaveTextContent('Open the Stats tab.'));
    await userEvent.click(toggles()[0]);
    expect(toggles()).toHaveLength(1);

    await act(async () => { finish(); });
    await vi.waitFor(() => expect(toggles()).toHaveLength(2));
    expect(toggles()[1]).toHaveAttribute('aria-expanded', 'false');
  });

  it('keeps the default across a remount, and reads a bad stored value as open', async () => {
    stubHelpStream(sseReply('Select **Add Trait**.'));
    const field = await openAsk();
    await send(field, 'How do I add a trait?');
    await userEvent.click(await within(conversation()).findByRole('button', { name: 'Sources' }));
    expect(storedOpen()).toBe(false);
    cleanup();

    const again = await openAsk();
    await send(again, 'How do I add a trait?');
    expect(await within(conversation()).findByRole('button', { name: /^Sources \(\d+\)$/ })).toHaveAttribute('aria-expanded', 'false');
    cleanup();

    storeFramedWindow({ sourcesOpen: 'nonsense', historyLength: 2 });
    const third = await openAsk();
    await send(third, 'How do I add a trait?');
    expect(await within(conversation()).findByRole('button', { name: 'Sources' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('applies the same default to Nearest Sections', async () => {
    storeFramedWindow({ sourcesOpen: false });
    stubHelpStream([sseFrame({ content: '[NOT IN' }), ...sseReply(' GUIDE]\nA trait is a tag on an entity.')]);
    const field = await openAsk();
    await send(field, 'How do I add a trait to a stat?');
    const toggle = await within(conversation()).findByRole('button', { name: /^Nearest Sections \(\d+\)$/ });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(toggle);
    expect(within(conversation()).getByRole('button', { name: SOURCE_BUTTON })).toBeInTheDocument();
  });

  it('opens and closes from the keyboard', async () => {
    stubHelpStream(sseReply('Select **Add Trait**.'));
    const field = await openAsk();
    await send(field, 'How do I add a trait?');
    const toggle = await within(conversation()).findByRole('button', { name: 'Sources' });
    toggle.focus();
    await userEvent.keyboard('{Enter}');
    expect(toggles()[0]).toHaveAttribute('aria-expanded', 'false');
    await userEvent.keyboard(' ');
    expect(toggles()[0]).toHaveAttribute('aria-expanded', 'true');
  });
});

describe('the Thinking block of an answer', () => {
  beforeEach(() => { storeMinimalWindow(); });

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
    await within(conversation()).findByRole('button', { name: 'Morphie is thinking…' });
    // The pulsing header is the wait line while the model reasons.
    // The wait line and the header share the words; the line itself is gone, the header stands.
    expect(within(conversation()).getAllByText('Morphie is thinking…')).toHaveLength(1);

    await act(async () => { finish(); });
    await vi.waitFor(() => expect(conversation()).toHaveTextContent('Select Add Trait.'));
    expect(within(conversation()).getByRole('button', { name: /^Morphie thought for \d+s$/ })).toBeInTheDocument();
    expect(within(conversation()).queryByRole('button', { name: 'Morphie is thinking…' })).toBeNull();
  });
});
