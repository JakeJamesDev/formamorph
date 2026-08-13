import type { AIRequestType, ChatMessage } from '@/types';

/**
 * Records the ordered AI request sequence a turn emits, as the ground truth the Turn Pipeline's parity
 * tests replay against. It observes the single request seam (`makeAIRequest`) and never touches what is
 * sent: every entry is a copy of the arguments the seam already received.
 *
 * Recording is inert until {@link startParityRecording} arms it, and only DEV code can arm it.
 */

/** One request as it crossed the seam, in dispatch order. */
export interface ParityRequestRecord {
  /** Global dispatch counter across the whole recording; strictly increasing, gap-free. */
  seq: number;
  type: AIRequestType;
  systemPrompt: string;
  messages: ChatMessage[];
  /** The cap the caller asked for; null means the request type's own default applies downstream. */
  maxTokens: number | null;
  silent: boolean;
  /** Turn this silent request attaches to, when it summarizes an older turn. */
  attachTurnId: string | null;
  /**
   * The raw text this call answered with — what a replaying fake adapter hands back so the next turn's
   * prompts are built from the same material. Null when the request was aborted or failed.
   */
  response: string | null;
}

/** One player action and every request it dispatched. */
export interface ParityTurnRecord {
  index: number;
  action: string;
  turnId: string | null;
  requests: ParityRequestRecord[];
}

/** The recorded run, as written to the fixture file. */
export interface ParityFixture {
  format: 'formamorph-turn-parity';
  formatVersion: 1;
  /** ISO timestamp of the capture. */
  recordedAt: string;
  /** Free-text provenance: which profile and model produced this run. */
  label: string;
  /** World file the run was driven through. */
  world: string;
  turns: ParityTurnRecord[];
  /** Requests dispatched before the first turn began (idle drainers, opening probes). */
  orphans: ParityRequestRecord[];
}

/** The arguments the seam received, as the recorder sees them. */
export interface ParityRequestInput {
  systemPrompt: string;
  messages: ChatMessage[];
  type: AIRequestType;
  maxTokens: number | null;
  silent: boolean;
  attachTurnId?: string;
}

export const PARITY_FORMAT = 'formamorph-turn-parity';
export const PARITY_FORMAT_VERSION = 1;

// Every export short-circuits on this, so a production build drops the whole recorder (mirrors devRouter).
const DEV = import.meta.env.DEV;

let active = false;
let seq = 0;
let turns: ParityTurnRecord[] = [];
let orphans: ParityRequestRecord[] = [];
let bySeq = new Map<number, ParityRequestRecord>();
let meta = { label: '', world: '' };

/** Arms recording and discards anything previously recorded. DEV-only; a no-op in production builds. */
export function startParityRecording(info: { label?: string; world?: string } = {}): void {
  if (!DEV) return;
  active = true;
  seq = 0;
  turns = [];
  orphans = [];
  bySeq = new Map();
  meta = { label: info.label ?? '', world: info.world ?? '' };
}

/** Disarms recording. The captured turns stay readable until the next start. */
export function stopParityRecording(): void {
  if (!DEV) return;
  active = false;
}

export function isParityRecording(): boolean {
  return DEV && active;
}

/** Opens a new turn; every later request lands on it until the next one opens. */
export function recordParityTurn(action: string, turnId?: string): void {
  if (!DEV || !active) return;
  turns.push({ index: turns.length, action, turnId: turnId ?? null, requests: [] });
}

/**
 * Records one request at dispatch time and returns its dispatch number, for pairing with
 * {@link recordParityResponse}. Copies its inputs, so later mutation can't rewrite history.
 */
export function recordParityRequest(input: ParityRequestInput): number | null {
  if (!DEV || !active) return null;
  const record: ParityRequestRecord = {
    seq: seq++,
    type: input.type,
    systemPrompt: input.systemPrompt,
    messages: input.messages.map((m) => ({ role: m.role, content: m.content })),
    maxTokens: input.maxTokens,
    silent: input.silent,
    attachTurnId: input.attachTurnId ?? null,
    response: null,
  };
  if (turns.length === 0) orphans.push(record);
  else turns[turns.length - 1].requests.push(record);
  bySeq.set(record.seq, record);
  return record.seq;
}

/** Attaches the raw answer to the request that asked for it. Aborted calls simply never arrive here. */
export function recordParityResponse(dispatchSeq: number | null, response: string): void {
  if (!DEV || !active || dispatchSeq === null) return;
  const record = bySeq.get(dispatchSeq);
  if (record) record.response = response;
}

/** The recording so far, as a fixture value. */
export function getParityFixture(recordedAt: string): ParityFixture {
  return {
    format: PARITY_FORMAT,
    formatVersion: PARITY_FORMAT_VERSION,
    recordedAt,
    label: meta.label,
    world: meta.world,
    turns,
    orphans,
  };
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(`Invalid parity fixture: ${message}`);
}

function validateRequest(value: unknown, where: string): ParityRequestRecord {
  assert(isRecord(value), `${where} is not an object`);
  assert(typeof value.seq === 'number' && Number.isInteger(value.seq), `${where}.seq is not an integer`);
  assert(typeof value.type === 'string' && value.type.length > 0, `${where}.type is empty`);
  assert(typeof value.systemPrompt === 'string', `${where}.systemPrompt is not a string`);
  assert(Array.isArray(value.messages), `${where}.messages is not an array`);
  value.messages.forEach((m, i) => {
    assert(isRecord(m), `${where}.messages[${i}] is not an object`);
    assert(m.role === 'system' || m.role === 'user' || m.role === 'assistant', `${where}.messages[${i}].role is not a chat role`);
    assert(typeof m.content === 'string', `${where}.messages[${i}].content is not a string`);
  });
  assert(value.maxTokens === null || typeof value.maxTokens === 'number', `${where}.maxTokens is neither null nor a number`);
  assert(typeof value.silent === 'boolean', `${where}.silent is not a boolean`);
  assert(value.attachTurnId === null || typeof value.attachTurnId === 'string', `${where}.attachTurnId is neither null nor a string`);
  assert(value.response === null || typeof value.response === 'string', `${where}.response is neither null nor a string`);
  // The asserts above have checked every field of the interface, which a Record<string, unknown> can't express.
  return value as unknown as ParityRequestRecord;
}

/**
 * Checks a loaded fixture against the recorded format and returns it typed. Throws with the offending
 * path on the first violation, so a stale or hand-edited fixture fails loudly instead of silently
 * weakening every parity test that replays it.
 */
export function validateParityFixture(value: unknown): ParityFixture {
  assert(isRecord(value), 'not an object');
  assert(value.format === PARITY_FORMAT, `format is not "${PARITY_FORMAT}"`);
  assert(value.formatVersion === PARITY_FORMAT_VERSION, `formatVersion is not ${PARITY_FORMAT_VERSION}`);
  assert(typeof value.recordedAt === 'string' && !Number.isNaN(Date.parse(value.recordedAt)), 'recordedAt is not an ISO timestamp');
  assert(typeof value.label === 'string', 'label is not a string');
  assert(typeof value.world === 'string', 'world is not a string');
  assert(Array.isArray(value.turns) && value.turns.length > 0, 'turns is empty');
  assert(Array.isArray(value.orphans), 'orphans is not an array');

  let expectedSeq = 0;
  const seen: number[] = [];
  value.orphans.forEach((r, i) => seen.push(validateRequest(r, `orphans[${i}]`).seq));
  value.turns.forEach((t, i) => {
    assert(isRecord(t), `turns[${i}] is not an object`);
    assert(t.index === i, `turns[${i}].index is ${String(t.index)}`);
    assert(typeof t.action === 'string', `turns[${i}].action is not a string`);
    assert(t.turnId === null || typeof t.turnId === 'string', `turns[${i}].turnId is neither null nor a string`);
    assert(Array.isArray(t.requests), `turns[${i}].requests is not an array`);
    t.requests.forEach((r, j) => seen.push(validateRequest(r, `turns[${i}].requests[${j}]`).seq));
  });
  // Dispatch order is the fixture's whole point: the flattened sequence must be the counter, gap-free.
  for (const s of seen) {
    assert(s === expectedSeq, `dispatch sequence broken at seq ${s} (expected ${expectedSeq})`);
    expectedSeq++;
  }
  // Every field is asserted above; the cast only drops the Record<string, unknown> narrowing.
  return value as unknown as ParityFixture;
}
