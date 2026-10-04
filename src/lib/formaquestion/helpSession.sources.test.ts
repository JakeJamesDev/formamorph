import { describe, expect, it, vi } from 'vitest';
import { createDocsIndex } from '@/lib/docs/docsIndex';
import { reasoningCapabilityFromLevels } from '@/lib/reasoningEffort';
import { EMBEDDING_MODEL_ID } from '@/lib/memoryRelevance';
import { openSseReply, sseFrame, sseReply, sseResponse, textSnapshot, textTarget } from '@/test/aiTextFixtures';
import { isPickRequest, VOICED_HELP_PROMPT } from '@/test/helpFixtures';
import type { ImageAttachment } from '@/types';
import { GENERAL_KNOWLEDGE_MARKER } from './generalKnowledge';
import { HELP_PICK_MAX_TOKENS, pickList } from './helpPicks';
import { HELP_PICK_SYSTEM_PROMPT } from './helpPrompt';
import type { HelpEmbedder } from './helpSemantic';
import { askHelp, HELP_SCORE_FLOOR, type HelpEvent, type HelpQuestion } from './helpSession';
import { DEFAULT_HELP_PRESET_ID, duplicateHelpPreset, editHelpOptions, EMPTY_HELP_PRESET_STORE } from './helpPresets';
import { helpSettingsOf, type HelpSources } from './helpSettings';
import { encodeVector, sectionTexts, type SectionVectorsFile } from './sectionVectors';

// Each source finds its own section for "import": the keyword search finds the one section that holds the
// word, the model picks the rewind section, and the note section is the nearest vector.
const PAGES = {
  Library: '# Library\n\nYour tiles.\n\n## How to Import a World\n\n1. Select **Import**.\n',
  Saves: '# Saves\n\nA save keeps a story.\n\n## How to Rewind a Turn\n\n1. Select **Rewind**.\n',
  Memory: '# Memory\n\nThe AI keeps notes.\n\n## How to Edit a Note\n\n1. Select **Edit**.\n',
};
const index = createDocsIndex({ pages: PAGES, sidebar: '- [Library](Library)\n- [Saves](Saves)\n- [Memory](Memory)\n' });
const KEYWORD_HIT = 'Library#how-to-import-a-world';
const PICKED = 'Saves#how-to-rewind-a-turn';
const NEAREST = 'Memory#how-to-edit-a-note';
const PICK_REPLY = 'Saves › How to Rewind a Turn';

/** The section vectors of the fixture docs: the note section along the query, the import section near it. */
const vectorsFile = (vectors: Record<string, [number, number]>, model = EMBEDDING_MODEL_ID): SectionVectorsFile => ({
  model,
  dims: 2,
  sections: sectionTexts(index).flatMap(({ section, hash }) =>
    (vectors[section.id] ? [{ id: section.id, hash, vector: encodeVector(Float32Array.from(vectors[section.id])) }] : [])),
});
const VECTORS = vectorsFile({ [NEAREST]: [1, 0], [KEYWORD_HIT]: [0.6, 0.8] });

/** An embedding model that is on the device and puts every query at (1, 0). */
const embedderOf = (over: Partial<HelpEmbedder> = {}) => ({
  open: vi.fn(async () => true),
  embed: vi.fn(async (texts: string[]) => texts.map(() => Float32Array.of(1, 0))),
  vectors: vi.fn(async () => VECTORS),
  ...over,
});

type Responder = (url: string, init: RequestInit) => Response | Promise<Response>;

/** An endpoint with one spy for the pick requests and one for every other request, and the order they came in. */
function endpoint({ picks = () => sseResponse(sseReply(PICK_REPLY)), answers = () => sseResponse(sseReply('Select **Import**.')) }: { picks?: Responder; answers?: Responder } = {}) {
  const order: string[] = [];
  const pickSpy = vi.fn(picks);
  const answerSpy = vi.fn(answers);
  const fetchImpl = ((url: string, init: RequestInit) => {
    const pick = isPickRequest(init);
    order.push(pick ? 'pick' : 'answer');
    return pick ? pickSpy(url, init) : answerSpy(url, init);
  }) as unknown as typeof fetch;
  return { fetchImpl, picks: pickSpy, answers: answerSpy, order };
}

const bodyOf = (spy: ReturnType<typeof vi.fn<Responder>>, call = 0) =>
  JSON.parse(spy.mock.calls[call][1].body as string) as { messages: { role: string; content: unknown }[] } & Record<string, unknown>;

async function ask(question: string, over: Partial<HelpQuestion>): Promise<{ events: HelpEvent[]; sources: string[]; done: Extract<HelpEvent, { type: 'done' }> }> {
  const events: HelpEvent[] = [];
  // The stage events have their own test file.
  for await (const event of askHelp({ question, settings: helpSettingsOf(), snapshot: textSnapshot(), index, ...over })) if (event.type !== 'stage') events.push(event);
  const done = events.at(-1);
  if (done?.type !== 'done') throw new Error('the question did not end');
  return { events, sources: done.sources.map((section) => section.id), done };
}

describe('the search sources, as shipped', () => {
  it('makes one pick request, then one answer request, and sends the keyword hit and the pick; the semantic source is off', async () => {
    const server = endpoint();
    const embedder = embedderOf();
    const { sources } = await ask('import', { fetchImpl: server.fetchImpl, embedder });

    expect(server.order).toEqual(['pick', 'answer']);
    expect(sources).toEqual([KEYWORD_HIT, PICKED]);
    expect(bodyOf(server.answers).messages[0].content).toBe(VOICED_HELP_PROMPT);
    expect(bodyOf(server.answers).messages[1].content).toContain('## How to Rewind a Turn');
    expect(embedder.open).not.toHaveBeenCalled();
  });
});

describe('each search source', () => {
  const MIXES: [HelpSources, string[]][] = [
    [{ keyword: false, aiPicks: false, semantic: false }, []],
    [{ keyword: true, aiPicks: false, semantic: false }, [KEYWORD_HIT]],
    [{ keyword: false, aiPicks: true, semantic: false }, [PICKED]],
    [{ keyword: false, aiPicks: false, semantic: true }, [NEAREST, KEYWORD_HIT]],
    [{ keyword: true, aiPicks: true, semantic: false }, [KEYWORD_HIT, PICKED]],
    // Both the keyword search and the vectors find the import section, so it leads.
    [{ keyword: true, aiPicks: false, semantic: true }, [KEYWORD_HIT, NEAREST]],
    [{ keyword: false, aiPicks: true, semantic: true }, [PICKED, NEAREST, KEYWORD_HIT]],
    [{ keyword: true, aiPicks: true, semantic: true }, [KEYWORD_HIT, PICKED, NEAREST]],
  ];

  it.each(MIXES)('runs only when its own switch is on: %o', async (sources, expected) => {
    const server = endpoint();
    const embedder = embedderOf();
    const result = await ask('import', { fetchImpl: server.fetchImpl, embedder, settings: helpSettingsOf({ sources }) });

    expect(result.sources).toEqual(expected);
    expect(server.picks).toHaveBeenCalledTimes(sources.aiPicks ? 1 : 0);
    expect(embedder.embed).toHaveBeenCalledTimes(sources.semantic ? 1 : 0);
    expect(server.answers).toHaveBeenCalledTimes(1);
    expect(result.done.text).toBe('Select **Import**.');
  });
});

describe('the pick request', () => {
  it('sends as the help kind with reasoning off, its own cap, the fixed pick prompt and every guide heading', async () => {
    const server = endpoint();
    // A model that reasons by default, on an endpoint whose own sampler switches are on.
    const target = textTarget({
      reasoning: { ...reasoningCapabilityFromLevels([], 'probe'), reasons: true, dialect: 'novita' },
      samplerOverrides: { ...textTarget().samplerOverrides, temperature: { enabled: true, value: 1.3 }, repetitionPenalty: { enabled: true, value: 1.25 } },
    });
    const snapshot = textSnapshot(target, { reasoningEngaged: true, reasoningEffort: 'high', promptReasoning: { help: 'high' } });
    await ask('import', { fetchImpl: server.fetchImpl, snapshot });

    const body = bodyOf(server.picks);
    expect(body).toMatchObject({ temperature: 0.2, repetition_penalty: 1, repeat_penalty: 1, max_tokens: HELP_PICK_MAX_TOKENS, enable_thinking: false });
    expect(body.tools).toBeUndefined();
    expect(body.messages.map((message) => message.role)).toEqual(['system', 'user']);
    expect(body.messages[0].content).toBe(HELP_PICK_SYSTEM_PROMPT);
    expect(body.messages[1].content).toBe(
      `<sections>\n${pickList(index).lines.join('\n')}\n</sections>\n\nQuestion: import\n\nReply with the lines of the sections that answer the question, the best one first.`,
    );
  });

  it('keeps its own samplers and cap when the Answer options of the preset change', async () => {
    const server = endpoint();
    await ask('import', { fetchImpl: server.fetchImpl, settings: helpSettingsOf({ presets: editHelpOptions(duplicateHelpPreset(EMPTY_HELP_PRESET_STORE, DEFAULT_HELP_PRESET_ID, 'mine', 'Mine'), 'mine', 'answer', { temperature: 1.1, repetitionPenalty: 1.3, maxTokens: 321 }) }) });

    expect(bodyOf(server.picks)).toMatchObject({ temperature: 0.2, repetition_penalty: 1, repeat_penalty: 1, max_tokens: HELP_PICK_MAX_TOKENS });
    expect(bodyOf(server.answers)).toMatchObject({ temperature: 1.1, repetition_penalty: 1.3, repeat_penalty: 1.3, max_tokens: 321 });
  });

  it('names the open screen, the earlier question and its answer, and carries no image', async () => {
    const server = endpoint();
    const image: ImageAttachment = { id: 'a', mime: 'image/jpeg', dataUrl: 'data:image/jpeg;base64,AAAA' };
    await ask('and then?', {
      index: createDocsIndex({ pages: { ...PAGES, Settings: '# Settings\n\n## Display\n\nDisplay holds the theme.\n' } }),
      fetchImpl: server.fetchImpl,
      images: [image],
      surface: { screen: 'mainMenu', dialog: 'settings', tabs: ['settings.display'] },
      history: [{ question: 'How do I rewind?', answer: 'Select **Rewind**.' }],
    });

    const { messages } = bodyOf(server.picks);
    expect(messages).toHaveLength(2);
    expect(typeof messages[1].content).toBe('string');
    expect(messages[1].content).toContain(
      "</sections>\n\nThe player asks from this screen: Settings dialog, Display tab.\n\nThe player's earlier question: How do I rewind?\n\nThe earlier answer:\nSelect **Rewind**.\n\nQuestion: and then?",
    );
    expect(JSON.stringify(messages)).not.toContain('AAAA');
    // The image still goes with the answer request.
    expect(JSON.stringify(bodyOf(server.answers).messages)).toContain('AAAA');
  });

  it('carries the newest exchange that got an answer, and no older one', async () => {
    const server = endpoint();
    await ask('can I undo it?', {
      fetchImpl: server.fetchImpl,
      history: [
        { question: 'How do I import?', answer: 'Select **Import**.' },
        { question: 'How do I rewind?', answer: 'Select **Rewind**.' },
        { question: 'and the note?', answer: '' },
      ],
    });

    const message = String(bodyOf(server.picks).messages[1].content);
    expect(message).toContain("The player's earlier question: How do I rewind?\n\nThe earlier answer:\nSelect **Rewind**.\n\nQuestion: can I undo it?");
    expect(message).not.toContain('How do I import?');
    expect(message).not.toContain('Select **Import**.');
    expect(message).not.toContain('and the note?');
  });

  it('carries an earlier answer that is not from the guide, with no marker', async () => {
    const server = endpoint();
    await ask('and then?', { fetchImpl: server.fetchImpl, history: [{ question: 'How do I fly?', answer: 'Flap your arms.', flagged: true }] });

    const message = String(bodyOf(server.picks).messages[1].content);
    expect(message).toContain('The earlier answer:\nFlap your arms.\n\nQuestion: and then?');
    expect(message).not.toContain(GENERAL_KNOWLEDGE_MARKER);
  });

  it('finds the new feature a follow-up names, though the pick names the earlier topic alone', async () => {
    const server = endpoint();
    const { sources } = await ask('how do I import a world?', {
      fetchImpl: server.fetchImpl,
      history: [{ question: 'How do I rewind?', answer: 'Select **Rewind**.', sources: index.get([PICKED]) }],
    });

    expect(String(bodyOf(server.picks).messages[1].content)).toContain('The earlier answer:\nSelect **Rewind**.');
    expect(sources[0]).toBe(KEYWORD_HIT);
    expect(sources).toContain(PICKED);
  });

  it('brings a section the keyword search ranks under its floor into the block, and the keyword search alone leaves it out', async () => {
    // "stripes" is in one heading and deep in one other body; the second hit is far under the first.
    const zebras = createDocsIndex({
      pages: {
        Zebra: '# Zebra\n\n## Zebra Stripes Count\n\nA zebra stripes count is a number.\n',
        Horse: `# Horse\n\n## Coats\n\n${'A horse has a coat of one color. '.repeat(30)}A few have stripes.\n`,
        Mule: '# Mule\n\n## Loads\n\nA mule carries a load.\n',
      },
    });
    const question = 'zebra stripes count';
    expect(zebras.search(question).map((section) => section.id)).toContain('Horse#coats');
    expect(zebras.search(question, 5, undefined, { floor: HELP_SCORE_FLOOR }).map((section) => section.id)).not.toContain('Horse#coats');

    const alone = await ask(question, { index: zebras, fetchImpl: endpoint().fetchImpl, settings: helpSettingsOf({ sources: { aiPicks: false } }) });
    expect(alone.sources).not.toContain('Horse#coats');
    const merged = await ask(question, { index: zebras, fetchImpl: endpoint({ picks: () => sseResponse(sseReply('Mule › Loads')) }).fetchImpl });
    expect(merged.sources).toContain('Horse#coats');
    expect(merged.sources).toContain('Mule#loads');
  });
});

describe('the merged ranking', () => {
  it('keeps a changelog section of the keyword search under every guide section, a late pick included', async () => {
    const withLog = createDocsIndex({ pages: { ...PAGES, Changelog: '# Changelog\n\n## 3.1.0\n\n### Added\n\n- Import is faster.\n' } });
    const logHit = withLog.search('import').find((section) => section.page === 'Changelog')?.id;
    expect(logHit).toBeDefined();
    // The changelog section is the keyword search's second hit; the note section is the model's second pick.
    const server = endpoint({ picks: () => sseResponse(sseReply(`${PICK_REPLY}\nMemory › How to Edit a Note`)) });
    const { sources } = await ask('import', { index: withLog, fetchImpl: server.fetchImpl });
    expect(sources).toEqual([KEYWORD_HIT, PICKED, NEAREST, logHit]);
  });

  describe("a what's-new question", () => {
    // The question leads with release 3.1.0, which is long enough to split into its two parts. The import
    // line of release 3.0.0 is a keyword match.
    const long = (line: string) => `- ${line} `.repeat(280).trim();
    const withLog = createDocsIndex({
      pages: { ...PAGES, Changelog: `# Changelog\n\n## 3.1.0\n\n### Added\n\n${long('Groups hold tiles.')}\n\n### Fixed\n\n${long('A crash is gone.')}\n\n## 3.0.0\n\n### Added\n\n- Import is faster.\n` },
    });
    const question = "what's new in the latest version for import?";
    const release = withLog.whatsNew(question).map((section) => section.id);
    const older = withLog.search('import').filter((section) => section.page === 'Changelog').map((section) => section.id);

    it('has a release lead of two sections and one older changelog match in the fixture', () => {
      expect(release).toHaveLength(2);
      expect(older).toHaveLength(1);
      expect(release).not.toContain(older[0]);
    });

    it('keeps the release sections first, then the guide sections, then the other changelog match, each once', async () => {
      const { sources } = await ask(question, { index: withLog, fetchImpl: endpoint().fetchImpl });
      expect(sources).toEqual([...release, KEYWORD_HIT, PICKED, ...older]);
    });

    it('keeps the release sections first when the keyword search finds no guide section', async () => {
      // No guide section holds "faster"; the keyword search gives the release lead, then the 3.0.0 match.
      const faster = "what's new in the latest version that is faster?";
      expect(withLog.search(faster).every((section) => section.page === 'Changelog')).toBe(true);
      expect(withLog.search(faster).some((section) => older.includes(section.id))).toBe(true);

      const { sources } = await ask(faster, { index: withLog, fetchImpl: endpoint().fetchImpl });
      const lead = withLog.whatsNew(faster).map((section) => section.id);
      expect(sources.slice(0, lead.length + 1)).toEqual([...lead, PICKED]);
    });

    it('keeps the release sections first with the keyword source off', async () => {
      const { sources } = await ask(question, { index: withLog, fetchImpl: endpoint().fetchImpl, settings: helpSettingsOf({ sources: { keyword: false } }) });
      expect(sources).toEqual([...release, PICKED]);
    });
  });

  it("keeps the open screen's section first, ahead of the merged ranking, and counts it once", async () => {
    const withSettings = createDocsIndex({ pages: { ...PAGES, Settings: '# Settings\n\n## Display\n\nDisplay holds the theme.\n' } });
    const server = endpoint({ picks: () => sseResponse(sseReply(`Settings › Display\n${PICK_REPLY}`)) });
    const { sources, done } = await ask('import', {
      index: withSettings, fetchImpl: server.fetchImpl, surface: { screen: 'mainMenu', dialog: 'settings', tabs: ['settings.display'] },
    });
    expect(sources).toEqual(['Settings#display', KEYWORD_HIT, PICKED]);
    expect(done.lead?.id).toBe('Settings#display');
  });

  it('puts a changelog section under a pick when the question asks nothing new and no guide section holds its words', async () => {
    const withLog = createDocsIndex({ pages: { ...PAGES, Changelog: '# Changelog\n\n## 3.1.0\n\n### Added\n\n- Rewinding is quicker.\n' } });
    const onlyLog = withLog.search('quicker').map((section) => section.id);
    expect(onlyLog.length).toBeGreaterThan(0);
    expect(withLog.get(onlyLog).every((section) => section.page === 'Changelog')).toBe(true);

    const { sources } = await ask('quicker', { index: withLog, fetchImpl: endpoint().fetchImpl });
    expect(sources).toEqual([PICKED, ...onlyLog]);
  });

  it('reads each ranking past the first hit for the one-hit search of a follow-up, so a section two sources rank second leads', async () => {
    const zebras = createDocsIndex({
      pages: {
        Plains: '# Plains\n\n## Zebra Stripes\n\nZebra stripes are black.\n\n## Herds\n\nA zebra lives in a herd.\n',
        Mule: '# Mule\n\n## Loads\n\nA mule carries a load.\n',
      },
    });
    expect(zebras.search('zebra stripes').map((section) => section.id)).toEqual(['Plains#zebra-stripes', 'Plains#herds']);
    const server = endpoint({ picks: () => sseResponse(sseReply('Mule › Loads\nPlains › Herds')) });
    const { sources } = await ask('zebra stripes', {
      index: zebras, fetchImpl: server.fetchImpl, history: [{ question: 'What is a mule?', answer: 'An animal.' }],
    });
    expect(sources[0]).toBe('Plains#herds');
  });
});

describe('a pick request that gives no picks', () => {
  const FAILURES: [string, Responder][] = [
    ['an HTTP error', () => new Response('{"error":{"message":"model overloaded"}}', { status: 503 })],
    ['a network error', () => { throw new TypeError('Failed to fetch'); }],
    ['an empty reply', () => sseResponse(sseReply(''))],
    ['a reply that copies no line of the list', () => sseResponse(sseReply('The import section answers it.'))],
    ['a reply that is cut in its reasoning', () => sseResponse(sseReply('<think>Which section', 'length'))],
  ];

  it.each(FAILURES)('answers from the keyword search after %s, with one answer request', async (_name, picks) => {
    const server = endpoint({ picks });
    const { sources, done } = await ask('import', { fetchImpl: server.fetchImpl });

    expect(server.order).toEqual(['pick', 'answer']);
    expect(sources).toEqual([KEYWORD_HIT]);
    expect(done).toMatchObject({ text: 'Select **Import**.', stopped: false, flagged: false });
  });

  it('keeps the score floor of the keyword search, as with the source off', async () => {
    const zebras = createDocsIndex({
      pages: {
        Zebra: '# Zebra\n\n## Zebra Stripes Count\n\nA zebra stripes count is a number.\n',
        Horse: `# Horse\n\n## Coats\n\n${'A horse has a coat of one color. '.repeat(30)}A few have stripes.\n`,
      },
    });
    const { sources } = await ask('zebra stripes count', { index: zebras, fetchImpl: endpoint({ picks: () => new Response('', { status: 500 }) }).fetchImpl });
    expect(sources).toEqual(['Zebra#zebra-stripes-count']);
  });

  it('does not send the answer request again when it fails after a failed pick', async () => {
    const server = endpoint({ picks: () => new Response('', { status: 500 }), answers: () => new Response('', { status: 500 }) });
    await expect(ask('import', { fetchImpl: server.fetchImpl })).rejects.toThrow();
    expect(server.order).toEqual(['pick', 'answer']);
  });

  it('does not send the pick request again when the answer request fails', async () => {
    const server = endpoint({ answers: () => new Response('', { status: 500 }) });
    await expect(ask('import', { fetchImpl: server.fetchImpl })).rejects.toThrow();
    expect(server.order).toEqual(['pick', 'answer']);
  });
});

describe('Stop while the pick request runs', () => {
  it('ends the question as stopped, with no answer request and no sources', async () => {
    const controller = new AbortController();
    const open = openSseReply([sseFrame({ content: 'Saves' })]);
    const server = endpoint({ picks: () => { queueMicrotask(() => controller.abort()); return open.respond(); } });
    const { events } = await ask('import', { fetchImpl: server.fetchImpl, signal: controller.signal });

    expect(events).toEqual([{ type: 'done', text: '', sources: [], lead: undefined, stopped: true, flagged: false, nearest: [], reasoning: '' }]);
    expect(server.order).toEqual(['pick']);
  });
});

describe('Stop while the semantic source opens its model', () => {
  it('ends the question as stopped without a wait for the model, and sends nothing', async () => {
    const controller = new AbortController();
    // A model that never finishes its load.
    const open = vi.fn(() => {
      queueMicrotask(() => controller.abort());
      return new Promise<boolean>(() => {});
    });
    const server = endpoint();
    const { events } = await ask('import', {
      fetchImpl: server.fetchImpl, embedder: embedderOf({ open }), signal: controller.signal, settings: helpSettingsOf({ sources: { aiPicks: false, semantic: true } }),
    });

    expect(events).toEqual([{ type: 'done', text: '', sources: [], lead: undefined, stopped: true, flagged: false, nearest: [], reasoning: '' }]);
    expect(server.order).toEqual([]);
  });
});

describe('the semantic source', () => {
  const semanticOnly = helpSettingsOf({ sources: { keyword: false, aiPicks: false, semantic: true } });

  it('is skipped when the embedding model is not on the device: nothing is embedded and no vectors load', async () => {
    const server = endpoint();
    const embedder = embedderOf({ open: vi.fn(async () => false) });
    const { sources } = await ask('import', { fetchImpl: server.fetchImpl, embedder, settings: helpSettingsOf({ sources: { semantic: true } }) });

    expect(embedder.open).toHaveBeenCalledTimes(1);
    expect(embedder.embed).not.toHaveBeenCalled();
    expect(embedder.vectors).not.toHaveBeenCalled();
    expect(sources).toEqual([KEYWORD_HIT, PICKED]);
    expect(server.order).toEqual(['pick', 'answer']);
  });

  it.each([
    ['the embedder fails', embedderOf({ embed: vi.fn(async () => { throw new Error('worker died'); }) })],
    ['the model fails to open', embedderOf({ open: vi.fn(async () => { throw new Error('no cache'); }) })],
    ['the vectors are from another model', embedderOf({ vectors: vi.fn(async () => vectorsFile({ [NEAREST]: [1, 0] }, 'other/model')) })],
  ])('is skipped when %s, and the other sources still answer', async (_name, embedder) => {
    const server = endpoint();
    const { sources } = await ask('import', { fetchImpl: server.fetchImpl, embedder, settings: helpSettingsOf({ sources: { semantic: true } }) });
    expect(sources).toEqual([KEYWORD_HIT, PICKED]);
    expect(server.answers).toHaveBeenCalledTimes(1);
  });

  it('embeds the question, and for a follow-up the earlier question with it', async () => {
    const embed = vi.fn(async (texts: string[]) => texts.map(() => Float32Array.of(1, 0)));
    await ask('and then?', {
      fetchImpl: endpoint().fetchImpl, embedder: embedderOf({ embed }), settings: semanticOnly,
      history: [{ question: 'How do I rewind?', answer: 'Select **Rewind**.' }],
    });
    expect(embed.mock.calls).toEqual([[['and then?', 'How do I rewind? and then?']]]);
  });

  it('leaves out a section whose text changed after its vector was built', async () => {
    const changed = createDocsIndex({ pages: { ...PAGES, Memory: PAGES.Memory.replace('Select **Edit**', 'Select **Change**') } });
    const { sources } = await ask('import', { index: changed, fetchImpl: endpoint().fetchImpl, embedder: embedderOf(), settings: semanticOnly });
    expect(sources).toEqual([KEYWORD_HIT]);
  });
});

describe('a flagged answer after the sources ran', () => {
  it('takes its nearest sections from the same merged search, with no second pick request', async () => {
    const server = endpoint({ answers: () => sseResponse(sseReply(`${GENERAL_KNOWLEDGE_MARKER}\nLight scatters.`)) });
    const { done } = await ask('import', { fetchImpl: server.fetchImpl });

    expect(done.flagged).toBe(true);
    expect(done.nearest.map((section) => section.id)).toEqual([KEYWORD_HIT, PICKED]);
    expect(server.order).toEqual(['pick', 'answer']);
  });
});
