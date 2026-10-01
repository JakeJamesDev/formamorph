import { describe, expect, it, vi } from 'vitest';
import { AiStreamError } from '@/lib/aiRequest/aiStream';
import { DEFAULT_TOOL_ROUND_CAP } from '@/lib/aiRequest/toolLoop';
import { createDocsIndex } from '@/lib/docs/docsIndex';
import { languageDirective } from '@/lib/languages';
import { UNKNOWN_REASONING_CAPABILITY, type ReasoningCapability } from '@/lib/reasoningEffort';
import { toolSchema } from '@/lib/tools/toolSchema';
import { openSseReply, sseFrame, sseReply, sseResponse, textSnapshot, textTarget } from '@/test/aiTextFixtures';
import { docsContents, DOCS_LOOKUP, DOCS_LOOKUP_CALL_LIMIT } from './docsLookup';
import { askHelp, type HelpEvent, type HelpQuestion } from './helpSession';

const PAGES = {
  Stats: '# 📊 Stats\n\nStats are numbers.\n\n## How to Add a Stat\n\n1. Open the **Stats** tab.\n2. Select **Add Stat**.\n',
  Traits: '# 🧬 Traits\n\nA trait changes a stat.\n\n## How to Add a Trait\n\n1. Open the **Traits** tab.\n2. Select **Add Trait**.\n',
  Library: '# 📚 Library\n\nThe library holds worlds.\n\n## How to Import a World\n\n1. Select **Import**.\n\n## How to Make a Folder\n\n1. Select **New Folder**.\n',
};
const index = createDocsIndex({ pages: PAGES, sidebar: '- [Stats](Stats)\n- [Traits](Traits)\n- [Library](Library)\n' });

/** An endpoint and model with a known answer to "does it take function calls?". */
const endpoint = (tools: boolean | null) => {
  const reasoning: ReasoningCapability = { ...UNKNOWN_REASONING_CAPABILITY, tools, sources: tools === null ? {} : { tools: 'native' } };
  return textSnapshot(textTarget({ reasoning }));
};
const CAPABLE = endpoint(true);

interface SentMessage { role: string; content: string | null; tool_calls?: { function: { name: string; arguments: string } }[] }
interface SentBody { messages: SentMessage[]; tools?: unknown[]; tool_choice?: string }
type FetchSpy = ReturnType<typeof vi.fn<(url: string, init: RequestInit) => Promise<Response>>>;

const bodyOf = (spy: FetchSpy, request = 0) => JSON.parse(spy.mock.calls[request][1].body as string) as SentBody;
const lastUser = (body: SentBody) => body.messages.filter((message) => message.role === 'user').at(-1)?.content ?? '';
const toolResults = (body: SentBody) => body.messages.filter((message) => message.role === 'tool').map((message) => message.content ?? '');

/** The frames of a reply that calls the lookup once per argument set. */
const callFrames = (...calls: unknown[]): string[] => [
  ...calls.map((args, at) => sseFrame({ tool_calls: [{ index: at, id: `srv-${at}`, type: 'function', function: { name: DOCS_LOOKUP.name, arguments: JSON.stringify(args) } }] })),
  sseFrame({}, 'tool_calls'),
  'data: [DONE]\n\n',
];

/** A fetch that answers request N with the Nth reply. A reply past the script fails the test. */
const script = (...replies: (string[] | (() => Response))[]): FetchSpy => {
  let request = 0;
  return vi.fn(async () => {
    const reply = replies[request++];
    if (!reply) throw new Error(`request ${request} has no scripted reply`);
    return typeof reply === 'function' ? reply() : sseResponse(reply);
  });
};

const ask = (question: string, fetchImpl: FetchSpy, over: Partial<HelpQuestion> = {}) =>
  askHelp({ question, snapshot: CAPABLE, index, fetchImpl: fetchImpl as unknown as typeof fetch, ...over });

async function collect(events: AsyncIterable<HelpEvent>): Promise<HelpEvent[]> {
  const all: HelpEvent[] = [];
  for await (const event of events) all.push(event);
  return all;
}
const sourcesOf = (events: HelpEvent[]) => {
  const done = events.at(-1);
  return done?.type === 'done' ? done.sources.map((section) => section.id) : null;
};

describe('lookup mode, on an endpoint known to take function calls', () => {
  it('offers the lookup function with the contents list and the best search hit, and nothing else of the guide', async () => {
    const fetchImpl = script(sseReply('Select **Add Trait**.'));
    await collect(ask('How do I add a trait?', fetchImpl));

    const body = bodyOf(fetchImpl);
    expect(body.tools).toEqual([toolSchema(DOCS_LOOKUP)]);
    expect(body.tool_choice).toBe('auto');
    const user = lastUser(body);
    expect(user).toContain(docsContents(index));
    expect(user).toContain('<section id="Traits#how-to-add-a-trait">\n## How to Add a Trait\n\n1. Open the **Traits** tab.\n2. Select **Add Trait**.\n</section>');
    expect(user).toContain('Question: How do I add a trait?');
    expect(user.match(/<section /g)).toHaveLength(1);
    expect(body.messages[0].content).toContain(DOCS_LOOKUP.name);
  });

  it('runs the call, sends the section text back, and reports the fetched sections first as the sources', async () => {
    const fetchImpl = script(
      callFrames({ sections: 'Library#how-to-make-a-folder' }),
      [sseFrame({ content: 'Select' }), ...sseReply(' **New Folder**.')],
    );
    // The words of the question match the import section, and the answer is in the folder section.
    const events = await collect(ask('How do I put a world away after I import it?', fetchImpl));

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const second = bodyOf(fetchImpl, 1);
    expect(second.messages.at(-2)?.tool_calls?.[0].function).toEqual({ name: DOCS_LOOKUP.name, arguments: '{"sections":"Library#how-to-make-a-folder"}' });
    expect(toolResults(second)).toEqual(['<section id="Library#how-to-make-a-folder">\n## How to Make a Folder\n\n1. Select **New Folder**.\n</section>']);
    expect(events.filter((event) => event.type === 'answer').map((event) => event.text)).toEqual(['Select', 'Select **New Folder**.']);
    expect(events.at(-1)).toMatchObject({ type: 'done', text: 'Select **New Folder**.', stopped: false });
    expect(sourcesOf(events)).toEqual(['Library#how-to-make-a-folder', 'Library#how-to-import-a-world']);
  });

  it('reports the sections of a search call as sources', async () => {
    const fetchImpl = script(callFrames({ search: 'folder' }), sseReply('Select **New Folder**.'));
    const events = await collect(ask('How do I add a trait?', fetchImpl));
    expect(toolResults(bodyOf(fetchImpl, 1))[0]).toContain('1. Select **New Folder**.');
    expect(sourcesOf(events)).toEqual(['Library#how-to-make-a-folder', 'Traits#how-to-add-a-trait']);
  });

  it('answers from the section in the prompt when the model calls nothing', async () => {
    const fetchImpl = script(sseReply('Select **Add Trait**.'));
    const events = await collect(ask('How do I add a trait?', fetchImpl));
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(events.at(-1)).toMatchObject({ type: 'done', text: 'Select **Add Trait**.' });
    expect(sourcesOf(events)).toEqual(['Traits#how-to-add-a-trait']);
  });

  it('holds no section when no word of the question is in the guide, and still offers the function', async () => {
    const fetchImpl = script(sseReply('The guide does not cover this.'));
    const events = await collect(ask('quasar', fetchImpl));
    const body = bodyOf(fetchImpl);
    expect(body.tools).toHaveLength(1);
    expect(lastUser(body)).not.toContain('<section ');
    expect(sourcesOf(events)).toEqual([]);
  });

  it('drops the text of a round that ends in a call from the answer', async () => {
    const fetchImpl = script(
      [sseFrame({ content: 'Let me read the guide.' }), ...callFrames({ sections: 'Library#how-to-make-a-folder' })],
      sseReply('Select **New Folder**.'),
    );
    const events = await collect(ask('How do I add a trait?', fetchImpl));
    const answers = events.filter((event) => event.type === 'answer').map((event) => event.text);
    expect(answers).toEqual(['Let me read the guide.', '', 'Select **New Folder**.']);
    expect(events.at(-1)).toMatchObject({ type: 'done', text: 'Select **New Folder**.' });
  });

  it('carries the earlier exchanges and the AI Language, as retrieval mode does', async () => {
    const fetchImpl = script(sseReply('Hecho.'));
    const history = [{ question: 'How do I import a world?', answer: '1. Select **Import**.' }];
    const events = await collect(ask('and then?', fetchImpl, { history, language: 'Spanish' }));

    const { messages } = bodyOf(fetchImpl);
    expect(messages.slice(1, -1)).toEqual([
      { role: 'user', content: 'How do I import a world?' },
      { role: 'assistant', content: '1. Select **Import**.' },
    ]);
    expect(messages[0].content).toContain(languageDirective('answers', 'Spanish'));
    // The follow-up has no keywords: the section in the prompt comes from the earlier question.
    expect(sourcesOf(events)).toEqual(['Library#how-to-import-a-world']);
  });
});

describe('retrieval mode, on an endpoint not known to take function calls', () => {
  it.each([
    ['says it takes none', false],
    ['has not answered', null],
  ])('offers no function and sends the matching sections when the endpoint %s', async (_name, tools) => {
    const fetchImpl = script(sseReply('Select **Add Trait**.'));
    const events = await collect(ask('How do I add a trait?', fetchImpl, { snapshot: endpoint(tools) }));

    const body = bodyOf(fetchImpl);
    expect(body).not.toHaveProperty('tools');
    expect(body).not.toHaveProperty('tool_choice');
    expect(lastUser(body)).not.toContain(docsContents(index));
    expect(lastUser(body)).toContain('<section page="Traits">');
    expect(body.messages[0].content).not.toContain(DOCS_LOOKUP.name);
    expect(sourcesOf(events)?.length).toBeGreaterThan(1);
  });
});

describe('a request that fails', () => {
  const overloaded = () => new Response('{"error":{"message":"model overloaded"}}', { status: 503 });

  it.each([
    ['lookup', true],
    ['retrieval', false],
  ])('is not sent again in %s mode', async (_name, tools) => {
    const fetchImpl: FetchSpy = vi.fn(async () => overloaded());
    const failure = await collect(ask('How do I add a trait?', fetchImpl, { snapshot: endpoint(tools) })).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(AiStreamError);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('ends the question when the round after a call fails, with no request after it', async () => {
    const fetchImpl = script(callFrames({ sections: 'Library#how-to-make-a-folder' }), overloaded);
    const failure = await collect(ask('How do I add a trait?', fetchImpl)).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(AiStreamError);
    expect((failure as AiStreamError).details).toContain('model overloaded');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});

describe('a bad call', () => {
  it('answers an unknown section id with the ids near it, keeps the function offered, and the answer completes', async () => {
    const fetchImpl = script(
      callFrames({ sections: 'Library#how-to-make-folders' }),
      callFrames({ sections: 'Library#how-to-make-a-folder' }),
      sseReply('Select **New Folder**.'),
    );
    const events = await collect(ask('How do I add a trait?', fetchImpl));

    const second = bodyOf(fetchImpl, 1);
    expect(toolResults(second)[0]).toContain('"Library#how-to-make-folders"');
    expect(toolResults(second)[0]).toContain('Library#how-to-make-a-folder');
    expect(second.tools).toHaveLength(1);
    expect(events.at(-1)).toMatchObject({ type: 'done', text: 'Select **New Folder**.' });
    expect(sourcesOf(events)).toEqual(['Library#how-to-make-a-folder', 'Traits#how-to-add-a-trait']);
  });

  it('withdraws the function after a call it cannot read, and the model answers from the prompt', async () => {
    const fetchImpl = script(callFrames('Library'), sseReply('Select **Add Trait**.'));
    const events = await collect(ask('How do I add a trait?', fetchImpl));
    expect(bodyOf(fetchImpl, 1)).not.toHaveProperty('tools');
    expect(events.at(-1)).toMatchObject({ type: 'done', text: 'Select **Add Trait**.' });
    expect(sourcesOf(events)).toEqual(['Traits#how-to-add-a-trait']);
  });
});

describe('a model that calls without end', () => {
  const SECTIONS = ['Stats#-stats', 'Stats#how-to-add-a-stat', 'Library#-library', 'Library#how-to-import-a-world', 'Library#how-to-make-a-folder', 'Traits#-traits'];

  it('stops at the call limit: one more round reports the limit, the next offers no function', async () => {
    // Each request gets a call for a section the model has not read yet, whatever the request offers.
    let request = 0;
    const fetchImpl: FetchSpy = vi.fn(async () => sseResponse(callFrames({ sections: SECTIONS[request++ % SECTIONS.length] })));
    const failure = await collect(ask('How do I add a trait?', fetchImpl)).catch((error: unknown) => error);

    // A model that never writes an answer ends as an empty answer, after a bounded count of requests.
    expect((failure as Error).message).toContain('empty answer');
    expect(fetchImpl).toHaveBeenCalledTimes(DOCS_LOOKUP_CALL_LIMIT + 2);
    expect(fetchImpl.mock.calls.length).toBeLessThanOrEqual(DEFAULT_TOOL_ROUND_CAP);
    const last = bodyOf(fetchImpl, fetchImpl.mock.calls.length - 1);
    expect(last).not.toHaveProperty('tools');
    const results = toolResults(last);
    expect(results.filter((text) => text.startsWith('<section '))).toHaveLength(DOCS_LOOKUP_CALL_LIMIT);
    expect(results.at(-1)).toContain('limit');
  });

  it('counts the calls of one round against the limit, and the answer after them reports what was read', async () => {
    const fetchImpl = script(
      callFrames(...SECTIONS.slice(0, DOCS_LOOKUP_CALL_LIMIT + 2).map((sections) => ({ sections }))),
      sseReply('Select **Add Stat**.'),
    );
    const events = await collect(ask('How do I add a trait?', fetchImpl));

    const second = bodyOf(fetchImpl, 1);
    expect(second).not.toHaveProperty('tools');
    expect(toolResults(second).filter((text) => text.startsWith('<section '))).toHaveLength(DOCS_LOOKUP_CALL_LIMIT);
    expect(sourcesOf(events)).toEqual([...SECTIONS.slice(0, DOCS_LOOKUP_CALL_LIMIT), 'Traits#how-to-add-a-trait']);
  });
});

describe('the docs text of one question', () => {
  it('does not send the section in the prompt again when the model asks for it', async () => {
    const fetchImpl = script(callFrames({ sections: 'Traits#how-to-add-a-trait' }), sseReply('Select **Add Trait**.'));
    const events = await collect(ask('How do I add a trait?', fetchImpl));
    const [result] = toolResults(bodyOf(fetchImpl, 1));
    expect(result).toContain('Traits#how-to-add-a-trait');
    expect(result).not.toContain('Select **Add Trait**');
    expect(sourcesOf(events)).toEqual(['Traits#how-to-add-a-trait']);
  });

  it('counts the section in the prompt against the budget of the fetched text', async () => {
    // Each section is about 5,000 characters: the one in the prompt and one fetched fit in 12,000, a third does not.
    const zebras = createDocsIndex({
      pages: Object.fromEntries(Array.from({ length: 4 }, (_, n) => [`Page${n}`, `## Zebra ${n}\n\n${'A zebra has stripes. '.repeat(250)}`])),
    });
    const [inPrompt, second, third] = zebras.search('zebra', 3).map((section) => section.id);
    const fetchImpl = script(callFrames({ sections: `${second}, ${third}` }), sseReply('Zebras have stripes.'));
    const events = await collect(ask('zebra', fetchImpl, { index: zebras }));

    const [result] = toolResults(bodyOf(fetchImpl, 1));
    expect(result).toContain(`<section id="${second}">`);
    expect(result).not.toContain(`<section id="${third}">`);
    expect(result).toContain(third);
    expect(sourcesOf(events)).toEqual([second, inPrompt]);
  });
});

describe('stop, after a call', () => {
  it('keeps the answer so far and the sections read', async () => {
    const reply = openSseReply([sseFrame({ content: '1. Select **New Folder**.' })]);
    const fetchImpl = script(callFrames({ sections: 'Library#how-to-make-a-folder' }), () => reply.respond());
    const stop = new AbortController();
    const events: HelpEvent[] = [];
    for await (const event of ask('How do I add a trait?', fetchImpl, { signal: stop.signal })) {
      events.push(event);
      if (event.type === 'answer') stop.abort();
    }
    expect(events.at(-1)).toMatchObject({ type: 'done', text: '1. Select **New Folder**.', stopped: true });
    expect(sourcesOf(events)).toEqual(['Library#how-to-make-a-folder', 'Traits#how-to-add-a-trait']);
    expect(reply.cancel).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
