import { describe, expect, it, vi } from 'vitest';
import { bundledDocsIndex } from '@/lib/docs/bundledDocsIndex';
import { createDocsIndex, type DocsIndex } from '@/lib/docs/docsIndex';
import type { SurfaceId } from '@/lib/docs/surfaceMap';
import { UNKNOWN_REASONING_CAPABILITY } from '@/lib/reasoningEffort';
import type { Surface } from '@/lib/surface/surfaceRegistry';
import { sseReply, sseResponse, textSnapshot, textTarget } from '@/test/aiTextFixtures';
import { GENERAL_KNOWLEDGE_MARKER } from './generalKnowledge';
import { DEFAULT_CODE_RIDER, QUICK_REFERENCE_SECTION, STAT_CODE_TAB } from './helpCodeRider';
import { helpUserMessage, screenLine } from './helpPrompt';
import { askHelp, HELP_SECTION_LIMIT, helpSections, type HelpEvent, type HelpQuestion } from './helpSession';
import { helpSettingsOf, type HelpSettings } from './helpSettings';

const LEAD = 'World-Editor-Stats#dynamic-value-calculation';
const FIELDS = 'World-Editor-Stats#the-fields';
const GUIDE_TRAITS = 'StatCodeGuide#traits';

const PAGES = {
  'World-Editor-Stats': [
    '# 📊 World Editor Stats', '', 'A stat holds a number.', '',
    '## The Fields', '', 'A stat has a name and a range.', '',
    '## Dynamic Value Calculation', '', 'The **Code** tab holds two boxes, **Before the AI** and **After the AI**.', '',
  ].join('\n'),
  StatCodeGuide: [
    '# Stat Code Guide', '', 'Stat code changes a stat each turn.', '',
    '## Quick Reference', '', '| Object | Read |', '|---|---|', '| `self` | `self.value` |', '', 'A stat compares through `.value`.', '',
    '## Traits', '', 'Switch a trait from code through `traits.<Name>.enabled`.', '',
  ].join('\n'),
  Traits: '# 🧬 Traits\n\nA trait changes a stat.\n\n## How to Add a Trait\n\n1. Open the **Traits** tab.\n',
};
const index = createDocsIndex({ pages: PAGES, sidebar: '- [World Editor Stats](World-Editor-Stats)\n- [Stat Code Guide](StatCodeGuide)\n- [Traits](Traits)\n' });

const surface = (...tabs: SurfaceId[]): Surface => ({ screen: 'worldEditor', dialog: null, tabs });
const CODE_TAB = surface(STAT_CODE_TAB);
const DETAILS_TAB = surface('worldEditorStat.details');

/** One request per question: the pick request is off. */
const settingsOf = (over: Partial<HelpSettings> = {}) => helpSettingsOf({ sources: { aiPicks: false }, ...over });
const BARE = { openScreen: false, lookup: false, sources: { keyword: false, aiPicks: false, semantic: false } } as const;

/** An endpoint known to take function calls, so lookup mode runs. */
const CAPABLE = textSnapshot(textTarget({ reasoning: { ...UNKNOWN_REASONING_CAPABILITY, tools: true, sources: { tools: 'native' } } }));

type FetchSpy = ReturnType<typeof vi.fn<(url: string, init: RequestInit) => Promise<Response>>>;
const userOf = (spy: FetchSpy): string =>
  (JSON.parse(spy.mock.calls[0][1].body as string) as { messages: { content: string }[] }).messages.at(-1)!.content;

async function ask(question: string, over: Partial<HelpQuestion> = {}, docs: DocsIndex = index, reply = 'Done.') {
  const fetchImpl: FetchSpy = vi.fn(async () => sseResponse(sseReply(reply)));
  const events: HelpEvent[] = [];
  for await (const event of askHelp({ question, settings: settingsOf(), snapshot: textSnapshot(), index: docs, fetchImpl: fetchImpl as unknown as typeof fetch, ...over })) events.push(event);
  const done = events.findLast((event) => event.type === 'done');
  const trace = events.findLast((event) => event.type === 'trace');
  if (done?.type !== 'done' || trace?.type !== 'trace') throw new Error('the question did not end');
  return {
    user: userOf(fetchImpl),
    ids: done.sources.map((section) => section.id),
    sources: done.sources,
    lead: done.lead?.id,
    flagged: done.flagged,
    trace: trace.trace,
  };
}

describe('the Quick Reference on the Code tab', () => {
  it('goes second, after the tab\'s lead, with the search hits after it', async () => {
    const { ids, lead, user } = await ask('How do I switch a trait?', { surface: CODE_TAB });
    expect(ids.slice(0, 3)).toEqual([LEAD, QUICK_REFERENCE_SECTION, GUIDE_TRAITS]);
    expect(lead).toBe(LEAD);
    expect(user).toContain(screenLine('World Editor screen, Code tab'));
  });

  it('goes once when the search also finds it', async () => {
    const { ids } = await ask('Show the quick reference of self value', { surface: CODE_TAB });
    expect(ids.filter((id) => id === QUICK_REFERENCE_SECTION)).toHaveLength(1);
    expect(ids.slice(0, 2)).toEqual([LEAD, QUICK_REFERENCE_SECTION]);
  });

  it('shows among the sent sections in AI Context', async () => {
    const { trace } = await ask('How do I switch a trait?', { surface: CODE_TAB });
    expect(trace.lead?.id).toBe(LEAD);
    expect(trace.sent.map((section) => section.id).slice(0, 2)).toEqual([LEAD, QUICK_REFERENCE_SECTION]);
  });

  it('rides lookup mode too, in the guide block', async () => {
    const { ids, user } = await ask('How do I switch a trait?', { surface: CODE_TAB, settings: settingsOf({ lookup: true }), snapshot: CAPABLE });
    expect(ids.slice(0, 2)).toEqual([LEAD, QUICK_REFERENCE_SECTION]);
    expect(user).toContain('A stat compares through `.value`.');
  });

  it('pins on the real guide: the Code tab\'s lead, then the Quick Reference', async () => {
    const { ids } = await ask('How do I make this go down?', { surface: CODE_TAB }, bundledDocsIndex());
    expect(ids.slice(0, 2)).toEqual([LEAD, QUICK_REFERENCE_SECTION]);
  });
});

describe('the Quick Reference on a code turn from another screen', () => {
  it('takes the lead\'s slot, and the screen line stays out', async () => {
    const { ids, lead, user, trace } = await ask('Can stats.Hunger drain each turn?', { surface: DETAILS_TAB });
    expect(ids[0]).toBe(QUICK_REFERENCE_SECTION);
    expect(lead).toBe(QUICK_REFERENCE_SECTION);
    expect(trace.lead?.id).toBe(QUICK_REFERENCE_SECTION);
    expect(user).not.toContain(screenLine('World Editor screen, Details tab'));
  });

  it('leads a code question with no screen open, and the Code tab while Use the Open Screen is off', async () => {
    expect((await ask('Can stats.Hunger drain each turn?')).ids[0]).toBe(QUICK_REFERENCE_SECTION);
    const off = await ask('Can stats.Hunger drain each turn?', { surface: CODE_TAB, settings: settingsOf({ openScreen: false }) });
    expect(off.ids[0]).toBe(QUICK_REFERENCE_SECTION);
    expect(off.ids).not.toContain(LEAD);
  });

  it('pins on a bare code turn: the guide block holds the Quick Reference alone', async () => {
    const { ids, user } = await ask('Can stats.Hunger drain each turn?', { settings: settingsOf(BARE) });
    expect(ids).toEqual([QUICK_REFERENCE_SECTION]);
    expect(user.startsWith('<guide>')).toBe(true);
    expect(user.endsWith(`\n\n${DEFAULT_CODE_RIDER}`)).toBe(true);
  });

  it('flags a marked answer on a bare code turn, which a bare question never is', async () => {
    const reply = `${GENERAL_KNOWLEDGE_MARKER}\nFrom general knowledge.`;
    expect((await ask('Can stats.Hunger drain each turn?', { settings: settingsOf(BARE) }, index, reply)).flagged).toBe(true);
    expect((await ask('How do I add a trait?', { settings: settingsOf(BARE) }, index, reply)).flagged).toBe(false);
  });
});

describe('a turn that is not a code turn', () => {
  it('sends the screen\'s lead and the search hits, with no Quick Reference', async () => {
    const question = 'How do I add a trait?';
    const { ids, sources, user } = await ask(question, { surface: DETAILS_TAB });
    expect(ids[0]).toBe(FIELDS);
    expect(ids).not.toContain(QUICK_REFERENCE_SECTION);
    expect(user).toBe(helpUserMessage(question, sources, 'World Editor screen, Details tab'));
  });

  it('stays bare with every source off', async () => {
    const { ids, user } = await ask('How do I add a trait?', { settings: settingsOf(BARE) });
    expect(ids).toEqual([]);
    expect(user).toBe('How do I add a trait?');
  });
});

describe('helpSections with a pinned section', () => {
  const zebraIndex = (count: number, size: number) => createDocsIndex({
    pages: Object.fromEntries(Array.from({ length: count }, (_, k) => [`Z${k}`, `# Z${k}\n\n## Zebra ${k}\n\nzebra ${'x'.repeat(size)}\n`])),
  });
  const pin = { id: 'Pin#pin', page: 'Pin', heading: 'Pin', label: 'Pin', trail: [], markdown: '## Pin\n\nPinned.' };

  it('keeps the lead, then the pinned section, then hits up to the section limit', () => {
    const zebras = zebraIndex(8, 100);
    const lead = zebras.search('zebra')[0];
    const ids = helpSections(zebras, 'zebra', { lead, pinned: [pin] }).map((section) => section.id);
    expect(ids).toHaveLength(HELP_SECTION_LIMIT);
    expect(ids.slice(0, 2)).toEqual([lead.id, pin.id]);
  });

  it('counts the pinned section against the budget, so fewer hits fit', () => {
    const zebras = zebraIndex(8, 3900);
    const lead = zebras.search('zebra')[0];
    const big = { ...pin, markdown: 'p'.repeat(3900) };
    // The lead and the pin take about 7,800 of 12,000: one hit of about 3,900 still fits.
    expect(helpSections(zebras, 'zebra', { lead, pinned: [big] })).toHaveLength(3);
    expect(helpSections(zebras, 'zebra', { lead, pinned: [big], budget: 8000 }).map((section) => section.id)).toEqual([lead.id, big.id]);
  });
});
