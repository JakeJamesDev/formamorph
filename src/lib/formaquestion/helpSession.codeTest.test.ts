/**
 * @vitest-environment node
 * (No DOM needed; node keeps the QuickJS WASM engine loading through its filesystem path.)
 */
import { describe, expect, it, vi } from 'vitest';
import { createDocsIndex } from '@/lib/docs/docsIndex';
import { SCRIPT_TIMINGS } from '@/lib/scripts';
import { SAMPLE_SENTENCE } from '@/lib/scriptTestSamples';
import { UNKNOWN_REASONING_CAPABILITY, type ReasoningCapability } from '@/lib/reasoningEffort';
import type { StatCodeWorld } from '@/lib/statCodeTestRun';
import { sseFrame, sseReply, sseResponse, textSnapshot, textTarget } from '@/test/aiTextFixtures';
import { emptyCodeWorld, openWorld, pastPicks, riderPreset } from '@/test/helpFixtures';
import type { ScriptTiming, Stat } from '@/types';
import { DEFAULT_CODE_RIDER, SANDBOX_GLOBAL_NAMES } from './helpCodeRider';
import { CODE_TEST_RIDER_LINE, HELP_CODE_TEST, HELP_CODE_TEST_CALL_LIMIT } from './helpCodeTest';
import type { CodeTestOwner, CodeTestResult } from './helpCodeTestRun';
import { askHelp, type HelpEvent, type HelpQuestion } from './helpSession';
import { helpSettingsOf, type HelpSettingsChange } from './helpSettings';
import type { HelpTrace } from './helpTrace';

const index = createDocsIndex({ pages: { ScriptsGuide: '# Stat Code\n\nCode sets a stat.\n\n## Quick Reference\n\nRead a stat through `.value`.\n' } });

const endpoint = (tools: boolean | null) => {
  const reasoning: ReasoningCapability = { ...UNKNOWN_REASONING_CAPABILITY, tools, sources: tools === null ? {} : { tools: 'native' } };
  return textSnapshot(textTarget({ reasoning }));
};
const CAPABLE = endpoint(true);

const CODE_QUESTION = 'Write stat code that switches Brave on when my Courage reaches 50.';

interface SentMessage { role: string; content: string | null }
interface SentBody { messages: SentMessage[]; tools?: unknown[] }
type FetchSpy = ReturnType<typeof vi.fn<(url: string, init: RequestInit) => Promise<Response>>>;

const bodyOf = (spy: FetchSpy, request = 0) => JSON.parse(spy.mock.calls[request][1].body as string) as SentBody;
const toolResults = (body: SentBody) => body.messages.filter((message) => message.role === 'tool').map((message) => message.content ?? '');
const toolNames = (body: SentBody) => (body.tools as { function: { name: string } }[] | undefined)?.map((tool) => tool.function.name) ?? [];
const results = (spy: FetchSpy) => toolResults(bodyOf(spy, 1)).map((text) => JSON.parse(text) as CodeTestResult & { error?: string });

interface TestCall { code: string; timing?: ScriptTiming; owner?: CodeTestOwner['kind']; name?: string }
const testFrames = (...calls: TestCall[]): string[] => [
  ...calls.map(({ code, timing = 'before', owner, name = owner ? undefined : 'Courage' }, at) => sseFrame({
    tool_calls: [{ index: at, id: `srv-${at}`, type: 'function', function: { name: HELP_CODE_TEST.name, arguments: JSON.stringify({ code, timing, owner, name }) } }],
  })),
  sseFrame({}, 'tool_calls'),
  'data: [DONE]\n\n',
];

const script = (...replies: string[][]): FetchSpy => {
  let request = 0;
  return vi.fn(async () => {
    const reply = replies[request++];
    if (!reply) throw new Error(`request ${request} has no scripted reply`);
    return sseResponse(reply);
  });
};

const stat = (name: string, value: number): Stat => ({ id: name.toLowerCase(), name, type: 'number', description: '', min: 0, max: 100, value, regen: 0, descriptors: [] });

const sedge = (): StatCodeWorld => ({
  ...emptyCodeWorld(),
  stats: [stat('Courage', 40), stat('Int', 32)],
  traits: [{ id: 'brave', name: 'Brave', statChanges: [] }],
});

// The Mascot is off, so the face call stays out of the offered functions.
const ask = (fetchImpl: FetchSpy, settings: HelpSettingsChange = {}, over: Partial<HelpQuestion> = {}) =>
  askHelp({ question: CODE_QUESTION, settings: helpSettingsOf({ mascot: false, codeTest: true, ...settings }), snapshot: CAPABLE, index, fetchImpl: pastPicks(fetchImpl), ...over });

async function collect(events: AsyncIterable<HelpEvent>): Promise<HelpEvent[]> {
  const all: HelpEvent[] = [];
  for await (const event of events) all.push(event);
  return all;
}

describe('the code test offer', () => {
  it('goes to a code turn on an endpoint that takes function calls, with its call limit', async () => {
    const fetchImpl = script(sseReply('Done.'));
    await collect(ask(fetchImpl));
    const offered = bodyOf(fetchImpl).tools as { function: { name: string } }[];
    expect(offered.map((tool) => tool.function.name)).toEqual([HELP_CODE_TEST.name]);
  });

  it('describes pending writes as no error', () => {
    expect(HELP_CODE_TEST.description).toMatch(/A pending write .*It is not an error/);
  });

  it('describes names not in the world and assumed stats as no errors, to create by kind', () => {
    expect(HELP_CODE_TEST.description).toMatch(/A notInWorld name and an assumed stat are not errors: keep the code, tell the player to create each one, and name its kind/);
  });

  it('stays out with its switch off, on a turn that is not a code turn, and on an endpoint without function calls', async () => {
    const off = script(sseReply('Done.'));
    await collect(ask(off, { codeTest: false }));
    expect(toolNames(bodyOf(off))).toEqual([]);

    const plain = script(sseReply('Done.'));
    await collect(ask(plain, {}, { question: 'How do I add a trait?' }));
    expect(toolNames(bodyOf(plain))).toEqual([]);

    for (const tools of [false, null]) {
      const unsupported = script(sseReply('Done.'));
      await collect(ask(unsupported, {}, { snapshot: endpoint(tools) }));
      expect(toolNames(bodyOf(unsupported))).toEqual([]);
    }
  });
});

describe('the test-first rider line', () => {
  const userOf = (spy: FetchSpy) => bodyOf(spy).messages.at(-1)!.content ?? '';

  it('ends the rider while the code test is offered', async () => {
    const fetchImpl = script(sseReply('Done.'));
    await collect(ask(fetchImpl));
    expect(userOf(fetchImpl).endsWith(`\n\n${DEFAULT_CODE_RIDER}\n${CODE_TEST_RIDER_LINE}`)).toBe(true);
  });

  it('leaves the rider as it is while the code test is not offered', async () => {
    const off = script(sseReply('Done.'));
    await collect(ask(off, { codeTest: false }));
    expect(userOf(off).endsWith(`\n\n${DEFAULT_CODE_RIDER}`)).toBe(true);

    const unsupported = script(sseReply('Done.'));
    await collect(ask(unsupported, {}, { snapshot: endpoint(false) }));
    expect(userOf(unsupported).endsWith(`\n\n${DEFAULT_CODE_RIDER}`)).toBe(true);
  });

  // Q35: the line belongs to the code test, so a cleared rider still sends it.
  it('goes alone after the message with an empty rider, and follows a custom one', async () => {
    const empty = script(sseReply('Done.'));
    await collect(ask(empty, { presets: riderPreset(' \n') }));
    expect(userOf(empty).endsWith(`.\n\n${CODE_TEST_RIDER_LINE}`)).toBe(true);
    expect(userOf(empty)).not.toContain(DEFAULT_CODE_RIDER.split('\n')[0]);

    const custom = script(sseReply('Done.'));
    await collect(ask(custom, { presets: riderPreset('Answer with code.\n') }));
    expect(userOf(custom).endsWith(`\n\nAnswer with code.\n${CODE_TEST_RIDER_LINE}`)).toBe(true);
  });

  it('names the function, and no example code or sandbox member', () => {
    expect(CODE_TEST_RIDER_LINE).toContain(`\`${HELP_CODE_TEST.name}\``);
    expect(CODE_TEST_RIDER_LINE).not.toMatch(/[=;(){}[\]]|\breturn\b/);
    expect(CODE_TEST_RIDER_LINE).not.toMatch(new RegExp(`\\b(?:${SANDBOX_GLOBAL_NAMES.join('|')})\\b`));
  });
});

describe('a code test call', () => {
  it('returns the analysis, the run, its writes and its dropped writes, and leaves the world as it was', async () => {
    const world = sedge();
    const before = structuredClone(world);
    const authored = vi.fn(() => world);
    const code = [
      'traits.Brave.enabled = stats.Courage.value >= 30;',
      'traits.Brav.enabled = true;',
      'self.value = 7;',
      'const wit = stats.Courag;',
    ].join('\n');
    const fetchImpl = script(testFrames({ code, name: 'Int' }, { code: 'return self.value + 1;', timing: 'after' }), sseReply('Here is your code.'));
    await collect(ask(fetchImpl, {}, { world: openWorld(undefined, authored) }));

    const [first, second] = results(fetchImpl);
    expect(first.world).toBe(true);
    expect(first.errors).toEqual([
      { line: 2, text: 'Brav', message: 'No trait is named “Brav”. Did you mean “Brave”?' },
      { line: 4, text: 'Courag', message: 'No stat is named “Courag”. Did you mean “Courage”?' },
    ]);
    expect(first.notInWorld).toEqual([]);
    expect(first.run).toEqual({
      error: null,
      value: 7,
      writes: ['Brave switched on'],
      pending: [],
      assumed: [],
      dropped: ['Unknown trait names. Writes ignored: Brav.'],
    });
    expect(second.run).toMatchObject({ error: null, value: 41 });
    expect(world).toEqual(before);
    expect(authored).toHaveBeenCalledTimes(1);
  });

  it('lists a persona switch on a trait a playable entity holds as pending, and drops one on any other name', async () => {
    // Wren can be played and Ash cannot, and Brave is the world's own.
    const world: StatCodeWorld = {
      ...sedge(),
      entities: [
        { id: 'wren', name: 'Wren', persona: true, traits: [{ id: 'seasoned', name: 'Seasoned', statChanges: [] }] },
        { id: 'ash', name: 'Ash', traits: [{ id: 'loyal', name: 'Loyal', statChanges: [] }] },
      ],
    };
    const code = [
      'persona.traits.Seasoned.enabled = clock.day > 14;',
      'persona.traits.Loyal.enabled = true;',
      'persona.traits.Brave.enabled = true;',
      'persona.traits.Seasoned.acquired = true;',
    ].join('\n');
    const fetchImpl = script(testFrames({ code }), sseReply('Done.'));
    await collect(ask(fetchImpl, {}, { world: openWorld(undefined, () => world) }));

    const [result] = results(fetchImpl);
    expect(result.run).toEqual({
      error: null,
      value: null,
      writes: [],
      pending: ['persona.traits.Seasoned switched off'],
      assumed: [],
      dropped: [
        'Unknown trait names. Writes ignored: persona.traits.Loyal, persona.traits.Brave.',
        'acquired is read-only. Writes ignored: persona.traits.Seasoned.',
      ],
    });
  });

  it('lists no pending writes on a run that throws', async () => {
    const world: StatCodeWorld = {
      ...sedge(),
      entities: [{ id: 'wren', name: 'Wren', persona: true, traits: [{ id: 'seasoned', name: 'Seasoned', statChanges: [] }] }],
    };
    const fetchImpl = script(testFrames({ code: 'persona.traits.Seasoned.enabled = true;\nreturn wisdom.value;' }), sseReply('Fixed.'));
    await collect(ask(fetchImpl, {}, { world: openWorld(undefined, () => world) }));
    const [result] = results(fetchImpl);
    expect(result.run).toMatchObject({ error: expect.any(String), writes: [], pending: [] });
  });

  it('reports a run that throws, with no writes', async () => {
    const fetchImpl = script(testFrames({ code: 'traits.Brave.enabled = true;\nreturn wisdom.value;' }), sseReply('Fixed.'));
    await collect(ask(fetchImpl, {}, { world: openWorld(undefined, sedge) }));
    const [result] = results(fetchImpl);
    expect(result.run?.error).toEqual(expect.any(String));
    expect(result.run?.writes).toEqual([]);
  });

  it('reads an unknown stat as a blank self', async () => {
    const fetchImpl = script(testFrames({ code: 'return self.value + 1;', name: 'Nope' }, { code: 'return self.value + 1;', name: '' }), sseReply('Done.'));
    await collect(ask(fetchImpl, {}, { world: openWorld(undefined, sedge) }));
    expect(results(fetchImpl).map((result) => result.run?.value)).toEqual([1, 1]);
  });

  it('with no world open, skips the name checks and the run and still reports syntax, clock and comparison errors', async () => {
    const fetchImpl = script(
      testFrames(
        { code: 'if (stats.Wisdom.value > 3 && clock.time >= 20) traits.Nope.enabled = true;\nreturn stats.Courage >= 50 ? 1 : 0;' },
        { code: 'return (;' },
      ),
      sseReply('Done.'),
    );
    await collect(ask(fetchImpl));
    const [names, syntax] = results(fetchImpl);
    expect(names).toMatchObject({ world: false });
    expect(names).not.toHaveProperty('notInWorld');
    expect(names).not.toHaveProperty('run');
    expect(names.errors.map((error) => error.message)).toEqual([
      expect.stringContaining('clock has no field “time”'),
      expect.stringContaining('stats.Courage is a whole stat, not a number'),
    ]);
    expect(JSON.stringify(names)).not.toMatch(/Wisdom|Nope/);
    expect(syntax.errors).toContainEqual(expect.objectContaining({ message: expect.stringContaining('Syntax error') }));
  });

  it('holds to 3 calls a question by default, and to the call limit setting', async () => {
    expect(HELP_CODE_TEST_CALL_LIMIT).toBe(3);
    const calls = Array.from({ length: 4 }, () => ({ code: 'return 1;' }));
    const byDefault = script(testFrames(...calls), sseReply('Done.'));
    await collect(ask(byDefault));
    const defaults = toolResults(bodyOf(byDefault, 1));
    expect(defaults.slice(0, 3).every((text) => JSON.parse(text).world === false)).toBe(true);
    expect(defaults[3]).toContain(`${HELP_CODE_TEST.name} has reached its limit of 3 calls`);

    const limited = script(testFrames(...calls.slice(0, 2)), sseReply('Done.'));
    await collect(ask(limited, { codeTestCallLimit: 1 }));
    expect(toolResults(bodyOf(limited, 1))[1]).toContain(`${HELP_CODE_TEST.name} has reached its limit of 1 call`);
  });

  it('shows each call and its result in the tool rounds of the trace', async () => {
    const fetchImpl = script(testFrames({ code: 'return 1;' }), sseReply('Done.'));
    const events = await collect(ask(fetchImpl, {}, { world: openWorld(undefined, sedge) }));
    const traces = events.flatMap((event): HelpTrace[] => (event.type === 'trace' ? [event.trace] : []));
    const [round] = traces.at(-1)!.requests.at(-1)!.record.toolRounds ?? [];
    expect(round.calls).toEqual([expect.objectContaining({ name: HELP_CODE_TEST.name, result: expect.stringContaining('"world":true') })]);
  });
});

describe('a code test call on an owned or Blueprint stat', () => {
  // Bram owns Rage and Grit and can be played, and Dread and Awe are Blueprint stats of one group.
  const stage = (): StatCodeWorld => ({
    ...sedge(),
    stats: [stat('Courage', 40), stat('Int', 32), { ...stat('Dread', 4), groupId: 'bp-fear' }, { ...stat('Awe', 6), groupId: 'bp-fear' }],
    statGroups: [{ id: 'bp', name: 'Blueprints', parentId: null, system: 'blueprints' }, { id: 'bp-fear', name: 'Fear', parentId: 'bp' }],
    entities: [{ id: 'bram', name: 'Bram', persona: true, stats: [stat('Rage', 3), stat('Grit', 8)] }],
  });
  const testOn = async (world: StatCodeWorld, ...calls: TestCall[]) => {
    const fetchImpl = script(testFrames(...calls), sseReply('Done.'));
    await collect(ask(fetchImpl, {}, { world: openWorld(undefined, () => world) }));
    return results(fetchImpl);
  };

  it('runs an entity’s stat with the world’s stats as `stats` and its entity as `owner`, and lists each write by route', async () => {
    const world = stage();
    const before = structuredClone(world);
    const code = 'stats.Courage.value = 45; owner.stats.Grit.max = 12; entities.Bram.stats.Grit.regen = 1; persona.stats.Grit.value = 2;';
    const [result] = await testOn(world, { code, name: 'Rage' });
    // The editor's reader checks the same box: `owner.stats` is Bram's, so Grit is a known name.
    expect(result.errors).toEqual([]);
    expect(result.run).toEqual({
      error: null,
      value: null,
      writes: ['stats.Courage.value = 45', 'owner.stats.Grit.max = 12', 'owner.stats.Grit.regen = 1'],
      pending: ['persona.stats.Grit.value = 2'],
      assumed: [],
      dropped: [],
    });
    expect(world).toEqual(before);
  });

  it('runs a Blueprint stat with an owner that holds its group’s stats only, and names a write outside the group as dropped', async () => {
    const [result] = await testOn(stage(), { code: 'owner.stats.Awe.value = 7; owner.stats.Courage.value = 1; return Object.keys(owner.stats).length;', name: 'Dread' });
    // An owner can hold stats beyond its group, so the reader warns on Courage and raises no error.
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([expect.objectContaining({ text: 'Courage' })]);
    expect(result.run).toMatchObject({
      error: null,
      value: 2,
      writes: ['owner.stats.Awe.value = 7'],
      dropped: ['Unknown stat names. Writes ignored: owner.stats.Courage.value.'],
    });
  });

  it('finds an owned stat by name only after the world’s own', async () => {
    const world: StatCodeWorld = { ...stage(), entities: [{ id: 'bram', name: 'Bram', stats: [{ ...stat('Courage', 5), id: 'twin' }] }] };
    const [result] = await testOn(world, { code: 'return Object.keys(owner.stats).length + 1;', name: 'Courage' });
    // The world's Courage runs, with no owner: its `owner.stats` is empty.
    expect(result.run?.value).toBe(1);
  });
});

describe('a code test call in every timing and on every owner', () => {
  // Bram can be played, owns Rage and holds Fierce; Brave is the world's own trait.
  const cast = (): StatCodeWorld => ({
    ...sedge(),
    entities: [{ id: 'bram', name: 'Bram', persona: true, stats: [stat('Rage', 3)], traits: [{ id: 'fierce', name: 'Fierce', statChanges: [] }] }],
  });
  const testOn = async (world: StatCodeWorld, ...calls: TestCall[]) => {
    const fetchImpl = script(testFrames(...calls), sseReply('Done.'));
    await collect(ask(fetchImpl, {}, { world: openWorld(undefined, () => world) }));
    return results(fetchImpl);
  };
  const ran = (writes: string[], more: object = {}): CodeTestResult => ({
    world: true, errors: [], warnings: [], notInWorld: [],
    run: { error: null, value: null, writes, pending: [], assumed: [], dropped: [], ...more },
  });

  it('offers all five timings and a stat, trait or world owner', () => {
    const options = (name: string) => HELP_CODE_TEST.params.find((param) => param.name === name)?.options;
    expect(options('timing')).toEqual([...SCRIPT_TIMINGS]);
    expect(options('owner')).toEqual(['stat', 'trait', 'world']);
  });

  it('runs a stat script in each timing', async () => {
    const fetchImpl = script(testFrames(...SCRIPT_TIMINGS.map((timing) => ({ code: 'stats.Int.value = 9;', timing }))), sseReply('Done.'));
    await collect(ask(fetchImpl, { codeTestCallLimit: SCRIPT_TIMINGS.length }, { world: openWorld(undefined, cast) }));
    expect(results(fetchImpl)).toEqual(SCRIPT_TIMINGS.map((timing) =>
      ran(['stats.Int.value = 9'], timing === 'output' ? { sentence: SAMPLE_SENTENCE } : {})));
  });

  it('runs a global trait script with its trait as self, and an entity’s with its entity as owner', async () => {
    const [brave, fierce] = await testOn(
      cast(),
      { code: "stats.Int.value = self.name === 'Brave' && !self.enabled ? 9 : 1;", owner: 'trait', name: 'Brave' },
      { code: "owner.stats.Rage.value = self.name === 'Fierce' ? 2 : 1;", owner: 'trait', name: 'Fierce' },
    );
    expect(brave).toEqual(ran(['stats.Int.value = 9']));
    expect(fierce).toEqual(ran(['owner.stats.Rage.value = 2']));
  });

  it('runs a Blueprint trait with an owner of no stats, and an unknown trait as one not held', async () => {
    const world: StatCodeWorld = {
      ...cast(),
      traits: [...cast().traits, { id: 'wary', name: 'Wary', statChanges: [], groupId: 'bp' }],
      traitGroups: [{ id: 'bp', name: 'Blueprints', parentId: null, system: 'blueprints' }],
    };
    const [wary, nope] = await testOn(
      world,
      { code: "owner.stats.Rage.value = self.name === 'Wary' ? 2 : 1;", owner: 'trait', name: 'Wary' },
      { code: "stats.Int.value = self.name === 'Nope' && !self.enabled ? 9 : 1;", owner: 'trait', name: 'Nope' },
    );
    // A Blueprint trait's owners vary, so the reader leaves `owner.stats` unchecked.
    expect(wary).toEqual(ran([], { dropped: ['Unknown stat names. Writes ignored: owner.stats.Rage.value.'] }));
    expect(nope).toEqual(ran(['stats.Int.value = 9']));
  });

  it('asks for the name of a trait it was not given', async () => {
    const [result] = await testOn(cast(), { code: 'stats.Int.value = 9;', owner: 'trait', name: ' ' });
    expect(result).toEqual({ error: 'A trait script needs the name of its trait.' });
  });

  it('runs a world script with an empty self and owner, and no stat named', async () => {
    const [result] = await testOn(cast(), { code: 'stats.Int.value = Object.keys(self).length + Object.keys(owner.stats).length + 3;', owner: 'world' });
    expect(result).toEqual(ran(['stats.Int.value = 3']));
  });

  it('rewrites a sample sentence During AI Output', async () => {
    const [result] = await testOn(cast(), { code: 'narration.sentence = narration.sentence.toUpperCase();', timing: 'output', owner: 'world' });
    expect(result).toEqual(ran([], { sentence: SAMPLE_SENTENCE.toUpperCase() }));
  });

  it('fires When a Trait Switches on a sample switched trait: a trait script’s own, else the world’s first', async () => {
    const code = "stats.Int.value = trait.enabled && trait.name === 'Brave' ? 50 : 1;";
    const [own, first] = await testOn(cast(), { code, timing: 'switch', owner: 'trait', name: 'Brave' }, { code, timing: 'switch', owner: 'world' });
    expect(own).toEqual(ran(['stats.Int.value = 50']));
    expect(first).toEqual(ran(['stats.Int.value = 50']));
  });
});

describe('a code test call on a half-built world', () => {
  // Wren can be played and owns Mood; Ash cannot and owns Grudge. Seasoned is on Wren alone.
  const halfBuilt = (): StatCodeWorld => ({
    ...sedge(),
    entities: [
      {
        id: 'wren', name: 'Wren', persona: true, traits: [{ id: 'seasoned', name: 'Seasoned', statChanges: [] }],
        placeholders: [{ id: 'mood', name: 'Mood', values: [{ id: 'calm', text: 'calm' }, { id: 'wary', text: 'wary' }] }],
      },
      {
        id: 'ash', name: 'Ash', traits: [{ id: 'loyal', name: 'Loyal', statChanges: [] }],
        placeholders: [{ id: 'grudge', name: 'Grudge', values: [{ id: 'old', text: 'old' }] }],
      },
    ],
  });
  const testOn = async (world: StatCodeWorld, ...calls: TestCall[]) => {
    const fetchImpl = script(testFrames(...calls), sseReply('Done.'));
    await collect(ask(fetchImpl, {}, { world: openWorld(undefined, () => world) }));
    return results(fetchImpl);
  };

  it('tags a name nothing is near as not in this world, with its kind, and keeps a typo an error', async () => {
    const code = [
      'traits.Rested.enabled = true;',
      'traits.Brav.enabled = true;',
      'persona.traits.Prowler.enabled = true;',
      "placeholders.Quotes.pin('The wind is howling');",
      "entities.Mara.placeholders.Hat.pin('red');",
      "persona.placeholders.Scar.pin('left');",
      'entities.Wren.traits.Quiet.enabled = true;',
      'const words = dictionaries.Lore;',
      "entities.Wren.placeholders.Hat.pin('red');",
    ].join('\n');
    const [result] = await testOn(halfBuilt(), { code });

    expect(result.errors).toEqual([{ line: 2, text: 'Brav', message: 'No trait is named “Brav”. Did you mean “Brave”?' }]);
    expect(result.warnings).toEqual([]);
    expect(result.notInWorld).toEqual([
      { line: 1, kind: 'trait', name: 'Rested', path: 'traits.Rested' },
      { line: 3, kind: 'trait', name: 'Prowler', path: 'persona.traits.Prowler' },
      { line: 4, kind: 'placeholder', name: 'Quotes', path: 'placeholders.Quotes' },
      { line: 5, kind: 'entity', name: 'Mara', path: 'entities.Mara' },
      { line: 6, kind: 'placeholder', name: 'Scar', path: 'persona.placeholders.Scar' },
      { line: 7, kind: 'trait', name: 'Quiet', path: 'entities.Wren.traits.Quiet' },
      { line: 8, kind: 'dictionary', name: 'Lore', path: 'dictionaries.Lore' },
      { line: 9, kind: 'placeholder', name: 'Hat', path: 'entities.Wren.placeholders.Hat' },
    ]);
    expect(result.run).toEqual({ error: null, value: null, writes: [], pending: [], assumed: [], dropped: ['Unknown trait names. Writes ignored: Brav.'] });
  });

  it('keeps a name another owner holds, or one near it, an error or a dropped write, never a tag', async () => {
    const code = [
      'traits.Seasoned.enabled = clock.day > 14;',
      'persona.traits.Brave.enabled = true;',
      'entities.Ash.traits.Seasoned.enabled = true;',
      "placeholders.Grudge.pin('new');",
      'traits.Seasone.enabled = true;',
      "placeholders.Grudg.pin('new');",
    ].join('\n');
    const [result] = await testOn(halfBuilt(), { code });

    expect(result.notInWorld).toEqual([]);
    expect(result.errors.map(({ line }) => line)).toEqual([1, 4, 5, 6]);
    expect(result.warnings.map(({ line }) => line)).toEqual([2, 3]);
    expect(result.run?.dropped).toEqual([
      'Unknown placeholder paths. Writes ignored: Grudge, Grudg.',
      'Unknown trait names. Writes ignored: Seasoned, Seasone.',
      'Unknown trait names. Writes ignored: entities.Ash.traits.Seasoned.',
      'Unknown trait names. Writes ignored: persona.traits.Brave.',
    ]);
  });

  it('assumes a stat nothing is near at 0 in 0–100, lists it, and leaves a typo stat out', async () => {
    const [ratio, range] = await testOn(
      halfBuilt(),
      { code: 'const typo = stats.Courag;\nreturn stats.Wisdom.value / stats.Wisdom.max;' },
      { code: 'return stats.Wisdom.max - stats.Wisdom.min + stats.Wisdom.value;' },
    );
    expect(ratio.notInWorld).toEqual([{ line: 2, kind: 'stat', name: 'Wisdom', path: 'stats.Wisdom' }]);
    expect(ratio.errors.map(({ text }) => text)).toEqual(['Courag']);
    expect(ratio.run).toMatchObject({ error: null, value: 0, writes: [], assumed: ['Wisdom'], dropped: [] });
    expect(range.run).toMatchObject({ error: null, value: 100, assumed: ['Wisdom'] });
  });

  it('lists a persona pin on a placeholder a playable entity owns as pending, in the scene', async () => {
    const code = [
      "persona.placeholders.Mood.pin('wary');",
      "persona.placeholders.Grudge.pin('new');",
      'return persona.inScene ? 1 : 0;',
    ].join('\n');
    const [result] = await testOn(halfBuilt(), { code });

    expect(result.notInWorld).toEqual([]);
    expect(result.run).toEqual({
      error: null,
      value: 1,
      writes: [],
      pending: ['persona.placeholders.Mood = wary'],
      assumed: [],
      dropped: ['Unknown placeholder paths. Writes ignored: persona › Grudge.'],
    });
  });

  it('lists the stats it assumed on a run that throws', async () => {
    const [result] = await testOn(halfBuilt(), { code: 'const w = stats.Wisdom.value;\nreturn wisdom.value;' });
    expect(result.run).toMatchObject({ error: expect.any(String), writes: [], pending: [], assumed: ['Wisdom'], dropped: [] });
  });
});
