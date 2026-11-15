import AuthService from './AuthService';
import { authHeaders, unwrap } from './authRequest';
import type { CharSpan } from '@/lib/coref/corefHost';
import type { MentionCorrection } from '@/lib/coref/mentionCorrections';

/** One passage's corrections as the server takes them (Character Mentions Q35). Spans are UTF-16 offsets. */
export interface CorefContributionBody {
  worldId: string;
  passage: string;
  modelId: string;
  modelVersion: number;
  clusters: CharSpan[][];
  clusterEntities: (string | null)[];
  corrections: MentionCorrection[];
}

/** A contribution in the staff queue. */
export interface CorefContribution extends CorefContributionBody {
  id: string;
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
    try {
      const response = await fetch(`${this.url}/count`, { headers: authHeaders() });
      if (!response.ok) return 0;
      return ((await response.json()) as { pending?: number }).pending ?? 0;
    } catch {
      return 0;
    }
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
