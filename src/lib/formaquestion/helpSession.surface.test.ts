import { describe, expect, it, vi } from 'vitest';
import { bundledDocsIndex } from '@/lib/docs/bundledDocsIndex';
import { createDocsIndex } from '@/lib/docs/docsIndex';
import type { SurfaceId } from '@/lib/docs/surfaceMap';
import { UNKNOWN_REASONING_CAPABILITY, type ReasoningCapability } from '@/lib/reasoningEffort';
import type { Surface } from '@/lib/surface/surfaceRegistry';
import { sseResponse, sseReply, textSnapshot, textTarget } from '@/test/aiTextFixtures';
import { pastPicks } from '@/test/helpFixtures';
import { askHelp, type HelpEvent, type HelpQuestion } from './helpSession';
import { helpSettingsOf } from './helpSettings';
import { surfaceHint } from './surfaceHint';

const PAGES = {
  Settings: '# ⚙️ Settings\n\nSettings hold your options.\n\n## Display\n\nDisplay holds the theme and text size.\n\n## Output\n\nOutput holds the narration length.\n\n## Tag Prompt\n\nThe tag prompt writes image tags.\n',
  Traits: '# 🧬 Traits\n\nA trait changes a stat.\n\n## How to Add a Trait\n\n1. Open the **Traits** tab.\n',
};
const index = createDocsIndex({ pages: PAGES, sidebar: '- [Settings](Settings)\n- [Traits](Traits)\n' });

const surface = (screen: SurfaceId | null, dialog: SurfaceId | null = null, tabs: SurfaceId[] = []): Surface => ({ screen, dialog, tabs });
const SETTINGS_DISPLAY = surface('mainMenu', 'settings', ['settings.display']);

type FetchSpy = ReturnType<typeof vi.fn<(url: string, init: RequestInit) => Promise<Response>>>;
const replyWith = (): FetchSpy => vi.fn(async () => sseResponse(sseReply('Done.')));
const userMessage = (spy: FetchSpy): string =>
  (JSON.parse(spy.mock.calls[0][1].body as string) as { messages: { role: string; content: string }[] }).messages.at(-1)!.content;

async function ask(question: string, over: Partial<HelpQuestion> = {}) {
  const fetchImpl = replyWith();
  const events: HelpEvent[] = [];
  for await (const event of askHelp({ question, settings: helpSettingsOf(), snapshot: textSnapshot(), index, fetchImpl: pastPicks(fetchImpl), ...over })) events.push(event);
  const done = events.at(-1);
  return { sent: userMessage(fetchImpl), sources: done?.type === 'done' ? done.sources.map((section) => section.id) : [] };
}

describe('the surface hint', () => {
  it('names the open dialog and tab by label and holds the mapped section', async () => {
    const { sent, sources } = await ask('What does this tab do?', { surface: SETTINGS_DISPLAY });
    expect(sent).toContain('this screen: Settings dialog, Display tab.');
    expect(sent).toContain('Display holds the theme and text size.');
    expect(sent).not.toMatch(/settings\.display|mainMenu/);
    expect(sources[0]).toBe('Settings#display');
  });

  it('puts the mapped section ahead of the search hits, once', async () => {
    const { sent, sources } = await ask('How do I add a trait? What is Display?', { surface: SETTINGS_DISPLAY });
    expect(sources[0]).toBe('Settings#display');
    expect(sources).toContain('Traits#how-to-add-a-trait');
    expect(sources.filter((id) => id === 'Settings#display')).toHaveLength(1);
    expect(sent.indexOf('Display holds')).toBeLessThan(sent.indexOf('1. Open the **Traits** tab.'));
  });

  it('never sends more than five sections, the surface section included', async () => {
    const crowded = createDocsIndex({
      pages: {
        ...PAGES,
        ...Object.fromEntries(Array.from({ length: 8 }, (_, n) => [`Zebra${n}`, `## Display zebra ${n}\n\nA zebra display.`])),
      },
    });
    const { sources } = await ask('Display zebra display', { surface: SETTINGS_DISPLAY, index: crowded });
    expect(sources).toHaveLength(5);
    expect(sources[0]).toBe('Settings#display');
  });

  describe('the how-to of the open page', () => {
    const editor = createDocsIndex({
      pages: {
        ...PAGES,
        'World-Editor-Locations': '# 🗺️ World Editor: Locations\n\nLocations hold the map.\n\n## How to Add a Location\n\n1. Select **Add Location**.\n',
        ...Object.fromEntries(Array.from({ length: 6 }, (_, n) => [`Other${n}`, `## Other ${n}\n\nOne more thing to add here.`])),
      },
    });
    const LOCATIONS = surface('worldEditor', null, ['worldEditor.locations']);
    const HOW_TO = 'World-Editor-Locations#how-to-add-a-location';

    it('joins a question with no keyword of its own that points at the screen', async () => {
      const { sources } = await ask('How do I add one here?', { surface: LOCATIONS, index: editor });
      expect(sources[0]).toMatch(/^World-Editor-Locations#.*world-editor-locations$/);
      expect(sources[0]).not.toContain('how-to');
      expect(sources).toContain(HOW_TO);
    });

    it('stays out of a task question that does not point at the screen, which keeps its own hits', async () => {
      const { sources } = await ask('How do I add one?', { surface: LOCATIONS, index: editor });
      expect(sources[0]).toMatch(/^World-Editor-Locations#.*world-editor-locations$/);
      expect(sources).not.toContain(HOW_TO);
      expect(sources.filter((id) => id.startsWith('Other'))).toHaveLength(4);
    });

    it('joins every question with the how-to rule off, for a probe\'s control arm', async () => {
      const { sources } = await ask('How do I add one?', { surface: LOCATIONS, index: editor, howToRule: false });
      expect(sources).toContain(HOW_TO);
    });
  });

  it('sends the Locations how-to from the bundled docs for "how do I add one here?"', async () => {
    const { sources } = await ask('How do I add one here?', { surface: surface('worldEditor', null, ['worldEditor.locations']), index: bundledDocsIndex() });
    expect(sources).toContain('World-Editor-Locations#how-to-add-a-location');
    expect(sources.length).toBeLessThanOrEqual(5);
  });

  it('reads the Surface of the call, so a later question names the later Surface', async () => {
    const first = await ask('What is this?', { surface: SETTINGS_DISPLAY });
    const second = await ask('What is this?', { surface: surface('mainMenu', 'settings', ['settings.output']) });
    expect(first.sent).toContain('Display tab');
    expect(second.sent).toContain('Output tab');
    expect(second.sent).not.toContain('Display tab');
  });

  it('adds nothing for a Surface players never see', async () => {
    const withHint = await ask('What is this?', { surface: surface('mainMenu', 'adminPanel', ['adminPanel.users']) });
    const without = await ask('What is this?');
    expect(withHint.sent).toBe(without.sent);
    expect(withHint.sources).toEqual(without.sources);
  });

  it('adds nothing when no Surface is open', async () => {
    const empty = await ask('What is this?', { surface: surface(null) });
    expect(empty.sent).toBe((await ask('What is this?')).sent);
  });

  it('holds only labels and docs text: nothing from a world, a save or a field', async () => {
    const { sent } = await ask('What does this tab do?', { surface: SETTINGS_DISPLAY });
    const line = sent.split('\n').find((text) => text.startsWith('The player asks from'))!;
    expect(line).toContain('Settings dialog, Display tab');
    // The message is the guide, the screen line and the question.
    expect(sent.replace(/<guide>[\s\S]*<\/guide>/, '').trim().split('\n').filter(Boolean)).toEqual([line, 'Question: What does this tab do?', 'Answer the question from the guide sections above.']);
  });

  it('puts the mapped section in a lookup request as a section already fetched', async () => {
    const reasoning: ReasoningCapability = { ...UNKNOWN_REASONING_CAPABILITY, tools: true, sources: { tools: 'native' } };
    const { sent, sources } = await ask('What does this tab do?', { surface: SETTINGS_DISPLAY, settings: helpSettingsOf({ lookup: true }), snapshot: textSnapshot(textTarget({ reasoning })) });
    expect(sent).toContain('<section id="Settings#display">');
    expect(sent).toContain('this screen: Settings dialog, Display tab.');
    expect(sources[0]).toBe('Settings#display');
  });
});

describe('surfaceHint', () => {
  it('spells acronyms and joins words of a tab id', () => {
    expect(surfaceHint(surface('mainMenu', 'settings', ['settings.display', 'settingsEndpoints.tagPrompt']), index)?.where)
      .toBe('Settings dialog, Display tab, Tag Prompt tab');
  });

  it('names the screen when no dialog is open', () => {
    const library = createDocsIndex({
      pages: { Library: '# 📚 Library\n\nHolds worlds.\n\n## The Library Tabs\n\nTabs.\n' },
      sidebar: '- [Library](Library)\n',
    });
    expect(surfaceHint(surface('mainMenu', null, ['mainMenu.worlds']), library)?.where).toBe('Main Menu screen, Worlds tab');
  });
});
