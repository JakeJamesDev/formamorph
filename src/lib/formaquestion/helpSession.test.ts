import { describe, expect, it, vi } from 'vitest';
import { createDocsIndex } from '@/lib/docs/docsIndex';
import { defaultEndpointSamplerOverrides } from '@/lib/endpointSamplers';
import { reasoningCapabilityFromLevels } from '@/lib/reasoningEffort';
import { openSseReply, sseFrame, sseReply, sseResponse, textSnapshot, textTarget } from '@/test/aiTextFixtures';
import { pastPicks, VOICED_HELP_PROMPT } from '@/test/helpFixtures';
import { AiStreamError } from '@/lib/aiRequest/aiStream';
import type { AIRequestType, ImageAttachment } from '@/types';
import { languageDirective } from '@/lib/languages';
import {
  askHelp, helpSections, HELP_DOCS_CHAR_BUDGET, HELP_SCORE_FLOOR, type EarlierExchange, type HelpEvent, type HelpQuestion,
} from './helpSession';
import { DEFAULT_HELP_PRESET_ID, duplicateHelpPreset, editHelpOptions, EMPTY_HELP_PRESET_STORE } from './helpPresets';
import { DEFAULT_HELP_SETTINGS, helpSettingsOf } from './helpSettings';

const PAGES = {
  Stats: '# 📊 Stats\n\nStats are numbers.\n\n## How to Add a Stat\n\n1. Open the **Stats** tab.\n2. Select **Add Stat**.\n',
  Traits: '# 🧬 Traits\n\nA trait changes a stat.\n\n## How to Add a Trait\n\n1. Open the **Traits** tab.\n2. Select **Add Trait**.\n',
  Library: '# 📚 Library\n\nThe library holds worlds.\n\n## How to Import a World\n\n1. Select **Import**.\n',
};
const index = createDocsIndex({ pages: PAGES, sidebar: '- [Stats](Stats)\n- [Traits](Traits)\n- [Library](Library)\n' });

type FetchSpy = ReturnType<typeof vi.fn<(url: string, init: RequestInit) => Promise<Response>>>;

/** A fetch that answers every request with one streamed reply. */
const replyWith = (chunks: string[]): FetchSpy => vi.fn(async () => sseResponse(chunks));

const bodyOf = (spy: FetchSpy, call = 0) => JSON.parse(spy.mock.calls[call][1].body as string) as {
  messages: { role: string; content: string }[];
} & Record<string, unknown>;

/** One help question against the fixture docs. The fake fetch gets the answer request; the pick request picks nothing. */
const ask = (question: string, fetchImpl: FetchSpy, over: Partial<HelpQuestion> = {}) =>
  askHelp({ question, settings: DEFAULT_HELP_SETTINGS, snapshot: textSnapshot(), index, fetchImpl: pastPicks(fetchImpl), ...over });

/** The answer events of a question. The trace and stage events have their own test files. */
async function collect(events: AsyncIterable<HelpEvent>): Promise<Exclude<HelpEvent, { type: 'trace' | 'stage' | 'face' }>[]> {
  const all: Exclude<HelpEvent, { type: 'trace' | 'stage' | 'face' }>[] = [];
  for await (const event of events) if (event.type !== 'trace' && event.type !== 'stage' && event.type !== 'face') all.push(event);
  return all;
}

describe('a help question', () => {
  it('sends one request that holds the matching docs sections, and yields the streamed answer and its sources', async () => {
    const fetchImpl = replyWith([sseFrame({ content: 'Open the **Traits** tab' }), ...sseReply(', then select **Add Trait**.')]);
    const events = await collect(ask('How do I add a trait?', fetchImpl));

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const { messages } = bodyOf(fetchImpl);
    const user = messages.filter((message) => message.role === 'user');
    expect(user).toHaveLength(1);
    expect(user[0].content).toContain('## How to Add a Trait\n\n1. Open the **Traits** tab.\n2. Select **Add Trait**.');
    expect(user[0].content).toContain('How do I add a trait?');

    expect(events.filter((event) => event.type === 'answer').map((event) => event.text)).toEqual([
      'Open the **Traits** tab',
      'Open the **Traits** tab, then select **Add Trait**.',
    ]);
    const done = events.at(-1);
    expect(done).toMatchObject({ type: 'done', text: 'Open the **Traits** tab, then select **Add Trait**.', stopped: false });
    expect(done?.type === 'done' && done.sources[0].id).toBe('Traits#how-to-add-a-trait');
  });

  it('sends as the help kind: the endpoint that kind resolves to, reasoning off, its own samplers', async () => {
    const fetchImpl = replyWith(sseReply('Select **Add Stat**.'));
    // A model that reasons by default, on an endpoint whose own sampler switches are on.
    const overrides = defaultEndpointSamplerOverrides();
    const target = textTarget({
      url: 'https://help.example.com/v1/chat/completions',
      reasoning: { ...reasoningCapabilityFromLevels([], 'probe'), reasons: true, dialect: 'novita' },
      samplerOverrides: {
        ...overrides,
        temperature: { enabled: true, value: 1.3 },
        repetitionPenalty: { enabled: true, value: 1.25 },
      },
    });
    const resolveTarget = vi.fn((_kind: AIRequestType) => target);
    const snapshot = textSnapshot(target, { resolveTarget, reasoningEngaged: true, reasoningEffort: 'high', promptReasoning: { help: 'high' } });
    await collect(ask('How do I add a stat?', fetchImpl, { snapshot }));

    expect(new Set(resolveTarget.mock.calls.map(([kind]) => kind))).toEqual(new Set(['help']));
    expect(fetchImpl.mock.calls[0][0]).toBe('https://help.example.com/v1/chat/completions');
    const body = bodyOf(fetchImpl);
    expect(body.enable_thinking).toBe(false);
    expect(body).toMatchObject({ temperature: 0.2, repetition_penalty: 1, repeat_penalty: 1 });
  });

  it('carries the fixed prompt, the docs sections and the question, and nothing else', async () => {
    /** One request, and what is left of its user message without the sections and the question. */
    const sent = async (question: string) => {
      const fetchImpl = replyWith(sseReply('Done.'));
      const events = await collect(ask(question, fetchImpl));
      const done = events.at(-1);
      const sources = done?.type === 'done' ? done.sources : [];
      const body = bodyOf(fetchImpl);
      const frame = sources
        .reduce((text, section) => text.replace(section.markdown, ''), body.messages[1].content)
        .replace(question, '')
        .replace(/<section page="[^"]*">\n\n<\/section>\n*/g, '');
      return { body, sources, frame };
    };
    const traits = await sent('How do I add a trait?');
    const library = await sent('How do I import a world?');

    expect(Object.keys(traits.body).sort()).toEqual(
      ['max_tokens', 'messages', 'model', 'repeat_penalty', 'repetition_penalty', 'stream', 'temperature'],
    );
    expect(traits.body.messages.map((message) => message.role)).toEqual(['system', 'user']);
    // The system prompt is fixed text, and so is the user message around its sections and question.
    expect(library.body.messages[0]).toEqual(traits.body.messages[0]);
    expect(traits.sources.length).toBeGreaterThan(0);
    expect(library.sources[0].id).toBe('Library#how-to-import-a-world');
    expect(library.frame).toBe(traits.frame);
    expect(traits.frame).not.toMatch(/Trait|Stat|Import|##/);
  });

  it('keeps an inline reasoning block out of the answer, and sends it as the reasoning', async () => {
    const fetchImpl = replyWith([
      sseFrame({ content: '<think>The player wants' }),
      sseFrame({ content: ' steps.</think>\n\n1. Select' }),
      ...sseReply(' **Add Trait**.'),
    ]);
    const events = await collect(ask('add a trait', fetchImpl));
    expect(events.map((event) => [event.text, event.reasoning])).toEqual([
      ['', 'The player wants'],
      ['1. Select', 'The player wants steps.'],
      ['1. Select **Add Trait**.', 'The player wants steps.'],
      ['1. Select **Add Trait**.', 'The player wants steps.'],
    ]);
  });
});

describe('the docs sections of a request', () => {
  /** An index whose pages each hold one section about zebras, `size` characters long. */
  const zebraIndex = (pages: number, size: number) => createDocsIndex({
    pages: Object.fromEntries(Array.from({ length: pages }, (_, n) => [
      `Page${n}`, `## Zebra ${n}\n\n${'A zebra has stripes. '.repeat(Math.ceil(size / 20)).slice(0, size)}`,
    ])),
  });

  it('holds at most five sections', () => {
    expect(helpSections(zebraIndex(8, 200), 'zebra')).toHaveLength(5);
  });

  it('counts a lead section once against the budget, so the other hits fill what is left', () => {
    // Each section is about 3,900 characters: the lead and two more fit in 12,000.
    const zebras = zebraIndex(8, 3900);
    const lead = zebras.search('zebra')[0];
    const sections = helpSections(zebras, 'zebra', { lead });
    expect(sections[0].id).toBe(lead.id);
    expect(sections).toHaveLength(3);
    // The budget is full: a fourth section of this size does not fit.
    expect(sections.reduce((sum, section) => sum + section.markdown.length, 0) + sections[1].markdown.length).toBeGreaterThan(HELP_DOCS_CHAR_BUDGET);
    expect(sections.reduce((sum, section) => sum + section.markdown.length, 0)).toBeLessThanOrEqual(HELP_DOCS_CHAR_BUDGET);
  });

  it('counts a lead section the search does not find against the budget too', () => {
    const lead = { id: 'Lead#lead', page: 'Lead', heading: 'Lead', label: 'Lead', trail: [], markdown: `## Lead

${'x'.repeat(7000)}` };
    const sections = helpSections(zebraIndex(8, 3900), 'zebra', { lead });
    expect(sections.map((section) => section.id)[0]).toBe('Lead#lead');
    expect(sections).toHaveLength(2);
  });

  it('holds at most five sections with a lead section included', () => {
    const zebras = zebraIndex(8, 200);
    const lead = zebras.search('zebra')[0];
    const ids = helpSections(zebras, 'zebra', { lead }).map((section) => section.id);
    expect(ids).toHaveLength(5);
    expect(ids[0]).toBe(lead.id);
    expect(new Set(ids).size).toBe(5);
  });

  it('adds the hits within a page, so a question without a keyword of its own reaches its how-to', () => {
    const pages = {
      Mine: '# Mine\n\nIntro.\n\n## How to Add One\n\n1. Select **Add**.\n',
      ...Object.fromEntries(Array.from({ length: 6 }, (_, n) => [`Other${n}`, `## Other ${n}\n\nOne more thing to add here.`])),
    };
    const docs = createDocsIndex({ pages });
    const lead = docs.get(['Mine#mine'])[0];
    expect(helpSections(docs, 'add one here', { lead }).map((section) => section.id)).toContain('Mine#how-to-add-one');
  });

  it('holds at most five sections for a follow-up too, when its own best section is not among the others', () => {
    // "Stripes" is the best match for the follow-up alone; with "zebra" the six zebra sections rank above it.
    const zebras = createDocsIndex({
      pages: {
        ...Object.fromEntries(Array.from({ length: 6 }, (_, n) => [`Zebra${n}`, `## Zebra ${n}\n\nA zebra has stripes.`])),
        Stripes: '## Stripes\n\nA band of color.',
      },
    });
    const sections = helpSections(zebras, 'stripes', { history: [{ question: 'zebra', answer: 'A horse.' }] });
    expect(sections[0].id).toBe('Stripes#stripes');
    expect(sections).toHaveLength(5);
  });

  it('stops before the section that takes the docs text over the budget', () => {
    // Each section is about 5,000 characters: two fit in 12,000 and a third does not.
    const sections = helpSections(zebraIndex(8, 5000), 'zebra');
    expect(sections).toHaveLength(2);
    expect(sections.reduce((sum, section) => sum + section.markdown.length, 0)).toBeLessThanOrEqual(HELP_DOCS_CHAR_BUDGET);
  });

  it('leaves out a hit under the score floor, which the search without a floor still finds', () => {
    const docs = createDocsIndex({
      pages: {
        Editor: '# Editor\n\n## Find and Replace\n\nRename the villain everywhere in the world with **Find and Replace**.\n',
        Library: '# Library\n\n## Groups\n\nRename a group from its menu.\n',
      },
    });
    const question = 'rename the villain everywhere in the world';
    expect(docs.search(question).map((section) => section.id)).toContain('Library#groups');
    expect(helpSections(docs, question).map((section) => section.id)).toEqual(['Editor#find-and-replace']);
  });

  it('leaves out a hit under the score floor of the search with the previous question too', () => {
    const docs = createDocsIndex({
      pages: {
        Paint: '# Paint\n\n## Paint Zebra Stripes\n\nPaint zebra stripes with a brush.\n',
        Library: '# Library\n\n## Groups\n\nPaint a group.\n',
      },
    });
    const history = [{ question: 'how do I paint zebra stripes', answer: 'Use a brush.' }];
    expect(docs.search('how do I paint zebra stripes and then?').map((section) => section.id)).toContain('Library#groups');
    expect(helpSections(docs, 'and then?', { history }).map((section) => section.id)).toEqual(['Paint#paint-zebra-stripes']);
  });

  describe('the how-tos of the open page', () => {
    const docs = createDocsIndex({
      pages: {
        Mine: '# Mine\n\nIntro.\n\n## How to Add One\n\n1. Select **Add**.\n',
        Zebra: '# Zebra\n\n## Zebra Stripes\n\nAdd a zebra stripe to the zebra. Each zebra stripe is black.\n',
      },
    });
    const lead = docs.get(['Mine#mine'])[0];
    const ids = (question: string, over: Parameters<typeof helpSections>[2] = {}) => helpSections(docs, question, { lead, ...over }).map((section) => section.id);

    it.each(['add a zebra stripe here', 'add this zebra stripe', 'add these zebra stripes'])('join under the score floor when the question points at the screen: %s', (question) => {
      expect(docs.search(question, 5, undefined, { floor: HELP_SCORE_FLOOR }).map((section) => section.id)).toEqual(['Zebra#zebra-stripes']);
      expect(ids(question)).toEqual(['Mine#mine', 'Zebra#zebra-stripes', 'Mine#how-to-add-one']);
    });

    it.each(['add a zebra stripe', 'add a zebra stripe where it goes', 'add a thistle zebra stripe'])('stay out when the question does not point at the screen: %s', (question) => {
      expect(ids(question)).toEqual(['Mine#mine', 'Zebra#zebra-stripes']);
    });

    it('join every question with the how-to rule off, for a probe\'s control arm', () => {
      expect(ids('add a zebra stripe', { howToRule: false })).toEqual(['Mine#mine', 'Zebra#zebra-stripes', 'Mine#how-to-add-one']);
    });
  });

  it('always holds the best match, even when it is over the budget alone', () => {
    const big = zebraIndex(3, 5000);
    expect(helpSections(big, 'zebra', { budget: 1000 }).map((section) => section.id)).toEqual([big.search('zebra')[0].id]);
  });

  it('holds no section when no word of the question is in the docs, and still asks once', async () => {
    const fetchImpl = replyWith(sseReply('The guide does not cover this.'));
    const events = await collect(ask('quasar', fetchImpl));
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(events.at(-1)).toMatchObject({ type: 'done', sources: [] });
  });

  it('reports the sections it sent as the sources', async () => {
    const fetchImpl = replyWith(sseReply('Done.'));
    const zebras = zebraIndex(8, 5000);
    const events = await collect(ask('zebra', fetchImpl, { index: zebras }));
    const done = events.at(-1);
    const sent = bodyOf(fetchImpl).messages[1].content;
    const sources = done?.type === 'done' ? done.sources : [];
    // Two sections of about 5,000 characters fit the budget.
    expect(sources).toHaveLength(2);
    expect(zebras.search('zebra', 8).filter((section) => sent.includes(section.markdown)).map((section) => section.id))
      .toEqual(sources.map((section) => section.id));
  });
});

describe('stop', () => {
  it('ends the stream, keeps the answer so far and closes the request', async () => {
    const reply = openSseReply([sseFrame({ content: '1. Open the **Traits** tab.' })]);
    const fetchImpl: FetchSpy = vi.fn(async () => reply.respond());
    const stop = new AbortController();
    const events: HelpEvent[] = [];
    for await (const event of ask('add a trait', fetchImpl, { signal: stop.signal })) {
      events.push(event);
      if (event.type === 'answer') stop.abort();
    }

    expect(events.at(-1)).toMatchObject({ type: 'done', text: '1. Open the **Traits** tab.', stopped: true });
    expect(events.at(-1)?.type === 'done' && events.at(-1)).toHaveProperty('sources.0.id', 'Traits#how-to-add-a-trait');
    expect(reply.cancel).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0][1].signal?.aborted).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('ends with an empty answer and no error when it comes before the first word', async () => {
    const stop = new AbortController();
    const fetchImpl: FetchSpy = vi.fn((_url, init) => new Promise<Response>((_resolve, reject) => {
      init.signal?.addEventListener('abort', () => reject(new DOMException('The operation was aborted.', 'AbortError')));
      stop.abort();
    }));
    const events = await collect(ask('add a trait', fetchImpl, { signal: stop.signal }));
    expect(events).toEqual([expect.objectContaining({ type: 'done', text: '', stopped: true })]);
  });
});

describe('a request that fails', () => {
  it('throws the HTTP failure with its details, after one request', async () => {
    const fetchImpl: FetchSpy = vi.fn(async () => new Response('{"error":{"message":"model overloaded"}}', { status: 503 }));
    const failure = await collect(ask('add a trait', fetchImpl)).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(AiStreamError);
    expect((failure as AiStreamError).details).toContain('model overloaded');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('throws when the model sends an empty answer', async () => {
    const fetchImpl = replyWith(sseReply('  \n'));
    await expect(collect(ask('add a trait', fetchImpl)))
      .rejects.toThrow('empty answer (finish reason: stop)');
  });

  it('throws when the server is not there', async () => {
    const fetchImpl: FetchSpy = vi.fn(async () => { throw new TypeError('Failed to fetch'); });
    await expect(collect(ask('add a trait', fetchImpl)))
      .rejects.toThrow('Failed to fetch');
  });
});

describe('a follow-up', () => {
  const turn = (question: string, answer: string): EarlierExchange => ({ question, answer });

  it('carries the earlier questions and answers as text, and no earlier docs sections', async () => {
    const fetchImpl = replyWith(sseReply('Select **Add Trait** again.'));
    const history = [turn('How do I import a world?', '1. Select **Import**.'), turn('How do I add a trait?', '1. Open the **Traits** tab.')];
    await collect(ask('and then?', fetchImpl, { history }));

    const { messages } = bodyOf(fetchImpl);
    expect(messages.slice(1, -1)).toEqual([
      { role: 'user', content: 'How do I import a world?' },
      { role: 'assistant', content: '1. Select **Import**.' },
      { role: 'user', content: 'How do I add a trait?' },
      { role: 'assistant', content: '1. Open the **Traits** tab.' },
    ]);
    expect(messages.at(-1)?.content).toContain('Question: and then?');
    expect(messages.filter((message) => message.content.includes('<guide>'))).toHaveLength(1);
  });

  it(`leaves out the oldest exchanges past the last ${DEFAULT_HELP_SETTINGS.historyLength}`, async () => {
    const fetchImpl = replyWith(sseReply('Done.'));
    const { historyLength } = DEFAULT_HELP_SETTINGS;
    const history = Array.from({ length: historyLength + 2 }, (_, n) => turn(`question ${n}`, `answer ${n}`));
    await collect(ask('and then?', fetchImpl, { history }));

    const earlier = bodyOf(fetchImpl).messages.slice(1, -1).map((message) => message.content);
    expect(earlier).toHaveLength(historyLength * 2);
    expect(earlier[0]).toBe('question 2');
    expect(earlier.at(-1)).toBe(`answer ${historyLength + 1}`);
  });

  it('reads the History Length and the answer cap from the settings of the question', async () => {
    const fetchImpl = replyWith(sseReply('Done.'));
    const history = Array.from({ length: 3 }, (_, n) => turn(`question ${n}`, `answer ${n}`));
    await collect(ask('and then?', fetchImpl, { history, settings: helpSettingsOf({ historyLength: 1, presets: editHelpOptions(duplicateHelpPreset(EMPTY_HELP_PRESET_STORE, DEFAULT_HELP_PRESET_ID, 'mine', 'Mine'), 'mine', 'answer', { maxTokens: 123 }) }) }));

    const body = bodyOf(fetchImpl);
    expect(body.messages.slice(1, -1).map((message) => message.content)).toEqual(['question 2', 'answer 2']);
    expect(body.max_tokens).toBe(123);
  });

  it('carries no earlier exchange at a History Length of 0, and searches for the question alone', async () => {
    const fetchImpl = replyWith(sseReply('Done.'));
    const settings = helpSettingsOf({ historyLength: 0 });
    await collect(ask('How do I add a stat?', fetchImpl, { history: [turn('How do I add a trait?', '1. Open the **Traits** tab.')], settings }));

    const { messages } = bodyOf(fetchImpl);
    expect(messages.map((message) => message.role)).toEqual(['system', 'user']);
    expect(messages[1].content).toContain('## How to Add a Stat');
    expect(messages[1].content).not.toContain('How to Add a Trait');
  });

  it('leaves out an earlier question that got no answer text', async () => {
    const fetchImpl = replyWith(sseReply('Done.'));
    await collect(ask('and then?', fetchImpl, { history: [turn('How do I add a stat?', 'Open **Stats**.'), turn('How do I add a trait?', '  ')] }));
    expect(bodyOf(fetchImpl).messages.slice(1, -1).map((message) => message.content)).toEqual(['How do I add a stat?', 'Open **Stats**.']);
  });

  it('finds the sections of the earlier topic when it has no keywords of its own', async () => {
    const fetchImpl = replyWith(sseReply('Done.'));
    const events = await collect(ask('and then?', fetchImpl, { history: [turn('How do I import a world?', '1. Select **Import**.')] }));
    const done = events.at(-1);
    expect(done?.type === 'done' && done.sources[0].id).toBe('Library#how-to-import-a-world');
  });

  /** The ids of the sections a question gets after the earlier exchanges. */
  const sectionIds = (question: string, history: EarlierExchange[]) => helpSections(index, question, { history }).map((section) => section.id);

  it('puts the best section of the question itself first after a change of topic, then the earlier topic', () => {
    const ids = sectionIds('How do I add a stat?', [turn('How do I import a world?', 'a')]);
    expect(ids[0]).toBe('Stats#how-to-add-a-stat');
    expect(ids).toContain('Library#how-to-import-a-world');
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('searches with the previous question and not the ones before it', () => {
    const ids = sectionIds('and then?', [turn('How do I add a stat?', 'a'), turn('How do I import a world?', 'b')]);
    expect(ids).toContain('Library#how-to-import-a-world');
    expect(ids).not.toContain('Stats#how-to-add-a-stat');
  });

  it('searches with the previous question that got an answer', () => {
    const ids = sectionIds('and then?', [turn('How do I import a world?', 'a'), turn('How do I add a stat?', '')]);
    expect(ids).toContain('Library#how-to-import-a-world');
    expect(ids).not.toContain('Stats#how-to-add-a-stat');
  });

  it('searches with the question alone when nothing came before', () => {
    expect(sectionIds('How do I add a trait?', [])).toEqual(index.search('How do I add a trait?', 5, undefined, { floor: HELP_SCORE_FLOOR }).map((section) => section.id));
  });
});

describe('the AI Language', () => {
  it('adds the directive to the prompt for a language other than English, and keeps the control names', async () => {
    const english = replyWith(sseReply('Done.'));
    const spanish = replyWith(sseReply('Hecho.'));
    await collect(ask('How do I add a trait?', english, { language: 'English' }));
    await collect(ask('How do I add a trait?', spanish, { language: 'Spanish' }));

    const englishPrompt = bodyOf(english).messages[0].content;
    const spanishPrompt = bodyOf(spanish).messages[0].content;
    expect(englishPrompt).toBe(VOICED_HELP_PROMPT);
    expect(spanishPrompt.startsWith(VOICED_HELP_PROMPT)).toBe(true);
    const added = spanishPrompt.slice(VOICED_HELP_PROMPT.length);
    expect(added).toContain(languageDirective('answers', 'Spanish'));
    expect(added).toMatch(/control name exactly as the guide writes it/);
  });

  it('adds no directive with no language set', async () => {
    const fetchImpl = replyWith(sseReply('Done.'));
    await collect(ask('How do I add a trait?', fetchImpl, { language: '  ' }));
    expect(bodyOf(fetchImpl).messages[0].content).toBe(VOICED_HELP_PROMPT);
  });
});

describe('a question with images', () => {
  const screenshot = (id: string): ImageAttachment => ({ id, mime: 'image/jpeg', dataUrl: `data:image/jpeg;base64,${btoa(id)}` });
  type Part = { type: string; text?: string; image_url?: { url: string } };

  it('puts the images after the question and its docs sections, on the last user message only', async () => {
    const fetchImpl = replyWith(sseReply('That is the **Traits** tab.'));
    const history = [{ question: 'How do I import a world?', answer: '1. Select **Import**.' }];
    await collect(ask('What is this trait screen?', fetchImpl, { history, images: [screenshot('a'), screenshot('b')] }));

    const messages = bodyOf(fetchImpl).messages as { role: string; content: string | Part[] }[];
    expect(messages.slice(1, -1).every((message) => typeof message.content === 'string')).toBe(true);
    const parts = messages.at(-1)!.content as Part[];
    expect(parts.map((part) => part.type)).toEqual(['text', 'image_url', 'image_url']);
    expect(parts[0].text).toContain('## How to Add a Trait');
    expect(parts[0].text).toContain('What is this trait screen?');
    expect(parts.slice(1).map((part) => part.image_url?.url)).toEqual([screenshot('a').dataUrl, screenshot('b').dataUrl]);
  });

  it('sends the question as plain text with no images', async () => {
    const fetchImpl = replyWith(sseReply('Select **Add Trait**.'));
    await collect(ask('How do I add a trait?', fetchImpl, { images: [] }));
    expect(typeof bodyOf(fetchImpl).messages.at(-1)?.content).toBe('string');
  });
});
