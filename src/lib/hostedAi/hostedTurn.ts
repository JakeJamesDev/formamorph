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

/**
 * One player turn on Formamorph AI. The first call goes alone and carries no id; the others wait for its
 * response headers and send the id the server issued. A first call that fails hands the turn to the next.
 */
export class HostedTurn {
  private id: string | null = null;
  private pending: Promise<void> | null = null;
  private messageShown = false;

  /** Waits for the turn's id, or takes the turn when no call holds it. Null when `signal` stops the wait. */
  async claim(signal?: AbortSignal): Promise<HostedTurnClaim | null> {
    const stopped = new Promise<void>((resolve) => signal?.addEventListener('abort', () => resolve(), { once: true }));
    for (;;) {
      if (signal?.aborted) return null;
      if (this.id !== null) return settled(this.id);
      if (!this.pending) break;
      await Promise.race([this.pending, stopped]);
    }
    let release = () => {};
    this.pending = new Promise<void>((resolve) => { release = resolve; });
    const end = (id: string | null) => {
      if (id) this.id = id;
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
