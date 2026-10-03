import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDocsIndex } from '@/lib/docs/docsIndex';
import { sseFrame, sseReply } from '@/test/aiTextFixtures';
import { helpAi } from '@/test/helpAiFixture';
import { stubHelpStream, storeFramedWindow } from '@/test/helpFixtures';
import type { HelpAi } from './useHelpAi';

const SETTINGS_KEY = 'FORMAMORPH_helpSettings';
const storedOpen = () => (JSON.parse(localStorage.getItem(SETTINGS_KEY)!) as { sourcesOpen: boolean }).sourcesOpen;

const ai = vi.hoisted(() => ({ current: null as unknown as HelpAi }));
vi.mock('./useHelpAi', () => ({ useHelpAi: () => ai.current }));
vi.mock('@/components/theme-provider', () => ({ useTheme: () => ({ resolvedTheme: 'dark' }) }));
import { Formaquestion } from './Formaquestion';

const PAGES = {
  Stats: '# 📊 Stats\n\nStats are numbers.\n\n## How to Add a Stat\n\n1. Open the **Stats** tab.\n',
  Traits: '# 🧬 Traits\n\nA trait changes a stat.\n\n## How to Add a Trait\n\n1. Open the **Traits** tab.\n',
};
const loadFixture = () => Promise.resolve(createDocsIndex({ pages: PAGES, sidebar: '- [Stats](Stats)\n- [Traits](Traits)\n' }));
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

const toggles = () => within(conversation()).getAllByRole('button', { name: /^Sources/ });
const SOURCE_BUTTON = /How to Add a Trait/;

beforeEach(() => {
  localStorage.clear();
  storeFramedWindow();
  ai.current = helpAi({ revalidate: vi.fn(async () => true) });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('the Sources fold of an answer', () => {
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
