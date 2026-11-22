import AuthService from './AuthService';
import { authHeaders, unwrap } from './authRequest';
import type { CharSpan } from '@/lib/coref/corefHost';
import type { MentionCorrection } from '@/lib/coref/mentionCorrections';

/** One cast entity as the reading saw it, names resolved. `kind` is null for the persona. */
export interface ContributionCastRecord {
  id: string;
  name: string;
  aliases: string[];
  strangerName: string | null;
  kind: 'unique' | 'generic' | null;
}

/** One quote the reading attributed: the speaker it showed, the rule that picked it and the mentions behind it.
 *  `fallback` is the rule that named the speaker when it came from a fallback; the server ignores it. */
export interface ContributionQuoteRecord {
  start: number;
  end: number;
  speakerId: string | null;
  rule: string;
  mention: { start: number; end: number } | null;
  firstPerson: { start: number; end: number }[];
  fallback?: string | null;
}

/** One passage's corrections as the server takes them (Character Mentions Q35). Spans are UTF-16 offsets. */
export interface CorefContributionBody {
  worldId: string;
  passage: string;
  modelId: string;
  modelVersion: number;
  clusters: CharSpan[][];
  clusterEntities: (string | null)[];
  corrections: MentionCorrection[];
  /** The resolved name of each referenced entity, by id. An id without one has no name to show. */
  entityNames: Record<string, string>;
  /** The persona's entity id; null without one. */
  playerId?: string | null;
  cast?: ContributionCastRecord[];
  /** Absent for a turn read before the records were kept. */
  quotes?: ContributionQuoteRecord[];
  clientVersion?: string;
  /** Absent for a turn read before the version was kept. */
  readingVersion?: number;
}

/** A label the export derives from a quote correction. `wholeCluster` is true when it named its whole unnamed cluster. */
export interface DerivedLabel {
  start: number;
  end: number;
  entityId: string;
  wholeCluster: boolean;
}

/** A contribution in the staff queue. */
export interface CorefContribution extends CorefContributionBody {
  id: string;
  /** Whether the export would change a label. Absent from a server that predates the field. */
  changesLabels?: boolean;
  derivedLabels?: DerivedLabel[];
  contributorUsername: string | null;
  state: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
}

/** A staff decision on a contribution. */
export type ContributionDecision = 'accept' | 'reject';

/** Contributed Character Mentions corrections: the player's send and the staff queue. */
class CorefContributionService {
  private get url() {
    return `${AuthService.API_URL}/coref-contributions`;
  }

  /** Send one passage's corrections. A later send for the same passage replaces the pending one. */
  async submit(body: CorefContributionBody): Promise<void> {
    const response = await fetch(this.url, { method: 'POST', headers: authHeaders(true), body: JSON.stringify(body) });
    await unwrap(response, 'Could not send the correction');
  }

  /** Pending contributions, oldest first. */
  async fetchQueue(): Promise<CorefContribution[]> {
    const response = await fetch(this.url, { headers: authHeaders() });
    return (await unwrap<{ data: CorefContribution[] }>(response, 'Could not load the contributions')).data;
  }

  /** How many contributions wait for review; 0 when the count cannot be read. */
  async fetchCount(): Promise<number> {
    return (await this.fetchCounts()).pending;
  }

  /** Pending and no-change counts; zeros when they cannot be read. */
  async fetchCounts(): Promise<{ pending: number; noChange: number }> {
    try {
      const response = await fetch(`${this.url}/count`, { headers: authHeaders() });
      if (!response.ok) return { pending: 0, noChange: 0 };
      const body = (await response.json()) as { pending?: number; noChange?: number };
      return { pending: body.pending ?? 0, noChange: body.noChange ?? 0 };
    } catch {
      return { pending: 0, noChange: 0 };
    }
  }

  /** Rejects every pending contribution that changes no label; resolves to how many it rejected. */
  async rejectNoChange(): Promise<number> {
    const response = await fetch(`${this.url}/reject-no-change`, { method: 'POST', headers: authHeaders() });
    return (await unwrap<{ rejected: number }>(response, 'Could not reject the contributions')).rejected;
  }

  async accept(id: string): Promise<void> {
    await this.review(id, 'accept');
  }

  async reject(id: string): Promise<void> {
    await this.review(id, 'reject');
  }

  private async review(id: string, action: ContributionDecision): Promise<void> {
    const response = await fetch(`${this.url}/${encodeURIComponent(id)}/${action}`, { method: 'POST', headers: authHeaders() });
    await unwrap(response, `Could not ${action} the contribution`);
  }
}

export default new CorefContributionService();
