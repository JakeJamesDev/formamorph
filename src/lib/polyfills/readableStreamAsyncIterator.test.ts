import { afterEach, describe, expect, it } from 'vitest';
import { installReadableStreamAsyncIterator } from './readableStreamAsyncIterator';

const proto = ReadableStream.prototype as unknown as Record<PropertyKey, unknown>;
const native = { values: proto.values, iterator: proto[Symbol.asyncIterator] };

function removeNative() {
  delete proto.values;
  delete proto[Symbol.asyncIterator];
}

afterEach(() => {
  proto.values = native.values;
  proto[Symbol.asyncIterator] = native.iterator;
});

function streamOf<T>(chunks: T[], onCancel?: () => void): ReadableStream<T> {
  return new ReadableStream<T>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
    cancel: onCancel,
  });
}

describe('installReadableStreamAsyncIterator', () => {
  it('leaves a native iterator alone', () => {
    expect(installReadableStreamAsyncIterator()).toBe(false);
    expect(proto[Symbol.asyncIterator]).toBe(native.iterator);
  });

  it('makes for await work when the engine has no iterator', async () => {
    removeNative();
    expect(installReadableStreamAsyncIterator()).toBe(true);
    const seen: number[] = [];
    for await (const chunk of streamOf([1, 2, 3]) as unknown as AsyncIterable<number>) seen.push(chunk);
    expect(seen).toEqual([1, 2, 3]);
  });

  it('cancels the stream on an early exit and releases the lock', async () => {
    removeNative();
    installReadableStreamAsyncIterator();
    let canceled = false;
    const stream = streamOf([1, 2, 3], () => { canceled = true; });
    for await (const chunk of stream as unknown as AsyncIterable<number>) {
      if (chunk === 1) break;
    }
    expect(canceled).toBe(true);
    expect(stream.locked).toBe(false);
  });

  it('keeps the stream open on an early exit with preventCancel', async () => {
    removeNative();
    installReadableStreamAsyncIterator();
    let canceled = false;
    const stream = streamOf([1, 2, 3], () => { canceled = true; }) as unknown as {
      values(options?: { preventCancel?: boolean }): AsyncIterableIterator<number>;
      locked: boolean;
    };
    for await (const chunk of stream.values({ preventCancel: true })) {
      if (chunk === 1) break;
    }
    expect(canceled).toBe(false);
    expect(stream.locked).toBe(false);
  });
});
