import { describe, expect, it, vi } from 'vitest';
import { createDocsIndex } from '@/lib/docs/docsIndex';
import type { SurfaceId } from '@/lib/docs/surfaceMap';
import { UNKNOWN_REASONING_CAPABILITY } from '@/lib/reasoningEffort';
import type { Surface } from '@/lib/surface/surfaceRegistry';
import { sseReply, sseResponse, textSnapshot, textTarget } from '@/test/aiTextFixtures';
import { GENERAL_KNOWLEDGE_MARKER } from './generalKnowledge';
import { askHelp, type HelpEvent, type HelpQuestion } from './helpSession';
import { helpSettingsOf, type HelpSettingsChange } from './helpSettings';

const PAGES = {
  Settings: '# ⚙️ Settings\n\nSettings hold your options.\n\n## Display\n\nDisplay holds the theme and text size.\n',
  Traits: '# 🧬 Traits\n\nA trait changes a stat.\n\n## How to Add a Trait\n\n1. Open the **Traits** tab.\n',
};
const index = createDocsIndex({ pages: PAGES, sidebar: '- [Settings](Settings)\n- [Traits](Traits)\n' });
const LOOKUP = textSnapshot(textTarget({ reasoning: { ...UNKNOWN_REASONING_CAPABILITY, tools: true, sources: { tools: 'native' } } }));

const surface = (screen: SurfaceId | null, dialog: SurfaceId | null = null, tabs: SurfaceId[] = []): Surface => ({ screen, dialog, tabs });
const SETTINGS_DISPLAY = surface('mainMenu', 'settings', ['settings.display']);
/** A Surface that maps to no docs section. */
const UNMAPPED = surface(null);

/** Every search source off, and the open screen off. */
const PLAIN_CHAT: HelpSettingsChange = { sources: { keyword: false, aiPicks: false, semantic: false }, lookup: false, openScreen: false };

type FetchSpy = ReturnType<typeof vi.fn<(url: string, init: RequestInit) => Promise<Response>>>;
type Body = { messages: { role: string; content: string }[]; tools?: unknown[] };
const asFetch = (spy: FetchSpy) => spy as unknown as typeof fetch;
const bodyOf = (spy: FetchSpy, call = 0): Body => JSON.parse(spy.mock.calls[call][1].body as string) as Body;

async function ask(question: string, change: HelpSettingsChange, { reply = 'Light scatters.', ...over }: Partial<HelpQuestion> & { reply?: string } = {}) {
  const fetchImpl: FetchSpy = vi.fn(async () => sseResponse(sseReply(reply)));
  const events: Exclude<HelpEvent, { type: 'trace' | 'stage' | 'face' }>[] = [];
  for await (const event of askHelp({ question, settings: helpSettingsOf(change), snapshot: textSnapshot(), index, fetchImpl: asFetch(fetchImpl), ...over })) {
    if (event.type !== 'trace' && event.type !== 'stage' && event.type !== 'face') events.push(event);
  }
  const done = events.at(-1);
  if (done?.type !== 'done') throw new Error('no done event');
  return { fetchImpl, events, done: { ...done, sources: done.sources.map((section) => section.id), nearest: done.nearest.map((section) => section.id) } };
}

describe('a question that no section can reach', () => {
  it('goes to the model as the question alone, and its answer has no flag and no nearest sections', async () => {
    const { fetchImpl, done } = await ask('Why is the sky blue?', PLAIN_CHAT, { surface: SETTINGS_DISPLAY });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(bodyOf(fetchImpl).messages.at(-1)).toEqual({ role: 'user', content: 'Why is the sky blue?' });
    expect(done).toMatchObject({ text: 'Light scatters.', flagged: false, sources: [], nearest: [] });
  });

  it('removes a marker the model writes, and still does not flag the answer', async () => {
    const { events, done } = await ask('How do I add a trait?', PLAIN_CHAT, { reply: `${GENERAL_KNOWLEDGE_MARKER}\nA trait is a tag.` });

    expect(done).toMatchObject({ text: 'A trait is a tag.', flagged: false });
    expect(events.every((event) => !event.flagged)).toBe(true);
  });

  it('keeps the earlier exchanges ahead of the question', async () => {
    const history = [{ question: 'What is a stat?', answer: 'A number.' }];
    const { fetchImpl } = await ask('And a trait?', PLAIN_CHAT, { history });

    expect(bodyOf(fetchImpl).messages.slice(1)).toEqual([
      { role: 'user', content: 'What is a stat?' },
      { role: 'assistant', content: 'A number.' },
      { role: 'user', content: 'And a trait?' },
    ]);
  });

  it('is bare also with the open screen on, when the screen maps to no section', async () => {
    const { fetchImpl, done } = await ask('Why is the sky blue?', { ...PLAIN_CHAT, openScreen: true }, { surface: UNMAPPED });

    expect(bodyOf(fetchImpl).messages.at(-1)?.content).toBe('Why is the sky blue?');
    expect(done.flagged).toBe(false);
  });

  it('is bare also with lookup on, when the endpoint does not take function calls', async () => {
    const { fetchImpl, done } = await ask('Why is the sky blue?', { ...PLAIN_CHAT, lookup: true });

    expect(bodyOf(fetchImpl).messages.at(-1)?.content).toBe('Why is the sky blue?');
    expect(bodyOf(fetchImpl).tools).toBeUndefined();
    expect(done.flagged).toBe(false);
  });
});

describe('a question that a section can still reach', () => {
  it('keeps the guide block when every source is off and the open screen leads with its section', async () => {
    const { fetchImpl, done } = await ask('What does this do?', { ...PLAIN_CHAT, openScreen: true }, { surface: SETTINGS_DISPLAY });

    expect(bodyOf(fetchImpl).messages.at(-1)?.content).toContain('<guide>');
    expect(bodyOf(fetchImpl).messages.at(-1)?.content).toContain('Display holds the theme and text size.');
    expect(done.sources).toEqual(['Settings#display']);
  });

  it('keeps the lookup request when every source is off and the endpoint takes function calls', async () => {
    const { fetchImpl, done } = await ask('Why is the sky blue?', { ...PLAIN_CHAT, lookup: true, mascot: false }, { snapshot: LOOKUP });

    expect(bodyOf(fetchImpl).messages.at(-1)?.content).not.toBe('Why is the sky blue?');
    expect(bodyOf(fetchImpl).tools).toHaveLength(1);
    expect(done).toMatchObject({ flagged: true, sources: [] });
  });

  it('keeps the empty guide block and the flag when the keyword search runs and finds nothing', async () => {
    const { fetchImpl, done } = await ask('Why is the sky blue?', { sources: { keyword: true, aiPicks: false } });

    expect(bodyOf(fetchImpl).messages.at(-1)?.content).toContain('<guide>\n\n</guide>');
    expect(done).toMatchObject({ flagged: true, sources: [] });
  });
});

describe('Use the Open Screen', () => {
  it('off, leaves the screen section and the screen line out of the answer request and the pick request', async () => {
    const fetchImpl: FetchSpy = vi.fn(async () => sseResponse(sseReply('Done.')));
    const events: HelpEvent[] = [];
    const question = { question: 'How do I add a trait?', settings: helpSettingsOf({ openScreen: false }), snapshot: textSnapshot(), index, surface: SETTINGS_DISPLAY, fetchImpl: asFetch(fetchImpl) };
    for await (const event of askHelp(question)) events.push(event);

    const sent = fetchImpl.mock.calls.map((call) => call[1].body as string).join('\n');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(sent).not.toContain('Settings dialog');
    expect(sent).not.toContain('Display holds the theme');
    const done = events.at(-1);
    expect(done?.type === 'done' && done.lead).toBeUndefined();
  });
});
