import { describe, expect, it, vi } from 'vitest';
import { AiStreamError } from '@/lib/aiRequest/aiStream';
import { DEFAULT_TOOL_ROUND_CAP } from '@/lib/aiRequest/toolLoop';
import { createDocsIndex } from '@/lib/docs/docsIndex';
import { languageDirective } from '@/lib/languages';
import { UNKNOWN_REASONING_CAPABILITY, type ReasoningCapability } from '@/lib/reasoningEffort';
import { toolSchema } from '@/lib/tools/toolSchema';
import { openSseReply, sseFrame, sseReply, sseResponse, textSnapshot, textTarget } from '@/test/aiTextFixtures';
import { pastPicks } from '@/test/helpFixtures';
import { DOCS_LOOKUP, DOCS_LOOKUP_CALL_LIMIT } from './docsLookup';
import { askHelp, helpSections, HELP_DOCS_CHAR_BUDGET, HELP_LOOKUP_CHAR_BUDGET, type HelpEvent, type HelpQuestion } from './helpSession';
import { DEFAULT_HELP_SETTINGS, helpSettingsOf } from './helpSettings';

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

// The Mascot is off, so the face call stays out of the offered functions.
const ask = (question: string, fetchImpl: FetchSpy, over: Partial<HelpQuestion> = {}) =>
  askHelp({ question, settings: helpSettingsOf({ lookup: true, mascot: false }), snapshot: CAPABLE, index, fetchImpl: pastPicks(fetchImpl), ...over });

async function collect(events: AsyncIterable<HelpEvent>): Promise<HelpEvent[]> {
  const all: HelpEvent[] = [];
  for await (const event of events) all.push(event);
  return all;
}
const sourcesOf = (events: HelpEvent[]) => {
  const done = events.at(-1);
  return done?.type === 'done' ? done.sources.map((section) => section.id) : null;
};

const TRAIT = 'How do I add a trait?';
/** A question with more than one section over the score floor. */
const TRAIT_ON_STAT = 'How do I add a trait to a stat?';
/** The ids of the sections the search puts in the prompt for a question. */
const hitIds = (question: string, over: Parameters<typeof helpSections>[2] = {}) => helpSections(index, question, over).map((section) => section.id);
/** The ids of the guide's sections in the order the reader lists them. */
const allIds = index.contents().flatMap((page) => page.sections.map((section) => section.id));

describe('lookup mode, as shipped', () => {
  it('offers no lookup function on a tool-capable endpoint, and sends the retrieval request', async () => {
    const shipped = script(sseReply('Select **Add Trait**.'));
    await collect(ask(TRAIT, shipped, { settings: DEFAULT_HELP_SETTINGS }));
    const retrieval = script(sseReply('Select **Add Trait**.'));
    await collect(ask(TRAIT, retrieval, { settings: helpSettingsOf({ lookup: false }) }));

    const names = ((bodyOf(shipped).tools ?? []) as { function: { name: string } }[]).map((tool) => tool.function.name);
    expect(names).not.toContain(DOCS_LOOKUP.name);
    expect(bodyOf(shipped)).toEqual(bodyOf(retrieval));
  });
});

describe('lookup mode, on an endpoint known to take function calls', () => {
  it('offers the lookup function with every search hit under the retrieval budget, as retrieval mode sends them', async () => {
    const lookupFetch = script(sseReply('Select **Add Trait**.'));
    const events = await collect(ask(TRAIT_ON_STAT, lookupFetch));
    const retrievalFetch = script(sseReply('Select **Add Trait**.'));
    const retrieval = await collect(ask(TRAIT_ON_STAT, retrievalFetch, { snapshot: endpoint(false) }));

    const body = bodyOf(lookupFetch);
    expect(body.tools).toEqual([toolSchema(DOCS_LOOKUP)]);
    expect(body.tool_choice).toBe('auto');
    const user = lastUser(body);
    const hits = hitIds(TRAIT_ON_STAT);
    expect(hits.length).toBeGreaterThan(1);
    expect([...user.matchAll(/<section id="([^"]+)">/g)].map((match) => match[1])).toEqual(hits);
    expect(user).toContain('<section id="Traits#how-to-add-a-trait">\n## How to Add a Trait\n\n1. Open the **Traits** tab.\n2. Select **Add Trait**.\n</section>');
    expect(user).toContain(`Question: ${TRAIT_ON_STAT}`);
    expect(body.messages[0].content).toContain(DOCS_LOOKUP.name);
    expect(sourcesOf(events)).toEqual(hits);
    expect(sourcesOf(retrieval)).toEqual(hits);
  });

  it('holds no contents list: no id of a section outside the prompt is in the request', async () => {
    const fetchImpl = script(sseReply('Select **Add Trait**.'));
    await collect(ask(TRAIT, fetchImpl));
    const body = bodyOf(fetchImpl);
    const request = body.messages.map((message) => message.content ?? '').join('\n');
    const unsent = allIds.filter((id) => !hitIds(TRAIT).includes(id));
    expect(unsent.length).toBeGreaterThan(2);
    for (const id of unsent) {
      expect(request, id).not.toContain(id);
      if (id.includes('#')) expect(request, id).not.toContain(id.slice(id.indexOf('#')));
    }
    expect(request).not.toContain('<contents>');
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
    expect(sourcesOf(events)).toEqual(['Library#how-to-make-a-folder', ...hitIds('How do I put a world away after I import it?')]);
  });

  it('reports the sections of a search call as sources', async () => {
    const fetchImpl = script(callFrames({ search: 'folder' }), sseReply('Select **New Folder**.'));
    const events = await collect(ask(TRAIT, fetchImpl));
    expect(toolResults(bodyOf(fetchImpl, 1))[0]).toContain('1. Select **New Folder**.');
    expect(sourcesOf(events)).toEqual(['Library#how-to-make-a-folder', ...hitIds(TRAIT)]);
  });

  it('answers from the sections in the prompt when the model calls nothing', async () => {
    const fetchImpl = script(sseReply('Select **Add Trait**.'));
    const events = await collect(ask(TRAIT, fetchImpl));
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(events.at(-1)).toMatchObject({ type: 'done', text: 'Select **Add Trait**.' });
    expect(sourcesOf(events)).toEqual(hitIds(TRAIT));
  });

  it('holds no section when no word of the question is in the guide, and still offers the function', async () => {
    const fetchImpl = script(sseReply('The guide does not cover this.'));
    const events = await collect(ask('quasar', fetchImpl));
    const body = bodyOf(fetchImpl);
    expect(body.tools).toHaveLength(1);
    expect(lastUser(body)).not.toContain('<section ');
    expect(lastUser(body)).not.toContain('<guide>');
    expect(sourcesOf(events)).toEqual([]);
  });

  it('drops the text of a round that ends in a call from the answer', async () => {
    const fetchImpl = script(
      [sseFrame({ content: 'Let me read the guide.' }), ...callFrames({ sections: 'Library#how-to-make-a-folder' })],
      sseReply('Select **New Folder**.'),
    );
    const events = await collect(ask(TRAIT, fetchImpl));
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
    // The follow-up has no keywords: the sections in the prompt come from the earlier question.
    expect(sourcesOf(events)).toContain('Library#how-to-import-a-world');
    expect(sourcesOf(events)).toEqual(hitIds('and then?', { history }));
  });
});

describe('retrieval mode, on an endpoint not known to take function calls', () => {
  it.each([
    ['says it takes none', false],
    ['has not answered', null],
  ])('offers no function and sends the matching sections when the endpoint %s', async (_name, tools) => {
    const fetchImpl = script(sseReply('Select **Add Trait**.'));
    const events = await collect(ask(TRAIT_ON_STAT, fetchImpl, { snapshot: endpoint(tools) }));

    const body = bodyOf(fetchImpl);
    expect(body).not.toHaveProperty('tools');
    expect(body).not.toHaveProperty('tool_choice');
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
    const failure = await collect(ask(TRAIT, fetchImpl, { snapshot: endpoint(tools) })).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(AiStreamError);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('ends the question when the round after a call fails, with no request after it', async () => {
    const fetchImpl = script(callFrames({ sections: 'Library#how-to-make-a-folder' }), overloaded);
    const failure = await collect(ask(TRAIT, fetchImpl)).catch((error: unknown) => error);
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
    const events = await collect(ask(TRAIT, fetchImpl));

    const second = bodyOf(fetchImpl, 1);
    expect(toolResults(second)[0]).toContain('"Library#how-to-make-folders"');
    expect(toolResults(second)[0]).toContain('Library#how-to-make-a-folder');
    expect(second.tools).toHaveLength(1);
    expect(events.at(-1)).toMatchObject({ type: 'done', text: 'Select **New Folder**.' });
    expect(sourcesOf(events)).toEqual(['Library#how-to-make-a-folder', ...hitIds(TRAIT)]);
  });

  it('reads a section by an id that an earlier result showed', async () => {
    // The second call passes the first near id the first result shows, whatever it is.
    let shown = '';
    const fetchImpl: FetchSpy = vi.fn(async (_url: string, init: RequestInit) => {
      const results = toolResults(JSON.parse(init.body as string) as SentBody);
      if (results.length === 0) return sseResponse(callFrames({ sections: 'Library#how-to-make-folders' }));
      if (results.length === 1) {
        shown = /Ids near it: ([^,.]+)/.exec(results[0])?.[1] ?? '';
        return sseResponse(callFrames({ sections: shown }));
      }
      return sseResponse(sseReply('Select **New Folder**.'));
    });
    const events = await collect(ask(TRAIT, fetchImpl));

    expect(shown).toBe('Library#how-to-make-a-folder');
    expect(toolResults(bodyOf(fetchImpl, 2))[1]).toContain(`<section id="${shown}">`);
    expect(sourcesOf(events)).toEqual([shown, ...hitIds(TRAIT)]);
  });

  it('withdraws the function after a call it cannot read, and the model answers from the prompt', async () => {
    const fetchImpl = script(callFrames('Library'), sseReply('Select **Add Trait**.'));
    const events = await collect(ask(TRAIT, fetchImpl));
    expect(bodyOf(fetchImpl, 1)).not.toHaveProperty('tools');
    expect(events.at(-1)).toMatchObject({ type: 'done', text: 'Select **Add Trait**.' });
    expect(sourcesOf(events)).toEqual(hitIds(TRAIT));
  });
});

describe('a model that calls without end', () => {
  // The search finds nothing for this question, so each call reads a section the prompt does not hold.
  const NOTHING = 'quasar';
  const SECTIONS = allIds.slice(0, DOCS_LOOKUP_CALL_LIMIT + 2);

  it('stops at the call limit: one more round reports the limit, the next offers no function', async () => {
    // Each request gets a call for a section the model has not read yet, whatever the request offers.
    let request = 0;
    const fetchImpl: FetchSpy = vi.fn(async () => sseResponse(callFrames({ sections: SECTIONS[request++ % SECTIONS.length] })));
    const failure = await collect(ask(NOTHING, fetchImpl)).catch((error: unknown) => error);

    // A model that never writes an answer ends as an empty answer, after a bounded count of requests.
    expect((failure as Error).message).toContain('empty answer');
    // The call limit ends the question two requests after the last call it allows. The loop's round cap is
    // the bound for a limit that high; the tool loop's own tests prove the cap.
    expect(DOCS_LOOKUP_CALL_LIMIT + 2).toBeLessThanOrEqual(DEFAULT_TOOL_ROUND_CAP);
    expect(fetchImpl).toHaveBeenCalledTimes(DOCS_LOOKUP_CALL_LIMIT + 2);
    const last = bodyOf(fetchImpl, fetchImpl.mock.calls.length - 1);
    expect(last).not.toHaveProperty('tools');
    const results = toolResults(last);
    expect(results.filter((text) => text.startsWith('<section '))).toHaveLength(DOCS_LOOKUP_CALL_LIMIT);
    expect(results.at(-1)).toContain('limit');
  });

  it('takes its call limit from the settings', async () => {
    let request = 0;
    const fetchImpl: FetchSpy = vi.fn(async () => sseResponse(callFrames({ sections: SECTIONS[request++ % SECTIONS.length] })));
    const failure = await collect(ask(NOTHING, fetchImpl, { settings: helpSettingsOf({ lookup: true, lookupCallLimit: 1 }) })).catch((error: unknown) => error);

    expect((failure as Error).message).toContain('empty answer');
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    const results = toolResults(bodyOf(fetchImpl, 2));
    expect(results.filter((text) => text.startsWith('<section '))).toHaveLength(1);
    expect(results.at(-1)).toContain('limit of 1 call');
  });

  it('counts the calls of one round against the limit, and the answer after them reports what was read', async () => {
    const fetchImpl = script(
      callFrames(...SECTIONS.slice(0, DOCS_LOOKUP_CALL_LIMIT + 2).map((sections) => ({ sections }))),
      sseReply('Select **Add Stat**.'),
    );
    const events = await collect(ask(NOTHING, fetchImpl));

    const second = bodyOf(fetchImpl, 1);
    expect(second).not.toHaveProperty('tools');
    expect(toolResults(second).filter((text) => text.startsWith('<section '))).toHaveLength(DOCS_LOOKUP_CALL_LIMIT);
    expect(sourcesOf(events)).toEqual(SECTIONS.slice(0, DOCS_LOOKUP_CALL_LIMIT));
  });
});

describe('the docs text of one question', () => {
  it('does not send the section in the prompt again when the model asks for it', async () => {
    const fetchImpl = script(callFrames({ sections: 'Traits#how-to-add-a-trait' }), sseReply('Select **Add Trait**.'));
    const events = await collect(ask(TRAIT, fetchImpl));
    const [result] = toolResults(bodyOf(fetchImpl, 1));
    expect(result).toContain('Traits#how-to-add-a-trait');
    expect(result).not.toContain('Select **Add Trait**');
    expect(sourcesOf(events)).toEqual(hitIds(TRAIT));
  });

  it('gives the fetched text a budget of its own, in addition to the sections in the prompt', async () => {
    // Each section is about 5,250 characters, so two fit in each budget and a third does not.
    const zebras = createDocsIndex({
      pages: Object.fromEntries(Array.from({ length: 6 }, (_, n) => [`Page${n}`, `## Zebra ${n}\n\n${'A zebra has stripes. '.repeat(250)}`])),
    });
    const size = zebras.search('zebra', 1)[0].markdown.length;
    expect(Math.floor(HELP_DOCS_CHAR_BUDGET / size)).toBe(2);
    expect(Math.floor(HELP_LOOKUP_CHAR_BUDGET / size)).toBe(2);
    const inPrompt = helpSections(zebras, 'zebra').map((section) => section.id);
    expect(inPrompt).toHaveLength(2);
    const [first, second, third] = zebras.search('zebra', 6).map((section) => section.id).filter((id) => !inPrompt.includes(id));
    const fetchImpl = script(callFrames({ sections: `${first}, ${second}, ${third}` }), sseReply('Zebras have stripes.'));
    const events = await collect(ask('zebra', fetchImpl, { index: zebras }));

    const [result] = toolResults(bodyOf(fetchImpl, 1));
    expect(result).toContain(`<section id="${first}">`);
    expect(result).toContain(`<section id="${second}">`);
    expect(result).not.toContain(`<section id="${third}">`);
    expect(result).toContain(third);
    expect(sourcesOf(events)).toEqual([first, second, ...inPrompt]);
  });
});

describe('stop, after a call', () => {
  it('keeps the answer so far and the sections read', async () => {
    const reply = openSseReply([sseFrame({ content: '1. Select **New Folder**.' })]);
    const fetchImpl = script(callFrames({ sections: 'Library#how-to-make-a-folder' }), () => reply.respond());
    const stop = new AbortController();
    const events: HelpEvent[] = [];
    for await (const event of ask(TRAIT, fetchImpl, { signal: stop.signal })) {
      events.push(event);
      if (event.type === 'answer') stop.abort();
    }
    expect(events.at(-1)).toMatchObject({ type: 'done', text: '1. Select **New Folder**.', stopped: true });
    expect(sourcesOf(events)).toEqual(['Library#how-to-make-a-folder', ...hitIds(TRAIT)]);
    expect(reply.cancel).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
