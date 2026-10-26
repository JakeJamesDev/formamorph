// Tool-offer spill probe: replays captured Rampage requests through the app's own tool loop, with a judgment
// Tool (log_landmark) offered or withheld, and counts native-reasoning spills, Tool calls and usable replies.
// The capture is a world-probe output (`<out>/rampage.json`); its first run's turn 1 and turn 2 supply the
// narration, choices and stat requests. Arms are interleaved run by run. Every request sends
// `reasoning_effort: "none"`, as the world probe does.
//
// Usage: npx vite-node testing/baseline/harness/tool-spill-probe.cli.ts -- --capture <rampage.json>
//          [--cases vague,roar,tower-stat] [--arms none,tool] [--runs 5] [--endpoint URL] [--model default] [--out FILE]
//   Cases: vague, opening, tower (narration); roar, tower-choices (choices); tower-stat (the stat pass).
//   Arms: `none` (no Tool), `tool` (log_landmark offered, as the app sends it), `kwargs` (offered, plus
//   chat_template_kwargs.enable_thinking false), `joint` (offered in one
//   plain request beside the schema, with no loop: what a stat pass sent before the loop split them). A stat case always sends the stat pass's strict json_schema.
//   --tool-file replaces log_landmark's description with a JSON file's `description` string.
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

const args = process.argv.slice(2);
function option(name: string, fallback: string): string {
  if (!args.includes(name)) return fallback;
  const value = args[args.indexOf(name) + 1];
  if (value === undefined || value.startsWith('--')) throw new Error(`${name} needs a value.`);
  return value;
}
const list = (name: string, fallback: string) => option(name, fallback).split(',').map((s) => s.trim()).filter(Boolean);
const capturePath = option('--capture', '');
if (!capturePath) throw new Error('Give --capture <world-probe rampage.json>.');
const endpoint = option('--endpoint', 'https://api.lyonade.net/v1/chat/completions');
const model = option('--model', 'default');
const runs = Number(option('--runs', '5'));
const cases = list('--cases', 'vague,roar,tower-stat');
const arms = list('--arms', 'none,tool');
const outFile = option('--out', `.scratch/tool-spill-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
const token = process.env.FORMAMORPH_PROBE_TOKEN ?? '';
const toolFile = option('--tool-file', '');

/** A judgment Tool: the call needs a judgment about narration the model has not written yet. Ticket 05's own
 *  wording is lost; this one reproduces its pattern of calls on a fallen landmark and spills on a vague turn. */
const LOG_LANDMARK: Tool = {
  id: 'probe-log-landmark',
  name: 'log_landmark',
  description: 'Log a landmark the creature destroyed. Call this whenever a named building, bridge, tower, stadium or ' +
    'other landmark is destroyed, before you write anything else. Pass the landmark\'s name.',
  params: [{ name: 'landmark', type: 'string', description: 'The destroyed landmark', required: true, options: [] }],
  handler: { kind: 'script', code: '' },
  emptyResult: '',
  offeredTo: ['narration', 'choices', 'statUpdates'],
};
if (toolFile) LOG_LANDMARK.description = (JSON.parse(readFileSync(toolFile, 'utf8')) as { description: string }).description;

const VAGUE_ACTION = 'I look for the first thing to break.';
const TOWER_NARRATION = 'You wrap both arms around Spire Tower and heave. The glass skin bursts outward in a glittering ' +
  'sheet, the steel spine groans, and the whole tower folds at its middle floors and comes down across the avenue in a ' +
  'roar of dust.\n\nSirens rise from every direction as the cloud rolls over Downtown Core.';

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
const CASES: Record<string, () => Case> = {
  vague: () => {
    const r = find(turn1, 'narration');
    return { kind: 'narration', messages: withLead(r.messages, VAGUE_ACTION), maxTokens: r.endpoint?.maxTokens ?? 1024 };
  },
  // The vague action as the story's first request, with no page before it.
  opening: () => {
    const r = find(turn1, 'narration');
    const [system, ...rest] = withLead(r.messages, VAGUE_ACTION);
    return { kind: 'narration', messages: [system, rest[rest.length - 1]], maxTokens: r.endpoint?.maxTokens ?? 1024 };
  },
  tower: () => {
    const r = find(turn1, 'narration');
    return { kind: 'narration', messages: withLead(r.messages, 'I wrap both arms around Spire Tower and tear it down.'), maxTokens: r.endpoint?.maxTokens ?? 1024 };
  },
  roar: () => {
    const r = find(turn2, 'choices');
    return { kind: 'choices', messages: r.messages, maxTokens: r.endpoint?.maxTokens ?? 256 };
  },
  'tower-choices': () => {
    const r = find(turn2, 'choices');
    const messages = r.messages.map((m, i) => {
      if (i !== r.messages.length - 1 || typeof m.content !== 'string') return m;
      const content = m.content.replace(/(## The Scene Just Told to Me[^\n]*\n)[\s\S]*?(\n\nNow write)/, `$1${TOWER_NARRATION}$2`);
      if (!content.includes('Spire Tower')) throw new Error('The choices message has no scene block to replace.');
      return { ...m, content };
    });
    return { kind: 'choices', messages, maxTokens: r.endpoint?.maxTokens ?? 256 };
  },
  'tower-stat': () => {
    const r = find(turn2, 'statUpdates');
    return {
      kind: 'statUpdates', messages: withNarration(r.messages, TOWER_NARRATION), maxTokens: r.endpoint?.maxTokens ?? 240,
      temperature: 0.2, schema: schemaFromReply(r.response ?? '{}'),
    };
  },
};

const SPILL = /<\|channel>|<channel\|>|<\|?think|^\s*thought\b|^\s*(?:thinking process:|the user (?:is asking|wants|has)|let me think)/im;

interface Trial {
  case: string; arm: string; run: number; calls: string[]; rounds: number;
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
      ...(offering && { tools: [toolSchema(LOG_LANDMARK)], tool_choice: 'auto' as const }),
      ...(c.schema && { response_format: responseFormat({ name: 'stat_changes', schema: c.schema }) }),
      ...(arm === 'kwargs' && { chat_template_kwargs: { enable_thinking: false } }),
    } as AiRequestSpec<RequestMessage, Tool>['body'],
    target: { url: endpoint, model } as AiRequestSpec['target'],
    requestType: c.kind,
    ...(offering && { tools: [LOG_LANDMARK] }),
    samplerSources: {},
  };
  const calls: string[] = [];
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
      return { case: caseId, arm, run, calls, rounds, raw, final, finishReason, spilled: raw.some((text) => SPILL.test(text)), leaked: SPILL.test(final), usable: usable(c.kind, final, c.schema) };
    }
    const events = streamAiToolLoop(spec, {
      execute: async (_tool, argumentsText) => {
        calls.push(argumentsText);
        return { text: 'Logged. Destruction is now 12. Write the reply.' };
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
    return { case: caseId, arm, run, calls, rounds, raw, final, spilled: raw.some((text) => SPILL.test(text)), leaked: false, usable: false, finishReason, error: (error as Error).message };
  }
  return {
    case: caseId, arm, run, calls, rounds, raw, final, finishReason,
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
      console.log(`${caseId} #${run + 1} ${arm}: spill ${t.spilled ? 'YES' : 'no'} · leak ${t.leaked ? 'YES' : 'no'} · calls ${t.calls.length} · usable ${t.usable ? 'yes' : 'NO'}${t.error ? ` · error ${t.error}` : ''}`);
      writeFileSync(outFile, JSON.stringify({ endpoint, model, capture: capturePath, trials }, null, 2));
    }
  }
}

console.log(`\n| Case | Arm | Spills | Leaks | Calls | Usable | Errors |\n|---|---|---|---|---|---|---|`);
for (const caseId of cases) for (const arm of arms) {
  const mine = trials.filter((t) => t.case === caseId && t.arm === arm);
  const n = mine.length;
  const count = (f: (t: Trial) => boolean) => `${mine.filter(f).length}/${n}`;
  console.log(`| ${caseId} | ${arm} | ${count((t) => t.spilled)} | ${count((t) => t.leaked)} | ${count((t) => t.calls.length > 0)} | ${count((t) => t.usable)} | ${count((t) => !!t.error)} |`);
}
console.log(`\n${trials.length} trials in ${((performance.now() - started) / 1000).toFixed(0)}s · ${outFile}`);
