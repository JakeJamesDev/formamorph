import AuthService from './AuthService';
import type { AdminPolicies, AdminPolicy, PolicyId, PolicyState, SavePolicyInput } from '@/types';

/** Server error envelope: this API answers with `error`, older handlers elsewhere read `message`. */
interface ErrorBody {
  error?: string;
  message?: string;
}

/** The code the server returns when a publish is refused for want of an accepted gate. */
export const TERMS_REQUIRED = 'TERMS_REQUIRED';

/**
 * Authored publish-time popups: the blocking upload gate, and the advisory tag notice.
 *
 * The gate is enforced by the server — this only decides what to show and when. A failure to read policy
 * state is therefore never a reason to block publishing: the client fails open and lets the server refuse.
 */
class PolicyService {
  private get apiUrl() {
    return AuthService.API_URL;
  }

  private authHeaders(withBody = false): HeadersInit {
    const headers: Record<string, string> = { Authorization: `Bearer ${AuthService.token}` };
    if (withBody) headers['Content-Type'] = 'application/json';
    return headers;
  }

  private async unwrap<T>(response: Response, fallback: string): Promise<T> {
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as ErrorBody;
      throw new Error(body.error || body.message || fallback);
    }
    return (await response.json()) as T;
  }

  /** The popups that apply to the current user, and whether they've accepted the gate. */
  async fetchPolicies(): Promise<PolicyState> {
    const response = await fetch(`${this.apiUrl}/policies`, { headers: this.authHeaders() });
    return this.unwrap<PolicyState>(response, 'Failed to load policies');
  }

  /** Both policies for editing, including disabled drafts. Admin only. */
  async fetchForAdmin(): Promise<AdminPolicies> {
    const response = await fetch(`${this.apiUrl}/policies/manage`, { headers: this.authHeaders() });
    return this.unwrap<AdminPolicies>(response, 'Failed to load policies');
  }

  /** Write a policy. `requireReaccept` invalidates every existing acceptance of the gate. */
  async save(id: PolicyId, input: SavePolicyInput): Promise<AdminPolicy> {
    const response = await fetch(`${this.apiUrl}/policies/${id}`, {
      method: 'PUT',
      headers: this.authHeaders(true),
      body: JSON.stringify(input),
    });

    const body = await this.unwrap<{ data: AdminPolicy }>(response, 'Failed to save the policy');
    return body.data;
  }

  /** Record that the current user accepts the gate as it stands. */
  async acceptUploadGate(): Promise<void> {
    const response = await fetch(`${this.apiUrl}/policies/upload-gate/accept`, {
      method: 'POST',
      headers: this.authHeaders(),
    });

    await this.unwrap(response, 'Failed to record your acceptance');
  }

  /** Record a refusal. Enforces nothing — an unanswered gate already blocks — but it lets an admin tell
   *  someone who was asked and said no from someone who has never tried to publish. */
  async declineUploadGate(): Promise<void> {
    const response = await fetch(`${this.apiUrl}/policies/upload-gate/decline`, {
      method: 'POST',
      headers: this.authHeaders(),
    });

    await this.unwrap(response, 'Failed to record your answer');
  }

  /** Require the gate to be accepted again — by one user, or by everyone when `userId` is omitted. */
  async resetUploadGate(userId?: string): Promise<void> {
    const response = await fetch(`${this.apiUrl}/policies/upload-gate/reset`, {
      method: 'POST',
      headers: this.authHeaders(true),
      body: JSON.stringify(userId ? { userId } : {}),
    });

    await this.unwrap(response, 'Failed to reset the terms');
  }

  /** Which of these tags the tag notice covers. Empty when the notice is off or nothing matches. */
  async matchTags(tags: string[]): Promise<string[]> {
    const response = await fetch(`${this.apiUrl}/policies/tag-notice/match`, {
      method: 'POST',
      headers: this.authHeaders(true),
      body: JSON.stringify({ tags }),
    });

    const body = await this.unwrap<{ matched: string[] }>(response, 'Failed to check tags');
    return body.matched;
  }
}

export default new PolicyService();
