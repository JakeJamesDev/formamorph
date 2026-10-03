import { describe, expect, it } from 'vitest';
import { createDocsIndex } from '@/lib/docs/docsIndex';
import type { Surface } from '@/lib/surface/surfaceRegistry';
import { sseReply, sseResponse, textSnapshot } from '@/test/aiTextFixtures';
import { pastPicks } from '@/test/helpFixtures';
import { askHelp, type HelpQuestion } from './helpSession';
import { helpSettingsOf } from './helpSettings';

// The model picks a section on the open screen's page and one on another page; no question below holds a
// word of either, so only the pick brings them in.
const index = createDocsIndex({
  pages: {
    Settings: '# Settings\n\n## Display\n\nDisplay holds the look.\n\n## How to Change the Theme\n\n1. Select **Theme**.\n',
    Memory: '# Memory\n\nThe AI keeps notes.\n\n## How to Edit a Note\n\n1. Select **Edit**.\n',
  },
  sidebar: '- [Settings](Settings)\n- [Memory](Memory)\n',
});
const LEAD = 'Settings#display';
const ON_PAGE = 'Settings#how-to-change-the-theme';
const OFF_PAGE = 'Memory#how-to-edit-a-note';
const BOTH = 'Memory › How to Edit a Note\nSettings › How to Change the Theme';
const DISPLAY_TAB: Surface = { screen: 'mainMenu', dialog: 'settings', tabs: ['settings.display'] };

async function sources(question: string, picked: string, over: Partial<HelpQuestion> = {}): Promise<string[]> {
  const fetchImpl = pastPicks(() => sseResponse(sseReply('It shows the look.')), picked);
  for await (const event of askHelp({ question, settings: helpSettingsOf(), snapshot: textSnapshot(), index, surface: DISPLAY_TAB, fetchImpl, ...over })) {
    if (event.type === 'done') return event.sources.map((section) => section.id);
  }
  throw new Error('the question did not end');
}

describe('a question that points at the open screen', () => {
  it.each(['what is going on here?', 'what is this?', 'what are these?'])('keeps only the picks on the screen\'s page: %s', async (question) => {
    expect(await sources(question, BOTH)).toEqual([LEAD, ON_PAGE]);
  });

  it('runs on the keyword search alone when every pick is off the screen\'s page', async () => {
    const offOnly = await sources('what is going on here?', 'Memory › How to Edit a Note');
    expect(offOnly).toEqual(await sources('what is going on here?', BOTH, { settings: helpSettingsOf({ sources: { aiPicks: false } }) }));
    expect(offOnly).not.toContain(OFF_PAGE);
  });

  it('keeps every pick with the screen rule off, for a probe\'s control arm', async () => {
    expect(await sources('what is going on here?', BOTH, { screenRule: false })).toEqual([LEAD, OFF_PAGE, ON_PAGE]);
  });
});

describe('a question that does not point at the open screen', () => {
  it.each(['what is going on?', 'where is it going on?', 'is thistle going on?'])('keeps the picks on every page: %s', async (question) => {
    expect(await sources(question, BOTH)).toEqual([LEAD, OFF_PAGE, ON_PAGE]);
  });

  it('keeps the picks on every page with no screen open, pointing words or not', async () => {
    expect(await sources('what is going on here?', BOTH, { surface: undefined })).toEqual([OFF_PAGE, ON_PAGE]);
  });
});
