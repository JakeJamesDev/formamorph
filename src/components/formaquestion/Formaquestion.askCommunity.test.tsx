import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDocsIndex } from '@/lib/docs/docsIndex';
import { closeFeedback } from '@/lib/feedbackOpener';
import { cancelSignIn, getSignInState, signInSucceeded } from '@/lib/signInStore';
import AuthService from '@/services/AuthService';
import { sseFrame, sseReply } from '@/test/aiTextFixtures';
import { helpAi } from '@/test/helpAiFixture';
import { storeFramedWindow, storeMinimalWindow, stubHelpStream } from '@/test/helpFixtures';
import type { HelpAi } from './useHelpAi';

const ai = vi.hoisted(() => ({ current: null as unknown as HelpAi }));
vi.mock('./useHelpAi', () => ({ useHelpAi: () => ai.current }));
const flags = vi.hoisted(() => ({ community: true }));
vi.mock('@/lib/featureFlags', () => ({ get COMMUNITY_ENABLED() { return flags.community; } }));
// jsdom can't drive a real Lexical selection; the stub keeps the body a plain textarea.
vi.mock('@/components/prompt/PromptField', () => ({
  default: (props: { value: string; onChange: (v: string) => void; ariaLabel?: string }) => (
    <textarea id="feedbackBody" aria-label={props.ariaLabel} value={props.value} onChange={(e) => props.onChange(e.target.value)} />
  ),
}));
import { FeedbackHost } from '@/components/FeedbackHost';
import { Formaquestion } from './Formaquestion';

const PAGES = {
  Settings: '# ⚙️ Settings\n\nSettings hold your options.\n\n## How to Change the Theme\n\n<!-- route: settings.display -->\n\n1. Open the **Display** tab.\n2. Pick a theme.\n',
};
const loadFixture = () => Promise.resolve(createDocsIndex({ pages: PAGES, sidebar: '- [Settings](Settings)\n' }));

const askCommunity = () => screen.queryByRole('button', { name: 'Ask the Community' });
const feedbackDialog = () => screen.queryByRole('dialog', { name: 'Send Feedback' });
const titleValue = () => (document.getElementById('feedbackTitle') as HTMLInputElement).value;
const windowLayer = () => document.querySelector<HTMLElement>('[data-shielded-layer="window"]')!;
const isCovered = () => windowLayer().style.zIndex === '40' && (windowLayer().firstElementChild as HTMLElement).inert;

async function openWindow() {
  render(<><Formaquestion loadIndex={loadFixture} /><FeedbackHost /></>);
  await userEvent.click(screen.getByRole('button', { name: 'Help' }));
  return screen.findByRole('textbox', { name: 'Ask a Question' });
}

async function ask(field: HTMLElement, question: string) {
  await userEvent.click(field);
  await userEvent.type(field, question, { delay: null, skipClick: true });
  await userEvent.click(screen.getByRole('button', { name: 'Send' }));
}

/** An answer stream that stays open until the test ends it. */
function heldReply() {
  let stream!: ReadableStreamDefaultController<Uint8Array>;
  const body = new ReadableStream<Uint8Array>({ start(controller) { stream = controller; } });
  const encoder = new TextEncoder();
  return {
    respond: () => new Response(body, { headers: { 'Content-Type': 'text/event-stream' } }),
    end: () => act(() => {
      stream.enqueue(encoder.encode(sseFrame({ content: 'Open the **Display** tab.' })));
      stream.enqueue(encoder.encode(sseFrame({}, 'stop')));
      stream.enqueue(encoder.encode('data: [DONE]\n\n'));
      stream.close();
    }),
  };
}

beforeEach(() => {
  localStorage.clear();
  flags.community = true;
  AuthService.token = 'token';
  vi.stubGlobal('innerWidth', 1600);
  vi.stubGlobal('innerHeight', 900);
  ai.current = helpAi({ revalidate: vi.fn(async () => true), requestSurface: vi.fn() });
});
afterEach(() => {
  act(() => {
    closeFeedback();
    cancelSignIn();
  });
  cleanup();
  AuthService.token = null;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Ask the Community', () => {
  it('shows in the ask panel once the answer is done, not while it is writing', async () => {
    storeFramedWindow();
    const field = await openWindow();
    const reply = heldReply();
    stubHelpStream(reply.respond);
    await ask(field, 'How do I change the theme?');
    await screen.findByRole('button', { name: 'Stop' });
    expect(askCommunity()).toBeNull();

    reply.end();
    const conversation = screen.getByRole('log', { name: 'Conversation' });
    expect(await within(conversation).findByRole('button', { name: 'Ask the Community' })).toBeInTheDocument();
  });

  it('shows under a stopped answer', async () => {
    storeFramedWindow();
    const field = await openWindow();
    stubHelpStream(heldReply().respond);
    await ask(field, 'How do I change the theme?');
    await userEvent.click(await screen.findByRole('button', { name: 'Stop' }));
    expect(await screen.findByRole('button', { name: 'Ask the Community' })).toBeInTheDocument();
  });

  it('shows in the minimal chat and in the bubble strip', async () => {
    storeMinimalWindow();
    let field = await openWindow();
    stubHelpStream(sseReply('Open the **Display** tab.'));
    await ask(field, 'How do I change the theme?');
    expect(await screen.findByRole('button', { name: 'Ask the Community' })).toBeInTheDocument();
    cleanup();

    localStorage.clear();
    field = await openWindow();
    stubHelpStream(sseReply('Open the **Display** tab.'));
    await ask(field, 'How do I change the theme?');
    const strip = await waitFor(() => document.querySelector<HTMLElement>('[data-fq-strip]')!);
    expect(await within(strip).findByRole('button', { name: 'Ask the Community' })).toBeInTheDocument();
  });

  it('shows under a failed answer, in a footer row of its own', async () => {
    storeFramedWindow();
    const field = await openWindow();
    stubHelpStream(() => new Response('', { status: 500 }));
    await ask(field, 'How do I change the theme?');
    expect(await screen.findByRole('button', { name: 'Ask the Community' })).toBeInTheDocument();
  });

  it('opens a new question over the window, titled with the collapsed question, and focus comes back on close', async () => {
    storeFramedWindow();
    const field = await openWindow();
    stubHelpStream(sseReply('Open the **Display** tab.'));
    await ask(field, 'How do I   change  the theme?');
    const button = await screen.findByRole('button', { name: 'Ask the Community' });
    expect(isCovered()).toBe(false);

    await userEvent.click(button);
    expect(feedbackDialog()).not.toBeNull();
    expect(screen.getByRole('tab', { name: 'Question' })).toHaveAttribute('data-state', 'active');
    expect(titleValue()).toBe('How do I change the theme?');
    expect(isCovered()).toBe(true);
    expect(document.getElementById('formaquestion-window')).toHaveAttribute('data-state', 'open');

    await userEvent.click(screen.getAllByRole('button', { name: 'Close' }).find((close) => close.textContent === 'Close')!);
    await waitFor(() => expect(feedbackDialog()).toBeNull());
    expect(isCovered()).toBe(false);
    expect(document.activeElement).toBe(button);
  });

  it('asks a signed-out player to sign in first, covering the window, then opens the question', async () => {
    AuthService.token = null;
    storeFramedWindow();
    const field = await openWindow();
    stubHelpStream(sseReply('Open the **Display** tab.'));
    await ask(field, 'How do I change the theme?');
    await userEvent.click(await screen.findByRole('button', { name: 'Ask the Community' }));

    expect(getSignInState().phase).toBe('checking');
    expect(feedbackDialog()).toBeNull();
    expect(isCovered()).toBe(true);

    act(() => signInSucceeded());
    expect(feedbackDialog()).not.toBeNull();
    expect(titleValue()).toBe('How do I change the theme?');
  });

  it('is hidden with the community flag off', async () => {
    flags.community = false;
    storeFramedWindow();
    const field = await openWindow();
    stubHelpStream(sseReply('Open the **Display** tab.'));
    await ask(field, 'How do I change the theme?');
    await screen.findByRole('button', { name: 'Take Me There' });
    expect(askCommunity()).toBeNull();
  });
});
