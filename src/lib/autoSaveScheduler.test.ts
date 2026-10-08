import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AUTO_SAVE_IDLE_MS, AUTO_SAVE_THRESHOLD, createAutoSaveScheduler } from '@/lib/autoSaveScheduler';

/** A save the test settles by hand, so it can act while one runs. */
function pendingSaves() {
  const settles: ((ok: boolean) => void)[] = [];
  const save = vi.fn(() => new Promise<boolean>((resolve) => { settles.push(resolve); }));
  const settle = async (ok: boolean) => { settles.shift()?.(ok); await vi.advanceTimersByTimeAsync(0); };
  return { save, settle };
}

const setup = () => {
  const saves = pendingSaves();
  const scheduler = createAutoSaveScheduler({ save: saves.save });
  scheduler.setEnabled(true);
  return { scheduler, ...saves };
};

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe('the change threshold', () => {
  it('saves once the count reaches it, without waiting for a pause', async () => {
    const { scheduler, save } = setup();
    scheduler.add(AUTO_SAVE_THRESHOLD - 1);
    await vi.advanceTimersByTimeAsync(0);
    expect(save).not.toHaveBeenCalled();
    scheduler.add(1);
    await vi.advanceTimersByTimeAsync(0);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('saves after 30 discrete actions', async () => {
    const { scheduler, save } = setup();
    for (let i = 0; i < 30; i += 1) scheduler.add(10);
    await vi.advanceTimersByTimeAsync(0);
    expect(save).toHaveBeenCalledTimes(1);
  });
});

describe('the idle pause', () => {
  it('saves one action once the pause passes, counted from the last change', async () => {
    const { scheduler, save } = setup();
    scheduler.add(10);
    await vi.advanceTimersByTimeAsync(AUTO_SAVE_IDLE_MS - 1000);
    scheduler.add(1);
    await vi.advanceTimersByTimeAsync(AUTO_SAVE_IDLE_MS - 1);
    expect(save).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('does nothing with a count of zero', async () => {
    const { scheduler, save } = setup();
    scheduler.add(0);
    await vi.advanceTimersByTimeAsync(AUTO_SAVE_IDLE_MS * 2);
    expect(save).not.toHaveBeenCalled();
  });
});

describe('the count', () => {
  it('resets on a good auto save and keeps what was edited while it ran', async () => {
    const { scheduler, save, settle } = setup();
    scheduler.add(AUTO_SAVE_THRESHOLD);
    await vi.advanceTimersByTimeAsync(0);
    scheduler.add(5);
    await settle(true);
    expect(scheduler.state.count).toBe(5);
    // The edits made during the save still save once the pause passes.
    await vi.advanceTimersByTimeAsync(AUTO_SAVE_IDLE_MS);
    expect(save).toHaveBeenCalledTimes(2);
  });

  it('resets on a good manual save', async () => {
    const { scheduler, save } = setup();
    scheduler.add(50);
    await scheduler.manual(async () => true);
    expect(scheduler.state.count).toBe(0);
    await vi.advanceTimersByTimeAsync(AUTO_SAVE_IDLE_MS);
    expect(save).not.toHaveBeenCalled();
  });

  it('drops on clear, with its timer', async () => {
    const { scheduler, save } = setup();
    scheduler.add(50);
    scheduler.clear();
    await vi.advanceTimersByTimeAsync(AUTO_SAVE_IDLE_MS);
    expect(save).not.toHaveBeenCalled();
  });
});

describe('while a save runs', () => {
  it('fires nothing, however much is added', async () => {
    const { scheduler, save } = setup();
    scheduler.add(AUTO_SAVE_THRESHOLD);
    await vi.advanceTimersByTimeAsync(0);
    scheduler.add(AUTO_SAVE_THRESHOLD);
    await vi.advanceTimersByTimeAsync(AUTO_SAVE_IDLE_MS);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('fires nothing during a manual save', async () => {
    const { scheduler, save } = setup();
    let finish!: (ok: boolean) => void;
    const manual = scheduler.manual(() => new Promise((resolve) => { finish = resolve; }));
    scheduler.add(AUTO_SAVE_THRESHOLD);
    await vi.advanceTimersByTimeAsync(AUTO_SAVE_IDLE_MS);
    expect(save).not.toHaveBeenCalled();
    finish(true);
    await manual;
    // Edits made during the manual save stay counted, so they save next.
    await vi.advanceTimersByTimeAsync(0);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('runs a manual save after the auto save it waited for', async () => {
    const { scheduler, settle } = setup();
    scheduler.add(AUTO_SAVE_THRESHOLD);
    await vi.advanceTimersByTimeAsync(0);
    const write = vi.fn(async () => true);
    const manual = scheduler.manual(write);
    expect(write).not.toHaveBeenCalled();
    await settle(true);
    await expect(manual).resolves.toBe(true);
    expect(write).toHaveBeenCalledTimes(1);
  });

  it('joins a manual save asked for during another', async () => {
    const { scheduler } = setup();
    const write = vi.fn(async () => true);
    const first = scheduler.manual(write);
    const second = scheduler.manual(write);
    await Promise.all([first, second]);
    expect(write).toHaveBeenCalledTimes(1);
  });
});

describe('afterSaves', () => {
  it('runs at once with no save running, and after the running save otherwise', async () => {
    const { scheduler, settle } = setup();
    const now = vi.fn();
    scheduler.afterSaves(now);
    expect(now).toHaveBeenCalledTimes(1);

    scheduler.add(AUTO_SAVE_THRESHOLD);
    await vi.advanceTimersByTimeAsync(0);
    const later = vi.fn();
    scheduler.afterSaves(later);
    await vi.advanceTimersByTimeAsync(0);
    expect(later).not.toHaveBeenCalled();
    await settle(true);
    expect(later).toHaveBeenCalledTimes(1);
  });
});

describe('a failed auto save', () => {
  it('pauses auto save until a manual save succeeds', async () => {
    const { scheduler, save, settle } = setup();
    scheduler.add(AUTO_SAVE_THRESHOLD);
    await vi.advanceTimersByTimeAsync(0);
    await settle(false);
    expect(scheduler.state.failed).toBe(true);
    scheduler.add(AUTO_SAVE_THRESHOLD);
    await vi.advanceTimersByTimeAsync(AUTO_SAVE_IDLE_MS);
    expect(save).toHaveBeenCalledTimes(1);

    // A failed manual save does not resume it.
    await scheduler.manual(async () => false);
    scheduler.add(AUTO_SAVE_THRESHOLD);
    await vi.advanceTimersByTimeAsync(AUTO_SAVE_IDLE_MS);
    expect(save).toHaveBeenCalledTimes(1);

    await scheduler.manual(async () => true);
    expect(scheduler.state.failed).toBe(false);
    scheduler.add(AUTO_SAVE_THRESHOLD);
    await vi.advanceTimersByTimeAsync(0);
    expect(save).toHaveBeenCalledTimes(2);
  });
});

describe('a save that throws', () => {
  it('counts as a failure and frees the scheduler for the next save', async () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { scheduler } = setup();
    await expect(scheduler.manual(async () => { throw new Error('toast failed'); })).resolves.toBe(false);
    const after = vi.fn();
    scheduler.afterSaves(after);
    expect(after).toHaveBeenCalledTimes(1);
    await expect(scheduler.manual(async () => true)).resolves.toBe(true);
    quiet.mockRestore();
  });
});

describe('off', () => {
  it('saves nothing, and saves what piled up once turned on', async () => {
    const { scheduler, save } = setup();
    scheduler.setEnabled(false);
    scheduler.add(AUTO_SAVE_THRESHOLD);
    await vi.advanceTimersByTimeAsync(AUTO_SAVE_IDLE_MS);
    expect(save).not.toHaveBeenCalled();
    scheduler.setEnabled(true);
    await vi.advanceTimersByTimeAsync(0);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('stops a pending idle save', async () => {
    const { scheduler, save } = setup();
    scheduler.add(10);
    scheduler.setEnabled(false);
    await vi.advanceTimersByTimeAsync(AUTO_SAVE_IDLE_MS);
    expect(save).not.toHaveBeenCalled();
  });
});
