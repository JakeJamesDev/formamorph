import type { ChatMessage } from '@/types';
import type { TransportRequest } from '@/lib/aiRequest/requestTransport';
import { applyDiary, applyDigest, applyImportance, parseTurnContent } from '@/lib/turnDigest';
import { sameCharacterName } from '@/lib/entityMatch';
import { cleanDiscoveredDescription } from '@/lib/runtimeCharacters';
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

export type BackgroundPassKind = 'discover' | 'digest' | 'diary' | 'milestone';

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
  describeCharacters: boolean;
  /** Character Diaries is on and Staged thinking reads them. */
  characterDiaries: boolean;
  /** The cast: every entity a diary can be written as. */
  entityNames: readonly string[];
  /** Deleted characters, never described again. */
  suppressedNames: readonly string[];
}

/** What every pass target names: a stored turn and the narration the pass reads. */
interface TurnTarget {
  turnId: string;
  narration: string;
}

/** One stored turn a digest summarizes. `action` is the paired user message as stored. */
export interface DigestTarget extends TurnTarget {
  action: string;
}

/** One name a stored turn introduces that no entity backs yet. */
export interface DiscoverTarget extends TurnTarget {
  name: string;
  locationId?: string;
}

/** One participant of a stored turn who has no diary entry yet. */
export interface DiaryTarget extends TurnTarget {
  name: string;
}

export interface MilestoneRequest {
  request: TransportRequest;
  parse: (reply: string) => IncrementalVerdict | null;
}

/** What the view supplies: the request path, the request builders and the state writers. */
export interface QueueEnv {
  send(request: TransportRequest): Promise<string>;
  digestRequest(target: DigestTarget): TransportRequest;
  discoverRequest(target: DiscoverTarget): TransportRequest;
  /** Built when the pass starts, so it reads the entity text a discover just wrote. */
  diaryRequest(target: DiaryTarget): TransportRequest;
  milestoneRequest(kept: string[], fresh: string[], attachTurnId: string): MilestoneRequest;
  setHistory(update: (prev: ChatMessage[]) => ChatMessage[]): void;
  setMilestoneSelection(selection: StoredMilestoneSelection | null): void;
  /** Adds the described character to the save's discovered entities. */
  addDiscovered(target: DiscoverTarget, description: string): void;
  /** The view's session counter, bumped on load and on new game. */
  session(): number;
}

export interface BackgroundPassQueue {
  update(snapshot: QueueSnapshot): void;
  /**
   * Runs a player-started request as a foreground job: it waits until no turn, scene render or pass holds
   * the model, then holds the queue while it runs. `cancel` removes a waiting job and aborts a running one;
   * `abort` and `dispose` do the same. Resolves to the job's value in a wrapper, or null when it was canceled, so a job may return null itself.
   */
  runForeground<T>(job: (signal: AbortSignal) => Promise<T>, cancel?: AbortSignal): Promise<{ value: T } | null>;
  /** Cancels every running pass and foreground job. Leaving the game and loading a save call it. */
  abort(): void;
  dispose(): void;
  /** The kinds running now; a new set on every change. */
  running(): ReadonlySet<BackgroundPassKind>;
  /** A foreground job is waiting for the model. */
  waiting(): boolean;
  subscribe(listener: () => void): () => void;
}

/** The writes one pass may make, guarded by the queue. */
interface PassWriter {
  history(update: (prev: ChatMessage[]) => ChatMessage[]): void;
  selection(selection: StoredMilestoneSelection | null): void;
  discovered(target: DiscoverTarget, description: string): void;
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
  /** The character a discover describes; one runs per character at a time. */
  group?: string;
  turnId: string;
  narration: string;
  /** The state the pass reads; an applied pass stays out while a snapshot still shows this state. */
  signature: string;
  prepare(): PreparedPass;
}

const isWritten = (summary: unknown) => typeof summary === 'string';

/** Stores a reply on its turn, only while the turn still holds the narration the pass read. Never sets the pass aside. */
const storeOnTurn = (write: PassWriter, store: (history: ChatMessage[]) => ChatMessage[] | null): true => {
  write.history((prev) => (write.isCurrent(prev) ? store(prev) ?? prev : prev));
  return true;
};

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

const isKnown = (name: string, names: readonly string[]) => names.some((known) => sameCharacterName(name, known));

/** The assistant turns a pass can read: an id, narration and participants. Oldest first. */
function participantTurns(history: ChatMessage[]) {
  const turns: Array<{
    turnId: string; narration: string; names: string[]; diaries: Record<string, string> | undefined; locationId?: string;
  }> = [];
  for (const message of history) {
    if (message.role !== 'assistant') continue;
    const turn = parseTurnContent(message.content);
    if (!turn?.turnId || !turn.narration?.trim() || !turn.entities?.length) continue;
    turns.push({ turnId: turn.turnId, narration: turn.narration, names: turn.entities, diaries: turn.diaries, locationId: turn.locationId });
  }
  return turns;
}

/** Every (turn, name) pair a name no entity backs makes due for a description, oldest turn first. */
export function dueDiscoveries(history: ChatMessage[], knownNames: readonly string[]): DiscoverTarget[] {
  const due: DiscoverTarget[] = [];
  for (const turn of participantTurns(history)) {
    for (const name of turn.names) {
      if (name.trim() && !isKnown(name, knownNames)) {
        due.push({ turnId: turn.turnId, name, narration: turn.narration, locationId: turn.locationId });
      }
    }
  }
  return due;
}

/** Every (turn, name) pair still missing a diary entry, oldest turn first. */
export function dueDiaries(history: ChatMessage[]): DiaryTarget[] {
  const due: DiaryTarget[] = [];
  for (const turn of participantTurns(history)) {
    for (const name of turn.names) {
      if (turn.diaries?.[name] === undefined) due.push({ turnId: turn.turnId, name, narration: turn.narration });
    }
  }
  return due;
}

/**
 * The due passes in serial priority order: discover, digest, diary, then the milestone once no digest is due.
 * `prune` is the selection without verdicts on turns that left, when nothing fresh carries it.
 */
function dueItems(snapshot: QueueSnapshot, env: QueueEnv): { items: DueItem[]; prune: StoredMilestoneSelection | null } {
  const items: DueItem[] = [];
  if (snapshot.describeCharacters) {
    const known = [...snapshot.entityNames, ...snapshot.suppressedNames];
    for (const target of dueDiscoveries(snapshot.history, known)) {
      items.push({
        kind: 'discover',
        key: `discover:${target.turnId}:${target.name}`,
        group: target.name,
        turnId: target.turnId,
        narration: target.narration,
        signature: target.narration,
        prepare: () => ({
          request: env.discoverRequest(target),
          apply: (reply, write) => {
            const description = cleanDiscoveredDescription(reply, target.name);
            if (!description) return false;
            write.discovered(target, description);
            return true;
          },
        }),
      });
    }
  }
  const digests = snapshot.memoryDigests ? dueDigests(snapshot.history) : [];
  for (const target of digests) {
    items.push({
      kind: 'digest',
      key: `digest:${target.turnId}`,
      turnId: target.turnId,
      narration: target.narration,
      signature: target.narration,
      prepare: () => ({
        request: env.digestRequest(target),
        apply: (reply, write) => storeOnTurn(write, (prev) => applyDigest(prev, target.turnId, reply)),
      }),
    });
  }
  if (snapshot.characterDiaries) {
    for (const target of dueDiaries(snapshot.history)) {
      // A new name waits until its entity shows in a snapshot, so the request reads the description. A name
      // no entity backs and no discover is coming for never gets one.
      if (!isKnown(target.name, snapshot.entityNames)) continue;
      items.push({
        kind: 'diary',
        key: `diary:${target.turnId}:${target.name}`,
        turnId: target.turnId,
        narration: target.narration,
        signature: target.narration,
        prepare: () => ({
          request: env.diaryRequest(target),
          // An empty entry is stored too, so the participant is not asked again.
          apply: (reply, write) => storeOnTurn(write, (prev) => applyDiary(prev, target.turnId, target.name, reply)),
        }),
      });
    }
  }
  if (!snapshot.memoryDigests || digests.length > 0) return { items, prune: null }; // the selector reads every digest
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
  const runningItems = new Map<string, Pick<DueItem, 'kind' | 'group'>>();
  let runningKinds: ReadonlySet<BackgroundPassKind> = new Set();
  const setAside = new Set<string>();
  // An applied pass by key, with the signature it read: a render can lag behind the write it made.
  const applied = new Map<string, { signature: string; group?: string }>();
  // Each history the queue wrote, mapped to the one it wrote over.
  const ownWrites = new WeakMap<ChatMessage[], ChatMessage[]>();
  const listeners = new Set<() => void>();
  let lastSession = env.session();
  // Foreground jobs start oldest first, one at a time, and keep every pass from starting while any waits or runs.
  const foregroundWaiting: Array<{ run(): void; drop(): void }> = [];
  let foregroundRunning = false;

  const publish = () => {
    runningKinds = new Set([...runningItems.values()].map((item) => item.kind));
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
    runningItems.set(item.key, { kind: item.kind, group: item.group });
    void (async () => {
      let outcome: 'applied' | 'setAside' | 'dropped' | 'canceled';
      try {
        const prepared = item.prepare();
        const reply = await env.send({ ...prepared.request, signal });
        if (signal.aborted || disposed) outcome = 'canceled';
        else if (!snapshot || !isCurrent(snapshot.history)) outcome = 'dropped';
        else {
          const write: PassWriter = {
            history: writeHistory, selection: env.setMilestoneSelection, discovered: env.addDiscovered, isCurrent,
          };
          outcome = prepared.apply((reply ?? '').trim(), write) ? 'applied' : 'setAside';
        }
      } catch {
        outcome = signal.aborted ? 'canceled' : 'setAside';
      }
      if (disposed) return;
      runningItems.delete(item.key);
      if (outcome === 'setAside') setAside.add(item.key);
      if (outcome === 'applied') applied.set(item.key, { signature: item.signature, group: item.group });
      publish();
      tick();
    })();
  };

  const tick = () => {
    // A new session waits for its first snapshot; the one held is the old save's.
    if (disposed || !snapshot || snapshot.busy || env.session() !== lastSession) return;
    if (foregroundRunning) return;
    if (foregroundWaiting.length > 0) {
      if (runningItems.size === 0) {
        foregroundWaiting.shift()!.run();
        publish();
      }
      return;
    }
    const { items: due, prune } = dueItems(snapshot, env);
    if (prune) env.setMilestoneSelection(prune);
    if (!snapshot.concurrent && runningItems.size > 0) return;
    const dueKeys = new Set(due.map((item) => item.key));
    for (const key of applied.keys()) if (!dueKeys.has(key)) applied.delete(key);
    // One discover per character: not while another runs or has applied, nor twice in one start.
    const claimed = [...runningItems.values(), ...applied.values()].flatMap((entry) => entry.group ?? []);
    const ready: DueItem[] = [];
    for (const item of due) {
      if (runningItems.has(item.key) || setAside.has(item.key) || applied.get(item.key)?.signature === item.signature) continue;
      const { group } = item;
      if (group !== undefined) {
        if (claimed.some((name) => sameCharacterName(name, group))) continue;
        claimed.push(group);
      }
      ready.push(item);
    }
    const toStart = snapshot.concurrent ? ready : ready.slice(0, 1);
    if (toStart.length === 0) return;
    toStart.forEach(start);
    publish();
  };

  return {
    update(next) {
      if (disposed) return;
      const session = env.session();
      if (session !== lastSession) applied.clear();
      if (session !== lastSession || (snapshot && isForeign(next.history, snapshot.history))) setAside.clear();
      lastSession = session;
      snapshot = next;
      tick();
    },
    runForeground<T>(job: (signal: AbortSignal) => Promise<T>, cancel?: AbortSignal) {
      return new Promise<{ value: T } | null>((resolve, reject) => {
        if (disposed || cancel?.aborted) return resolve(null);
        const own = new AbortController();
        const queueSignal = controller.signal;
        const stop = () => own.abort();
        const onCancel = () => {
          own.abort();
          const at = foregroundWaiting.indexOf(entry);
          if (at < 0) return;
          foregroundWaiting.splice(at, 1);
          entry.drop();
          publish();
          tick();
        };
        const entry = {
          drop: () => {
            cancel?.removeEventListener('abort', onCancel);
            resolve(null);
          },
          run: () => {
            foregroundRunning = true;
            queueSignal.addEventListener('abort', stop, { once: true });
            const done = () => {
              cancel?.removeEventListener('abort', onCancel);
              queueSignal.removeEventListener('abort', stop);
              foregroundRunning = false;
              if (disposed) return;
              publish();
              tick();
            };
            let started: Promise<T>;
            try { started = job(own.signal); } catch (error) { started = Promise.reject(error); }
            started.then(
              (value) => { done(); resolve(own.signal.aborted ? null : { value }); },
              (error: unknown) => { done(); if (own.signal.aborted) resolve(null); else reject(error); },
            );
          },
        };
        cancel?.addEventListener('abort', onCancel, { once: true });
        foregroundWaiting.push(entry);
        publish();
        tick();
      });
    },
    abort() {
      controller.abort();
      controller = new AbortController();
      foregroundWaiting.splice(0).forEach((entry) => entry.drop());
      publish();
    },
    dispose() {
      disposed = true;
      controller.abort();
      foregroundWaiting.splice(0).forEach((entry) => entry.drop());
      runningItems.clear();
      listeners.clear();
    },
    running: () => runningKinds,
    waiting: () => foregroundWaiting.length > 0,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
