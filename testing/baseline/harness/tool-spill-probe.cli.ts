// Tool-offer spill probe: replays captured requests of one bundled world through the app's own tool loop, with
// the world's judgment Tool offered or withheld, and counts native-reasoning spills, Tool calls and usable replies.
// The capture is a world-probe output (`<out>/<world>.json`); its first run's turn 1 and turn 2 supply the
// narration, choices and stat requests. Arms are interleaved run by run. Every request sends
// `reasoning_effort: "none"`, as the world probe does.
//
// Usage: npx vite-node testing/baseline/harness/tool-spill-probe.cli.ts -- --capture <world.json>
//          [--world rampage] [--cases ...] [--arms none,tool] [--runs 5] [--endpoint URL] [--model default] [--out FILE]
//   Worlds and cases: rampage (log_landmark): vague, opening, tower (narration); roar, tower-choices (choices);
//   vague-stat, opening-stat, tower-stat (the stat pass). emberwatch (offer_prayer): vague, prayer (narration);
//   vague-stat, opening-stat, prayer-stat (the stat pass). `opening-stat` is turn 1's stat request as captured.
//   Arms: `none` (no Tool), `tool` (the Tool offered, as the app sends it), `kwargs` (offered, plus
//   chat_template_kwargs.enable_thinking false), `joint` (offered in one
//   plain request beside the schema, with no loop: what a stat pass sent before the loop split them). A stat case always sends the stat pass's strict json_schema.
//   The Tool is the world file's own, from src/defaultworlds. --tool-file replaces its description with a JSON
//   file's `description` string.
//   FORMAMORPH_PROBE_TOKEN is sent as the bearer token when the endpoint needs one; it is never written out.
import { readFileSync, writeFileSync } from 'node:fs';
import type { RequestMessage, Tool } from '@/types';
import type { AiRequestSpec } from '@/lib/aiRequest/aiRequestSpec';
import { streamAiRequest } from '@/lib/aiRequest/aiStream';
import { streamAiToolLoop } from '@/lib/aiRequest/toolLoop';
import { responseFormat, type ResponseSchemaNode } from '@/lib/aiRequest/responseSchema';
import { stripReasoning } from '@/lib/aiResponse';
import { parseChoices } from '@/lib/choices';
import { toolSchema } from '@/lib/tools/toolSchema';
import { parseToolArgs } from '@/lib/tools/toolRunner';

const args = process.argv.slice(2);
function option(name: string, fallback: string): string {
  if (!args.includes(name)) return fallback;
  const value = args[args.indexOf(name) + 1];
  if (value === undefined || value.startsWith('--')) throw new Error(`${name} needs a value.`);
  return value;
}
const list = (name: string, fallback: string) => option(name, fallback).split(',').map((s) => s.trim()).filter(Boolean);
const capturePath = option('--capture', '');
if (!capturePath) throw new Error('Give --capture <world-probe world.json>.');
const worldId = option('--world', 'rampage');
const endpoint = option('--endpoint', 'https://api.lyonade.net/v1/chat/completions');
const model = option('--model', 'default');
const runs = Number(option('--runs', '5'));
const arms = list('--arms', 'none,tool');
const outFile = option('--out', `.scratch/tool-spill-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
const token = process.env.FORMAMORPH_PROBE_TOKEN ?? '';
const toolFile = option('--tool-file', '');

/** What a world's replay needs: its Tool, the actions and narrations its cases put in, and the reply a call gets. */
interface ProbeWorld {
  tool: string;
  /** The trigger cases' name stem: `<stem>`, `<stem>-choices`, `<stem>-stat`. */
  trigger: string;
  defaultCases: string;
  vagueAction: string;
  vagueNarration: string;
  triggerAction: string;
  triggerNarration: string;
  /** The text the stubbed handler answers each call with. */
  reply: string;
}
const WORLDS: Record<string, ProbeWorld> = {
  rampage: {
    tool: 'log_landmark',
    trigger: 'tower',
    defaultCases: 'vague-stat,tower-stat',
    vagueAction: 'I look for the first thing to break.',
    vagueNarration: 'You rise out of the bay and wade toward the waterfront, scanning the skyline for the first thing to ' +
      'break. Car alarms howl along the boulevard as your shadow falls across the piers.\n\nOut over the water, a ' +
      'helicopter turns to keep you in frame.',
    triggerAction: 'I wrap both arms around Spire Tower and tear it down.',
    triggerNarration: 'You wrap both arms around Spire Tower and heave. The glass skin bursts outward in a glittering ' +
      'sheet, the steel spine groans, and the whole tower folds at its middle floors and comes down across the avenue in a ' +
      'roar of dust.\n\nSirens rise from every direction as the cloud rolls over Downtown Core.',
    reply: 'Logged Spire Tower. Destruction is now 12. Give the stat changes.',
  },
  emberwatch: {
    tool: 'offer_prayer',
    trigger: 'prayer',
    defaultCases: 'vague-stat,prayer-stat',
    vagueAction: 'I look around the square.',
    vagueNarration: 'You walk into Ashford Square as the evening bell tolls from the keep. Candles burn in the chapel ' +
      'windows across the way, and townsfolk hurry past with their eyes on the barrow road.\n\nA guard at the well ' +
      'watches you, then looks away.',
    triggerAction: "I kneel at the Ember's brazier and pray for strength against the barrow.",
    triggerNarration: "You kneel on the worn stones before the Ember's brazier in the Chapel of the Ember and bow your " +
      'head. You pray for strength against what waits in the barrow, and the coals brighten as if they heard.\n\n' +
      'Mother Hesk looks up from her candles and nods once.',
    reply: 'The prayer is heard. Faith is now 60. Give the stat changes.',
  },
};
const world = WORLDS[worldId] ?? (() => { throw new Error(`No world "${worldId}". Worlds: ${Object.keys(WORLDS).join(', ')}.`); })();
const cases = list('--cases', world.defaultCases);

const worldTools = (JSON.parse(readFileSync(`src/defaultworlds/${worldId}.json`, 'utf8')) as { tools?: Tool[] }).tools ?? [];
const TOOL: Tool = worldTools.find((tool) => tool.name === world.tool)
  ?? (() => { throw new Error(`src/defaultworlds/${worldId}.json has no ${world.tool} Tool.`); })();
if (toolFile) TOOL.description = (JSON.parse(readFileSync(toolFile, 'utf8')) as { description: string }).description;

interface DumpRequest { type: string; messages: RequestMessage[]; response?: string; endpoint?: { maxTokens?: number } }
const capture = JSON.parse(readFileSync(capturePath, 'utf8')) as { turns: { action: string; requests: DumpRequest[] }[] }[];
const [, turn1, turn2] = capture[0].turns;
const find = (turn: { requests: DumpRequest[] }, type: string) => {
  const found = turn.requests.find((r) => r.type === type);
  if (!found) throw new Error(`The capture has no ${type} request on that turn.`);
  return found;
};

/** Replace the text before the first blank line of the final user message. */
const withLead = (messages: RequestMessage[], lead: string): RequestMessage[] => messages.map((m, i) => {
  if (i !== messages.length - 1 || typeof m.content !== 'string') return m;
  const rest = m.content.indexOf('\n\n');
  return { ...m, content: rest < 0 ? lead : lead + m.content.slice(rest) };
});
/** Replace the narration block of a stat request's user message. */
const withNarration = (messages: RequestMessage[], narration: string): RequestMessage[] => messages.map((m, i) => {
  if (i !== messages.length - 1 || typeof m.content !== 'string') return m;
  const end = m.content.indexOf('\n\nGive each character');
  return { ...m, content: `Narration: ${narration}${end < 0 ? '' : m.content.slice(end)}` };
});

/** The stat schema, rebuilt from a valid reply's keys. */
function schemaFromReply(reply: string): ResponseSchemaNode {
  const parsed = JSON.parse(reply) as Record<string, Record<string, number>>;
  const object = (properties: Record<string, ResponseSchemaNode>): ResponseSchemaNode =>
    ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });
  return object(Object.fromEntries(Object.entries(parsed).map(([owner, stats]) =>
    [owner, object(Object.fromEntries(Object.keys(stats).map((k) => [k, { type: 'integer' } as const])))])));
}

interface Case { kind: 'narration' | 'choices' | 'statUpdates'; messages: RequestMessage[]; maxTokens: number; temperature?: number; schema?: ResponseSchemaNode }
/** A stat case over `turn`'s stat request, with `narration` in place of its own when given. */
const statCase = (turn: { requests: DumpRequest[] }, narration?: string): Case => {
  const r = find(turn, 'statUpdates');
  return {
    kind: 'statUpdates', messages: narration === undefined ? r.messages : withNarration(r.messages, narration),
    maxTokens: r.endpoint?.maxTokens ?? 240, temperature: 0.2, schema: schemaFromReply(r.response ?? '{}'),
  };
};

const CASES: Record<string, () => Case> = {
  vague: () => {
    const r = find(turn1, 'narration');
    return { kind: 'narration', messages: withLead(r.messages, world.vagueAction), maxTokens: r.endpoint?.maxTokens ?? 1024 };
  },
  // The vague action as the story's first request, with no page before it.
  opening: () => {
    const r = find(turn1, 'narration');
    const [system, ...rest] = withLead(r.messages, world.vagueAction);
    return { kind: 'narration', messages: [system, rest[rest.length - 1]], maxTokens: r.endpoint?.maxTokens ?? 1024 };
  },
  [world.trigger]: () => {
    const r = find(turn1, 'narration');
    return { kind: 'narration', messages: withLead(r.messages, world.triggerAction), maxTokens: r.endpoint?.maxTokens ?? 1024 };
  },
  roar: () => {
    const r = find(turn2, 'choices');
    return { kind: 'choices', messages: r.messages, maxTokens: r.endpoint?.maxTokens ?? 256 };
  },
  [`${world.trigger}-choices`]: () => {
    const r = find(turn2, 'choices');
    const messages = r.messages.map((m, i) => {
      if (i !== r.messages.length - 1 || typeof m.content !== 'string') return m;
      const content = m.content.replace(/(## The Scene Just Told to Me[^\n]*\n)[\s\S]*?(\n\nNow write)/, `$1${world.triggerNarration}$2`);
      if (!content.includes(world.triggerNarration)) throw new Error('The choices message has no scene block to replace.');
      return { ...m, content };
    });
    return { kind: 'choices', messages, maxTokens: r.endpoint?.maxTokens ?? 256 };
  },
  'vague-stat': () => statCase(turn2, world.vagueNarration),
  'opening-stat': () => statCase(turn1),
  [`${world.trigger}-stat`]: () => statCase(turn2, world.triggerNarration),
};

const SPILL = /<\|channel>|<channel\|>|<\|?think|^\s*thought\b|^\s*(?:thinking process:|the user (?:is asking|wants|has)|let me think)/im;

interface Trial {
  case: string; arm: string; run: number; calls: string[]; rounds: number;
  /** The calls whose arguments the app accepts, so the handler would run. */
  accepted: string[];
  /** Every round's raw content, final round last. */
  raw: string[]; final: string; spilled: boolean; leaked: boolean; usable: boolean; finishReason: string | null; error?: string;
}

function usable(kind: Case['kind'], text: string, schema?: ResponseSchemaNode): boolean {
  if (kind === 'narration') return text.trim().length > 80;
  if (kind === 'choices') {
    const lines = parseChoices(text, Infinity);
    return lines.length >= 3 && lines.length <= 5;
  }
  try {
    const reply = JSON.parse(text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')) as Record<string, unknown>;
    return schema?.type === 'object' && schema.required.every((owner) => typeof reply[owner] === 'object');
  } catch { return false; }
}

async function trial(caseId: string, arm: string, run: number): Promise<Trial> {
  const c = CASES[caseId]();
  const offering = arm !== 'none';
  const spec: AiRequestSpec<RequestMessage, Tool> = {
    url: endpoint,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: {
      model,
      messages: c.messages,
      max_tokens: c.maxTokens,
      stream: true,
      reasoning_effort: 'none',
      ...(c.temperature !== undefined && { temperature: c.temperature }),
      ...(offering && { tools: [toolSchema(TOOL)], tool_choice: 'auto' as const }),
      ...(c.schema && { response_format: responseFormat({ name: 'stat_changes', schema: c.schema }) }),
      ...(arm === 'kwargs' && { chat_template_kwargs: { enable_thinking: false } }),
    } as AiRequestSpec<RequestMessage, Tool>['body'],
    target: { url: endpoint, model } as AiRequestSpec['target'],
    requestType: c.kind,
    ...(offering && { tools: [TOOL] }),
    samplerSources: {},
  };
  const calls: string[] = [];
  const accepted: string[] = [];
  const raw: string[] = [];
  let final = '';
  let finishReason: string | null = null;
  let rounds = 1;
  // The round in progress, so a request that throws still shows what it streamed.
  let streaming = '';
  try {
    if (arm === 'joint') {
      for await (const event of streamAiRequest(spec)) {
        if (event.type === 'delta') streaming = event.content;
        if (event.type !== 'done') continue;
        calls.push(...event.result.toolCalls.map((call) => call.arguments));
        raw.push(event.result.content);
        final = stripReasoning(event.result.content).trim();
        finishReason = event.result.finishReason;
      }
      return { case: caseId, arm, run, calls, accepted: calls.filter((text) => !('error' in parseToolArgs(TOOL.params, text))), rounds, raw, final, finishReason, spilled: raw.some((text) => SPILL.test(text)), leaked: SPILL.test(final), usable: usable(c.kind, final, c.schema) };
    }
    const events = streamAiToolLoop(spec, {
      execute: async (_tool, argumentsText) => {
        calls.push(argumentsText);
        // Arguments the app's World Tool turn rejects get its error, so the model's next move is the real one.
        const parsed = parseToolArgs(TOOL.params, argumentsText);
        if ('error' in parsed) return { text: JSON.stringify({ error: parsed.error }), failure: 'arguments' };
        accepted.push(argumentsText);
        return { text: world.reply };
      },
      captureRounds: true,
    });
    for await (const event of events) {
      if (event.type === 'delta') streaming = event.content;
      if (event.type === 'toolRound') { raw.push(event.round.content); rounds++; streaming = ''; }
      if (event.type === 'done') { raw.push(event.result.content); final = stripReasoning(event.result.content).trim(); finishReason = event.result.finishReason; }
    }
  } catch (error) {
    raw.push(streaming);
    return { case: caseId, arm, run, calls, accepted, rounds, raw, final, spilled: raw.some((text) => SPILL.test(text)), leaked: false, usable: false, finishReason, error: (error as Error).message };
  }
  return {
    case: caseId, arm, run, calls, accepted, rounds, raw, final, finishReason,
    spilled: raw.some((text) => SPILL.test(text)),
    leaked: SPILL.test(final),
    usable: usable(c.kind, final, c.schema),
  };
}

const trials: Trial[] = [];
const started = performance.now();
for (const caseId of cases) {
  if (!CASES[caseId]) throw new Error(`No case "${caseId}". Cases: ${Object.keys(CASES).join(', ')}.`);
  for (let run = 0; run < runs; run++) {
    // Alternate which arm goes first, so each pair carries its own control.
    const order = run % 2 ? [...arms].reverse() : arms;
    for (const arm of order) {
      const t = await trial(caseId, arm, run);
      trials.push(t);
      console.log(`${caseId} #${run + 1} ${arm}: spill ${t.spilled ? 'YES' : 'no'} · leak ${t.leaked ? 'YES' : 'no'} · calls ${t.calls.length} (accepted ${t.accepted.length}) · usable ${t.usable ? 'yes' : 'NO'}${t.error ? ` · error ${t.error}` : ''}`);
      writeFileSync(outFile, JSON.stringify({ endpoint, model, world: worldId, tool: TOOL.name, capture: capturePath, trials }, null, 2));
    }
  }
}

console.log(`\n| Case | Arm | Spills | Leaks | Calls | Accepted | Usable | Errors |\n|---|---|---|---|---|---|---|---|`);
for (const caseId of cases) for (const arm of arms) {
  const mine = trials.filter((t) => t.case === caseId && t.arm === arm);
  const n = mine.length;
  const count = (f: (t: Trial) => boolean) => `${mine.filter(f).length}/${n}`;
  console.log(`| ${caseId} | ${arm} | ${count((t) => t.spilled)} | ${count((t) => t.leaked)} | ${count((t) => t.calls.length > 0)} | ${count((t) => t.accepted.length > 0)} | ${count((t) => t.usable)} | ${count((t) => !!t.error)} |`);
}
console.log(`\n${trials.length} trials in ${((performance.now() - started) / 1000).toFixed(0)}s · ${outFile}`);
