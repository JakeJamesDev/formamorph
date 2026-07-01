import { describe, it, expect } from 'vitest';
import { createWorkerClient } from './createWorkerClient';

// Minimal Worker stub: captures the posted payload and lets a test emit a matching reply.
class FakeWorker {
  listeners: Record<string, ((e: MessageEvent) => void)[]> = {};
  lastMessage: Record<string, unknown> | null = null;
  addEventListener(type: string, cb: (e: MessageEvent) => void) {
    (this.listeners[type] ||= []).push(cb);
  }
  postMessage(msg: Record<string, unknown>) { this.lastMessage = msg; }
  terminate() {}
  emit(data: unknown) {
    (this.listeners['message'] || []).forEach((cb) => cb({ data } as MessageEvent));
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
});
