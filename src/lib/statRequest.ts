import type { PlayerStat, Trait } from '@/types';
import { stripMarkdown } from './stripMarkdown';
import { statChipValues } from './chipValues/chipValues';
import { applyAiMaxChanges, applyAiStatChanges, parseStatUpdates } from './statChanges';
import { randomUUID } from './uuid';
import { PLAYER_OWNER } from './statOwners';
import type { ResponseSchema, ResponseSchemaNode } from './aiRequest/responseSchema';

const nameKey = (name: string) => name.trim().replace(/\s+/g, ' ').toLowerCase();
const symbolKey = (name: string) => nameKey(name).replace(/\p{Variation_Selector}|[^\p{L}\p{N}\p{M}]/gu, '');

/** The heading the player's stats sit under, and their key in a schema reply. */
export const PLAYER_STAT_HEADING = 'Player Character';

/** The largest change, up or down, the schema lets one value or maximum take in a turn. */
export const STAT_CHANGE_BOUND = 20;

export interface StatRequestTarget {
  id: string;
  name: string;
  plainName: string;
  ownerId: string;
  /** The owner's key in a schema reply. */
  ownerKey: string;
  /** The stat's key under its owner in a schema reply, holding its change: its plain name, numbered when
   *  the owner already uses that key. */
  key: string;
  /** The key beside it that holds the change to its maximum. */
  maxKey: string;
}

export interface StatRequestSnapshot {
  id: string;
  /** The player's targets first, then each entity owner's. */
  targets: StatRequestTarget[];
  /** Every owner's section, for the schema request. */
  context: Record<string, string>;
  /** The player's section alone, for the text pass. */
  textContext: Record<string, string>;
  /** Each entity owner's key, in order. The text pass skips them. */
  entityKeys: string[];
  /** The request takes the text pass, because its endpoint refused the schema. */
  textPass?: boolean;
}

/** An entity whose stats join the player's in one request. */
export interface StatRequestOwner {
  id: string;
  /** Its heading in the request; a clash takes a numbered key. */
  name: string;
  /** Its live stats, names resolved. */
  stats: readonly PlayerStat[];
}

export interface StatUpdateDiagnostic {
  name: string;
  /** `textPass` marks a reply the text pass wrote; it skips none of the player's stats. `skipped` names an
   *  entity owner the text pass left out. */
  reason: 'ambiguous' | 'unknown' | 'invalid' | 'disabled' | 'missing' | 'textPass' | 'skipped';
}

export interface ResolvedStatUpdate {
  /** The owner whose stat this moves; with `id`, the stat's address. */
  ownerId: string;
  id: string;
  name: string;
  value: number;
  max: number;
}

export interface StatResponse {
  requestId: string;
  updates: ResolvedStatUpdate[];
  diagnostics: StatUpdateDiagnostic[];
}

const maxKeyOf = (key: string) => `${key} max`;

/** Unique keys for one owner's stats, in order. A stat takes its plain name and that name's max key, or the
 *  first numbered name whose pair is free, so a stat named "Vigor max" never lands on Vigor's max key. */
function statKeys(plainNames: readonly string[]): string[] {
  const taken = new Set<string>();
  return plainNames.map((plain) => {
    const base = plain || 'Stat';
    let key = base;
    for (let n = 2; taken.has(key) || taken.has(maxKeyOf(key)); n++) key = `${base} (${n})`;
    taken.add(key).add(maxKeyOf(key));
    return key;
  });
}

/** Unique owner keys, in order, after the keys already `taken`: a plain name, or its first free numbered form. */
function ownerKeys(names: readonly string[], taken: Set<string>): string[] {
  return names.map((name) => {
    const base = stripMarkdown(name).trim() || 'Character';
    let key = base;
    for (let n = 2; taken.has(key); n++) key = `${base} (${n})`;
    taken.add(key);
    return key;
  });
}

/** One owner's targets, and its Stats chip values naming each stat by its key. */
function ownerSection(stats: readonly PlayerStat[], ownerId: string, ownerKey: string) {
  const plainNames = stats.map(({ name }) => stripMarkdown(name).trim());
  const keys = statKeys(plainNames);
  const targets = stats.map(({ id, name }, i) => ({
    id, name, plainName: plainNames[i], ownerId, ownerKey, key: keys[i], maxKey: maxKeyOf(keys[i]),
  }));
  // The chip names each stat by its key, so a numbered key is the name the reply sees.
  return { targets, context: statChipValues(stats.map((stat, i) => ({ ...stat, name: keys[i] }))) };
}

/** Capture the names and identities this stat request exposes, with plain names in every Stats chip. The
 *  player's targets belong to `ownerId`, keyed `ownerKey` in a schema reply. Each of `entities` follows under
 *  its own heading in every Stats chip value. */
export function createStatRequest(
  stats: readonly PlayerStat[],
  ownerId: string = PLAYER_OWNER,
  { ownerKey = PLAYER_STAT_HEADING, textPass = false, entities = [] }:
    { ownerKey?: string; textPass?: boolean; entities?: readonly StatRequestOwner[] } = {},
): StatRequestSnapshot {
  const player = ownerSection(stats, ownerId, ownerKey);
  const owners = entities.filter((owner) => owner.stats.length);
  const keys = ownerKeys(owners.map((owner) => owner.name), new Set([ownerKey]));
  const sections = owners.map((owner, i) => ({ key: keys[i], ...ownerSection(owner.stats, owner.id, keys[i]) }));
  const context = Object.fromEntries(Object.entries(player.context).map(([token, value]) => [
    token, [value, ...sections.map((section) => `### ${section.key}\n${section.context[token]}`)].join('\n\n'),
  ]));
  return {
    id: randomUUID(),
    targets: [...player.targets, ...sections.flatMap((section) => section.targets)],
    context,
    textContext: player.context,
    entityKeys: keys,
    ...(textPass && { textPass }),
  };
}

/** The player's targets alone: what the text pass asks about. */
export function playerTargets(snapshot: StatRequestSnapshot): StatRequestTarget[] {
  const entityKeys = new Set(snapshot.entityKeys);
  return snapshot.targets.filter((target) => !entityKeys.has(target.ownerKey));
}

const bounded = (): ResponseSchemaNode => ({ type: 'integer', minimum: -STAT_CHANGE_BOUND, maximum: STAT_CHANGE_BOUND });

const fixedObject = (properties: Record<string, ResponseSchemaNode>): ResponseSchemaNode =>
  ({ type: 'object', additionalProperties: false, required: Object.keys(properties), properties });

/** The fixed reply shape: every owner, and under it every stat's bounded change beside its bounded max
 *  change, all required. A bare signed number per key keeps the sign the model writes. */
export function statRequestSchema(snapshot: StatRequestSnapshot): ResponseSchema {
  const owners = new Map<string, Record<string, ResponseSchemaNode>>();
  for (const target of snapshot.targets) {
    const stats = owners.get(target.ownerKey) ?? {};
    stats[target.key] = bounded();
    stats[target.maxKey] = bounded();
    owners.set(target.ownerKey, stats);
  }
  return {
    name: 'stat_changes',
    schema: fixedObject(Object.fromEntries([...owners].map(([key, stats]) => [key, fixedObject(stats)]))),
  };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

/** A reply's JSON object; `undefined` when the reply is not JSON-shaped, `null` when it is but won't parse. */
function jsonReply(raw: string): Record<string, unknown> | null | undefined {
  const text = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  if (!text.startsWith('{')) return undefined;
  try {
    const parsed: unknown = JSON.parse(text);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

const whole = (n: unknown): number | null => (typeof n === 'number' && Number.isFinite(n) ? Math.round(n) : null);

/** Read a schema reply by the owner, stat and max keys the request sent. */
function readSchemaReply(reply: Record<string, unknown>, snapshot: StatRequestSnapshot): StatResponse {
  const updates = new Map<StatRequestTarget, ResolvedStatUpdate>();
  const diagnostics: StatUpdateDiagnostic[] = [];
  for (const [ownerKey, stats] of Object.entries(reply)) {
    const owned = snapshot.targets.filter((target) => target.ownerKey === ownerKey);
    if (!owned.length || !isRecord(stats)) {
      diagnostics.push({ name: ownerKey, reason: owned.length ? 'invalid' : 'unknown' });
      continue;
    }
    for (const [key, entry] of Object.entries(stats)) {
      const target = owned.find((candidate) => candidate.key === key || candidate.maxKey === key);
      const amount = whole(entry);
      if (!target || amount === null) {
        diagnostics.push({ name: key, reason: target ? 'invalid' : 'unknown' });
        continue;
      }
      const update = updates.get(target) ?? { ownerId: target.ownerId, id: target.id, name: target.name, value: 0, max: 0 };
      if (key === target.key) update.value += amount;
      else update.max += amount;
      updates.set(target, update);
    }
  }
  return { requestId: snapshot.id, updates: [...updates.values()].filter((u) => u.value || u.max), diagnostics };
}

/** Match replies against the request's names before later pins can rename their stats. A schema reply reads
 *  by key; any other reply is the text pass's lines. */
export function readStatResponse(raw: string, snapshot: StatRequestSnapshot): StatResponse {
  const reply = jsonReply(raw);
  if (reply) return readSchemaReply(reply, snapshot);
  if (reply === null) return { requestId: snapshot.id, updates: [], diagnostics: [{ name: raw.trim(), reason: 'invalid' }] };
  const updates = new Map<string, ResolvedStatUpdate>();
  // A refused schema, or a server that ignored one, leaves the text pass's lines; an empty reply is one too.
  const diagnostics: StatUpdateDiagnostic[] = [
    { name: '', reason: 'textPass' }, ...snapshot.entityKeys.map((name) => ({ name, reason: 'skipped' as const })),
  ];
  const targets = playerTargets(snapshot);
  for (const line of raw.split('\n').filter((text) => text.trim())) {
    const plain = stripMarkdown(line);
    const separator = plain.lastIndexOf(':');
    const name = plain.slice(0, separator).trim();
    const { values, maxes } = parseStatUpdates(`stat:${plain.slice(separator + 1)}`);
    if (separator < 0 || !name || (values.stat === undefined && maxes.stat === undefined)) {
      diagnostics.push({ name: line.trim(), reason: 'invalid' });
      continue;
    }
    const rawName = line.slice(0, line.lastIndexOf(':')).trim().replace(/^[-*+]\s+/, '');
    let matches = nameKey(rawName) !== nameKey(name)
      ? targets.filter((target) => nameKey(target.name) === nameKey(rawName)) : [];
    const byKey = targets.filter((target) => nameKey(target.key) === nameKey(name));
    if (!matches.length && byKey.length === 1) matches = byKey;
    if (!matches.length) matches = targets.filter((target) => nameKey(target.plainName) === nameKey(name));
    if (!matches.length && symbolKey(name)) {
      matches = targets.filter((target) => symbolKey(target.plainName) === symbolKey(name));
    }
    if (matches.length !== 1) {
      diagnostics.push({ name, reason: matches.length ? 'ambiguous' : 'unknown' });
      continue;
    }
    const target = matches[0];
    const key = `${target.ownerId}/${target.id}`;
    const update = updates.get(key) ?? { ownerId: target.ownerId, id: target.id, name: target.name, value: 0, max: 0 };
    update.value += values.stat ?? 0;
    update.max += maxes.stat ?? 0;
    updates.set(key, update);
  }
  return { requestId: snapshot.id, updates: [...updates.values()], diagnostics };
}

/** Apply `ownerId`'s updates to that owner's `stats`, caps before values, by identity, preserving authored
 *  text and enforcing the owner's live set. `active` is the owner's traits in force, which the cap under a
 *  code max derives from. The response's own diagnostics come back with the owner's. */
export function applyStatResponse(
  stats: PlayerStat[],
  response: StatResponse,
  enabledIds: ReadonlySet<string>,
  active: readonly Trait[] = [],
  ownerId: string = PLAYER_OWNER,
): { stats: PlayerStat[]; diagnostics: StatUpdateDiagnostic[] } {
  const owned = response.updates.filter((update) => update.ownerId === ownerId);
  const byId = new Map(owned.map((update) => [update.id, update]));
  const presentIds = new Set(stats.map((stat) => stat.id));
  const diagnostics = [...response.diagnostics];
  for (const update of owned) {
    if (!presentIds.has(update.id)) diagnostics.push({ name: update.name, reason: 'missing' });
    else if (!enabledIds.has(update.id)) diagnostics.push({ name: update.name, reason: 'disabled' });
  }
  return {
    stats: stats.map((stat) => {
      const update = byId.get(stat.id);
      if (!update || !enabledIds.has(stat.id)) return stat;
      const key = stat.name.toLowerCase();
      const capped = applyAiMaxChanges([stat], { [key]: update.max }, active);
      return applyAiStatChanges(capped, { [key]: update.value })[0];
    }),
    diagnostics,
  };
}

/** The history's change map: the player's stats alone, by name; request identities stay transient. */
export function statResponseChanges(response: StatResponse): Record<string, number>[] {
  return response.updates.filter((update) => update.ownerId === PLAYER_OWNER && update.value !== 0)
    .map((update) => ({ [update.name.toLowerCase()]: update.value }));
}
