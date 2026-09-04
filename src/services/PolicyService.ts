import AuthService from './AuthService';
import type {
  AdminPolicies, AdminPolicy, PolicyId, PolicyState, PublicPrivacyPolicy, SavePolicyInput,
} from '@/types';

/** Server error envelope: this API answers with `error`, older handlers elsewhere read `message`. */
interface ErrorBody {
  error?: string;
  message?: string;
}

/** The code the server returns when a publish is refused for want of an accepted gate. */
export const TERMS_REQUIRED = 'TERMS_REQUIRED';

/** The code the server returns when any request is refused for want of an accepted Privacy Policy. */
export const PRIVACY_REQUIRED = 'PRIVACY_REQUIRED';

/**
 * The server's authored policies: the publish-time upload gate and tag notice, and the Privacy Policy
 * that stands in front of every authenticated route.
 *
 * All three are enforced by the server — this only decides what to show and when. A failure to read
 * policy state is therefore never a reason to block publishing: the client fails open and lets the
 * server refuse. The Privacy Policy is the one exception to reading with a token, because registration
 * shows it before the account exists.
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

  /**
   * The Privacy Policy's text alone, for a reader with no account yet.
   *
   * The only policy read that sends no token: registration shows the policy before the account exists.
   * Null when the server has none switched on, which is the state it ships in — a caller that finds
   * nothing here has nothing to ask, and the server is refusing nothing either.
   */
  async fetchPublicPrivacyPolicy(): Promise<PublicPrivacyPolicy | null> {
    const response = await fetch(`${this.apiUrl}/policies/privacy-policy`);
    if (response.status === 404) return null;

    const body = await this.unwrap<{ privacyPolicy: PublicPrivacyPolicy }>(response, 'Failed to load the privacy policy');
    return body.privacyPolicy;
  }

  /**
   * Record that the current user accepts the Privacy Policy as it stands.
   *
   * A 404 answers that the policy is switched off, which means there is nothing outstanding rather
   * than that the acceptance failed — an admin who disables it mid-signup must not leave the new
   * account being told its answer never landed.
   */
  async acceptPrivacyPolicy(): Promise<void> {
    const response = await fetch(`${this.apiUrl}/policies/privacy-policy/accept`, {
      method: 'POST',
      headers: this.authHeaders(),
    });

    if (response.status === 404) return;

    await this.unwrap(response, 'Failed to record your acceptance');
  }

  /** Record a refusal of the Privacy Policy. Enforces nothing on its own — an unanswered policy already
   *  refuses every authenticated route — but it tells an admin they were asked and said no. */
  async declinePrivacyPolicy(): Promise<void> {
    const response = await fetch(`${this.apiUrl}/policies/privacy-policy/decline`, {
      method: 'POST',
      headers: this.authHeaders(),
    });

    await this.unwrap(response, 'Failed to record your answer');
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
