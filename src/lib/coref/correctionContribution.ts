// Contributing a turn's corrections to the shared training corpus (Q9, Q14, Q35, Q59).
import CorefContributionService, {
  type CorefContributionBody, type ContributionCastRecord, type ContributionQuoteRecord,
} from '@/services/CorefContributionService';
import type { Entity } from '@/types';
import { APP_VERSION } from '@/lib/version';
import type { ReadingSpan } from './mentionReading';
import type { MentionCorrection } from './mentionCorrections';
import { narrationHash, type TurnMentionReading } from './mentionReadings';

/** Whether this player may contribute: signed in and age-attested (Q14). */
export type ContributeAccess = 'signedOut' | 'unattested' | 'ready';

export const contributeAccess = (signedIn: boolean, attested: boolean): ContributeAccess =>
  (!signedIn ? 'signedOut' : !attested ? 'unattested' : 'ready');

/** The player at the device: whether they may contribute, and their account id while signed in. */
export interface Contributor {
  access: ContributeAccess;
  accountId: string | null;
}

/** Whether this contributor opted in: the setting holds the id of the account that did (Q60). */
export const contributesNow = (optedInAccount: string | null, { access, accountId }: Contributor): boolean =>
  access === 'ready' && accountId !== null && optedInAccount === accountId;

/** Whether to ask this contributor the Contribute Corrections question: they may contribute, have not opted in,
 *  and their account never answered it (Q64). */
export const asksToContribute = (
  optedInAccount: string | null, contributor: Contributor, answered: (accountId: string) => boolean,
): boolean =>
  contributor.access === 'ready' && contributor.accountId !== null
  && !contributesNow(optedInAccount, contributor) && !answered(contributor.accountId);

type Named = Pick<Entity, 'id' | 'name'>;
/** An entity as play resolved it: placeholders are already names. */
export type CastSource = Named & Pick<Entity, 'aliases' | 'strangerName' | 'kind'>;

/** What one send needs. `entities` is the reading's cast as play resolved it and `persona` the played persona. */
export interface TurnContribution {
  worldId: string | null;
  passage: string;
  entry: TurnMentionReading | undefined;
  corrections: readonly MentionCorrection[];
  entities: readonly CastSource[];
  persona: CastSource | undefined;
}

/** Each entity's name by id: the reading's cast and the played persona, both as play resolved them. */
const contributionNames = (cast: readonly Named[], persona: Named | undefined): ReadonlyMap<string, string> =>
  new Map([...cast, ...(persona ? [persona] : [])].map(({ id, name }) => [id, name]));

/** The server refuses a name longer than this, and with it the whole send. */
const ENTITY_NAME_MAX = 200;

/** The referenced entities' names; one the server would refuse is left out, so staff read the id. */
function referencedNames(ids: readonly (string | null)[], names: ReadonlyMap<string, string>): Record<string, string> {
  const entries: [string, string][] = [];
  for (const id of new Set(ids)) {
    const name = id === null ? undefined : names.get(id);
    if (id !== null && name?.trim() && name.length <= ENTITY_NAME_MAX) entries.push([id, name]);
  }
  return Object.fromEntries(entries);
}

const ALIASES_MAX = 20;
const ID_MAX = 200;
const CAST_MAX = 200;
const QUOTES_MAX = 500;
const FIRST_PERSON_MAX = 50;
const CLIENT_VERSION_MAX = 64;

const usable = (text: string | null | undefined, max = ENTITY_NAME_MAX): text is string => !!text?.trim() && text.length <= max;

// The span checks copy the server's `validSpan` (FormamorphServer `corefCorpus.js`).
const isHigh =(code: number) => code >= 0xd800 && code <= 0xdbff;
const isLow = (code: number) => code >= 0xdc00 && code <= 0xdfff;
const onCodePoint = (text: string, at: number) => at === 0 || at === text.length || !(isHigh(text.charCodeAt(at - 1)) && isLow(text.charCodeAt(at)));
const WORD_CHAR = /^[\p{L}\p{N}]$/u;
const insideWord = (text: string, at: number) => {
  if (at === 0 || at === text.length) return false;
  const before = Array.from(text.slice(Math.max(0, at - 2), at)).pop() ?? '';
  return WORD_CHAR.test(before) && WORD_CHAR.test(String.fromCodePoint(text.codePointAt(at) ?? 0));
};
/** Whether the server takes this span: inside the passage, on code points, splitting no word. */
const validSpan = (text: string, { start, end }: ReadingSpan): boolean =>
  Number.isInteger(start) && Number.isInteger(end) && start >= 0 && end > start && end <= text.length
  && onCodePoint(text, start) && onCodePoint(text, end) && !insideWord(text, start) && !insideWord(text, end);

const usableSpan = (text: string, span: ReadingSpan | null | undefined): ReadingSpan | null =>
  span && validSpan(text, span) ? { start: span.start, end: span.end } : null;

const castRecord = (entity: CastSource, kind: ContributionCastRecord['kind']): ContributionCastRecord | null => {
  if (!usable(entity.id, ID_MAX) || !usable(entity.name)) return null;
  return {
    id: entity.id,
    name: entity.name,
    aliases: (entity.aliases ?? []).filter((alias) => usable(alias)).slice(0, ALIASES_MAX),
    strangerName: usable(entity.strangerName) ? entity.strangerName : null,
    kind,
  };
};

/** The cast the reading voted with, then the persona. A reading made before the cast ids were kept falls back to
 *  the entities the turn references. */
function castRecords(
  entry: TurnMentionReading, corrections: readonly MentionCorrection[], entities: readonly CastSource[], persona: CastSource | undefined,
): ContributionCastRecord[] {
  const ids = entry.castIds ?? [
    ...(entry.clusterEntities ?? []), ...corrections.map((c) => c.entityId), ...entry.reading.quotes.map((q) => q.speaker),
  ].filter((id): id is string => id !== null);
  const byId = new Map(entities.map((entity) => [entity.id, entity]));
  const records: ContributionCastRecord[] = [];
  const seen = new Set<string>();
  for (const id of ids) {
    const entity = byId.get(id);
    if (!entity || seen.has(id) || id === persona?.id) continue;
    seen.add(id);
    const record = castRecord(entity, entity.kind === 'generic' ? 'generic' : 'unique');
    if (record) records.push(record);
  }
  const personaRecord = persona ? castRecord(persona, null) : null;
  // The persona record always survives the cap.
  return (personaRecord ? [...records.slice(0, CAST_MAX - 1), personaRecord] : records.slice(0, CAST_MAX));
}

/** The quotes the reading attributed, as it showed them. A quote saved before the records were kept has no rule and
 *  is left out; a span the server would refuse is left out too. */
function quoteRecords(passage: string, quotes: TurnMentionReading['reading']['quotes']): ContributionQuoteRecord[] {
  const records: ContributionQuoteRecord[] = [];
  for (const quote of quotes) {
    if (!quote.rule || !validSpan(passage, quote)) continue;
    records.push({
      start: quote.start,
      end: quote.end,
      speakerId: usable(quote.speaker, ID_MAX) ? quote.speaker : null,
      rule: quote.rule,
      mention: usableSpan(passage, quote.mention),
      firstPerson: (quote.firstPerson ?? []).flatMap((span) => usableSpan(passage, span) ?? []).slice(0, FIRST_PERSON_MAX),
      ...(quote.fallback !== undefined ? { fallback: quote.fallback } : {}),
    });
    if (records.length === QUOTES_MAX) break;
  }
  return records;
}

/** The body for a turn's corrections, or null when the reading kept no clusters or read another narration. */
export function contributionBody({ worldId, passage, entry, corrections, entities, persona }: TurnContribution): CorefContributionBody | null {
  if (!worldId || !entry?.clusters || !entry.clusterEntities || !corrections.length) return null;
  if (entry.textHash !== narrationHash(passage)) return null;
  const names = contributionNames(entities, persona);
  const wireCorrections = corrections.map(({ kind, start, end, entityId }) => ({ kind, start, end, entityId }));
  const quotes = quoteRecords(passage, entry.reading.quotes);
  return {
    worldId,
    passage,
    modelId: entry.model,
    modelVersion: entry.version,
    clusters: entry.clusters,
    clusterEntities: entry.clusterEntities,
    corrections: wireCorrections,
    entityNames: referencedNames([...entry.clusterEntities, ...wireCorrections.map((c) => c.entityId)], names),
    playerId: persona && usable(persona.id, ID_MAX) ? persona.id : null,
    cast: castRecords(entry, corrections, entities, persona),
    ...(quotes.length ? { quotes } : {}),
    clientVersion: APP_VERSION.slice(0, CLIENT_VERSION_MAX),
    ...(entry.readingVersion ? { readingVersion: entry.readingVersion } : {}),
  };
}

/** Sends the turn's corrections when the signed-in account opted in and may contribute. Resolves whether a send
 *  went out; a failed send leaves the correction local. */
export async function contributeTurn(
  optedInAccount: string | null, contributor: Contributor, turn: TurnContribution,
): Promise<boolean> {
  if (!contributesNow(optedInAccount, contributor)) return false;
  const body = contributionBody(turn);
  if (!body) return false;
  try {
    await CorefContributionService.submit(body);
    return true;
  } catch (error: unknown) {
    console.warn('Could not contribute the correction', error);
    return false;
  }
}
