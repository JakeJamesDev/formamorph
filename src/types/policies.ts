/** An authored publish-time popup as a reader sees it. */
export interface PolicyPopup {
  title: string;
  /** Markdown, authored by an admin. */
  body: string;
  /** Tag notice only: the tags that trigger it, normalized lowercase. */
  tags: string[];
}

/** A policy the reader answers, plus whether they have accepted the version now in force. */
export interface AnswerablePolicy extends PolicyPopup {
  accepted: boolean;
}

/** The upload gate. Named apart from the privacy policy because only this one governs publishing. */
export type UploadGateState = AnswerablePolicy;

/** What the publish flow needs. Either popup is null when no admin has authored and enabled it. */
export interface PolicyState {
  uploadGate: UploadGateState | null;
  tagNotice: PolicyPopup | null;
  /** Null while the policy is switched off, which is how it ships — nothing to prompt for, and the
   *  server refuses nothing either. `tags` rides along as an empty list and means nothing here. */
  privacyPolicy: AnswerablePolicy | null;
}

/** The Privacy Policy as a stranger reads it: the text alone, with no answer to report. Registration
 *  shows it before the account exists, so this is the one policy read that carries no acceptance. */
export interface PublicPrivacyPolicy {
  title: string;
  body: string;
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

/** Every policy, for the admin editor. Never null: an unwritten row reads as an empty draft. */
export interface AdminPolicies {
  uploadGate: AdminPolicy;
  tagNotice: AdminPolicy;
  privacyPolicy: AdminPolicy;
}

/** An authoring payload. `requireReaccept` applies to the policies a user answers. */
export interface SavePolicyInput {
  enabled: boolean;
  title: string;
  body: string;
  tags?: string[];
  requireReaccept?: boolean;
}

/** Which policy is being written; the server knows exactly these three. */
export type PolicyId = 'upload_gate' | 'tag_notice' | 'privacy_policy';
