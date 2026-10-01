import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDocsIndex } from '@/lib/docs/docsIndex';
import { openSseReply, sseFrame, sseReply, stubStream, textSnapshot } from '@/test/aiTextFixtures';
import { HELP_HISTORY_EXCHANGES } from '@/lib/formaquestion/helpSession';
import { languageDirective } from '@/lib/languages';
import { turnActivity } from '@/lib/turnActivity';
import type { HelpAi } from './useHelpAi';
import { useHelpChat } from './useHelpChat';

const index = createDocsIndex({ pages: { Traits: '# Traits\n\n## How to Add a Trait\n\n1. Select **Add Trait**.\n' } });
const ai: HelpAi = { snapshot: textSnapshot(), language: 'English', reachable: true, revalidate: async () => true };

/** The chat messages of one request the stub received. */
const sentMessages = (spy: ReturnType<typeof stubStream>, call: number) =>
  (JSON.parse(spy.mock.calls[call][1]!.body as string) as { messages: { role: string; content: string }[] }).messages;

afterEach(() => {
  turnActivity.set(false);
  vi.unstubAllGlobals();
});

describe('useHelpChat', () => {
  it('takes one question at a time: a second ask while the first runs adds nothing and sends nothing', async () => {
    const fetchSpy = stubStream(sseReply('Select **Add Trait**.'));
    const { result } = renderHook(() => useHelpChat(index, ai));
    act(() => {
      result.current.ask('How do I add a trait?');
      result.current.ask('And a stat?');
    });
    await waitFor(() => expect(result.current.busy).toBe(false));
    expect(result.current.exchanges.map((exchange) => exchange.question)).toEqual(['How do I add a trait?']);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // The next question goes through once the first has its answer.
    act(() => { result.current.ask('And a stat?'); });
    await waitFor(() => expect(result.current.exchanges).toHaveLength(2));
    await waitFor(() => expect(result.current.busy).toBe(false));
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['finds the AI', true],
    ['finds no AI', false],
  ])('stops at once when Stop comes while the fresh check runs, and sends nothing when the check later %s', async (_name, found) => {
    const fetchSpy = stubStream(sseReply('Unused.'));
    let finishCheck: (reachable: boolean) => void = () => {};
    const blocked: HelpAi = { ...ai, reachable: false, revalidate: () => new Promise((resolve) => { finishCheck = resolve; }) };
    const { result } = renderHook(() => useHelpChat(index, blocked));
    act(() => { result.current.ask('How do I add a trait?'); });
    expect(result.current.busy).toBe(true);

    // The check of a server that does not answer can take a long time. Stop does not wait for it.
    await act(async () => { result.current.stop(); });
    expect(result.current.exchanges.map((exchange) => exchange.status)).toEqual(['stopped']);
    expect(result.current.busy).toBe(false);

    await act(async () => { finishCheck(found); });
    expect(result.current.exchanges.map((exchange) => exchange.status)).toEqual(['stopped']);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('does nothing before the docs load', () => {
    const fetchSpy = stubStream(sseReply('Unused.'));
    const { result } = renderHook(() => useHelpChat(null, ai));
    act(() => { result.current.ask('How do I add a trait?'); });
    expect(result.current.exchanges).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('sends a follow-up with the earlier question and answer', async () => {
    const fetchSpy = stubStream(sseReply('Select **Add Trait**.'));
    const { result } = renderHook(() => useHelpChat(index, ai));
    act(() => { result.current.ask('How do I add a trait?'); });
    await waitFor(() => expect(result.current.busy).toBe(false));
    act(() => { result.current.ask('and then?'); });
    await waitFor(() => expect(result.current.exchanges.at(-1)?.status).toBe('answered'));

    expect(sentMessages(fetchSpy, 1).slice(1, -1)).toEqual([
      { role: 'user', content: 'How do I add a trait?' },
      { role: 'assistant', content: 'Select **Add Trait**.' },
    ]);
  });

  it(`keeps every exchange in view while a request carries only the last ${HELP_HISTORY_EXCHANGES}`, async () => {
    const fetchSpy = stubStream(sseReply('Done.'));
    const { result } = renderHook(() => useHelpChat(index, ai));
    const total = HELP_HISTORY_EXCHANGES + 2;
    for (let n = 0; n < total; n++) {
      act(() => { result.current.ask(`question ${n}`); });
      await waitFor(() => expect(result.current.busy).toBe(false));
    }

    expect(result.current.exchanges.map((exchange) => exchange.question)).toEqual(Array.from({ length: total }, (_, n) => `question ${n}`));
    const earlier = sentMessages(fetchSpy, total - 1).slice(1, -1).filter((message) => message.role === 'user');
    expect(earlier.map((message) => message.content)).toEqual(
      Array.from({ length: HELP_HISTORY_EXCHANGES }, (_, n) => `question ${total - 1 - HELP_HISTORY_EXCHANGES + n}`),
    );
  });

  it('writes the answer in the AI Language', async () => {
    const fetchSpy = stubStream(sseReply('Selecciona **Add Trait**.'));
    const { result } = renderHook(() => useHelpChat(index, { ...ai, language: 'Spanish' }));
    act(() => { result.current.ask('How do I add a trait?'); });
    await waitFor(() => expect(result.current.busy).toBe(false));
    expect(sentMessages(fetchSpy, 0)[0].content).toContain(languageDirective('answers', 'Spanish'));
  });

  it('clears the conversation and ends the answer that is coming in', async () => {
    const reply = openSseReply([sseFrame({ content: '1. Select' })]);
    const fetchSpy = vi.fn(async (_url: string, _init: RequestInit) => reply.respond());
    vi.stubGlobal('fetch', fetchSpy);
    const { result } = renderHook(() => useHelpChat(index, ai));
    act(() => { result.current.ask('How do I add a trait?'); });
    await waitFor(() => expect(result.current.exchanges[0]?.answer).toBe('1. Select'));

    act(() => { result.current.clear(); });
    expect(result.current.exchanges).toEqual([]);
    expect(result.current.busy).toBe(false);

    // A question right after Clear starts a new conversation, before the old stream has closed.
    const next = stubStream(sseReply('Done.'));
    act(() => { result.current.ask('How do I add a stat?'); });
    expect(result.current.exchanges.map((exchange) => exchange.question)).toEqual(['How do I add a stat?']);
    await waitFor(() => expect(reply.cancel).toHaveBeenCalled());
    expect(fetchSpy.mock.calls[0][1].signal?.aborted).toBe(true);
    await waitFor(() => expect(result.current.busy).toBe(false));
    expect(result.current.exchanges.map((exchange) => exchange.answer)).toEqual(['Done.']);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('holds Send while a game turn generates, and sends once the turn ends', async () => {
    const fetchSpy = stubStream(sseReply('Done.'));
    const { result } = renderHook(() => useHelpChat(index, ai));
    act(() => { turnActivity.set(true); });
    expect(result.current.held).toBe(true);
    act(() => { result.current.ask('How do I add a trait?'); });
    expect(result.current.exchanges).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();

    act(() => { turnActivity.set(false); });
    expect(result.current.held).toBe(false);
    act(() => { result.current.ask('How do I add a trait?'); });
    await waitFor(() => expect(result.current.busy).toBe(false));
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
