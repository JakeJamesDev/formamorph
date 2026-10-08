/**
 * When the World Editor saves on its own: once the change count reaches the threshold, or once the idle pause
 * passes with a count above zero. Every save, manual or auto, goes through it, so it never fires while one runs.
 */

export const AUTO_SAVE_THRESHOLD = 300;
export const AUTO_SAVE_IDLE_MS = 30_000;

type SaveKind = 'manual' | 'auto';

export interface AutoSaveScheduler {
  /** Adds a committed change's units and restarts the idle pause. */
  add(units: number): void;
  /** Runs a manual save. One asked for during an auto save runs after it; during a manual one, it joins it. */
  manual(save: () => Promise<boolean>): Promise<boolean>;
  /** Off stops the timer; the count still grows, so turning it on saves what piled up. */
  setEnabled(enabled: boolean): void;
  /** Drops the count, as when the world is back to what is on disk. */
  clear(): void;
  /** Runs `then` now, or once no save runs. */
  afterSaves(then: () => void): void;
  /** What the scheduler holds now, for tests. */
  readonly state: { count: number; saving: boolean; failed: boolean };
}

/** `save` is the auto save. A save that resolves false or throws is a failed one. */
export function createAutoSaveScheduler({ save }: { save: () => Promise<boolean> }): AutoSaveScheduler {
  let count = 0;
  let enabled = false;
  // A failed auto save pauses until a manual save succeeds, so a full disk toasts once.
  let failed = false;
  let running: { kind: SaveKind; done: Promise<boolean> } | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const stopTimer = () => { clearTimeout(timer); timer = undefined; };
  const schedule = () => {
    stopTimer();
    if (!enabled || failed || running || count <= 0) return;
    // A full count saves on the next task, never inside the commit that filled it.
    timer = setTimeout(() => { void run('auto', save); }, count >= AUTO_SAVE_THRESHOLD ? 0 : AUTO_SAVE_IDLE_MS);
  };

  function run(kind: SaveKind, write: () => Promise<boolean>): Promise<boolean> {
    stopTimer();
    // Edits made while the save runs are not in it, so they stay counted.
    const counted = count;
    // A throw is a failure too, so the scheduler is never left waiting on a save that ended.
    const done = write().catch((error: unknown) => {
      console.error('Error saving world:', error);
      return false;
    }).then((ok) => {
      running = null;
      if (ok) {
        count = Math.max(0, count - counted);
        if (kind === 'manual') failed = false;
      } else if (kind === 'auto') {
        failed = true;
      }
      schedule();
      return ok;
    });
    running = { kind, done };
    return done;
  }

  const manual = (write: () => Promise<boolean>): Promise<boolean> => {
    if (!running) return run('manual', write);
    return running.kind === 'auto' ? running.done.then(() => manual(write)) : running.done;
  };
  const afterSaves = (then: () => void): void => {
    if (running) void running.done.then(() => afterSaves(then));
    else then();
  };

  return {
    add(units) {
      if (units <= 0) return;
      count += units;
      schedule();
    },
    manual,
    afterSaves,
    setEnabled(next) {
      enabled = next;
      schedule();
    },
    clear() {
      count = 0;
      stopTimer();
    },
    get state() {
      return { count, saving: running !== null, failed };
    },
  };
}
