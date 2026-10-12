import type { ChatMessage } from '@/types';
import type { TransportRequest } from '@/lib/aiRequest/requestTransport';
import { applyDigest, applyImportance, parseTurnContent } from '@/lib/turnDigest';
import type { BandTurn } from '@/lib/turnBanding';
import {
  applyIncrementalVerdict, milestoneCandidates, resolveMilestoneKeep,
  type IncrementalVerdict, type MemoryPinMap,
} from '@/lib/milestoneMemory';

/**
 * The Background Pass Queue: runs the silent passes a turn leaves behind while nothing else holds the
 * model. React-free; the view hands it snapshots and the queue decides what starts, applies results
 * through a session guard, and sets a failed pass aside for the rest of the idle window.
 */

export type BackgroundPassKind = 'digest' | 'milestone';

/** The selector's verdict as the save stores it. */
export interface StoredMilestoneSelection {
  seen: string[];
  selected: string[] | null;
}

/** What the queue reads on each tick. */
export interface QueueSnapshot {
  history: ChatMessage[];
  /** The turns as the selector reads them: memory overrides applied, deleted memories gone. */
  effectiveTurns: BandTurn[];
  milestoneSelection: StoredMilestoneSelection | null;
  memoryPins: MemoryPinMap;
  /** A turn, a scene render, or other work holds the model, so nothing new starts. */
  busy: boolean;
  concurrent: boolean;
  memoryDigests: boolean;
}

/** One stored turn a digest summarizes. `action` is the paired user message as stored. */
export interface DigestTarget {
  turnId: string;
  action: string;
  narration: string;
}

export interface MilestoneRequest {
  request: TransportRequest;
  parse: (reply: string) => IncrementalVerdict | null;
}

/** What the view supplies: the request path, the request builders and the state writers. */
export interface QueueEnv {
  send(request: TransportRequest): Promise<string>;
  digestRequest(target: DigestTarget): TransportRequest;
  milestoneRequest(kept: string[], fresh: string[], attachTurnId: string): MilestoneRequest;
  setHistory(update: (prev: ChatMessage[]) => ChatMessage[]): void;
  setMilestoneSelection(selection: StoredMilestoneSelection | null): void;
  /** The view's session counter, bumped on load and on new game. */
  session(): number;
}

export interface BackgroundPassQueue {
  update(snapshot: QueueSnapshot): void;
  /** Cancels every running pass. Leaving the game and loading a save call it. */
  abort(): void;
  dispose(): void;
  /** The kinds running now; a new set on every change. */
  running(): ReadonlySet<BackgroundPassKind>;
  subscribe(listener: () => void): () => void;
}

/** The writes one pass may make, guarded by the queue. */
interface PassWriter {
  history(update: (prev: ChatMessage[]) => ChatMessage[]): void;
  selection(selection: StoredMilestoneSelection | null): void;
  /** Whether `history` still holds the narration the pass read. */
  isCurrent(history: ChatMessage[]): boolean;
}

interface PreparedPass {
  request: TransportRequest;
  /** Writes the reply; false sets the pass aside. */
  apply(reply: string, write: PassWriter): boolean;
}

interface DueItem {
  kind: BackgroundPassKind;
  key: string;
  turnId: string;
  narration: string;
  /** The state the pass reads; an applied pass stays out while a snapshot still shows this state. */
  signature: string;
  prepare(): PreparedPass;
}

const isWritten = (summary: unknown) => typeof summary === 'string';

/** The digest target at `index`, paired with the user message before it as stored. */
const targetAt = (history: ChatMessage[], index: number, turnId: string, narration: string): DigestTarget => {
  const paired = history[index - 1];
  return { turnId, narration, action: paired?.role === 'user' ? paired.content : '' };
};

/** Every turn due for a digest, oldest first. An empty summary counts as written. */
export function dueDigests(history: ChatMessage[]): DigestTarget[] {
  const due: DigestTarget[] = [];
  history.forEach((message, i) => {
    if (message.role !== 'assistant') return;
    const turn = parseTurnContent(message.content);
    if (!turn?.turnId || isWritten(turn.summary)) return;
    const narration = turn.narration ?? '';
    if (narration.trim()) due.push(targetAt(history, i, turn.turnId, narration));
  });
  return due;
}

/** The digest target for one turn, written or not, or null when the turn is gone or its narration is blank. */
export function digestTarget(history: ChatMessage[], turnId: string): DigestTarget | null {
  const index = history.findIndex((m) => m.role === 'assistant' && parseTurnContent(m.content)?.turnId === turnId);
  const narration = index < 0 ? '' : parseTurnContent(history[index].content)?.narration ?? '';
  return narration.trim() ? targetAt(history, index, turnId, narration) : null;
}

/** The selector's next run: the selection pruned to live candidates, the kept old ones it shows, and the fresh ones it judges. */
export function planMilestone(
  turns: BandTurn[],
  selection: StoredMilestoneSelection | null,
  pins: MemoryPinMap,
): { selection: StoredMilestoneSelection | null; kept: BandTurn[]; fresh: BandTurn[] } {
  const candidates = milestoneCandidates(turns);
  if (candidates.length === 0) return { selection, kept: [], fresh: [] };
  const live = new Set(candidates.map((t) => t.turnId ?? ''));
  // A rollback took turns away; a re-aging turn is judged fresh.
  const pruned = selection && selection.seen.some((id) => !live.has(id))
    ? {
      seen: selection.seen.filter((id) => live.has(id)),
      selected: selection.selected === null ? null : selection.selected.filter((id) => live.has(id)),
    }
    : selection;
  const seen = new Set(pruned?.seen ?? []);
  const fresh = candidates.filter((t) => t.turnId && !seen.has(t.turnId));
  const old = candidates.filter((t) => t.turnId && seen.has(t.turnId));
  const keptIds = resolveMilestoneKeep(
    old,
    pruned ? { seen, selected: pruned.selected === null ? null : new Set(pruned.selected) } : null,
    pins,
  );
  return { selection: pruned, kept: old.filter((t) => keptIds.has(t.turnId!)), fresh };
}

function latestTurn(history: ChatMessage[]): { turnId: string; narration: string } | null {
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].role !== 'assistant') continue;
    const turn = parseTurnContent(history[i].content);
    return turn?.turnId ? { turnId: turn.turnId, narration: turn.narration ?? '' } : null;
  }
  return null;
}

function narrationOf(history: ChatMessage[], turnId: string): string | undefined {
  for (const message of history) {
    if (message.role !== 'assistant') continue;
    const turn = parseTurnContent(message.content);
    if (turn?.turnId === turnId) return turn.narration ?? '';
  }
  return undefined;
}

/**
 * The due passes in serial priority order: digests oldest first, then the milestone once no digest is due.
 * `prune` is the selection without verdicts on turns that left, when nothing fresh carries it.
 */
function dueItems(snapshot: QueueSnapshot, env: QueueEnv): { items: DueItem[]; prune: StoredMilestoneSelection | null } {
  if (!snapshot.memoryDigests) return { items: [], prune: null };
  const digests = dueDigests(snapshot.history);
  const items: DueItem[] = digests.map((target) => ({
    kind: 'digest',
    key: `digest:${target.turnId}`,
    turnId: target.turnId,
    narration: target.narration,
    signature: target.narration,
    prepare: () => ({
      request: env.digestRequest(target),
      apply: (reply, write) => {
        write.history((prev) => (write.isCurrent(prev) ? applyDigest(prev, target.turnId, reply) ?? prev : prev));
        return true;
      },
    }),
  }));
  if (digests.length > 0) return { items, prune: null }; // the selector reads every digest
  const latest = latestTurn(snapshot.history);
  if (!latest) return { items, prune: null };
  const plan = planMilestone(snapshot.effectiveTurns, snapshot.milestoneSelection, snapshot.memoryPins);
  if (plan.fresh.length === 0) {
    return { items, prune: plan.selection !== snapshot.milestoneSelection ? plan.selection : null };
  }
  items.push({
    kind: 'milestone',
    key: 'milestone',
    turnId: latest.turnId,
    narration: latest.narration,
    signature: JSON.stringify([latest.narration, plan.fresh.map((t) => t.turnId)]),
    prepare: () => {
      const keptIds = plan.kept.map((t) => t.turnId!);
      const freshIds = plan.fresh.map((t) => t.turnId!);
      const { request, parse } = env.milestoneRequest(
        plan.kept.map((t) => (t.summary ?? '').trim()),
        plan.fresh.map((t) => (t.summary ?? '').trim()),
        latest.turnId,
      );
      return {
        request,
        apply: (reply, write) => {
          if (!reply) return false;
          // A malformed reply keeps every fresh entry: fail-safe, never fail-drop.
          const verdict = parse(reply);
          if (verdict && verdict.weights.size > 0) {
            const byTurnId = new Map<string, number>();
            verdict.weights.forEach((weight, i) => {
              if (freshIds[i]) byTurnId.set(freshIds[i], weight);
            });
            write.history((prev) => (write.isCurrent(prev) ? applyImportance(prev, byTurnId) : prev));
          }
          write.selection(applyIncrementalVerdict(plan.selection, keptIds, freshIds, verdict));
          return true;
        },
      };
    },
  });
  return { items, prune: null };
}

/** Creates an idle queue; it ticks on every {@link BackgroundPassQueue.update} and after every pass ends. */
export function createBackgroundPassQueue(env: QueueEnv): BackgroundPassQueue {
  let snapshot: QueueSnapshot | null = null;
  let controller = new AbortController();
  let disposed = false;
  const runningItems = new Map<string, BackgroundPassKind>();
  let runningKinds: ReadonlySet<BackgroundPassKind> = new Set();
  const setAside = new Set<string>();
  // An applied pass by key, with the signature it read: a render can lag behind the write it made.
  const applied = new Map<string, string>();
  // Each history the queue wrote, mapped to the one it wrote over.
  const ownWrites = new WeakMap<ChatMessage[], ChatMessage[]>();
  const listeners = new Set<() => void>();
  let lastSession = env.session();

  const publish = () => {
    runningKinds = new Set(runningItems.values());
    listeners.forEach((listener) => listener());
  };

  const isForeign = (next: ChatMessage[], last: ChatMessage[]) => {
    let at = next;
    while (at !== last) {
      const before = ownWrites.get(at);
      if (!before) return true;
      at = before;
    }
    return false;
  };

  const writeHistory = (update: (prev: ChatMessage[]) => ChatMessage[]) => env.setHistory((prev) => {
    const next = update(prev);
    if (next !== prev) ownWrites.set(next, prev);
    return next;
  });

  const start = (item: DueItem) => {
    const signal = controller.signal;
    const session = env.session();
    const isCurrent = (history: ChatMessage[]) =>
      env.session() === session && narrationOf(history, item.turnId) === item.narration;
    runningItems.set(item.key, item.kind);
    void (async () => {
      let outcome: 'applied' | 'setAside' | 'dropped' | 'canceled';
      try {
        const prepared = item.prepare();
        const reply = await env.send({ ...prepared.request, signal });
        if (signal.aborted || disposed) outcome = 'canceled';
        else if (!snapshot || !isCurrent(snapshot.history)) outcome = 'dropped';
        else {
          const write: PassWriter = { history: writeHistory, selection: env.setMilestoneSelection, isCurrent };
          outcome = prepared.apply((reply ?? '').trim(), write) ? 'applied' : 'setAside';
        }
      } catch {
        outcome = signal.aborted ? 'canceled' : 'setAside';
      }
      if (disposed) return;
      runningItems.delete(item.key);
      if (outcome === 'setAside') setAside.add(item.key);
      if (outcome === 'applied') applied.set(item.key, item.signature);
      publish();
      tick();
    })();
  };

  const tick = () => {
    // A new session waits for its first snapshot; the one held is the old save's.
    if (disposed || !snapshot || snapshot.busy || env.session() !== lastSession) return;
    const { items: due, prune } = dueItems(snapshot, env);
    if (prune) env.setMilestoneSelection(prune);
    if (!snapshot.concurrent && runningItems.size > 0) return;
    const dueKeys = new Set(due.map((item) => item.key));
    for (const key of applied.keys()) if (!dueKeys.has(key)) applied.delete(key);
    const ready = due.filter((item) =>
      !runningItems.has(item.key) && !setAside.has(item.key) && applied.get(item.key) !== item.signature);
    const toStart = snapshot.concurrent ? ready : ready.slice(0, 1);
    if (toStart.length === 0) return;
    toStart.forEach(start);
    publish();
  };

  return {
    update(next) {
      if (disposed) return;
      const session = env.session();
      if (session !== lastSession || (snapshot && isForeign(next.history, snapshot.history))) setAside.clear();
      lastSession = session;
      snapshot = next;
      tick();
    },
    abort() {
      controller.abort();
      controller = new AbortController();
    },
    dispose() {
      disposed = true;
      controller.abort();
      runningItems.clear();
      listeners.clear();
    },
    running: () => runningKinds,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
