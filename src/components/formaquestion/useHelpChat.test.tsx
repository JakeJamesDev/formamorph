import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { bundledDocsIndex } from '@/lib/docs/bundledDocsIndex';
import { createDocsIndex } from '@/lib/docs/docsIndex';
import { surfaceRegistry } from '@/lib/surface/surfaceRegistry';
import { openSseReply, sseFrame, sseReply } from '@/test/aiTextFixtures';
import { stubHelpStream } from '@/test/helpFixtures';
import { GENERAL_KNOWLEDGE_MARKER } from '@/lib/formaquestion/generalKnowledge';
import { DEFAULT_HELP_SETTINGS } from '@/lib/formaquestion/helpSettings';
import { languageDirective } from '@/lib/languages';
import { turnActivity } from '@/lib/turnActivity';
import type { ImageAttachment } from '@/types';
import { helpAi } from '@/test/helpAiFixture';
import type { HelpAi } from './useHelpAi';
import { useHelpChat } from './useHelpChat';

const index = createDocsIndex({ pages: { Traits: '# Traits\n\n## How to Add a Trait\n\n1. Select **Add Trait**.\n' } });
const ai: HelpAi = helpAi({ readsImages: true });

const screenshot = (id: string): ImageAttachment => ({ id, mime: 'image/jpeg', dataUrl: `data:image/jpeg;base64,${btoa(id)}` });

/** The image urls on the last message of one request the stub received. */
const sentImages = (spy: ReturnType<typeof stubHelpStream>, call: number): string[] => {
  const last = (JSON.parse(spy.mock.calls[call][1]!.body as string) as { messages: { content: unknown }[] }).messages.at(-1)!.content;
  return Array.isArray(last) ? (last as { image_url?: { url: string } }[]).flatMap((part) => (part.image_url ? [part.image_url.url] : [])) : [];
};

/** The chat messages of one request the stub received. */
const sentMessages = (spy: ReturnType<typeof stubHelpStream>, call: number) =>
  (JSON.parse(spy.mock.calls[call][1]!.body as string) as { messages: { role: string; content: string }[] }).messages;

afterEach(() => {
  turnActivity.set(false);
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('useHelpChat', () => {
  it('takes one question at a time: a second ask while the first runs adds nothing and sends nothing', async () => {
    const fetchSpy = stubHelpStream(sseReply('Select **Add Trait**.'));
    const { result } = renderHook(() => useHelpChat(index, ai, DEFAULT_HELP_SETTINGS));
    act(() => {
      result.current.ask('How do I add a trait?');
      result.current.ask('And a stat?');
    });
    await waitFor(() => expect(result.current.busy).toBe(false));
    expect(result.current.exchanges.map((exchange) => exchange.question)).toEqual(['How do I add a trait?']);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.picks).toHaveBeenCalledTimes(1);

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
    const fetchSpy = stubHelpStream(sseReply('Unused.'));
    let finishCheck: (reachable: boolean) => void = () => {};
    const blocked: HelpAi = { ...ai, reachable: false, revalidate: () => new Promise((resolve) => { finishCheck = resolve; }) };
    const { result } = renderHook(() => useHelpChat(index, blocked, DEFAULT_HELP_SETTINGS));
    act(() => { result.current.ask('How do I add a trait?'); });
    expect(result.current.busy).toBe(true);

    // The check of a server that does not answer can take a long time. Stop does not wait for it.
    await act(async () => { result.current.stop(); });
    expect(result.current.exchanges.map((exchange) => exchange.status)).toEqual(['stopped']);
    expect(result.current.busy).toBe(false);

    await act(async () => { finishCheck(found); });
    expect(result.current.exchanges.map((exchange) => exchange.status)).toEqual(['stopped']);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(fetchSpy.picks).not.toHaveBeenCalled();
  });

  it('does nothing before the docs load', () => {
    const fetchSpy = stubHelpStream(sseReply('Unused.'));
    const { result } = renderHook(() => useHelpChat(null, ai, DEFAULT_HELP_SETTINGS));
    act(() => { result.current.ask('How do I add a trait?'); });
    expect(result.current.exchanges).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(fetchSpy.picks).not.toHaveBeenCalled();
  });

  it('sends a follow-up with the earlier question and answer', async () => {
    const fetchSpy = stubHelpStream(sseReply('Select **Add Trait**.'));
    const { result } = renderHook(() => useHelpChat(index, ai, DEFAULT_HELP_SETTINGS));
    act(() => { result.current.ask('How do I add a trait?'); });
    await waitFor(() => expect(result.current.busy).toBe(false));
    act(() => { result.current.ask('and then?'); });
    await waitFor(() => expect(result.current.exchanges.at(-1)?.status).toBe('answered'));

    expect(sentMessages(fetchSpy, 1).slice(1, -1)).toEqual([
      { role: 'user', content: 'How do I add a trait?' },
      { role: 'assistant', content: 'Select **Add Trait**.' },
    ]);
  });

  it('keeps a vague follow-up on the page of the earlier answer', async () => {
    const tools = createDocsIndex({
      pages: {
        Bench: '# Bench\n\n## Checks\n\nTest with **Check**.\n',
        Tools: '# Tools\n\n## How to Make a Tool\n\nSelect **Add Tool**.\n\n## How to Try a Tool\n\nTest the tool with **Try It**.\n',
      },
      sidebar: '- [Bench](Bench)\n- [Tools](Tools)\n',
    });
    stubHelpStream(sseReply('Select **Add Tool**.'));
    const { result } = renderHook(() => useHelpChat(tools, ai, DEFAULT_HELP_SETTINGS));
    act(() => { result.current.ask('How do I make a tool?'); });
    await waitFor(() => expect(result.current.busy).toBe(false));
    act(() => { result.current.ask('how do I test it?'); });
    await waitFor(() => expect(result.current.exchanges.at(-1)?.status).toBe('answered'));

    expect(result.current.exchanges.at(-1)?.sources[0].id).toBe('Tools#how-to-try-a-tool');
  });

  it('keeps a vague follow-up on the topic of the earlier answer, not on the page of the open screen', async () => {
    vi.spyOn(surfaceRegistry, 'get').mockReturnValue({ screen: 'worldEditor', dialog: null, tabs: [] });
    stubHelpStream(sseReply('Select **Add Tool**.'));
    const { result } = renderHook(() => useHelpChat(bundledDocsIndex(), ai, DEFAULT_HELP_SETTINGS));
    act(() => { result.current.ask('How do I make a tool?'); });
    await waitFor(() => expect(result.current.busy).toBe(false));
    act(() => { result.current.ask('how do I test it?'); });
    await waitFor(() => expect(result.current.exchanges.at(-1)?.status).toBe('answered'));

    // The open screen's section leads; the question's own top hit comes next.
    const [lead, top] = result.current.exchanges.at(-1)!.sources;
    expect(lead.page).toBe('WorldEditor');
    expect(top.id).toBe('Tools#how-to-try-a-tool');
  });

  it('shows a flagged answer without its marker, and sends the marker back with it on a follow-up', async () => {
    const fetchSpy = stubHelpStream(sseReply(`${GENERAL_KNOWLEDGE_MARKER}\nLight scatters.`));
    const { result } = renderHook(() => useHelpChat(index, ai, DEFAULT_HELP_SETTINGS));
    act(() => { result.current.ask('Why is the sky blue?'); });
    await waitFor(() => expect(result.current.busy).toBe(false));
    expect(result.current.exchanges[0]).toMatchObject({ answer: 'Light scatters.', flagged: true });

    act(() => { result.current.ask('and at night?'); });
    await waitFor(() => expect(result.current.exchanges.at(-1)?.status).toBe('answered'));
    expect(sentMessages(fetchSpy, 1).slice(1, -1)).toEqual([
      { role: 'user', content: 'Why is the sky blue?' },
      { role: 'assistant', content: `${GENERAL_KNOWLEDGE_MARKER}\nLight scatters.` },
    ]);
    expect(result.current.exchanges.every((exchange) => !exchange.answer.includes(GENERAL_KNOWLEDGE_MARKER))).toBe(true);
  });

  it(`keeps every exchange in view while a request carries only the last ${DEFAULT_HELP_SETTINGS.historyLength}`, async () => {
    const fetchSpy = stubHelpStream(sseReply('Done.'));
    const { result } = renderHook(() => useHelpChat(index, ai, DEFAULT_HELP_SETTINGS));
    const { historyLength } = DEFAULT_HELP_SETTINGS;
    const total = historyLength + 2;
    for (let n = 0; n < total; n++) {
      act(() => { result.current.ask(`question ${n}`); });
      await waitFor(() => expect(result.current.busy).toBe(false));
    }

    expect(result.current.exchanges.map((exchange) => exchange.question)).toEqual(Array.from({ length: total }, (_, n) => `question ${n}`));
    const earlier = sentMessages(fetchSpy, total - 1).slice(1, -1).filter((message) => message.role === 'user');
    expect(earlier.map((message) => message.content)).toEqual(
      Array.from({ length: historyLength }, (_, n) => `question ${total - 1 - historyLength + n}`),
    );
  });

  it('writes the answer in the AI Language', async () => {
    const fetchSpy = stubHelpStream(sseReply('Selecciona **Add Trait**.'));
    const { result } = renderHook(() => useHelpChat(index, { ...ai, language: 'Spanish' }, DEFAULT_HELP_SETTINGS));
    act(() => { result.current.ask('How do I add a trait?'); });
    await waitFor(() => expect(result.current.busy).toBe(false));
    expect(sentMessages(fetchSpy, 0)[0].content).toContain(languageDirective('answers', 'Spanish'));
  });

  it('clears the conversation and ends the answer that is coming in', async () => {
    const reply = openSseReply([sseFrame({ content: '1. Select' })]);
    const fetchSpy = stubHelpStream(reply.respond);
    const { result } = renderHook(() => useHelpChat(index, ai, DEFAULT_HELP_SETTINGS));
    act(() => { result.current.ask('How do I add a trait?'); });
    await waitFor(() => expect(result.current.exchanges[0]?.answer).toBe('1. Select'));

    act(() => { result.current.clear(); });
    expect(result.current.exchanges).toEqual([]);
    expect(result.current.busy).toBe(false);

    // A question right after Clear starts a new conversation, before the old stream has closed.
    const next = stubHelpStream(sseReply('Done.'));
    act(() => { result.current.ask('How do I add a stat?'); });
    expect(result.current.exchanges.map((exchange) => exchange.question)).toEqual(['How do I add a stat?']);
    await waitFor(() => expect(reply.cancel).toHaveBeenCalled());
    expect(fetchSpy.mock.calls[0][1].signal?.aborted).toBe(true);
    await waitFor(() => expect(result.current.busy).toBe(false));
    expect(result.current.exchanges.map((exchange) => exchange.answer)).toEqual(['Done.']);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('holds Send while a game turn generates, and sends once the turn ends', async () => {
    const fetchSpy = stubHelpStream(sseReply('Done.'));
    const { result } = renderHook(() => useHelpChat(index, ai, DEFAULT_HELP_SETTINGS));
    act(() => { turnActivity.set(true); });
    expect(result.current.held).toBe(true);
    act(() => { result.current.ask('How do I add a trait?'); });
    expect(result.current.exchanges).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(fetchSpy.picks).not.toHaveBeenCalled();

    act(() => { turnActivity.set(false); });
    expect(result.current.held).toBe(false);
    act(() => { result.current.ask('How do I add a trait?'); });
    await waitFor(() => expect(result.current.busy).toBe(false));
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('sends the pending images with the question, keeps them on its exchange, and leaves none pending', async () => {
    const fetchSpy = stubHelpStream(sseReply('That is the **Traits** tab.'));
    const { result } = renderHook(() => useHelpChat(index, ai, DEFAULT_HELP_SETTINGS));
    act(() => { result.current.setPending(() => [screenshot('a'), screenshot('b')]); });
    act(() => { result.current.ask('What is this?'); });
    expect(result.current.pending).toEqual([]);
    await waitFor(() => expect(result.current.busy).toBe(false));

    expect(sentImages(fetchSpy, 0)).toEqual([screenshot('a').dataUrl, screenshot('b').dataUrl]);
    expect(result.current.exchanges[0].images.map((image) => image.id)).toEqual(['a', 'b']);
  });

  it('sends a follow-up without the images of the earlier question', async () => {
    const fetchSpy = stubHelpStream(sseReply('Done.'));
    const { result } = renderHook(() => useHelpChat(index, ai, DEFAULT_HELP_SETTINGS));
    act(() => { result.current.setPending(() => [screenshot('a')]); });
    act(() => { result.current.ask('What is this?'); });
    await waitFor(() => expect(result.current.busy).toBe(false));
    act(() => { result.current.ask('and then?'); });
    await waitFor(() => expect(result.current.exchanges.at(-1)?.status).toBe('answered'));

    expect(sentImages(fetchSpy, 1)).toEqual([]);
    expect(JSON.stringify(sentMessages(fetchSpy, 1))).not.toContain(screenshot('a').dataUrl);
  });

  it('sends no image when the model does not read images', async () => {
    const fetchSpy = stubHelpStream(sseReply('Done.'));
    const { result } = renderHook(() => useHelpChat(index, { ...ai, readsImages: false }, DEFAULT_HELP_SETTINGS));
    act(() => { result.current.setPending(() => [screenshot('a')]); });
    act(() => { result.current.ask('What is this?'); });
    await waitFor(() => expect(result.current.busy).toBe(false));
    expect(sentImages(fetchSpy, 0)).toEqual([]);
    expect(result.current.exchanges[0].images).toEqual([]);
  });
});
