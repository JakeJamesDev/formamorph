/** What a caller wants done once the player signs in. */
export interface SignInRequest {
  onSignedIn?: () => void;
}

interface SignInState {
  /** `checking` waits on the age gate's authentication check; `open` shows the dialog. */
  phase: 'idle' | 'checking' | 'open';
  request: SignInRequest | null;
}

let state: SignInState = { phase: 'idle', request: null };
const listeners = new Set<() => void>();
const signedInListeners = new Set<() => void>();
const publish = (next: SignInState) => {
  state = next;
  listeners.forEach((listener) => listener());
};

/** Raises sign-in from anywhere. The host runs the age gate's authentication check before the dialog opens. */
export function requestSignIn(request: SignInRequest = {}): void {
  publish({ phase: state.phase === 'open' ? 'open' : 'checking', request });
}

/** Opens the dialog once the check passes. */
export function showSignIn(): void {
  if (state.phase === 'checking') publish({ ...state, phase: 'open' });
}

/** Drops the request when the check or the dialog is canceled. */
export function cancelSignIn(): void {
  if (state.phase !== 'idle') publish({ phase: 'idle', request: null });
}

export function signInSucceeded(): void {
  const { request } = state;
  publish({ phase: 'idle', request: null });
  signedInListeners.forEach((listener) => listener());
  request?.onSignedIn?.();
}

/** Listens for every successful sign-in, whoever raised it. Returns the unsubscribe. */
export function onSignInSucceeded(listener: () => void): () => void {
  signedInListeners.add(listener);
  return () => { signedInListeners.delete(listener); };
}

export function subscribeSignIn(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function getSignInState(): SignInState {
  return state;
}
