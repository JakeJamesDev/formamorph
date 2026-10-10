import type { PlayerStat, Trait } from '@/types';
import { stripMarkdown } from './stripMarkdown';
import { statChipValues } from './chipValues/chipValues';
import { applyAiMaxChanges, applyAiStatChanges, parseStatUpdates } from './statChanges';
import { randomUUID } from './uuid';
import { PLAYER_OWNER } from './statOwners';

const nameKey = (name: string) => name.trim().replace(/\s+/g, ' ').toLowerCase();
const symbolKey = (name: string) => nameKey(name).replace(/\p{Variation_Selector}|[^\p{L}\p{N}\p{M}]/gu, '');

export interface StatRequestSnapshot {
  id: string;
  targets: { id: string; name: string; plainName: string; ownerId: string }[];
  context: Record<string, string>;
}

export interface StatUpdateDiagnostic {
  name: string;
  reason: 'ambiguous' | 'unknown' | 'invalid' | 'disabled' | 'missing';
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

/** Capture the names and identities this stat request exposes, with plain names in every Stats chip. Every
 *  target belongs to `ownerId`. */
export function createStatRequest(stats: readonly PlayerStat[], ownerId: string = PLAYER_OWNER): StatRequestSnapshot {
  const targets = stats.map(({ id, name }) => ({ id, name, plainName: stripMarkdown(name).trim(), ownerId }));
  const plainStats = stats.map((stat, i) => ({ ...stat, name: targets[i].plainName }));
  return { id: randomUUID(), targets, context: statChipValues(plainStats) };
}

/** Match replies against the request's names before later pins can rename their stats. */
export function readStatResponse(raw: string, snapshot: StatRequestSnapshot): StatResponse {
  const updates = new Map<string, ResolvedStatUpdate>();
  const diagnostics: StatUpdateDiagnostic[] = [];
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
      ? snapshot.targets.filter((target) => nameKey(target.name) === nameKey(rawName)) : [];
    if (!matches.length) matches = snapshot.targets.filter((target) => nameKey(target.plainName) === nameKey(name));
    if (!matches.length && symbolKey(name)) {
      matches = snapshot.targets.filter((target) => symbolKey(target.plainName) === symbolKey(name));
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

/** Keep the existing history representation; request identities remain transient. */
export function statResponseChanges(response: StatResponse): Record<string, number>[] {
  return response.updates.filter((update) => update.value !== 0)
    .map((update) => ({ [update.name.toLowerCase()]: update.value }));
}
