/**
 * The Bench's background pass over the edited world: the rule findings with their seen-record keys, and the
 * world's publish size. Pure, so it runs the same in the Bench worker and in-thread where no worker exists.
 */
import { worldPublishPayload } from '@/lib/publishPayload';
import { APP_VERSION } from '@/lib/version';
import { findingKeys, type FindingKeys } from './findingKeys';
import { runRules, type Finding, type RuleWorld } from './rules';

export interface BenchPassResult {
  findings: Finding[];
  /** Each finding's keys, in the same order, so the receiver skips hashing them again. */
  keys: FindingKeys[];
  /** The UTF-8 length of the content a publish of this world would send. */
  bytes: number;
}

const encoder = new TextEncoder();
const utf8 = (text: string) => encoder.encode(text).length;

/**
 * The UTF-8 length of `JSON.stringify(value)`, with each array element that is an object measured once per
 * object: the records an edit didn't replace keep their figure.
 */
export function createJsonByteCounter(): (value: unknown) => number {
  const cache = new WeakMap<object, number>();
  const element = (item: unknown): number => {
    if (item === undefined || typeof item === 'function' || typeof item === 'symbol') return 4; // null
    if (!item || typeof item !== 'object') return utf8(JSON.stringify(item));
    let found = cache.get(item);
    if (found === undefined) cache.set(item, found = utf8(JSON.stringify(item)));
    return found;
  };
  const measure = (value: unknown, depth: number): number => {
    if (depth > 1 || !value || typeof value !== 'object' || 'toJSON' in value) return utf8(JSON.stringify(value) ?? '');
    if (Array.isArray(value)) {
      return value.length ? value.reduce((sum: number, item) => sum + element(item), 2) + value.length - 1 : 2;
    }
    let sum = 2;
    let fields = 0;
    for (const [key, field] of Object.entries(value)) {
      if (field === undefined || typeof field === 'function' || typeof field === 'symbol') continue;
      sum += utf8(JSON.stringify(key)) + 1 + measure(field, depth + 1);
      fields += 1;
    }
    return sum + Math.max(0, fields - 1);
  };
  return (value) => measure(value, 0);
}

/** A pass's answer as the worker sends it: the findings only when they differ from its last answer. */
export type BenchReply = Pick<BenchPassResult, 'bytes'> & Partial<Pick<BenchPassResult, 'findings' | 'keys'>>;

/** Passes over a mirrored world, replying without findings while they stay as last sent, so an edit that
 *  changes no finding costs the editor no transfer and no re-render of the list. */
export function createBenchReplier(): (world: RuleWorld) => BenchReply {
  const pass = createBenchPass();
  let lastSaid: string | null = null;
  return (world) => {
    const result = pass(world);
    const said = JSON.stringify(result.findings);
    if (said === lastSaid) return { bytes: result.bytes };
    lastSaid = said;
    return result;
  };
}

/** A pass that remembers the byte figure of every record it has measured. */
export function createBenchPass(): (world: RuleWorld) => BenchPassResult {
  const count = createJsonByteCounter();
  return (world) => {
    const findings = runRules(world);
    // Publish sends the stored copy, which carries the version stamp `saveWorld` puts on it.
    const bytes = count(worldPublishPayload({ version: APP_VERSION, ...world }).contentData);
    return { findings, keys: findings.map(findingKeys), bytes };
  };
}
