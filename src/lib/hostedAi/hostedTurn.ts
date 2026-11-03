/** One call's claim on its turn: the id it sends, and how it reports its response. */
export interface HostedTurnClaim {
  /** The server-issued turn id, or null for the call that opens the turn. */
  turnId: string | null;
  /** The call got its response headers; `id` is the turn id they carried. */
  opened: (id: string | null) => void;
  /** The call ended without a response the turn can use. */
  failed: () => void;
}

const settled = (turnId: string): HostedTurnClaim => ({ turnId, opened: () => {}, failed: () => {} });

/** The largest margin taken off a turn's limit, to cover the time a call takes to reach the server. */
const MAX_EXPIRY_MARGIN_MS = 30_000;

/** The share of a turn's limit taken off it, up to the largest margin. */
const EXPIRY_MARGIN_SHARE = 0.1;

/**
 * One player turn on Formamorph AI. The first call goes alone and carries no id; the others wait for its
 * response headers and send the id the server issued. A first call that fails hands the turn to the next.
 * A turn past its limit clears its id, so the next call opens a new one. A null limit never expires.
 */
export class HostedTurn {
  private id: string | null = null;
  private sentAt = 0;
  private pending: Promise<void> | null = null;
  private messageShown = false;

  private clearIfExpired(limitSeconds: number | null) {
    if (this.id === null || limitSeconds === null) return;
    const limitMs = limitSeconds * 1000;
    if (Date.now() - this.sentAt >= limitMs - Math.min(MAX_EXPIRY_MARGIN_MS, limitMs * EXPIRY_MARGIN_SHARE)) this.id = null;
  }

  /** The turn holds a server-issued id, so the server admits its remaining calls past the budget, up to the grace. A claim clears an expired id. */
  get started(): boolean {
    return this.id !== null;
  }

  /** Waits for the turn's id, or takes the turn when no call holds a live one. Null when `signal` stops the wait. */
  async claim(signal: AbortSignal | undefined, limitSeconds: number | null): Promise<HostedTurnClaim | null> {
    const stopped = new Promise<void>((resolve) => signal?.addEventListener('abort', () => resolve(), { once: true }));
    for (;;) {
      if (signal?.aborted) return null;
      this.clearIfExpired(limitSeconds);
      if (this.id !== null) return settled(this.id);
      if (!this.pending) break;
      await Promise.race([this.pending, stopped]);
    }
    let release = () => {};
    this.pending = new Promise<void>((resolve) => { release = resolve; });
    // The clock starts before the server's does.
    const sentAt = Date.now();
    const end = (id: string | null) => {
      if (id) {
        this.id = id;
        this.sentAt = sentAt;
      }
      this.pending = null;
      release();
    };
    return { turnId: null, opened: end, failed: () => end(null) };
  }

  /** True the first time only, so a turn shows one hosted message however many calls fail. */
  claimMessage(): boolean {
    if (this.messageShown) return false;
    this.messageShown = true;
    return true;
  }
}

/** The turns of recent play, by the client's own turn id, so a background pass joins the turn it belongs to. */
export class HostedTurnRegistry {
  private readonly turns = new Map<string, HostedTurn>();

  constructor(private readonly cap = 50) {}

  turnFor(key: string): HostedTurn {
    let turn = this.turns.get(key);
    if (!turn) {
      turn = new HostedTurn();
      this.turns.set(key, turn);
      if (this.turns.size > this.cap) this.turns.delete(this.turns.keys().next().value as string);
    }
    return turn;
  }
}
