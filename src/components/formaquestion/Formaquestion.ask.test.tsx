import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'react-toastify';
import { createDocsIndex } from '@/lib/docs/docsIndex';
import { closeErrorDetails } from '@/lib/errorDetails';
import { WIDE_WIDTH } from '@/lib/formaquestion/windowBox';
import { turnActivity } from '@/lib/turnActivity';
import { openSseReply, sseFrame, sseReply } from '@/test/aiTextFixtures';
import { helpAi } from '@/test/helpAiFixture';
import { stubHelpStream, storeFramedWindow, storeWindowBox } from '@/test/helpFixtures';
import { ATTACH_REFUSAL_COPY, MAX_ATTACHMENTS } from '@/lib/actionAttachments';
import { decodedFake, fakeImageFile, installFakeImageCodec } from '@/test/fakeImageCodec';
import type { HelpAi } from './useHelpAi';

// The AI settings and the reachability check come from the app's providers. Each test sets them here.
const ai = vi.hoisted(() => ({ current: null as unknown as HelpAi, enabled: [] as boolean[] }));
vi.mock('./useHelpAi', () => ({
  useHelpAi: (enabled: boolean) => {
    ai.enabled.push(enabled);
    return ai.current;
  },
}));
vi.mock('@/components/theme-provider', () => ({ useTheme: () => ({ resolvedTheme: 'dark' }) }));
import { ThemedToastContainer } from '@/components/ThemedToastContainer';
import { Formaquestion } from './Formaquestion';

const PAGES = {
  Stats: '# 📊 Stats\n\nStats are numbers.\n\n## How to Add a Stat\n\n1. Open the **Stats** tab.\n2. Select **Add Stat**.\n',
  Traits: '# 🧬 Traits\n\nA trait changes a stat.\n\n## How to Add a Trait\n\n1. Open the **Traits** tab.\n2. Select **Add Trait**.\n',
};
const loadFixture = () => Promise.resolve(createDocsIndex({ pages: PAGES, sidebar: '- [Stats](Stats)\n- [Traits](Traits)\n' }));

const helpTab = () => screen.getByRole('button', { name: 'Help' });
const conversation = () => screen.getByRole('log', { name: 'Conversation' });
const searchRows = () => within(within(conversation()).getByRole('list', { name: 'Search Results' })).getAllByRole('button');

/** Renders the app's one Formaquestion and opens the window, with the fixture docs loaded. */
async function openAsk() {
  const view = render(<><ThemedToastContainer /><Formaquestion loadIndex={loadFixture} /></>);
  fireEvent.click(helpTab());
  const field = await screen.findByRole('textbox', { name: 'Ask a Question' });
  return { view, field };
}

async function send(field: HTMLElement, question: string) {
  await userEvent.type(field, question);
  await userEvent.click(screen.getByRole('button', { name: 'Send' }));
}

/** A server that refuses the request, with its error text still on the way until `end` is called. */
function slowRefusal() {
  let end = () => {};
  const body = new ReadableStream<Uint8Array>({ start(controller) { end = () => controller.close(); } });
  return { end: () => end(), respond: () => new Response(body, { status: 503 }) };
}

beforeEach(() => {
  localStorage.clear();
  storeFramedWindow();
  ai.enabled = [];
  ai.current = helpAi({ revalidate: vi.fn(async () => true) });
});
afterEach(() => {
  act(() => {
    toast.dismiss();
    closeErrorDetails();
  });
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('the Ask tab', () => {
  it('is the first of three tabs and the one a new window opens on, with the cursor in the question field', async () => {
    const { field } = await openAsk();
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['Ask', 'Search', 'Guide']);
    expect(screen.getByRole('tab', { name: 'Ask' })).toHaveAttribute('data-state', 'active');
    await waitFor(() => expect(field).toHaveFocus());
  });

  it('shows the question, streams the answer as markdown and lists the sections it came from', async () => {
    const fetchSpy = stubHelpStream([sseFrame({ content: '1. Open the **Traits** tab.\n' }), ...sseReply('2. Select **Add Trait**.')]);
    const { field } = await openAsk();
    await send(field, 'How do I add a trait?');

    expect(within(conversation()).getByText('How do I add a trait?')).toBeInTheDocument();
    expect(field).toHaveValue('');
    // Markdown, not its source: two list items, and the control names with no asterisks.
    await waitFor(() => expect(within(conversation()).getAllByRole('listitem')).toHaveLength(2));
    expect(conversation()).toHaveTextContent('Open the Traits tab.');
    expect(conversation()).toHaveTextContent('Select Add Trait.');
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    const sources = await within(conversation()).findByRole('group', { name: 'Sources' });
    await userEvent.click(within(sources).getByRole('button', { name: /How to Add a Trait/ }));
    expect(screen.getByRole('article', { name: '🧬 Traits: How to Add a Trait' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Guide' })).toHaveAttribute('data-state', 'active');
  });

  it('sends on Enter, and Shift+Enter adds a line to the question', async () => {
    const fetchSpy = stubHelpStream(sseReply('Done.'));
    const { field } = await openAsk();
    await userEvent.type(field, 'How do I add a trait{Shift>}{Enter}{/Shift}to a stat?');
    expect(field).toHaveValue('How do I add a trait\nto a stat?');
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(fetchSpy.picks).not.toHaveBeenCalled();
    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));
    expect(field).toHaveValue('');
  });

  it('has no Send for an empty question', async () => {
    const fetchSpy = stubHelpStream(sseReply('Done.'));
    const { field } = await openAsk();
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
    await userEvent.type(field, '   {Enter}');
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(fetchSpy.picks).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
  });

  it('opens a docs link in an answer in the reader', async () => {
    stubHelpStream(sseReply('See [the stats page](Stats#how-to-add-a-stat).'));
    const { field } = await openAsk();
    await send(field, 'How do I add a trait?');
    await userEvent.click(await within(conversation()).findByRole('link', { name: 'the stats page' }));
    expect(screen.getByRole('article', { name: '📊 Stats: How to Add a Stat' })).toBeInTheDocument();
  });

  it('keeps the conversation and the question in progress across a tab change and a close', async () => {
    stubHelpStream(sseReply('Select **Add Trait**.'));
    const { field } = await openAsk();
    await send(field, 'How do I add a trait?');
    await within(conversation()).findByRole('group', { name: 'Sources' });
    await userEvent.type(field, 'and then');

    await userEvent.click(screen.getByRole('tab', { name: 'Search' }));
    await userEvent.click(screen.getByRole('tab', { name: 'Ask' }));
    expect(screen.getByRole('textbox', { name: 'Ask a Question' })).toHaveValue('and then');

    fireEvent.click(screen.getByRole('button', { name: 'Close Formaquestion' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Formaquestion' })).toBeNull());
    fireEvent.click(helpTab());
    expect(conversation()).toHaveTextContent('How do I add a trait?');
    expect(conversation()).toHaveTextContent('Select Add Trait.');
    expect(screen.getByRole('textbox', { name: 'Ask a Question' })).toHaveValue('and then');
  });
});

describe('the conversation while an answer comes in', () => {
  it('stays at its end, and keeps the place of a player who scrolled up', async () => {
    const encoder = new TextEncoder();
    let push: (text: string) => void = () => {};
    const body = new ReadableStream<Uint8Array>({
      start(controller) { push = (text) => controller.enqueue(encoder.encode(sseFrame({ content: text }))); },
    });
    stubHelpStream(() => new Response(body, { headers: { 'Content-Type': 'text/event-stream' } }));
    const { field } = await openAsk();
    // jsdom has no layout: the conversation is 1000px of text in a 200px viewport.
    const viewport = document.querySelector<HTMLElement>('[data-fq-scroll="conversation"]')!;
    Object.defineProperty(viewport, 'scrollHeight', { configurable: true, get: () => 1000 });
    Object.defineProperty(viewport, 'clientHeight', { configurable: true, get: () => 200 });
    await send(field, 'How do I add a trait?');

    act(() => push('First words. '));
    await waitFor(() => expect(conversation()).toHaveTextContent('First words.'));
    expect(viewport.scrollTop).toBe(1000);

    viewport.scrollTop = 100;
    fireEvent.scroll(viewport);
    act(() => push('More words.'));
    await waitFor(() => expect(conversation()).toHaveTextContent('More words.'));
    expect(viewport.scrollTop).toBe(100);
  });
});

describe('the conversation', () => {
  it('writes nothing to browser storage', async () => {
    stubHelpStream(sseReply('Select **Add Trait**.'));
    const writes = vi.spyOn(Storage.prototype, 'setItem');
    const opens = vi.fn();
    vi.stubGlobal('indexedDB', { open: opens });
    const { field } = await openAsk();
    await send(field, 'How do I add a trait?');
    await within(conversation()).findByRole('group', { name: 'Sources' });
    await send(field, 'and then?');
    await waitFor(() => expect(within(conversation()).getAllByRole('group', { name: 'Sources' })).toHaveLength(2));
    await userEvent.type(field, 'a question in progress');
    fireEvent.click(screen.getByRole('button', { name: 'Close Formaquestion' }));
    fireEvent.click(helpTab());

    expect(writes).not.toHaveBeenCalled();
    expect(opens).not.toHaveBeenCalled();
    expect(conversation()).toHaveTextContent('and then?');
  });

  /** Opens the title bar menu and returns Clear Conversation. */
  async function clearItem() {
    await userEvent.click(screen.getByRole('button', { name: 'More Actions' }));
    return screen.findByRole('menuitem', { name: 'Clear Conversation' });
  }

  it('is empty after Clear Conversation, which is off while empty and also ends the answer that is coming in', async () => {
    stubHelpStream(sseReply('Select **Add Trait**.'));
    const { field } = await openAsk();
    expect(await clearItem()).toHaveAttribute('aria-disabled', 'true');
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
    await send(field, 'How do I add a trait?');
    await within(conversation()).findByRole('group', { name: 'Sources' });

    const reply = openSseReply([sseFrame({ content: '1. Open the **Stats** tab.' })]);
    stubHelpStream(reply.respond);
    await send(field, 'How do I add a stat?');
    await waitFor(() => expect(conversation()).toHaveTextContent('Open the Stats tab.'));
    const item = await clearItem();
    expect(item).not.toHaveAttribute('aria-disabled');
    await userEvent.click(item);

    expect(conversation()).not.toHaveTextContent('How do I add a trait?');
    expect(conversation()).not.toHaveTextContent('Open the Stats tab.');
    expect(await clearItem()).toHaveAttribute('aria-disabled', 'true');
    await userEvent.keyboard('{Escape}');
    expect(screen.getByRole('button', { name: 'Send' })).toBeInTheDocument();
    await waitFor(() => expect(reply.cancel).toHaveBeenCalledTimes(1));
  });
});

describe('during a game turn', () => {
  afterEach(() => act(() => turnActivity.set(false)));

  it('holds Send and says why, keeps the search working, and sends once the turn ends', async () => {
    const fetchSpy = stubHelpStream(sseReply('Select **Add Trait**.'));
    const { field } = await openAsk();
    act(() => turnActivity.set(true));
    await userEvent.type(field, 'How do I add a trait?{Enter}');

    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
    const reason = screen.getByText('Wait for the game turn to finish to send a question');
    // Approved pattern 9: the line sits under the field.
    expect(field.compareDocumentPosition(reason) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(fetchSpy.picks).not.toHaveBeenCalled();
    expect(field).toHaveValue('How do I add a trait?');

    await userEvent.click(screen.getByRole('tab', { name: 'Search' }));
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search the Guide' }), 'trait');
    expect(within(screen.getByRole('list', { name: 'Search Results' })).getAllByRole('button')[0]).toHaveTextContent('How to Add a Trait');
    await userEvent.click(screen.getByRole('tab', { name: 'Ask' }));

    act(() => turnActivity.set(false));
    expect(screen.queryByText('Wait for the game turn to finish to send a question')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Send' }));
    await within(conversation()).findByRole('group', { name: 'Sources' });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});

describe('stop', () => {
  it('ends the stream, keeps the answer so far and closes the request', async () => {
    const reply = openSseReply([sseFrame({ content: '1. Open the **Traits** tab.' })]);
    const fetchSpy = stubHelpStream(reply.respond);
    const { field } = await openAsk();
    await send(field, 'How do I add a trait?');

    // While the answer comes in, Stop takes the place of Send.
    const stop = await screen.findByRole('button', { name: 'Stop' });
    expect(screen.queryByRole('button', { name: 'Send' })).toBeNull();
    await waitFor(() => expect(conversation()).toHaveTextContent('Open the Traits tab.'));
    await userEvent.click(stop);

    await waitFor(() => expect(screen.getByRole('button', { name: 'Send' })).toBeInTheDocument());
    expect(conversation()).toHaveTextContent('Open the Traits tab.');
    expect(conversation()).toHaveTextContent('Stopped');
    expect(reply.cancel).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    // A stop is the player's choice, not a failure.
    expect(screen.queryByText('Failed to process AI request')).toBeNull();
  });

  it('takes one question at a time: Enter sends nothing while an answer comes in', async () => {
    const reply = openSseReply([sseFrame({ content: 'One moment' })]);
    const fetchSpy = stubHelpStream(reply.respond);
    const { field } = await openAsk();
    await send(field, 'How do I add a trait?');
    await screen.findByRole('button', { name: 'Stop' });
    await userEvent.type(field, 'How do I add a stat?{Enter}');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(field).toHaveValue('How do I add a stat?');
  });
});

describe('the check of the AI', () => {
  it('runs only while the window is open', async () => {
    render(<Formaquestion loadIndex={loadFixture} />);
    expect(ai.enabled.at(-1)).toBe(false);
    fireEvent.click(helpTab());
    await screen.findByRole('textbox', { name: 'Ask a Question' });
    expect(ai.enabled.at(-1)).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Close Formaquestion' }));
    expect(ai.enabled.at(-1)).toBe(false);
  });
});

describe('the wait line', () => {
  it('says it waits for the AI until the first answer text, then hides', async () => {
    const encoder = new TextEncoder();
    let answer = () => {};
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        answer = () => { for (const chunk of sseReply('Select **Add Trait**.')) controller.enqueue(encoder.encode(chunk)); controller.close(); };
      },
    });
    stubHelpStream(() => new Response(body, { headers: { 'Content-Type': 'text/event-stream' } }));
    const { field } = await openAsk();
    await send(field, 'How do I add a trait?');
    await waitFor(() => expect(conversation()).toHaveTextContent('Waiting for your AI…'));
    expect(conversation()).not.toHaveTextContent('Writing');

    await act(async () => { answer(); });
    await waitFor(() => expect(conversation()).toHaveTextContent('Select Add Trait.'));
    expect(conversation()).not.toHaveTextContent('Waiting for your AI…');
  });
});

describe('with no AI connected', () => {
  it('shows the docs search for the question, sends nothing and shows no error', async () => {
    const fetchSpy = stubHelpStream(sseReply('Not used.'));
    const revalidate = vi.fn(async () => false);
    ai.current = { ...ai.current, reachable: false, revalidate };
    const { field } = await openAsk();
    await send(field, 'How do I add a trait?');

    await waitFor(() => expect(searchRows()[0]).toHaveTextContent('How to Add a Trait'));
    expect(conversation()).toHaveTextContent('No AI is connected');
    expect(revalidate).toHaveBeenCalledTimes(1);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(fetchSpy.picks).not.toHaveBeenCalled();
    expect(screen.queryByText('Failed to process AI request')).toBeNull();
    expect(screen.getByRole('button', { name: 'Send' })).toBeInTheDocument();

    await userEvent.click(searchRows()[0]);
    expect(screen.getByRole('article', { name: '🧬 Traits: How to Add a Trait' })).toBeInTheDocument();
  });

  it('says it is checking the AI while the fresh check runs', async () => {
    stubHelpStream(sseReply('Select **Add Trait**.'));
    let found = (_ok: boolean) => {};
    const revalidate = vi.fn(() => new Promise<boolean>((resolve) => { found = resolve; }));
    ai.current = { ...ai.current, reachable: false, revalidate };
    const { field } = await openAsk();
    await send(field, 'How do I add a trait?');
    await waitFor(() => expect(conversation()).toHaveTextContent('Checking your AI…'));

    await act(async () => { found(true); });
    await waitFor(() => expect(conversation()).toHaveTextContent('Select Add Trait.'));
    expect(conversation()).not.toHaveTextContent('Checking your AI…');
  });

  it('asks the AI when a fresh check finds it, after a check that found none', async () => {
    const fetchSpy = stubHelpStream(sseReply('Select **Add Trait**.'));
    ai.current = { ...ai.current, reachable: false, revalidate: vi.fn(async () => true) };
    const { field } = await openAsk();
    await send(field, 'How do I add a trait?');
    await waitFor(() => expect(conversation()).toHaveTextContent('Select Add Trait.'));
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('asks the AI without a second check while the first check still runs', async () => {
    const fetchSpy = stubHelpStream(sseReply('Select **Add Trait**.'));
    const revalidate = vi.fn(async () => false);
    ai.current = { ...ai.current, reachable: null, revalidate };
    const { field } = await openAsk();
    await send(field, 'How do I add a trait?');
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));
    expect(revalidate).not.toHaveBeenCalled();
  });
});

describe('a request that fails', () => {
  it('shows the error toast with its details, and the docs search for the question', async () => {
    const fetchSpy = stubHelpStream(() => new Response('{"error":{"message":"model overloaded"}}', { status: 503 }));
    const { field } = await openAsk();
    await send(field, 'How do I add a trait?');

    await screen.findByText('Failed to process AI request');
    expect(searchRows()[0]).toHaveTextContent('How to Add a Trait');
    expect(conversation()).toHaveTextContent('The AI did not answer');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Send' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'View Details →' }));
    const details = await screen.findByRole('dialog', { name: 'Error Details' });
    expect(details.textContent).toContain('Message: model overloaded');
    expect(details.textContent).toContain('Status: 503');
  });

  it('shows the connection toast and the docs search when the server is not there', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    const { field } = await openAsk();
    await send(field, 'How do I add a stat?');
    expect(await screen.findByRole('button', { name: 'Fix connection →' })).toBeInTheDocument();
    expect(searchRows()[0]).toHaveTextContent('How to Add a Stat');
  });

  it('keeps the words that came before the failure, and says the answer did not finish', async () => {
    // The connection breaks after the first words.
    const encoder = new TextEncoder();
    let reads = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (reads++ === 0) controller.enqueue(encoder.encode(sseFrame({ content: 'First, go to the Traits screen.' })));
        else controller.error(new Error('connection reset'));
      },
    });
    stubHelpStream(() => new Response(body, { headers: { 'Content-Type': 'text/event-stream' } }));
    const { field } = await openAsk();
    await send(field, 'How do I add a trait?');

    await screen.findByText('Failed to process AI request');
    expect(conversation()).toHaveTextContent('First, go to the Traits screen.');
    expect(conversation()).toHaveTextContent('The answer did not finish. These guide sections match your question.');
    expect(conversation()).not.toHaveTextContent('The AI did not answer');
    expect(searchRows()[0]).toHaveTextContent('How to Add a Trait');
  });

  it('says so when no guide section matches the question', async () => {
    stubHelpStream(() => new Response('', { status: 500 }));
    const { field } = await openAsk();
    await send(field, 'quasar');
    await screen.findByText('Failed to process AI request');
    expect(conversation()).toHaveTextContent('The AI did not answer, and no guide section matches your question');
    expect(within(conversation()).queryByRole('list', { name: 'Search Results' })).toBeNull();
    expect(conversation()).not.toHaveTextContent('These guide sections match');
  });
});

describe('an answer that did not come from the guide', () => {
  const NOTICE = 'This answer is not from the guide. It can be wrong about Formamorph.';

  it('shows the notice above the answer and the nearest sections in place of the sources, with no marker', async () => {
    stubHelpStream([sseFrame({ content: '[NOT IN' }), ...sseReply(' GUIDE]\nA trait is a tag on an entity.')]);
    const { field } = await openAsk();
    await send(field, 'How do I add a trait to a stat?');

    const nearest = await within(conversation()).findByRole('group', { name: 'Nearest Sections' });
    expect(within(nearest).getByRole('button', { name: /How to Add a Trait/ })).toBeInTheDocument();
    expect(within(nearest).getByRole('button', { name: /How to Add a Stat/ })).toBeInTheDocument();
    expect(within(conversation()).queryByRole('group', { name: 'Sources' })).toBeNull();
    const notice = within(conversation()).getByText(NOTICE);
    const answer = within(conversation()).getByText('A trait is a tag on an entity.');
    expect(notice.compareDocumentPosition(answer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(conversation()).not.toHaveTextContent('NOT IN');

    await userEvent.click(within(nearest).getByRole('button', { name: /How to Add a Trait/ }));
    expect(screen.getByRole('article', { name: '🧬 Traits: How to Add a Trait' })).toBeInTheDocument();
  });

  it('shows no notice on an answer from the guide', async () => {
    stubHelpStream(sseReply('Select **Add Trait**.'));
    const { field } = await openAsk();
    await send(field, 'How do I add a trait?');

    await within(conversation()).findByRole('group', { name: 'Sources' });
    expect(conversation()).not.toHaveTextContent(NOTICE);
    expect(within(conversation()).queryByRole('group', { name: 'Nearest Sections' })).toBeNull();
  });
});

describe('an answer with a link the model wrote', () => {
  it('renders no link that runs script', async () => {
    stubHelpStream(sseReply('Select [this](javascript:alert(1)) and [the site](https://example.com/help).'));
    const { field } = await openAsk();
    await send(field, 'How do I add a trait?');
    const site = await within(conversation()).findByRole('link', { name: 'the site' });
    expect(site).toHaveAttribute('rel', 'noopener noreferrer');
    for (const link of within(conversation()).queryAllByRole('link')) {
      expect(link.getAttribute('href') ?? '').not.toMatch(/^\s*javascript:/i);
    }
    expect(conversation().querySelector('[href^="javascript" i]')).toBeNull();
  });
});

describe('unmount', () => {
  it('cancels a stream in progress', async () => {
    const reply = openSseReply([sseFrame({ content: 'One moment' })]);
    stubHelpStream(reply.respond);
    const { field, view } = await openAsk();
    await send(field, 'How do I add a trait?');
    await waitFor(() => expect(conversation()).toHaveTextContent('One moment'));

    view.unmount();
    await waitFor(() => expect(reply.cancel).toHaveBeenCalledTimes(1));
  });

  it('shows no toast for a request that fails after it', async () => {
    // The error text is still on the way at unmount.
    const refusal = slowRefusal();
    const fetchSpy = stubHelpStream(refusal.respond);
    const toastError = vi.spyOn(toast, 'error');
    const { field, view } = await openAsk();
    await send(field, 'How do I add a trait?');
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));

    view.unmount();
    await act(async () => {
      refusal.end();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(toastError).not.toHaveBeenCalled();
  });

  it('shows the toast for the same failure while it is mounted', async () => {
    const refusal = slowRefusal();
    const fetchSpy = stubHelpStream(refusal.respond);
    const toastError = vi.spyOn(toast, 'error');
    const { field } = await openAsk();
    await send(field, 'How do I add a trait?');
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));

    await act(async () => {
      refusal.end();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(toastError).toHaveBeenCalledTimes(1);
  });
});

describe('the wide layout', () => {
  beforeEach(() => {
    vi.stubGlobal('innerWidth', 1600);
    vi.stubGlobal('innerHeight', 900);
    storeWindowBox({ x: 400, y: 100, w: WIDE_WIDTH, h: 560 });
  });

  it('holds the conversation beside the rail, with the cursor in the question field', async () => {
    const { field } = await openAsk();
    expect(screen.queryByRole('tab')).toBeNull();
    expect(screen.getByRole('searchbox', { name: 'Search the Guide' })).toBeInTheDocument();
    expect(conversation()).toBeInTheDocument();
    await waitFor(() => expect(field).toHaveFocus());
  });

  it('opens a source in the reader, and goes back to the conversation', async () => {
    stubHelpStream(sseReply('Select **Add Trait**.'));
    const { field } = await openAsk();
    await send(field, 'How do I add a trait?');
    const sources = await within(conversation()).findByRole('group', { name: 'Sources' });
    await userEvent.click(within(sources).getByRole('button', { name: /How to Add a Trait/ }));
    expect(screen.getByRole('article', { name: '🧬 Traits: How to Add a Trait' })).toBeInTheDocument();
    expect(screen.queryByRole('log')).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Back to Conversation' }));
    expect(screen.queryByRole('article')).toBeNull();
    expect(conversation()).toHaveTextContent('Select Add Trait.');
  });
});

describe('on a mobile-size screen', () => {
  it('opens on Ask with focus on the sheet, so no keyboard opens', async () => {
    vi.stubGlobal('innerWidth', 375);
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query.includes('max-width'), media: query, addEventListener: () => {}, removeEventListener: () => {},
    }));
    const { field } = await openAsk();
    await waitFor(() => expect(screen.getByRole('dialog', { name: 'Formaquestion' })).toHaveFocus());
    expect(field).not.toHaveFocus();
  });
});

describe('screenshots on a question', () => {
  /** The box that takes a paste or a drop: the ask field's own row and its parent. */
  const askBox = (field: HTMLElement) => field.parentElement!.parentElement!;
  const clipboard = (files: File[]) => ({ files, getData: () => '' });
  const dragOf = (files: File[]) => ({ files, types: ['Files'], getData: () => '', dropEffect: 'none' });
  /** The image urls on the last message of one request. */
  const sentImages = (spy: ReturnType<typeof stubHelpStream>, call = 0): string[] => {
    const last = (JSON.parse(spy.mock.calls[call][1]!.body as string) as { messages: { content: unknown }[] }).messages.at(-1)!.content;
    return Array.isArray(last) ? (last as { image_url?: { url: string } }[]).flatMap((part) => (part.image_url ? [part.image_url.url] : [])) : [];
  };

  beforeEach(() => {
    installFakeImageCodec();
    ai.current = { ...ai.current, readsImages: true };
  });

  it('attaches a pasted and a dropped image, sends both with the question, and shows them on it', async () => {
    const { field } = await openAsk();
    await act(async () => { fireEvent.paste(askBox(field), { clipboardData: clipboard([fakeImageFile('800x600')]) }); });
    await act(async () => { fireEvent.drop(askBox(field), { dataTransfer: dragOf([fakeImageFile('4000x3000')]) }); });
    await waitFor(() => expect(screen.getAllByRole('button', { name: /^Remove attached image/ })).toHaveLength(2));

    const fetchSpy = stubHelpStream(sseReply('That is the **Traits** tab.'));
    await send(field, 'What is this?');
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));
    expect(sentImages(fetchSpy).map((url) => decodedFake(url).size)).toEqual(['800x600', '1568x1176']);
    expect(screen.queryByRole('button', { name: /^Remove attached image/ })).toBeNull();
    expect(within(conversation()).getAllByRole('button', { name: /^View attached image/ })).toHaveLength(2);
  });

  it('picks images with the attach button', async () => {
    await openAsk();
    expect(screen.getByRole('button', { name: 'Attach images' })).toBeInTheDocument();
    await act(async () => {
      fireEvent.change(screen.getByTestId('attach-input'), { target: { files: [fakeImageFile('100x100')] } });
    });
    await waitFor(() => expect(screen.getAllByRole('button', { name: /^Remove attached image/ })).toHaveLength(1));
  });

  it('refuses a fifth image with the action box toast', async () => {
    const warn = vi.spyOn(toast, 'warning');
    const { field } = await openAsk();
    const files = ['1x1', '2x2', '3x3', '4x4', '5x5'].map((size) => fakeImageFile(size));
    await act(async () => { fireEvent.drop(askBox(field), { dataTransfer: dragOf(files) }); });
    await waitFor(() => expect(warn).toHaveBeenCalledWith(ATTACH_REFUSAL_COPY.limit));
    expect(screen.getAllByRole('button', { name: /^Remove attached image/ })).toHaveLength(MAX_ATTACHMENTS);
  });

  it('writes no image to storage', async () => {
    const stored: string[] = [];
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key: string, value: string) {
      stored.push(`${key}=${value}`);
    });
    // jsdom has no IndexedDB, so any open of it counts as a write.
    const idbOpen = vi.fn();
    vi.stubGlobal('indexedDB', { open: idbOpen });
    const { field } = await openAsk();
    await act(async () => { fireEvent.paste(askBox(field), { clipboardData: clipboard([fakeImageFile('800x600')]) }); });
    await screen.findByRole('button', { name: 'Remove attached image 1' });
    const fetchSpy = stubHelpStream(sseReply('Done.'));
    await send(field, 'What is this?');
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));
    const image = sentImages(fetchSpy)[0];
    expect(image).toMatch(/^data:image\/jpeg/);

    expect(stored.filter((entry) => entry.includes(image) || entry.includes('data:image'))).toEqual([]);
    expect(idbOpen).not.toHaveBeenCalled();
  });
});

describe('screenshots on a model that does not read images', () => {
  beforeEach(installFakeImageCodec);

  it('has no attach button, and a pasted image adds nothing and shows no error', async () => {
    const warn = vi.spyOn(toast, 'warning');
    const { field } = await openAsk();
    expect(screen.queryByRole('button', { name: 'Attach images' })).toBeNull();
    expect(screen.queryByTestId('attach-input')).toBeNull();
    let notPrevented = false;
    await act(async () => {
      notPrevented = fireEvent.paste(field.parentElement!.parentElement!, { clipboardData: { files: [fakeImageFile('800x600')], getData: () => '' } });
    });
    // The paste stays with the browser: the intake takes nothing.
    expect(notPrevented).toBe(true);
    expect(screen.queryByRole('button', { name: /^Remove attached image/ })).toBeNull();
    expect(warn).not.toHaveBeenCalled();
  });
});
