import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { waitForPrograms } from './waitForPrograms';

/** Stands in for three's WebGLProperties: `get` hands back a fresh empty record for an unknown object. */
const recordStore = () => {
  let map = new WeakMap<object, object>();
  return {
    get(object: unknown) {
      const key = object as object;
      if (!map.has(key)) map.set(key, {});
      return map.get(key);
    },
    /** What `renderer.dispose()` does to every record. */
    dispose() { map = new WeakMap(); },
  };
};

/** A material with a program that turns ready after `readyAfter` checks. */
const compiled = (records: ReturnType<typeof recordStore>, readyAfter: number) => {
  const material = {};
  let checks = 0;
  Object.assign(records.get(material) as object, { currentProgram: { isReady: () => ++checks > readyAfter } });
  return material;
};

const settled = (promise: Promise<void>) => {
  let done = false;
  void promise.then(() => { done = true; });
  return () => done;
};

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe('waitForPrograms', () => {
  it('resolves only once every program reports ready', async () => {
    const records = recordStore();
    const done = settled(waitForPrograms([compiled(records, 0), compiled(records, 3)], records, () => false));
    await vi.advanceTimersByTimeAsync(20);
    expect(done()).toBe(false);
    await vi.advanceTimersByTimeAsync(20);
    expect(done()).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('ends without throwing when the renderer is disposed mid-wait', async () => {
    const records = recordStore();
    const done = settled(waitForPrograms([compiled(records, 100)], records, () => false));
    await vi.advanceTimersByTimeAsync(10);
    records.dispose();
    await vi.advanceTimersByTimeAsync(10);
    expect(done()).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('stops polling once stop returns true, with programs still compiling', async () => {
    const records = recordStore();
    let stopped = false;
    const done = settled(waitForPrograms([compiled(records, 100)], records, () => stopped));
    await vi.advanceTimersByTimeAsync(30);
    expect(done()).toBe(false);
    stopped = true;
    await vi.advanceTimersByTimeAsync(10);
    expect(done()).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
});
