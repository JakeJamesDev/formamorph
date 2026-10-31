// The answer request bodies of the full plan, byte for byte: a refactor of the request leaves these files untouched.
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { createDocsIndex } from '@/lib/docs/docsIndex';
import type { SurfaceId } from '@/lib/docs/surfaceMap';
import { UNKNOWN_REASONING_CAPABILITY, type ReasoningCapability } from '@/lib/reasoningEffort';
import type { Surface } from '@/lib/surface/surfaceRegistry';
import { parseTurns } from '@/lib/turnBanding';
import { sseReply, sseResponse, textSnapshot, textTarget } from '@/test/aiTextFixtures';
import { helpTool, isPickRequest, NO_PICK, openWorld } from '@/test/helpFixtures';
import type { Entity } from '@/types';
import { SCRIPT_TAB } from './helpCodeRider';
import type { HelpRequestPlan } from './helpRequestPlan';
import { askHelp, type HelpQuestion } from './helpSession';
import { helpSettingsOf, type HelpSettingsChange } from './helpSettings';
import type { OpenWorld } from './helpWorld';
import { buildPlayerView } from './playerView';
import { storySoFar } from './storySoFar';
import type { WorldIndexInput } from './worldIndex';

/** A change laid over the full plan, so a test sees that the body follows the plan. */
const change = vi.hoisted(() => ({ plan: null as Partial<HelpRequestPlan> | null }));
vi.mock('./helpRequestPlan', async (importOriginal) => {
  const real = await importOriginal<typeof import('./helpRequestPlan')>();
  return { ...real, fullHelpPlan: (...args: Parameters<typeof real.fullHelpPlan>) => ({ ...real.fullHelpPlan(...args), ...change.plan }) };
});

const index = createDocsIndex({
  pages: {
    ScriptsGuide: '# Stat Code\n\nCode sets a stat.\n\n## Quick Reference\n\nRead a stat through `.value`.\n',
    Entities: '# Entities\n\nAn entity is a character the narrator plays.\n\n## How to Add an Entity\n\n1. Select **Add**.\n',
  },
});

const CAPABLE = (() => {
  const reasoning: ReasoningCapability = { ...UNKNOWN_REASONING_CAPABILITY, tools: true, sources: { tools: 'native' } };
  return textSnapshot(textTarget({ reasoning }));
})();

const CODE_QUESTION = 'Write stat code that switches Brave on when my Courage reaches 50.';
const PLAIN_QUESTION = 'Who keeps the gate, and how do I add an entity?';

const surface = (...tabs: SurfaceId[]): Surface => ({ screen: 'worldEditor', dialog: null, tabs });
const CODE_TAB = surface(SCRIPT_TAB);

const mara: Entity = { id: 'mara', name: 'Mara', playerDescription: 'A widow who keeps the gate.', aiDescription: 'She hides the key under the shrine.' };
const sedge = (): WorldIndexInput => ({
  worldOverview: { name: 'Sedge', description: '', author: '', thumbnail: null, bgm: null, systemPrompt: '', tags: [] },
  stats: [], locations: [], traits: [], entities: [mara], items: [],
  dictionaries: [{ id: 'book', name: 'Lore', entries: [{ id: 'pact', name: 'Ashen Pact', key: ['ashen pact'], value: 'An oath sworn in smoke.' }] }],
});
const editorWorld = (): OpenWorld => ({ ...openWorld(), lean: 'editor', world: sedge });

const HISTORY = [
  { role: 'user' as const, content: 'I walk to the gate.' },
  { role: 'assistant' as const, content: JSON.stringify({ narration: 'Mara opens the gate.', choices: [], stat_changes: [], turnId: 't1', summary: 'You met Mara at the gate.' }) },
];
const gameWorld = (): OpenWorld => ({
  ...openWorld(),
  lean: 'game',
  game: () => ({
    view: buildPlayerView({ world: { entities: [mara], locations: [], traits: [] }, chain: [], history: HISTORY, persona: null, resolve: (text) => text }),
    story: storySoFar({ turns: parseTurns(HISTORY), memoryDigests: true, verbatimFloor: 1, milestoneDrop: null, stripMedia: false }),
    lore: [], loreVectors: null, resolve: (text) => text,
  }),
});

/** The first answer request body of one question; the pick requests are not the plan's. */
async function answerBody(question: string, settings: HelpSettingsChange, over: Partial<HelpQuestion> = {}): Promise<string> {
  const answers = vi.fn(async (_url: string, _init: RequestInit) => sseResponse(sseReply('Mara keeps the gate.')));
  const fetchImpl = ((url: string, init: RequestInit) => (isPickRequest(init) ? sseResponse(sseReply(NO_PICK)) : answers(url, init))) as unknown as typeof fetch;
  const events = askHelp({ question, settings: helpSettingsOf(settings), snapshot: CAPABLE, index, fetchImpl, ...over });
  for await (const _ of events) { /* drain */ }
  return `${JSON.stringify(JSON.parse(answers.mock.calls[0][1].body as string), null, 2)}\n`;
}

const KEYWORD = { sources: { keyword: true, aiPicks: false, semantic: false } };
const OFF = { sources: { keyword: false, aiPicks: false, semantic: false } };

/** Each case and the request it stands for. Roll, the face and the code test ride every case that can take them. */
const PARITY_CASES: [name: string, ask: () => Promise<string>][] = [
  ['code-turn', () => answerBody(CODE_QUESTION, { ...KEYWORD, roll: true }, { surface: CODE_TAB, world: editorWorld() })],
  ['non-code-turn', () => answerBody(PLAIN_QUESTION, { ...KEYWORD, roll: true }, { surface: surface('worldEditor.entities') })],
  ['editor-lean', () => answerBody(PLAIN_QUESTION, { ...KEYWORD, mascot: false }, { world: editorWorld() })],
  ['game-lean', () => answerBody(PLAIN_QUESTION, { ...KEYWORD, mascot: false }, { world: gameWorld() })],
  ['lookup-mode', () => answerBody(CODE_QUESTION, { ...KEYWORD, lookup: true }, { surface: CODE_TAB, world: editorWorld() })],
  ['bare-question', () => answerBody(PLAIN_QUESTION, { ...OFF, mascot: false })],
  ['tools-on', () => answerBody(PLAIN_QUESTION, { ...KEYWORD, mascot: false, tools: [helpTool()], toolSwitches: { 'h-1': true } }, { world: gameWorld() })],
];

describe('the answer request body', () => {
  it.each(PARITY_CASES)('of the %s case matches its captured body', async (name, ask) => {
    await expect(await ask()).toMatchFileSnapshot(`__bodies__/${name}.json`);
  });

  it.each<[keyof HelpRequestPlan, HelpRequestPlan[keyof HelpRequestPlan]]>([
    ['guide', false], ['world', false], ['story', false], ['code', null], ['code', { test: false }],
    ['lookup', false], ['roll', false], ['face', false], ['tools', []], ['riders', ['A rider of the plan.']],
  ])('changes some captured body when the plan sets %s to %j', async (field, value) => {
    change.plan = { [field]: value };
    try {
      const changed = [];
      for (const [name, ask] of PARITY_CASES) {
        if (await ask() !== readFileSync(new URL(`__bodies__/${name}.json`, import.meta.url), 'utf8')) changed.push(name);
      }
      expect(changed).not.toEqual([]);
    } finally {
      change.plan = null;
    }
  });

  it('keeps the world block and the story when the plan drops the guide alone', async () => {
    change.plan = { guide: false };
    try {
      const body = await answerBody(PLAIN_QUESTION, { ...KEYWORD, mascot: false }, { world: gameWorld() });
      expect(body).toContain('<world>');
      expect(body).toContain('<story>');
      expect(body).not.toContain('<section page=');
    } finally {
      change.plan = null;
    }
  });
});
