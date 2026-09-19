/**
 * Whether this device has attested to being old enough for user-generated community content.
 *
 * The record is shaped like the server's policy acceptances — accepted, the version of the copy that was
 * accepted, and when — so the account-backed `age_gate` policy can use it as its local mirror. Raising
 * {@link AGE_GATE_VERSION} therefore re-prompts everyone, the same way an admin resetting the upload
 * gate does.
 *
 * This store remains the authority for guests and a device mirror for signed-in accounts. A second store
 * keeps each account's confirmed answer under its own id, so one account's answer never unlocks another.
 * Writes are try/catch'd because private-mode browsers throw on `setItem`; a failed write means the gate
 * returns next launch.
 */

const STORAGE_KEY = 'FORMAMORPH_ageGate';
const ACCOUNTS_STORAGE_KEY = 'FORMAMORPH_ageGateAccounts';

/** Raise this when the attestation copy changes: a stored acceptance below it re-prompts. */
export const AGE_GATE_VERSION = 1;

export interface AgeGateAcceptance {
  accepted: boolean;
  acceptanceVersion: number;
  acceptedAt: string;
}

/** A stored value as a record, or null when it is not one. */
function toAcceptance(parsed: unknown): AgeGateAcceptance | null {
  if (!parsed || typeof parsed !== 'object') return null;
  const record = parsed as Partial<AgeGateAcceptance>;
  if (typeof record.accepted !== 'boolean') return null;
  return {
    accepted: record.accepted,
    acceptanceVersion: typeof record.acceptanceVersion === 'number' ? record.acceptanceVersion : 0,
    acceptedAt: typeof record.acceptedAt === 'string' ? record.acceptedAt : '',
  };
}

const isCurrent = (record: AgeGateAcceptance | null): boolean =>
  Boolean(record?.accepted) && (record?.acceptanceVersion ?? 0) >= AGE_GATE_VERSION;

const currentAcceptance = (): AgeGateAcceptance => ({
  accepted: true,
  acceptanceVersion: AGE_GATE_VERSION,
  acceptedAt: new Date().toISOString(),
});

/** The stored record, or null when this device has never answered (or the record is unreadable). */
function readAgeGate(): AgeGateAcceptance | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? toAcceptance(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

/** Every account answer this device holds, keyed by account id. Empty when unreadable. */
function readAccountAnswers(): Record<string, unknown> {
  try {
    const raw = localStorage.getItem(ACCOUNTS_STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function writeAccountAnswers(answers: Record<string, unknown>): void {
  try {
    localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(answers));
  } catch {
    /* private mode — the account is checked against the server again next session */
  }
}

/** Whether the player has accepted the gate as it currently reads. */
export function isAgeAttested(): boolean {
  return isCurrent(readAgeGate());
}

/** Record that the player attests to the gate as it currently reads. */
export function acceptAgeGate(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(currentAcceptance()));
  } catch {
    /* private mode — this device attests again next session */
  }
}

/** Whether the server has confirmed, on this device, that this account accepted the gate as it currently reads. */
export function isAccountAgeAttested(accountId: string): boolean {
  const answers = readAccountAnswers();
  return Object.prototype.hasOwnProperty.call(answers, accountId) && isCurrent(toAcceptance(answers[accountId]));
}

/** Record the server's confirmation that this account attests to the gate as it currently reads. */
export function rememberAccountAgeGate(accountId: string): void {
  writeAccountAnswers({ ...readAccountAnswers(), [accountId]: currentAcceptance() });
}

/** Drop this account's remembered answer, once the server stops confirming it. */
export function forgetAccountAgeGate(accountId: string): void {
  const answers = readAccountAnswers();
  if (!Object.prototype.hasOwnProperty.call(answers, accountId)) return;
  delete answers[accountId];
  writeAccountAnswers(answers);
}
