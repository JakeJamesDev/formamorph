// Pure helpers behind the GameViewer rollback / re-generate controls. They operate on the per-turn
// snapshot stack (`gameStates` — one entry saved after each turn, 0-indexed by page) and the AI-context
// turn log. Kept here, free of React/state, so the (off-by-one-prone) index math is unit-testable.

/** Flags the AI-context turn log carries so a superseded turn renders struck-through with a reason. */
export interface TurnFlags {
  regenerated?: boolean;
  pruned?: boolean;
}

/** Snapshot to restore when rolling back to `currentPage` (a page you've paged back to). Page P's
 *  post-turn snapshot is `gameStates[P - 1]`. */
export function rollbackState<S>(gameStates: readonly S[], currentPage: number): S | null {
  return gameStates[currentPage - 1] ?? null;
}

/** Snapshot to restore when re-generating the current turn — the state from *before* it. Turn ≥ 2 uses
 *  the previous turn's snapshot (`gameStates[currentPage - 2]`); turn 1 (the opening) has no predecessor
 *  there, so it uses the captured pre-game `initialState`. */
export function regenerateState<S>(
  gameStates: readonly S[],
  initialState: S | null,
  currentPage: number,
): S | null {
  return currentPage >= 2 ? (gameStates[currentPage - 2] ?? null) : initialState;
}

/** The gameStates slot a post-turn snapshot belongs in, derived from the snapshot's *own* message-history
 *  length (two messages per turn). Indexing off the snapshot — not a closure variable that goes stale
 *  inside the async turn flow — keeps the slot aligned with the turn it represents. */
export function snapshotPageIndex(historyLength: number, messagesPerPage: number): number {
  return Math.ceil(historyLength / messagesPerPage) - 1;
}

/** Store `snapshot` at `pageIndex`: overwrite an existing slot (re-generate / kept-abort re-save) or
 *  append the next turn. Returns a new array; never mutates the input. */
export function placeSnapshot<S>(states: readonly S[], pageIndex: number, snapshot: S): S[] {
  const next = [...states];
  if (pageIndex < next.length) next[pageIndex] = snapshot;
  else next.push(snapshot);
  return next;
}

/** Whether the current page can be re-generated: you're on the latest page and at least one turn exists. */
export function canRegenerate(currentPage: number, totalPages: number): boolean {
  return totalPages > 0 && currentPage === totalPages;
}

/** The player action that produced the latest turn — the last user message — or null if the tail of the
 *  history isn't a completed user→assistant pair. */
export function lastTurnAction(history: readonly { role: string; content: string }[]): string | null {
  const user = history[history.length - 2];
  return user && user.role === "user" ? user.content : null;
}

/** Flag the most recent turn as superseded by a re-generate (it's about to be re-rolled). */
export function markRegeneratedTurn<T extends TurnFlags>(turns: readonly T[]): T[] {
  if (turns.length === 0) return [...turns];
  const next = [...turns];
  next[next.length - 1] = { ...next[next.length - 1], regenerated: true };
  return next;
}

/** Flag the turns a rollback to `currentPage` discards — every turn after it. In the common case (no
 *  prior re-generate) turn indices line up with pages, so these are the entries at `i >= currentPage`. */
export function markPrunedTurns<T extends TurnFlags>(turns: readonly T[], currentPage: number): T[] {
  return turns.map((t, i) => (i >= currentPage ? { ...t, pruned: true } : t));
}
