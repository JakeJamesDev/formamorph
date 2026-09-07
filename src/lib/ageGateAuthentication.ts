import { AGE_GATE_VERSION } from '@/lib/ageGate';
import AgeGateService from '@/services/AgeGateService';
import AuthService from '@/services/AuthService';
import type { AgeGateAuthenticationFlow, BoundAgeGateAuthentication } from '@/types';

const STORAGE_KEY = 'FORMAMORPH_ageGateAuthentication';
export const AGE_GATE_AUTH_FLOW_PARAM = 'contentWarningFlow';
let volatileFlow: AgeGateAuthenticationFlow | null = null;

export class AgeGateAuthenticationChangedError extends Error {}

const accountKey = () => `${AuthService.token ?? ''}:${AuthService.currentUser?.id ?? ''}`;

const readStoredFlow = (): AgeGateAuthenticationFlow | null => {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const flow = parsed as Partial<AgeGateAuthenticationFlow>;
    if (typeof flow.id !== 'string' || typeof flow.acceptanceVersion !== 'number') return null;
    return { id: flow.id, acceptanceVersion: flow.acceptanceVersion };
  } catch {
    return null;
  }
};

const isStoredFlow = (flow: AgeGateAuthenticationFlow): boolean => {
  const stored = volatileFlow ?? readStoredFlow();
  return stored?.id === flow.id && stored.acceptanceVersion === flow.acceptanceVersion;
};

/** Start one authentication flow from the warning the visitor just accepted. */
export function beginAgeGateAuthentication(): AgeGateAuthenticationFlow {
  const flow = { id: crypto.randomUUID(), acceptanceVersion: AGE_GATE_VERSION };
  volatileFlow = flow;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(flow));
  } catch {
    /* The current visit remains accepted; a navigation cannot carry the answer without session storage. */
  }
  return flow;
}

/** Add the opaque flow id to one site authentication link. */
export function withAgeGateAuthentication(
  path: string,
  flow: AgeGateAuthenticationFlow | null,
): string {
  if (!flow || !isStoredFlow(flow)) return path;
  const url = new URL(path, 'https://authentication.invalid');
  url.searchParams.set(AGE_GATE_AUTH_FLOW_PARAM, flow.id);
  return `${url.pathname}${url.search}${url.hash}`;
}

/** Restore only the flow named by this authentication page's address. */
export function readAgeGateAuthentication(search = window.location.search): AgeGateAuthenticationFlow | null {
  const id = new URLSearchParams(search).get(AGE_GATE_AUTH_FLOW_PARAM);
  const stored = volatileFlow ?? readStoredFlow();
  return id && stored?.id === id ? stored : null;
}

/** Bind the pending answer to the account created by this authentication attempt. */
export function bindAgeGateAuthentication(flow: AgeGateAuthenticationFlow): BoundAgeGateAuthentication {
  if (!isStoredFlow(flow) || !AuthService.isAuthenticated()) {
    throw new AgeGateAuthenticationChangedError('This sign-in flow is no longer active.');
  }
  return { ...flow, accountKey: accountKey() };
}

/** Forget an abandoned flow without touching a newer one. */
export function cancelAgeGateAuthentication(flow: AgeGateAuthenticationFlow): void {
  if (!isStoredFlow(flow)) return;
  if (volatileFlow?.id === flow.id) volatileFlow = null;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* An unreadable store cannot be reused by a later flow. */
  }
}

const assertSameAccount = (flow: BoundAgeGateAuthentication) => {
  if (isStoredFlow(flow) && accountKey() === flow.accountKey) return;
  cancelAgeGateAuthentication(flow);
  throw new AgeGateAuthenticationChangedError('Your signed-in account changed. Start sign-in again.');
};

/** Persist the displayed warning version, skipping the write when the account already has it. */
export async function completeAgeGateAuthentication(flow: BoundAgeGateAuthentication): Promise<void> {
  assertSameAccount(flow);
  const answer = await AgeGateService.read();
  assertSameAccount(flow);

  if (answer.requiredVersion !== flow.acceptanceVersion) {
    throw new Error(answer.requiredVersion > flow.acceptanceVersion
      ? 'Update Formamorph to review the current adult-content warning.'
      : 'The account server is not ready for this content warning. Try again later.');
  }

  if (!answer.accepted) {
    await AgeGateService.accept(flow.acceptanceVersion);
    assertSameAccount(flow);
  }

  cancelAgeGateAuthentication(flow);
}
