import { describe, expect, it, vi } from 'vitest';
import { createDocsIndex } from '@/lib/docs/docsIndex';
import { sseReply, sseResponse, textSnapshot, textTarget } from '@/test/aiTextFixtures';
import { isPickRequest, NO_PICK, openWorld } from '@/test/helpFixtures';
import { ENTITY_RIDER, entityAddNote } from './entityBlock';
import { askHelp, type HelpEvent, type HelpQuestion } from './helpSession';
import { helpSettingsOf, type HelpSettingsChange } from './helpSettings';
import type { OpenWorld } from './helpWorld';
import type { WorldIndexInput } from './worldIndex';

/** The entity rider and the add note: what an entity block's request side puts in the answer request. */

const index = createDocsIndex({ pages: { Entities: '# Entities\n\nAn entity is a character the narrator plays.\n' } });

const sedge = (): WorldIndexInput => ({
  worldOverview: { name: 'Sedge', description: '', author: '', thumbnail: null, bgm: null, systemPrompt: '', tags: [] },
  stats: [], locations: [], traits: [], items: [], dictionaries: [],
  entities: [{ id: 'mara', name: 'Mara', playerDescription: '', aiDescription: 'She keeps the gate.' }],
});

const editorWorld = (): OpenWorld => ({ ...openWorld(), lean: 'editor', world: sedge });

type FetchSpy = ReturnType<typeof vi.fn<(url: string, init: RequestInit) => Promise<Response>>>;

function endpoint() {
  const answers: FetchSpy = vi.fn(async () => sseResponse(sseReply('Here is a guard.')));
  const fetchImpl = ((url: string, init: RequestInit) => (isPickRequest(init) ? sseResponse(sseReply(NO_PICK)) : answers(url, init))) as unknown as typeof fetch;
  return { fetchImpl, answers };
}

const userMessage = (spy: FetchSpy) => (JSON.parse(spy.mock.calls[0][1].body as string) as { messages: { content: string }[] }).messages.at(-1)!.content;

async function ask(over: Partial<HelpQuestion> = {}, settings: HelpSettingsChange = {}) {
  const { fetchImpl, answers } = endpoint();
  const events: HelpEvent[] = [];
  for await (const event of askHelp({
    question: 'Make me a gate guard.',
    settings: helpSettingsOf({ mascot: false, sources: { keyword: true, aiPicks: false, semantic: false }, ...settings }),
    snapshot: textSnapshot(textTarget()),
    index,
    fetchImpl,
    ...over,
  })) events.push(event);
  return userMessage(answers);
}

describe('the entity rider', () => {
  it('rides the full request in a World Editor with Creation on', async () => {
    expect(await ask({ world: editorWorld() }, { creation: true })).toContain(ENTITY_RIDER);
  });

  it('rides it even with Read the World off', async () => {
    expect(await ask({ world: editorWorld() }, { creation: true, readWorld: false })).toContain(ENTITY_RIDER);
  });

  it.each<[string, Partial<HelpQuestion>, HelpSettingsChange]>([
    ['Creation off in a World Editor', { world: editorWorld() }, { creation: false }],
    ['Creation on in game', { world: openWorld() }, { creation: true }],
    ['Creation on with no world open', {}, { creation: true }],
  ])('stays out with %s', async (_, over, settings) => {
    expect(await ask(over, settings)).not.toContain(ENTITY_RIDER);
  });
});

describe('the add note', () => {
  it('rides last, after the entity rider, and names every entity added', async () => {
    const message = await ask({ world: editorWorld(), added: ['Ash', 'Birch'] }, { creation: true });
    expect(message.endsWith(`${ENTITY_RIDER}\n\n${entityAddNote(['Ash', 'Birch'])}`)).toBe(true);
  });

  it('rides a bare question in game too', async () => {
    const message = await ask({ world: openWorld(), added: ['Ash'] }, { sources: { keyword: false, aiPicks: false, semantic: false }, readWorld: false });
    expect(message).toBe(`Make me a gate guard.\n\n${entityAddNote(['Ash'])}`);
  });

  it('stays out when nothing was added', async () => {
    expect(await ask({ world: editorWorld(), added: [] })).toBe(await ask({ world: editorWorld() }));
  });
});
