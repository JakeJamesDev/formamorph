import { describe, expect, it, vi } from 'vitest';
import { createDocsIndex } from '@/lib/docs/docsIndex';
import { UNKNOWN_REASONING_CAPABILITY } from '@/lib/reasoningEffort';
import { sseFrame, sseReply, sseResponse, textSnapshot, textTarget } from '@/test/aiTextFixtures';
import { pastPicks } from '@/test/helpFixtures';
import { DOCS_LOOKUP } from './docsLookup';
import { GENERAL_KNOWLEDGE_MARKER } from './generalKnowledge';
import { askHelp, type HelpEvent, type HelpQuestion } from './helpSession';
import { helpSettingsOf } from './helpSettings';

const PAGES = {
  Stats: '# 📊 Stats\n\nStats are numbers.\n\n## How to Add a Stat\n\n1. Open the **Stats** tab.\n2. Select **Add Stat**.\n',
  Traits: '# 🧬 Traits\n\nA trait changes a stat.\n\n## How to Add a Trait\n\n1. Open the **Traits** tab.\n2. Select **Add Trait**.\n',
};
const index = createDocsIndex({ pages: PAGES, sidebar: '- [Stats](Stats)\n- [Traits](Traits)\n' });
const LOOKUP = textSnapshot(textTarget({ reasoning: { ...UNKNOWN_REASONING_CAPABILITY, tools: true, sources: { tools: 'native' } } }));

type FetchSpy = ReturnType<typeof vi.fn<(url: string, init: RequestInit) => Promise<Response>>>;

/** A fetch that answers request N with the Nth reply. */
const script = (...replies: string[][]): FetchSpy => {
  let request = 0;
  return vi.fn(async () => sseResponse(replies[request++]));
};

const ask = (question: string, fetchImpl: FetchSpy, over: Partial<HelpQuestion> = {}) =>
  askHelp({ question, settings: helpSettingsOf({ lookup: true }), snapshot: textSnapshot(), index, fetchImpl: pastPicks(fetchImpl), ...over });

async function collect(events: AsyncIterable<HelpEvent>): Promise<HelpEvent[]> {
  const all: HelpEvent[] = [];
  for await (const event of events) all.push(event);
  return all;
}

function doneOf(events: HelpEvent[]) {
  const done = events.at(-1);
  if (done?.type !== 'done') throw new Error('no done event');
  return { ...done, sources: done.sources.map((section) => section.id), nearest: done.nearest.map((section) => section.id) };
}

const answerTexts = (events: HelpEvent[]) => events.flatMap((event) => (event.type === 'answer' ? [event.text] : []));

describe('the general-knowledge flag', () => {
  it('tells the model the marker, in both modes', async () => {
    for (const snapshot of [textSnapshot(), LOOKUP]) {
      const fetchImpl = script(sseReply('Select **Add Trait**.'));
      await collect(ask('How do I add a trait?', fetchImpl, { snapshot }));
      const body = JSON.parse(fetchImpl.mock.calls[0][1].body as string) as { messages: { role: string; content: string }[] };
      expect(body.messages.find((message) => message.role === 'system')?.content).toContain(GENERAL_KNOWLEDGE_MARKER);
    }
  });

  it('flags an answer with the marker and removes the marker from the text', async () => {
    const events = await collect(ask('How do I add a trait?', script(sseReply(`${GENERAL_KNOWLEDGE_MARKER}\nA trait is a tag.`))));

    expect(doneOf(events)).toMatchObject({ text: 'A trait is a tag.', flagged: true });
    expect(answerTexts(events).every((text) => !text.includes('GUIDE'))).toBe(true);
    expect(events.filter((event) => event.type === 'answer').at(-1)).toMatchObject({ flagged: true });
  });

  it('reads and removes a marker split across two chunks', async () => {
    const fetchImpl = script([sseFrame({ content: '[NOT IN' }), ...sseReply(' GUIDE]\nA trait is a tag.')]);
    const events = await collect(ask('How do I add a trait?', fetchImpl));

    expect(answerTexts(events)).toEqual(['A trait is a tag.']);
    expect(doneOf(events)).toMatchObject({ text: 'A trait is a tag.', flagged: true });
  });

  it('does not flag an answer with no marker when sections were sent, and shows its sources', async () => {
    const done = doneOf(await collect(ask('How do I add a trait?', script(sseReply('Select **Add Trait**.')))));

    expect(done).toMatchObject({ flagged: false, nearest: [] });
    expect(done.sources).toContain('Traits#how-to-add-a-trait');
  });

  it('flags an answer with no marker when no section was sent', async () => {
    const done = doneOf(await collect(ask('Why is the sky blue?', script(sseReply('Light scatters.')))));

    expect(done).toMatchObject({ text: 'Light scatters.', flagged: true, sources: [], nearest: [] });
  });

  it('gives a flagged answer the search hits for the question as its nearest sections', async () => {
    const done = doneOf(await collect(ask('How do I add a trait to a stat?', script(sseReply(`${GENERAL_KNOWLEDGE_MARKER}\nNot that way.`)))));

    expect(done.flagged).toBe(true);
    expect(done.nearest).toEqual(expect.arrayContaining(['Traits#how-to-add-a-trait', 'Stats#how-to-add-a-stat']));
  });

  it('keeps a stopped answer flagged when its marker came in', async () => {
    const controller = new AbortController();
    const fetchImpl = vi.fn(async () => sseResponse([sseFrame({ content: `${GENERAL_KNOWLEDGE_MARKER}\nA trait` })]));
    const events: HelpEvent[] = [];
    for await (const event of ask('How do I add a trait?', fetchImpl, { signal: controller.signal })) {
      events.push(event);
      if (event.type === 'answer') controller.abort();
    }

    expect(doneOf(events)).toMatchObject({ text: 'A trait', flagged: true, stopped: true });
  });

  it('keeps a held start of the marker hidden when Stop lands on it', async () => {
    const controller = new AbortController();
    // The player stops once the held start has been read, and before more text comes.
    const body = new ReadableStream<Uint8Array>({
      start(stream) { stream.enqueue(new TextEncoder().encode(sseFrame({ content: '[NOT IN G' }))); },
      pull() { controller.abort(); },
    });
    const fetchImpl = vi.fn(async () => new Response(body, { headers: { 'Content-Type': 'text/event-stream' } }));
    const events = await collect(ask('How do I add a trait?', fetchImpl, { signal: controller.signal }));

    expect(doneOf(events)).toMatchObject({ text: '', stopped: true });
    expect(answerTexts(events).every((text) => !text.includes('['))).toBe(true);
  });
});

describe('the general-knowledge flag in lookup mode', () => {
  const lookupCall = (args: unknown) => [
    sseFrame({ tool_calls: [{ index: 0, id: 'call-0', type: 'function', function: { name: DOCS_LOOKUP.name, arguments: JSON.stringify(args) } }] }),
    sseFrame({}, 'tool_calls'),
    'data: [DONE]\n\n',
  ];

  it('flags a marked answer after a lookup, and gives it the search hits as its nearest sections', async () => {
    const fetchImpl = script(lookupCall({ sections: 'Stats#how-to-add-a-stat' }), sseReply(`${GENERAL_KNOWLEDGE_MARKER}\nA trait is a tag.`));
    const done = doneOf(await collect(ask('How do I add a trait?', fetchImpl, { snapshot: LOOKUP })));

    expect(done).toMatchObject({ text: 'A trait is a tag.', flagged: true });
    expect(done.nearest).toContain('Traits#how-to-add-a-trait');
  });

  it('does not flag an answer from a fetched section when the search found none', async () => {
    const fetchImpl = script(lookupCall({ sections: 'Stats#how-to-add-a-stat' }), sseReply('Select **Add Stat**.'));
    const done = doneOf(await collect(ask('Why is the sky blue?', fetchImpl, { snapshot: LOOKUP })));

    expect(done).toMatchObject({ flagged: false, sources: ['Stats#how-to-add-a-stat'] });
  });

  it('flags an answer with no marker when the search found none and the model read none', async () => {
    const done = doneOf(await collect(ask('Why is the sky blue?', script(sseReply('Light scatters.')), { snapshot: LOOKUP })));

    expect(done).toMatchObject({ flagged: true, sources: [] });
  });

  it('reads the marker of the answer only, not of text before a lookup call', async () => {
    const before = [sseFrame({ content: `${GENERAL_KNOWLEDGE_MARKER}\nLet me look.` }), ...lookupCall({ sections: 'Traits#how-to-add-a-trait' })];
    const done = doneOf(await collect(ask('How do I add a trait?', script(before, sseReply('Select **Add Trait**.')), { snapshot: LOOKUP })));

    expect(done).toMatchObject({ text: 'Select **Add Trait**.', flagged: false });
  });
});

describe('the general-knowledge flag in the follow-up history', () => {
  const historyOf = (fetchImpl: FetchSpy) =>
    (JSON.parse(fetchImpl.mock.calls[0][1].body as string) as { messages: { role: string; content: string }[] }).messages
      .filter((message) => message.role === 'assistant')
      .map((message) => message.content);

  it('gives a flagged earlier answer its marker back, alone on the first line', async () => {
    const fetchImpl = script(sseReply('Select **Add Trait**.'));
    await collect(ask('And then?', fetchImpl, { history: [{ question: 'What is a trait?', answer: 'A trait is a tag.', flagged: true }] }));

    expect(historyOf(fetchImpl)).toEqual([`${GENERAL_KNOWLEDGE_MARKER}\nA trait is a tag.`]);
  });

  it('gives a grounded earlier answer no marker', async () => {
    const fetchImpl = script(sseReply('Select **Add Trait**.'));
    await collect(ask('And then?', fetchImpl, { history: [
      { question: 'How do I add a stat?', answer: 'Select **Add Stat**.', flagged: false },
      { question: 'What is a trait?', answer: 'A trait is a tag.' },
    ] }));

    expect(historyOf(fetchImpl)).toEqual(['Select **Add Stat**.', 'A trait is a tag.']);
  });
});
