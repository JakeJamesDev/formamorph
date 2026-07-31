/** An authored publish-time popup as a reader sees it. */
export interface PolicyPopup {
  title: string;
  /** Markdown, authored by an admin. */
  body: string;
  /** Tag notice only: the tags that trigger it, normalized lowercase. */
  tags: string[];
}

/** The upload gate, plus whether this user has already accepted the current version of it. */
export interface UploadGateState extends PolicyPopup {
  accepted: boolean;
}

/** What the publish flow needs. Either popup is null when no admin has authored and enabled it. */
export interface PolicyState {
  uploadGate: UploadGateState | null;
  tagNotice: PolicyPopup | null;
}

/** A policy as the admin editor sees it, including a disabled or half-written draft. */
export interface AdminPolicy {
  enabled: boolean;
  title: string;
  body: string;
  tags: string[];
  /** Bumped whenever everyone must accept again; acceptances record the version they were given for. */
  acceptanceVersion: number;
  updatedAt: string | null;
}

/** Both policies, for the admin editor. */
export interface AdminPolicies {
  uploadGate: AdminPolicy;
  tagNotice: AdminPolicy;
}

/** An authoring payload. `requireReaccept` applies to the upload gate only. */
export interface SavePolicyInput {
  enabled: boolean;
  title: string;
  body: string;
  tags?: string[];
  requireReaccept?: boolean;
}

/** Which policy is being written; the server knows exactly these two. */
export type PolicyId = 'upload_gate' | 'tag_notice';
