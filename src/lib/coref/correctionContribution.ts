// Contributing a turn's corrections to the shared training corpus (Q9, Q14, Q35, Q59).
import CorefContributionService, { type CorefContributionBody } from '@/services/CorefContributionService';
import type { Entity } from '@/types';
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

/** What one send needs; `names` holds each entity's placeholder-resolved name, the persona's included (Q71). */
export interface TurnContribution {
  worldId: string | null;
  passage: string;
  entry: TurnMentionReading | undefined;
  corrections: readonly MentionCorrection[];
  names: ReadonlyMap<string, string>;
}

type Named = Pick<Entity, 'id' | 'name'>;

/** Each entity's name by id: the reading's cast and the played persona, both as play resolved them. */
export const contributionNames = (cast: readonly Named[], persona: Named | undefined): ReadonlyMap<string, string> =>
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

/** The body for a turn's corrections, or null when the reading kept no clusters or read another narration. */
export function contributionBody({ worldId, passage, entry, corrections, names }: TurnContribution): CorefContributionBody | null {
  if (!worldId || !entry?.clusters || !entry.clusterEntities || !corrections.length) return null;
  if (entry.textHash !== narrationHash(passage)) return null;
  const wireCorrections = corrections.map(({ kind, start, end, entityId }) => ({ kind, start, end, entityId }));
  return {
    worldId,
    passage,
    modelId: entry.model,
    modelVersion: entry.version,
    clusters: entry.clusters,
    clusterEntities: entry.clusterEntities,
    corrections: wireCorrections,
    entityNames: referencedNames([...entry.clusterEntities, ...wireCorrections.map((c) => c.entityId)], names),
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
