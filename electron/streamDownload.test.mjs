import { describe, it, expect, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import streamDownload from './streamDownload.cjs';

const { pumpResponseToFile } = streamDownload;

/** A fetch-body stand-in: yields each chunk once, then `{ done: true }`. */
const fakeBody = (chunks) => {
  let i = 0;
  return { getReader: () => ({ read: async () => (i < chunks.length ? { done: false, value: chunks[i++] } : { done: true }) }) };
};

/**
 * Controllable WriteStream stand-in. `writeReturns` (per call) drives backpressure — a `false` makes the
 * pump wait for a 'drain'. Records everything written; `end(cb)` flushes.
 */
class FakeOut extends EventEmitter {
  constructor(writeReturns = []) {
    super();
    this.written = [];
    this.writeReturns = writeReturns;
    this.calls = 0;
  }
  write(buf) {
    this.written.push(Buffer.from(buf));
    const ret = this.calls < this.writeReturns.length ? this.writeReturns[this.calls] : true;
    this.calls++;
    return ret;
  }
  end(cb) { this.ended = true; if (cb) cb(); }
}

const u8 = (...bytes) => Uint8Array.from(bytes);

describe('pumpResponseToFile', () => {
  it('writes every chunk, reports cumulative progress, and returns the byte count', async () => {
    const out = new FakeOut();
    const onChunk = vi.fn();
    const received = await pumpResponseToFile(fakeBody([u8(1, 2, 3), u8(4, 5)]), out, 0, onChunk);

    expect(received).toBe(5);
    expect(Buffer.concat(out.written)).toEqual(Buffer.from([1, 2, 3, 4, 5]));
    expect(onChunk.mock.calls.map((c) => c[0])).toEqual([3, 5]); // cumulative
    expect(out.ended).toBe(true);
  });

  it('seeds the running count when resuming (received > 0)', async () => {
    const out = new FakeOut();
    const onChunk = vi.fn();
    const received = await pumpResponseToFile(fakeBody([u8(9, 9)]), out, 100, onChunk);
    expect(received).toBe(102);
    expect(onChunk).toHaveBeenCalledWith(102);
  });

  it('waits for drain when write() signals backpressure', async () => {
    const out = new FakeOut([false]); // first write backpressures
    const onChunk = vi.fn();
    const p = pumpResponseToFile(fakeBody([u8(1), u8(2)]), out, 0, onChunk);
    // The pump is parked on the drain wait; releasing it lets the stream finish.
    await Promise.resolve();
    out.emit('drain');
    const received = await p;
    expect(received).toBe(2);
    expect(Buffer.concat(out.written)).toEqual(Buffer.from([1, 2]));
  });

  it('throws a mid-write error instead of leaving it unhandled', async () => {
    const out = new FakeOut();
    const boom = new Error('ENOSPC');
    // Emit the write error asynchronously, mid-pump.
    queueMicrotask(() => out.emit('error', boom));
    await expect(pumpResponseToFile(fakeBody([u8(1), u8(2), u8(3)]), out, 0, () => {})).rejects.toBe(boom);
  });

  it('rejects the drain wait when the stream errors during backpressure', async () => {
    const out = new FakeOut([false]);
    const boom = new Error('disk gone');
    const p = pumpResponseToFile(fakeBody([u8(1), u8(2)]), out, 0, () => {});
    await Promise.resolve();
    out.emit('error', boom); // errors while parked on drain
    await expect(p).rejects.toBe(boom);
  });
});
