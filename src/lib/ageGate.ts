/**
 * Whether this device has attested to being old enough for user-generated community content.
 *
 * The record is shaped like the server's policy acceptances — accepted, the version of the copy that was
 * accepted, and when — so the account-backed `age_gate` policy can use it as its local mirror. Raising
 * {@link AGE_GATE_VERSION} therefore re-prompts everyone, the same way an admin resetting the upload
 * gate does.
 *
 * This store remains the authority for guests and a device mirror for signed-in accounts. Writes are
 * try/catch'd because private-mode browsers throw on `setItem`; a failed write means the gate returns
 * next launch.
 */

const STORAGE_KEY = 'FORMAMORPH_ageGate';

/** Raise this when the attestation copy changes: a stored acceptance below it re-prompts. */
export const AGE_GATE_VERSION = 1;

export interface AgeGateAcceptance {
  accepted: boolean;
  acceptanceVersion: number;
  acceptedAt: string;
}

/** The stored record, or null when this device has never answered (or the record is unreadable). */
function readAgeGate(): AgeGateAcceptance | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const record = parsed as Partial<AgeGateAcceptance>;
    if (typeof record.accepted !== 'boolean') return null;
    return {
      accepted: record.accepted,
      acceptanceVersion: typeof record.acceptanceVersion === 'number' ? record.acceptanceVersion : 0,
      acceptedAt: typeof record.acceptedAt === 'string' ? record.acceptedAt : '',
    };
  } catch {
    return null;
  }
}

/** Whether the player has accepted the gate as it currently reads. */
export function isAgeAttested(): boolean {
  const stored = readAgeGate();
  return Boolean(stored?.accepted) && (stored?.acceptanceVersion ?? 0) >= AGE_GATE_VERSION;
}

/** Record that the player attests to the gate as it currently reads. */
export function acceptAgeGate(): void {
  const record: AgeGateAcceptance = {
    accepted: true,
    acceptanceVersion: AGE_GATE_VERSION,
    acceptedAt: new Date().toISOString(),
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  } catch {
    /* private mode — this device attests again next session */
  }
}
