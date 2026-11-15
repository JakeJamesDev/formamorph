// Contributing a turn's corrections to the shared training corpus (Q9, Q14, Q35, Q59).
import CorefContributionService, { type CorefContributionBody } from '@/services/CorefContributionService';
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

/** What one send needs: the turn's narration, its reading, and every correction for the turn so far. */
export interface TurnContribution {
  worldId: string | null;
  passage: string;
  entry: TurnMentionReading | undefined;
  corrections: readonly MentionCorrection[];
}

/** The body for a turn's corrections, or null when the reading kept no clusters or read another narration. */
export function contributionBody({ worldId, passage, entry, corrections }: TurnContribution): CorefContributionBody | null {
  if (!worldId || !entry?.clusters || !entry.clusterEntities || !corrections.length) return null;
  if (entry.textHash !== narrationHash(passage)) return null;
  return {
    worldId,
    passage,
    modelId: entry.model,
    modelVersion: entry.version,
    clusters: entry.clusters,
    clusterEntities: entry.clusterEntities,
    corrections: corrections.map(({ kind, start, end, entityId }) => ({ kind, start, end, entityId })),
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
