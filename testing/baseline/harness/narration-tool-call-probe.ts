import { defaultNarrationUserPrompt, defaultSystemPrompt } from '@/components/game/GamePrompts';
import { authoredPreviewValues } from '@/lib/authoredPreviewValues';
import { NONE_PLACEHOLDER } from '@/lib/promptFallbacks';
import { renderPromptTemplate } from '@/lib/promptTemplate';
import { scannedEntries } from '@/lib/testBench/triggers';
import { buildNarrationPrompt } from '@/lib/turnPipeline/narrationPrompt';
import type { Entity, World } from '@/types';

export const MAIN_ACTION =
  'I greet the ferryman and the woman by the firepit, asking them to tell me a little about themselves.';

export const CONTROL_ACTION =
  'I crouch at the edge of the dock and study the pale water beneath it.';

export const PROBE_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'request_info',
      description: 'Retrieve full descriptions of world entities by name or keyword.',
      parameters: {
        type: 'object',
        properties: { term: { type: 'string' } },
        required: ['term'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'write',
      description: 'Submit the completed story narration.',
      parameters: {
        type: 'object',
        properties: { narration: { type: 'string' } },
        required: ['narration'],
        additionalProperties: false,
      },
    },
  },
] as const;

export interface ProbeMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: ProbeToolCall[];
  tool_call_id?: string;
}

export interface ProbeToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

export interface ProbeRequest {
  model: 'default';
  messages: ProbeMessage[];
  tools: typeof PROBE_TOOLS;
  tool_choice: 'auto';
  max_tokens: 1024;
  reasoning_effort: 'none';
  stream: false;
}

export interface PreparedProbeCase {
  caseId: string;
  action: string;
  sourceRevision: string;
  request: ProbeRequest;
}

export interface ProbeTransport {
  send(request: ProbeRequest, options: { signal: AbortSignal }): Promise<unknown>;
}

export interface ProbeExchange {
  request: ProbeRequest;
  response?: unknown;
  error?: { name: string; message: string; status?: number; responseBody?: unknown };
  durationMs: number;
  usage?: Record<string, number>;
}

export interface ProbeToolResultEvidence {
  callId: string;
  term: string;
  result: EntityLookupResult;
}

export interface ProbeTrialEvidence {
  caseId: string;
  action: string;
  sourceRevision: string;
  initialRequest: ProbeRequest;
  status: 'succeeded' | 'failed' | 'canceled';
  failure?: { kind: string; message: string };
  narration: string | null;
  requestCount: number;
  lookupCount: number;
  requests: ProbeExchange[];
  toolResults: ProbeToolResultEvidence[];
  usage: Record<string, number> | null;
  durationMs: number;
}

const CURRENT_ENTITIES =
  '<ENTITIES|markdown|header="Characters and things that may appear in this location">';
const SUMMARY_ENTITIES =
  '<ENTITIES|summary.markdown|header="Characters and things that may appear in this location">';
const SUBLOCATION_ENTITIES =
  '<ENTITIES|sublocations.markdown|header="Characters and things that may appear in a sub-location">';
const SUMMARY_SUBLOCATION_ENTITIES =
  '<ENTITIES|sublocations.summary.markdown|header="Characters and things that may appear in a sub-location">';
const OUTPUT_SENTENCE =
  'Output only the story prose - the events themselves, with no labels, no mention of being an AI, and nothing after the scene ends.';
const TOOL_OUTPUT_SENTENCE =
  'Submit the finished story through write, with only the story prose in its narration argument: the events themselves, with no labels, no mention of being an AI, and nothing after the scene ends.';
const ENTITY_INFORMATION = `## Entity information
The entity listings contain summaries. Full descriptions are available through request_info.
Before portraying a listed entity in this turn, retrieve its full description using its listed name. Use that description together with the established scene to write the entity consistently.
Request further information when a returned description leaves you needing another entity's details. Once you have enough information, submit the complete narration through write.

`;
const UNRESOLVED_TOKEN = /<[A-Z][A-Z _-]*(?:\|[^>\n]+)?>/;
const WITHHELD_FACTS = [
  'only one arm - the right',
  'left sleeve is pinned up',
  'brass ring through his left ear',
  'burn scar across her right cheek',
  'green glass bead braided into her hair',
  'counts everything twice',
];
const ENTITY_ALIASES: Readonly<Record<string, readonly string[]>> = {
  'ent-bram': ['ferryman'],
  'ent-odette': ['eel-smoker', 'woman by the firepit'],
  'ent-ferry': ['ferry', 'raft'],
  'ent-tomas': ['watchman', 'far-bank watchman'],
  'ent-wick': ["ferryman's sister"],
};

export interface EntityLookupResult {
  matches: Array<{ id: string; name: string; description: string | undefined }>;
}

export function lookupEntityInfo(entities: Entity[], term: string): EntityLookupResult {
  const needle = term.trim().toLocaleLowerCase('en-US');
  if (!needle) return { matches: [] };
  const matches = entities
    .filter((entity) => {
      if (entity.name.trim().toLocaleLowerCase('en-US') === needle) return true;
      return (ENTITY_ALIASES[entity.id] ?? [])
        .some((alias) => alias.toLocaleLowerCase('en-US') === needle);
    })
    .map((entity) => ({
      id: entity.id,
      name: entity.name,
      description: entity.aiDescription,
    }));
  return { matches };
}

function replaceOnce(source: string, from: string, to: string): string {
  const first = source.indexOf(from);
  if (first === -1 || source.indexOf(from, first + from.length) !== -1) {
    throw new Error(`Probe prompt source drifted around: ${from}`);
  }
  return `${source.slice(0, first)}${to}${source.slice(first + from.length)}`;
}

function probeSystemTemplate(): string {
  let template = replaceOnce(defaultSystemPrompt, CURRENT_ENTITIES, SUMMARY_ENTITIES);
  template = replaceOnce(template, SUBLOCATION_ENTITIES, SUMMARY_SUBLOCATION_ENTITIES);
  template = replaceOnce(template, OUTPUT_SENTENCE, TOOL_OUTPUT_SENTENCE);
  return replaceOnce(template, '## Output\n', `${ENTITY_INFORMATION}## Output\n`);
}

function validatePreparedMessages(messages: ProbeMessage[], world: World): void {
  const text = messages.map((message) => message.content ?? '').join('\n');
  const unresolved = text.match(UNRESOLVED_TOKEN)?.[0];
  if (unresolved) throw new Error(`Unresolved prompt token: ${unresolved}`);

  for (const entity of world.entities) {
    const description = entity.aiDescription?.trim();
    if (description && text.includes(description)) {
      throw new Error(`Full description leaked into the initial request: ${entity.name}`);
    }
  }
  for (const fact of WITHHELD_FACTS) {
    if (text.toLocaleLowerCase('en-US').includes(fact.toLocaleLowerCase('en-US'))) {
      throw new Error(`Withheld fact leaked into the initial request: ${fact}`);
    }
  }
}

export function prepareNarrationToolCallCase(input: {
  caseId: string;
  action: string;
  sourceRevision: string;
  world: World;
}): PreparedProbeCase {
  const location = input.world.locations.find((candidate) => candidate.id === 'loc-sedge');
  if (!location) throw new Error('Sedge Landing fixture is missing loc-sedge.');
  const activeTraitIds = input.world.traits.filter((trait) => trait.isDefault).map((trait) => trait.id);
  if (!activeTraitIds.includes('trait-wren')) throw new Error('Sedge Landing fixture is missing default Wren.');

  const ctx = {
    ...authoredPreviewValues(input.world, {
      location,
      activeTraitIds,
      resolve: (text: string) => text,
    }),
    '<NOTES>': NONE_PLACEHOLDER,
    '<TIME>': NONE_PLACEHOLDER,
  };
  const system = buildNarrationPrompt({
    template: probeSystemTemplate(),
    ctx,
    action: input.action,
    history: [],
    dictionary: scannedEntries(input.world),
    actionVec: null,
    semanticLore: false,
    embedVectors: new Map(),
    language: 'English',
    paragraphLimit: 'single',
    maxTokens: 1024,
    markdownOutput: false,
    sectionStyle: 'markdown',
    resolvePH: (text) => text,
  }).prompt;
  const user = renderPromptTemplate(defaultNarrationUserPrompt, { '<PLAYER ACTION>': input.action });
  const messages: ProbeMessage[] = [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
  validatePreparedMessages(messages, input.world);

  return {
    caseId: input.caseId,
    action: input.action,
    sourceRevision: input.sourceRevision,
    request: {
      model: 'default',
      messages,
      tools: PROBE_TOOLS,
      tool_choice: 'auto',
      max_tokens: 1024,
      reasoning_effort: 'none',
      stream: false,
    },
  };
}

export interface ProbePreparationReview {
  kind: 'narration-tool-call-preparation';
  sourceRevision: string;
  cloudBehaviorUntested: true;
  cases: PreparedProbeCase[];
}

export function prepareNarrationToolCallReview(
  world: World,
  sourceRevision: string,
): ProbePreparationReview {
  return {
    kind: 'narration-tool-call-preparation',
    sourceRevision,
    cloudBehaviorUntested: true,
    cases: [
      prepareNarrationToolCallCase({ caseId: 'main', action: MAIN_ACTION, sourceRevision, world }),
      prepareNarrationToolCallCase({ caseId: 'control', action: CONTROL_ACTION, sourceRevision, world }),
    ],
  };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function responseMessage(response: unknown): ProbeMessage {
  if (!isRecord(response) || !Array.isArray(response.choices) || !isRecord(response.choices[0])) {
    throw new Error('Response has no first choice.');
  }
  const message = response.choices[0].message;
  if (!isRecord(message)) throw new Error('Response choice has no message.');
  const content = message.content;
  const rawCalls = message.tool_calls;
  if (content !== null && typeof content !== 'string') throw new Error('Assistant content is not text or null.');
  if (rawCalls !== undefined && !Array.isArray(rawCalls)) throw new Error('Assistant tool_calls is not an array.');
  const toolCalls = rawCalls?.map((raw): ProbeToolCall => {
    if (!isRecord(raw) || typeof raw.id !== 'string' || raw.type !== 'function' || !isRecord(raw.function)) {
      throw new Error('Malformed native tool call.');
    }
    if (typeof raw.function.name !== 'string' || typeof raw.function.arguments !== 'string') {
      throw new Error('Malformed native tool function.');
    }
    return {
      id: raw.id,
      type: 'function',
      function: { name: raw.function.name, arguments: raw.function.arguments },
    };
  });
  return { ...message, role: 'assistant', content: content ?? null, ...(toolCalls ? { tool_calls: toolCalls } : {}) };
}

function exactStringArgument(serialized: string, name: string): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized);
  } catch {
    throw new Error(`Tool arguments are not valid JSON for ${name}.`);
  }
  if (!isRecord(parsed) || Object.keys(parsed).length !== 1 || typeof parsed[name] !== 'string') {
    throw new Error(`Tool arguments must contain exactly one string field named ${name}.`);
  }
  const value = parsed[name].trim();
  if (!value) throw new Error(`Tool argument ${name} is empty.`);
  return value;
}

function responseUsage(response: unknown): Record<string, number> | undefined {
  if (!isRecord(response) || !isRecord(response.usage)) return undefined;
  const entries = Object.entries(response.usage).filter((entry): entry is [string, number] =>
    typeof entry[1] === 'number' && Number.isFinite(entry[1]));
  return entries.length ? Object.fromEntries(entries) : undefined;
}

function sumUsage(exchanges: ProbeExchange[]): Record<string, number> | null {
  const total: Record<string, number> = {};
  for (const exchange of exchanges) {
    for (const [key, value] of Object.entries(exchange.usage ?? {})) total[key] = (total[key] ?? 0) + value;
  }
  return Object.keys(total).length ? total : null;
}

export async function runNarrationToolCallTrial(input: {
  caseId: string;
  action: string;
  sourceRevision: string;
  world: World;
  transport: ProbeTransport;
  signal?: AbortSignal;
  requestTimeoutMs?: number;
}): Promise<ProbeTrialEvidence> {
  const started = performance.now();
  const prepared = prepareNarrationToolCallCase(input);
  const initialRequest = structuredClone(prepared.request);
  const messages = structuredClone(prepared.request.messages);
  const requests: ProbeExchange[] = [];
  const toolResults: ProbeToolResultEvidence[] = [];
  const seenCallIds = new Set<string>();
  let lookupCount = 0;

  const finish = (
    status: ProbeTrialEvidence['status'],
    narration: string | null,
    failure?: ProbeTrialEvidence['failure'],
  ): ProbeTrialEvidence => ({
    caseId: input.caseId,
    action: input.action,
    sourceRevision: input.sourceRevision,
    initialRequest,
    status,
    ...(failure ? { failure } : {}),
    narration,
    requestCount: requests.length,
    lookupCount,
    requests,
    toolResults,
    usage: sumUsage(requests),
    durationMs: performance.now() - started,
  });

  for (let round = 0; round < 4; round++) {
    if (input.signal?.aborted) return finish('canceled', null, { kind: 'canceled', message: 'Trial canceled.' });
    const request: ProbeRequest = { ...prepared.request, messages: structuredClone(messages) };
    const requestStarted = performance.now();
    const requestController = new AbortController();
    let timedOut = false;
    const cancelRequest = () => requestController.abort();
    input.signal?.addEventListener('abort', cancelRequest, { once: true });
    const timeout = setTimeout(() => {
      timedOut = true;
      requestController.abort();
    }, input.requestTimeoutMs ?? 60_000);
    let response: unknown;
    try {
      response = await input.transport.send(request, { signal: requestController.signal });
    } catch (error) {
      const recordedError = {
        name: error instanceof Error ? error.name : 'Error',
        message: error instanceof Error ? error.message : String(error),
        ...(error instanceof EndpointRejectionError
          ? { status: error.status, responseBody: error.responseBody }
          : {}),
      };
      requests.push({
        request,
        error: recordedError,
        durationMs: performance.now() - requestStarted,
      });
      if (input.signal?.aborted) {
        return finish('canceled', null, { kind: 'canceled', message: 'Trial canceled.' });
      }
      if (timedOut) {
        return finish('failed', null, { kind: 'request_timeout', message: 'Model request timed out.' });
      }
      if (error instanceof EndpointRejectionError) {
        return finish('failed', null, { kind: 'endpoint_rejection', message: error.message });
      }
      return finish('failed', null, { kind: 'transport_error', message: requests.at(-1)!.error!.message });
    } finally {
      clearTimeout(timeout);
      input.signal?.removeEventListener('abort', cancelRequest);
    }
    requests.push({
      request,
      response,
      durationMs: performance.now() - requestStarted,
      usage: responseUsage(response),
    });

    let assistant: ProbeMessage;
    try {
      assistant = responseMessage(response);
    } catch (error) {
      return finish('failed', null, {
        kind: 'malformed_response',
        message: error instanceof Error ? error.message : String(error),
      });
    }
    const calls = assistant.tool_calls ?? [];
    if (calls.length === 0) {
      return finish('failed', null, { kind: 'missing_write', message: 'Assistant returned no native tool call.' });
    }

    const unknown = calls.find((call) => call.function.name !== 'write' && call.function.name !== 'request_info');
    if (unknown) {
      return finish('failed', null, { kind: 'unknown_function', message: `Unknown function: ${unknown.function.name}` });
    }
    for (const call of calls) {
      if (!call.id.trim() || seenCallIds.has(call.id)) {
        return finish('failed', null, { kind: 'duplicate_call_id', message: `Duplicate or empty call identifier: ${call.id}` });
      }
      seenCallIds.add(call.id);
    }
    const writes = calls.filter((call) => call.function.name === 'write');
    const lookups = calls.filter((call) => call.function.name === 'request_info');
    if (writes.length > 1) {
      return finish('failed', null, { kind: 'multiple_writes', message: 'Response contained multiple write calls.' });
    }
    if (writes.length && lookups.length) {
      return finish('failed', null, { kind: 'mixed_calls', message: 'Response mixed lookup and write calls.' });
    }
    if (writes.length === 1 && lookups.length === 0 && calls.length === 1) {
      try {
        return finish('succeeded', exactStringArgument(writes[0].function.arguments, 'narration'));
      } catch (error) {
        return finish('failed', null, {
          kind: 'invalid_arguments',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
    messages.push(assistant);
    for (const call of lookups) {
      if (lookupCount >= 4) {
        return finish('failed', null, { kind: 'lookup_budget_exhausted', message: 'Lookup budget exhausted.' });
      }
      let term: string;
      try {
        term = exactStringArgument(call.function.arguments, 'term');
      } catch (error) {
        return finish('failed', null, {
          kind: 'invalid_arguments',
          message: error instanceof Error ? error.message : String(error),
        });
      }
      const result = lookupEntityInfo(input.world.entities, term);
      lookupCount++;
      toolResults.push({ callId: call.id, term, result });
      messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(result) });
    }
  }
  return finish('failed', null, { kind: 'request_budget_exhausted', message: 'Request budget exhausted.' });
}

export class EndpointRejectionError extends Error {
  constructor(
    public readonly status: number,
    public readonly responseBody: unknown,
  ) {
    super(`HTTP ${status}: ${typeof responseBody === 'string' ? responseBody : JSON.stringify(responseBody)}`);
    this.name = 'EndpointRejectionError';
  }
}

export function createCloudProbeTransport(options: {
  endpoint?: string;
  token?: string;
  fetchImpl?: typeof fetch;
} = {}): ProbeTransport {
  const endpoint = options.endpoint ?? 'https://api.lyonade.net/v1/chat/completions';
  const fetchImpl = options.fetchImpl ?? fetch;
  return {
    async send(request, { signal }) {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (options.token) headers.Authorization = `Bearer ${options.token}`;
      const response = await fetchImpl(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(request),
        signal,
      });
      const text = await response.text();
      let body: unknown = text;
      if (text) {
        try {
          body = JSON.parse(text);
        } catch {
          body = text;
        }
      }
      if (!response.ok) throw new EndpointRejectionError(response.status, body);
      return body;
    },
  };
}

export interface ProbeBatchEvidence {
  sourceRevision: string;
  trials: ProbeTrialEvidence[];
  durationMs: number;
}

export async function runNarrationToolCallBatch(input: {
  sourceRevision: string;
  world: World;
  transport: ProbeTransport;
  signal?: AbortSignal;
  requestTimeoutMs?: number;
}): Promise<ProbeBatchEvidence> {
  const started = performance.now();
  const cases = [
    { caseId: 'main-1', action: MAIN_ACTION },
    { caseId: 'main-2', action: MAIN_ACTION },
    { caseId: 'control-1', action: CONTROL_ACTION },
    { caseId: 'control-2', action: CONTROL_ACTION },
  ];
  const trials: ProbeTrialEvidence[] = [];
  for (const probeCase of cases) {
    if (input.signal?.aborted) break;
    const trial = await runNarrationToolCallTrial({ ...input, ...probeCase });
    trials.push(trial);
    if (trial.failure?.kind === 'endpoint_rejection' || trial.status === 'canceled') break;
  }
  return { sourceRevision: input.sourceRevision, trials, durationMs: performance.now() - started };
}
