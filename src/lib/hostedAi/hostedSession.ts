import AuthService from '@/services/AuthService';
import type { ReasoningCapability } from '@/lib/reasoningEffort';
import { hostedReasoningCapability, parseHostedState, type HostedState, type HostedUsage } from './hostedState';
import { HOSTED_STATE_URL } from './hostedUrls';
import { hostedStateSends, readHostedRefusal, type HostedPresetState, type HostedRefusal } from './refusals';
import { HostedTurn, HostedTurnRegistry } from './hostedTurn';

/** What the session knows, replaced whole on every change. */
export interface HostedSnapshot {
  /** The last hosted state this session read, kept while a later read fails. */
  hosted: HostedState | null;
  /** The preset state, from the credential, the last refusal and the last read. */
  presetState: HostedPresetState;
  /** The served model's capability record; unknown with no model read yet. */
  capability: ReasoningCapability;
}

interface HostedSessionOptions {
  /** The account token, read at the moment of use. */
  credential?: () => string | null;
  fetchImpl?: typeof fetch;
  stateUrl?: string;
}

/**
 * The client's view of Formamorph AI for this account: the hosted state, the preset state it implies, and
 * the turns calls belong to. React-free; the settings context subscribes to it.
 */
export class HostedSession {
  readonly credential: () => string | null;
  private readonly fetchImpl: () => typeof fetch;
  private readonly stateUrl: string;
  private readonly turns = new HostedTurnRegistry();
  private readonly listeners = new Set<() => void>();
  private hosted: HostedState | null = null;
  /** The last read failed, so the preset is unavailable until one answers. */
  private stale = true;
  /** A refusal's state, which holds until the next successful read. */
  private refused: HostedPresetState | null = null;
  private reading: Promise<void> | null = null;
  private snapshot: HostedSnapshot;
  /** Capability records by served model id, so a model the server switches to reads its own. */
  private readonly capabilities = new Map<string, ReasoningCapability>();

  constructor({ credential = () => AuthService.token, fetchImpl, stateUrl = HOSTED_STATE_URL }: HostedSessionOptions = {}) {
    this.credential = credential;
    // The global is read per call, so the app's request watchers wrap it.
    this.fetchImpl = () => fetchImpl ?? fetch;
    this.stateUrl = stateUrl;
    this.snapshot = this.build();
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  /** The snapshot; a token that changed since it was built drops everything the old account held. */
  getSnapshot = (): HostedSnapshot => {
    if (this.credential() !== this.builtFor) this.forget();
    return this.snapshot;
  };

  private builtFor: string | null = null;

  private forget() {
    this.hosted = null;
    this.stale = true;
    this.refused = null;
    this.snapshot = this.build();
  }

  /** The blocking state the player was last told about; cleared once the preset sends again. */
  private announced: HostedPresetState | null = null;

  /** Records that the player saw `state`'s message. */
  markAnnounced(state: HostedPresetState) {
    this.announced = state;
  }

  /** True once per blocking state, so a background pass that keeps failing tells the player once. */
  claimAnnouncement(state: HostedPresetState): boolean {
    if (this.announced === state) return false;
    this.announced = state;
    return true;
  }

  private build(): HostedSnapshot {
    this.builtFor = this.credential();
    const presetState: HostedPresetState = !this.credential()
      ? 'signed-out'
      : this.refused ?? (this.stale || !this.hosted ? 'unavailable' : this.hosted.state);
    if (hostedStateSends(presetState)) this.announced = null;
    const model = this.hosted?.model;
    let capability = model ? this.capabilities.get(model.id) : undefined;
    if (model && !capability) {
      capability = hostedReasoningCapability(model.capabilities);
      this.capabilities.set(model.id, capability);
    }
    return { hosted: this.hosted, presetState, capability: capability ?? hostedReasoningCapability(undefined) };
  }

  private changed() {
    this.snapshot = this.build();
    this.listeners.forEach((listener) => listener());
  }

  /** Forgets everything account-bound. */
  reset() {
    this.forget();
    this.listeners.forEach((listener) => listener());
  }

  /** Reads the hosted state again. Concurrent calls share one read. */
  refresh(): Promise<void> {
    this.reading ??= this.read().finally(() => { this.reading = null; });
    return this.reading;
  }

  private async read() {
    const token = this.credential();
    if (!token || !this.stateUrl) { this.changed(); return; }
    try {
      const response = await this.fetchImpl()(this.stateUrl, { headers: { Authorization: `Bearer ${token}` } });
      // A sign-out during the read leaves the answer to the old account unused.
      if (this.credential() !== token) return;
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const refusal = readHostedRefusal(response.status, body);
        this.refused = refusal.presetState;
        this.stale = refusal.presetState === null;
      } else {
        const state = parseHostedState((body as { data?: unknown } | null)?.data);
        this.hosted = state ?? this.hosted;
        this.stale = state === null;
        this.refused = null;
      }
    } catch {
      this.stale = true;
    }
    this.changed();
  }

  /** Records what a refused call said. A `window_exceeded` takes the server's window and reads the state again. */
  noteRefusal(refusal: HostedRefusal) {
    if (refusal.presetState) this.refused = refusal.presetState;
    if (refusal.window !== undefined && this.hosted) this.hosted = { ...this.hosted, window: refusal.window };
    if (refusal.resetAt !== undefined && this.hosted) this.hosted = { ...this.hosted, resetAt: refusal.resetAt };
    this.changed();
    if (refusal.code === 'window_exceeded') void this.refresh();
  }

  /** Lays a settled call's usage onto the state. */
  noteUsage(usage: HostedUsage) {
    if (!this.hosted) return;
    this.hosted = { ...this.hosted, ...usage };
    this.changed();
  }

  /** The turn a client turn id names, shared by every call of that turn. */
  turnFor(key: string): HostedTurn {
    return this.turns.turnFor(key);
  }
}

/** The app's one session. */
export const hostedSession = new HostedSession();
