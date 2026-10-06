/**
 * @vitest-environment node
 * (No DOM needed; node keeps the QuickJS WASM engine loading through its filesystem path.)
 */
import { describe, expect, it, vi } from 'vitest';
import { createDocsIndex } from '@/lib/docs/docsIndex';
import type { SurfaceId } from '@/lib/docs/surfaceMap';
import { UNKNOWN_REASONING_CAPABILITY, type ReasoningCapability } from '@/lib/reasoningEffort';
import type { StatCodeWorld } from '@/lib/statCodeTestRun';
import type { Surface } from '@/lib/surface/surfaceRegistry';
import { sseFrame, sseReply, sseResponse, textSnapshot, textTarget } from '@/test/aiTextFixtures';
import { emptyCodeWorld, openWorld, pastPicks } from '@/test/helpFixtures';
import type { Stat } from '@/types';
import { HELP_CODE_TEST } from './helpCodeTest';
import type { CodeTestResult } from './helpCodeTestRun';
import type { HelpFocus } from './helpFocus';
import { askHelp, type HelpEvent, type HelpQuestion } from './helpSession';
import { helpSettingsOf } from './helpSettings';
import type { HelpTrace } from './helpTrace';

const index = createDocsIndex({
  pages: {
    'World-Editor-Stats': '# World Editor: Stats\n\nStats hold numbers.\n\n## The Fields\n\nA stat has a name.\n\n## Dynamic Value Calculation\n\nCode sets a stat.\n',
    'World-Editor-Traits': '# World Editor: Traits\n\nTraits change stats.\n\n## The Panel\n\nA trait has a name.\n',
    StatCodeGuide: '# Stat Code\n\nCode sets a stat.\n\n## Quick Reference\n\nRead a stat through `.value`.\n',
  },
});

const editor = (...tabs: SurfaceId[]): Surface => ({ screen: 'mainMenu', dialog: 'worldEditor', tabs });
const STAT_CODE = editor('worldEditor.stats', 'worldEditorStat.code');
const STAT_DETAILS = editor('worldEditor.stats', 'worldEditorStat.details');
const TRAIT_PANEL = editor('worldEditor.traits', 'worldEditorTrait.details');
const COURAGE: HelpFocus = { kind: 'stat', id: 'courage', name: 'Courage' };

const endpoint = (tools: boolean) => {
  const reasoning: ReasoningCapability = { ...UNKNOWN_REASONING_CAPABILITY, tools, sources: { tools: 'native' } };
  return textSnapshot(textTarget({ reasoning }));
};

interface SentBody { messages: { role: string; content: string | null }[] }
type FetchSpy = ReturnType<typeof vi.fn<(url: string, init: RequestInit) => Promise<Response>>>;
const bodyOf = (spy: FetchSpy, request = 0) => JSON.parse(spy.mock.calls[request][1].body as string) as SentBody;
const userOf = (spy: FetchSpy) => bodyOf(spy).messages.at(-1)!.content ?? '';

const script = (...replies: string[][]): FetchSpy => {
  let request = 0;
  return vi.fn(async () => {
    const reply = replies[request++];
    if (!reply) throw new Error(`request ${request} has no scripted reply`);
    return sseResponse(reply);
  });
};

/** One code test call per argument set, as the model sends them. */
const testFrames = (...calls: Record<string, string>[]): string[] => [
  ...calls.map((args, at) => sseFrame({
    tool_calls: [{ index: at, id: `srv-${at}`, type: 'function', function: { name: HELP_CODE_TEST.name, arguments: JSON.stringify({ box: 'before', ...args }) } }],
  })),
  sseFrame({}, 'tool_calls'),
  'data: [DONE]\n\n',
];
const results = (spy: FetchSpy) => bodyOf(spy, 1).messages.filter((m) => m.role === 'tool').map((m) => JSON.parse(m.content ?? '') as CodeTestResult);

const stat = (name: string, value: number): Stat => ({ id: name.toLowerCase(), name, type: 'number', description: '', min: 0, max: 100, value, regen: 0, descriptors: [] });
const sedge = (): StatCodeWorld => ({ ...emptyCodeWorld(), stats: [stat('Courage', 40), stat('Int', 32)] });

async function ask(fetchImpl: FetchSpy, over: Partial<HelpQuestion>): Promise<HelpEvent[]> {
  const events: HelpEvent[] = [];
  const question = askHelp({
    question: 'What does this do?', settings: helpSettingsOf({ mascot: false, codeTest: true }), snapshot: endpoint(false), index, fetchImpl: pastPicks(fetchImpl), ...over,
  });
  for await (const event of question) events.push(event);
  return events;
}
const lastTrace = (events: HelpEvent[]): HelpTrace => events.filter((e): e is Extract<HelpEvent, { type: 'trace' }> => e.type === 'trace').at(-1)!.trace;

describe('the surface line with a focus', () => {
  it('names the focused stat after the open tab of its panel', async () => {
    const fetchImpl = script(sseReply('Done.'));
    await ask(fetchImpl, { surface: STAT_CODE, focus: COURAGE });
    expect(userOf(fetchImpl)).toContain('this screen: World Editor dialog, Stats tab, Code tab of the stat Courage.');
  });

  it('reads as before without a focus', async () => {
    const fetchImpl = script(sseReply('Done.'));
    await ask(fetchImpl, { surface: STAT_CODE });
    expect(userOf(fetchImpl)).toContain('this screen: World Editor dialog, Stats tab, Code tab.');
  });

  it('leaves out a focus whose panel is not open', async () => {
    const fetchImpl = script(sseReply('Done.'));
    await ask(fetchImpl, { surface: TRAIT_PANEL, focus: COURAGE });
    expect(userOf(fetchImpl)).toContain('this screen: World Editor dialog, Traits tab, Details tab.');
    expect(userOf(fetchImpl)).not.toContain('Courage');
  });

  it('names a trait on the trait panel', async () => {
    const fetchImpl = script(sseReply('Done.'));
    await ask(fetchImpl, { surface: TRAIT_PANEL, focus: { kind: 'trait', id: 'brave', name: 'Brave' } });
    expect(userOf(fetchImpl)).toContain('Traits tab, Details tab of the trait Brave.');
  });

  it('sends and traces no focus with Use the Open Screen off', async () => {
    const fetchImpl = script(sseReply('Done.'));
    const events = await ask(fetchImpl, { surface: STAT_DETAILS, focus: COURAGE, settings: helpSettingsOf({ mascot: false, openScreen: false }) });
    expect(userOf(fetchImpl)).not.toContain('Courage');
    expect(lastTrace(events).focus).toBeNull();
  });
});

describe('the focus in AI Context', () => {
  it('goes in the trace beside the surface', async () => {
    const trace = lastTrace(await ask(script(sseReply('Done.')), { surface: STAT_DETAILS, focus: COURAGE }));
    expect(trace.surface).toBe('World Editor dialog, Stats tab, Details tab');
    expect(trace.focus).toBe('stat Courage');
  });

  it('is null without a focus that matches the open panel', async () => {
    expect(lastTrace(await ask(script(sseReply('Done.')), { surface: STAT_DETAILS })).focus).toBeNull();
    expect(lastTrace(await ask(script(sseReply('Done.')), { surface: TRAIT_PANEL, focus: COURAGE })).focus).toBeNull();
  });
});

describe('the code test stat default', () => {
  const code = 'return self.value + 1;';
  const asked = (fetchImpl: FetchSpy, over: Partial<HelpQuestion> = {}) =>
    ask(fetchImpl, { question: 'Write the code for me.', surface: STAT_CODE, focus: COURAGE, snapshot: endpoint(true), world: openWorld(undefined, sedge), ...over });

  it('is optional', () => {
    expect(HELP_CODE_TEST.params.find((param) => param.name === 'stat')?.required).toBe(false);
  });

  it('reads the focused stat as self when the call names none, and an explicit stat wins', async () => {
    const fetchImpl = script(testFrames({ code }, { code, stat: ' ' }, { code, stat: 'Int' }), sseReply('Done.'));
    await asked(fetchImpl);
    expect(results(fetchImpl).map((result) => result.run?.value)).toEqual([41, 41, 33]);
  });

  it('gives a blank self with no focused stat', async () => {
    const fetchImpl = script(testFrames({ code }), sseReply('Done.'));
    await asked(fetchImpl, { focus: undefined });
    expect(results(fetchImpl).map((result) => result.run?.value)).toEqual([1]);
  });

  it('takes no focus of another kind', async () => {
    const fetchImpl = script(testFrames({ code }), sseReply('Done.'));
    await asked(fetchImpl, { surface: TRAIT_PANEL, focus: { kind: 'trait', id: 'courage', name: 'Courage' } });
    expect(results(fetchImpl).map((result) => result.run?.value)).toEqual([1]);
  });
});
