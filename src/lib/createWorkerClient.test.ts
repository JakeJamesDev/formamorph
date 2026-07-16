import { describe, it, expect } from 'vitest';
import { createWorkerClient } from './createWorkerClient';

// Minimal Worker stub: captures the posted payload and lets a test emit a matching reply.
class FakeWorker {
  listeners: Record<string, ((e: MessageEvent) => void)[]> = {};
  lastMessage: Record<string, unknown> | null = null;
  terminated = false;
  addEventListener(type: string, cb: (e: MessageEvent) => void) {
    (this.listeners[type] ||= []).push(cb);
  }
  postMessage(msg: Record<string, unknown>) { this.lastMessage = msg; }
  terminate() { this.terminated = true; }
  emit(data: unknown) {
    (this.listeners['message'] || []).forEach((cb) => cb({ data } as MessageEvent));
  }
  /** Fire a non-`message` event (`error` / `messageerror`), which carries no request id. */
  emitEvent(type: string, event: unknown = {}) {
    (this.listeners[type] || []).forEach((cb) => cb(event as MessageEvent));
  }
}

describe('createWorkerClient', () => {
  it('resolves a request when the worker replies with success', async () => {
    let worker: FakeWorker | null = null;
    const client = createWorkerClient(() => (worker = new FakeWorker()) as unknown as Worker);
    const pending = client.run({ foo: 1 });
    worker!.emit({ type: 'success', id: worker!.lastMessage!.id, result: 42 });
    await expect(pending).resolves.toBe(42);
  });

  it('rejects pending requests when terminated before a response', async () => {
    const client = createWorkerClient(() => new FakeWorker() as unknown as Worker);
    const pending = client.run({ foo: 1 });
    client.terminate();
    await expect(pending).rejects.toThrow('Worker terminated before response');
  });

  it('rejects a request the worker errors on instead of hanging forever', async () => {
    let worker: FakeWorker | null = null;
    const client = createWorkerClient(() => (worker = new FakeWorker()) as unknown as Worker);
    const pending = client.run({ foo: 1 });

    // A worker whose script fails to load never posts a `message` — only `error`.
    worker!.emitEvent('error', { message: 'Script load failed' });

    await expect(pending).rejects.toThrow('Script load failed');
  });

  it('discards a failed worker so the next request builds a fresh one', async () => {
    const built: FakeWorker[] = [];
    const client = createWorkerClient(() => {
      const w = new FakeWorker();
      built.push(w);
      return w as unknown as Worker;
    });

    const first = client.run({ foo: 1 });
    built[0].emitEvent('error', { message: 'Script load failed' });
    await expect(first).rejects.toThrow('Script load failed');
    expect(built[0].terminated).toBe(true);

    // Caching the dead worker would hang every later call; a fresh one can succeed once the cause clears.
    const second = client.run({ foo: 2 });
    expect(built).toHaveLength(2);
    built[1].emit({ type: 'success', id: built[1].lastMessage!.id, result: 'ok' });
    await expect(second).resolves.toBe('ok');
  });

  it('rejects every in-flight request on a single worker error', async () => {
    let worker: FakeWorker | null = null;
    const client = createWorkerClient(() => (worker = new FakeWorker()) as unknown as Worker);
    const a = client.run({ foo: 1 });
    const b = client.run({ foo: 2 });

    worker!.emitEvent('error', {});

    await expect(a).rejects.toThrow('Worker failed to load'); // falls back when the event has no message
    await expect(b).rejects.toThrow('Worker failed to load');
  });

  it('keeps the worker after a messageerror, which leaves it healthy', async () => {
    const built: FakeWorker[] = [];
    const client = createWorkerClient(() => {
      const w = new FakeWorker();
      built.push(w);
      return w as unknown as Worker;
    });

    const pending = client.run({ foo: 1 });
    built[0].emitEvent('messageerror');
    await expect(pending).rejects.toThrow('could not be deserialized');
    expect(built[0].terminated).toBe(false);

    client.run({ foo: 2 });
    expect(built).toHaveLength(1); // same instance reused
  });
});
