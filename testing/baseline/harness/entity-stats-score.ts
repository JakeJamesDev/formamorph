// Scoring for entity-stats-probe.cli.ts: parse each arm's reply into owner/stat changes, then grade them
// against a case's gold cells.
import { createStatRequest, readStatResponse, type StatRequestSnapshot } from '@/lib/statRequest';
import { stripMarkdown } from '@/lib/stripMarkdown';
import type { OwnerId } from '@/lib/scope';
import type { PlayerStat } from '@/types';

export type Direction = '+' | '-';
/** Owner key (`player` or an entity id) → stat name → direction. */
export type GoldCells = Record<string, Record<string, Direction>>;

export interface Owner {
  key: string;
  /** The name the request shows for this owner. */
  name: string;
  stats: PlayerStat[];
}

export interface Change { owner: string; stat: string; change: number }

export interface Parsed {
  changes: Change[];
  /** Lines or items that named no owner or stat in the request, or carried no number. */
  invalid: number;
  /** The reply was not readable at all (JSON arm only). */
  unreadable: boolean;
  /** Stats whose maximum the reply moved. No case moves one, so each is invented. Arms the app reader reads only. */
  maxChanges?: number;
}

export interface Score {
  expected: number;
  hits: number;
  wrongSign: number;
  misses: number;
  spurious: number;
  /** Spurious cells whose stat name the gold moves on a different owner. */
  misattributed: number;
  /** Rows that repeat an owner/stat pair already reported. */
  duplicates: number;
  exact: boolean;
  /** `owner/stat` plus the gold direction, for each gold move the reply missed or signed wrong. */
  missedCells: string[];
  /** `owner/stat` plus the reply's direction, for each spurious move. */
  spuriousCells: string[];
}

const key = (text: string) => stripMarkdown(text).replace(/^[\s*_+-]+|[\s*_]+$/g, '').replace(/\s+/g, ' ').toLowerCase();

/** One owner's reply, text lines or the shipped schema object, read by the app's own reader. A shipped
 *  request over several owners maps each update's owner id through `ownerKeyOf`. */
export function parsePlainLines(
  raw: string, owner: Owner, snapshot: StatRequestSnapshot = createStatRequest(owner.stats),
  ownerKeyOf: (ownerId: OwnerId) => string = () => owner.key,
): Parsed {
  const response = readStatResponse(raw, snapshot);
  return {
    changes: response.updates.filter((u) => u.value !== 0).map((u) => ({ owner: ownerKeyOf(u.ownerId), stat: u.name, change: u.value })),
    invalid: response.diagnostics.filter((d) => d.reason !== 'textPass' && d.reason !== 'skipped').length,
    unreadable: false,
    maxChanges: response.updates.filter((u) => u.max !== 0).length,
  };
}

/** Arm A's lines: an owner's name, any separator (`/`, `:`, a space), then `Stat: delta`. Each line routes to
 *  the longest owner name it opens with. A line with no owner is invalid, since nothing says whose stat it is. */
export function parseOwnerLines(raw: string, owners: Owner[]): Parsed {
  const byOwner = new Map<string, string[]>();
  const longestFirst = [...owners].sort((a, b) => b.name.length - a.name.length);
  let invalid = 0;
  for (const line of raw.split('\n').filter((text) => text.trim())) {
    const plain = key(line);
    const owner = longestFirst.find((o) => plain.startsWith(key(o.name)) && /^\s*[/:\s-]/.test(plain.slice(key(o.name).length)));
    if (!owner) { invalid++; continue; }
    const rest = plain.slice(key(owner.name).length).replace(/^\s*[/:-]?\s*/, '');
    byOwner.set(owner.key, [...(byOwner.get(owner.key) ?? []), rest]);
  }
  const changes: Change[] = [];
  for (const owner of owners) {
    const lines = byOwner.get(owner.key);
    if (!lines) continue;
    const parsed = parsePlainLines(lines.join('\n'), owner);
    changes.push(...parsed.changes);
    invalid += parsed.invalid;
  }
  return { changes, invalid, unreadable: false };
}

/** Arm A3's blocks: an owner's name alone on a line (a heading mark allowed), then that owner's
 *  `Stat: delta` lines. A stat line before any owner is invalid. */
export function parseOwnerBlocks(raw: string, owners: Owner[]): Parsed {
  const byOwner = new Map<string, string[]>();
  let current: Owner | undefined;
  let invalid = 0;
  for (const line of raw.split('\n').filter((text) => text.trim())) {
    const heading = owners.find((o) => key(line.replace(/^\s*#+/, '')).replace(/:$/, '') === key(o.name));
    if (heading) { current = heading; continue; }
    if (!current) { invalid++; continue; }
    byOwner.set(current.key, [...(byOwner.get(current.key) ?? []), line]);
  }
  const parts = owners.filter((o) => byOwner.has(o.key)).map((o) => parsePlainLines(byOwner.get(o.key)!.join('\n'), o));
  return { changes: parts.flatMap((p) => p.changes), invalid: invalid + parts.reduce((n, p) => n + p.invalid, 0), unreadable: false };
}

/** The JSON arms' object: owner name → a list of `{ stat, change }` rows, or a map of stat → change.
 *  Every row is kept, so duplicates stay visible. */
export function parseJsonReply(raw: string, owners: Owner[]): Parsed {
  let body: unknown;
  try { body = JSON.parse(raw); } catch { return { changes: [], invalid: 0, unreadable: true }; }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { changes: [], invalid: 0, unreadable: true };
  const changes: Change[] = [];
  let invalid = 0;
  for (const [name, value] of Object.entries(body)) {
    const owner = owners.find((o) => key(o.name) === key(name));
    const rows = Array.isArray(value) ? value as unknown[]
      : value && typeof value === 'object' ? Object.entries(value).map(([stat, change]) => ({
        // A stat may carry its change beside other fields (`{ evidence, change }`).
        stat, change: change && typeof change === 'object' ? (change as { change?: unknown }).change : change,
      })) : null;
    if (!owner || !rows) { invalid++; continue; }
    for (const row of rows) {
      const { stat, change } = (row ?? {}) as { stat?: unknown; change?: unknown };
      const match = typeof stat === 'string' ? owner.stats.find((s) => key(s.name) === key(stat)) : undefined;
      if (!match || typeof change !== 'number' || !Number.isFinite(change)) { invalid++; continue; }
      if (change !== 0) changes.push({ owner: owner.key, stat: match.name, change: Math.round(change) });
    }
  }
  return { changes, invalid, unreadable: false };
}

const sign = (n: number): Direction | null => (n > 0 ? '+' : n < 0 ? '-' : null);

/** Grade one reply. Only owners in `scope` are graded, so a player-only control reads only player cells. */
export function scoreChanges(changes: Change[], expect: GoldCells, allow: GoldCells, scope: readonly string[]): Score {
  const inScope = changes.filter((c) => scope.includes(c.owner));
  const totals = new Map<string, { owner: string; stat: string; sum: number; rows: number }>();
  for (const c of inScope) {
    const k = `${c.owner}\u0000${key(c.stat)}`;
    const cell = totals.get(k) ?? { owner: c.owner, stat: c.stat, sum: 0, rows: 0 };
    cell.sum += c.change;
    cell.rows++;
    totals.set(k, cell);
  }
  const lookup = (gold: GoldCells, owner: string, stat: string) =>
    Object.entries(gold[owner] ?? {}).find(([name]) => key(name) === key(stat))?.[1];

  let expected = 0, hits = 0, wrongSign = 0, misses = 0;
  const missedCells: string[] = [], spuriousCells: string[] = [];
  for (const owner of scope) {
    for (const [stat, want] of Object.entries(expect[owner] ?? {})) {
      expected++;
      const got = sign(totals.get(`${owner}\u0000${key(stat)}`)?.sum ?? 0);
      if (got === want) { hits++; continue; }
      if (got) wrongSign++;
      else misses++;
      missedCells.push(`${owner}/${stat}${want}`);
    }
  }
  let spurious = 0, misattributed = 0, duplicates = 0;
  for (const cell of totals.values()) {
    duplicates += cell.rows - 1;
    const got = sign(cell.sum);
    if (!got || lookup(expect, cell.owner, cell.stat) || lookup(allow, cell.owner, cell.stat) === got) continue;
    spurious++;
    spuriousCells.push(`${cell.owner}/${cell.stat}${got}`);
    if (Object.entries(expect).some(([owner, cells]) => owner !== cell.owner && lookup({ [owner]: cells }, owner, cell.stat))) {
      misattributed++;
    }
  }
  return { expected, hits, wrongSign, misses, spurious, misattributed, duplicates, exact: hits === expected && !spurious, missedCells, spuriousCells };
}
