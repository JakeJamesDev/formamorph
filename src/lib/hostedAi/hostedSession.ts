import AuthService from '@/services/AuthService';
import type { ReasoningCapability } from '@/lib/reasoningEffort';
import { hostedReasoningCapability, parseHostedState, recordOf, type HostedState, type HostedUsage } from './hostedState';
import { HOSTED_STATE_URL, hostedAckUrl } from './hostedUrls';
import { WARN_THRESHOLDS } from './hostedAllowance';
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
  /** A call settled its usage and no commit has raised its notice yet. */
  private usageNoted = false;
  /** Warnings shown in this session, so a slow or failed ack never shows one twice. */
  private readonly shown = new Set<number>();
  private exhaustedShownFor: string | null = null;

  private forget() {
    this.hosted = null;
    this.stale = true;
    this.refused = null;
    // Notices are per account, so the next account starts with none shown.
    this.shown.clear();
    this.exhaustedShownFor = null;
    this.usageNoted = false;
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
    this.usageNoted = true;
    this.changed();
  }

  /**
   * Moves the state to where the meter says it is, once a turn has committed. Mid-turn the state holds, so
   * the turn's remaining passes still send.
   */
  settleTurn() {
    const hosted = this.hosted;
    if (!hosted || (hosted.state !== 'ready' && hosted.state !== 'warned') || hosted.percentUsed === null) return;
    const state = hosted.percentUsed >= 100 ? 'exhausted'
      : hosted.percentUsed >= WARN_THRESHOLDS[0] ? 'warned' : hosted.state;
    if (state === hosted.state) return;
    this.hosted = { ...hosted, state };
    this.changed();
  }

  /** True once after a call settled its usage, so a turn on another preset raises no notice. */
  takeUsageNoted(): boolean {
    const noted = this.usageNoted;
    this.usageNoted = false;
    return noted;
  }

  /** The thresholds shown in this session. */
  shownWarnings(): ReadonlySet<number> {
    return this.shown;
  }

  /** True once per reset date, so the exhausted notice shows once per month. */
  claimExhaustedNotice(): boolean {
    const key = this.hosted?.resetAt ?? 'unknown';
    if (this.exhaustedShownFor === key) return false;
    this.exhaustedShownFor = key;
    return true;
  }

  /**
   * Marks a warning as shown and acknowledges it, and every lower one, on the server so no device shows it
   * again this month. A refusal of the ack keeps the warning hidden for this session only.
   */
  async acknowledgeWarning(threshold: number): Promise<void> {
    const token = this.credential();
    const crossed = [...WARN_THRESHOLDS].filter((t) => t <= threshold);
    crossed.forEach((t) => this.shown.add(t));
    if (!token) return;
    for (const t of crossed) {
      if (this.hosted?.acknowledged.includes(t)) continue;
      try {
        const response = await this.fetchImpl()(hostedAckUrl(t), { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
        const body: unknown = await response.json().catch(() => null);
        const list = recordOf(recordOf(body)?.data)?.acknowledged;
        if (response.ok && Array.isArray(list) && this.hosted && this.credential() === token) {
          this.hosted = { ...this.hosted, acknowledged: list.filter((n): n is number => typeof n === 'number') };
        }
      } catch {
        // The warning stays hidden for this session; the next session asks the server again.
      }
    }
    this.changed();
  }

  /** The turn a client turn id names, shared by every call of that turn. */
  turnFor(key: string): HostedTurn {
    return this.turns.turnFor(key);
  }
}

/** The app's one session. */
export const hostedSession = new HostedSession();
