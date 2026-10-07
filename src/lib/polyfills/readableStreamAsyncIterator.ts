/**
 * Gives `ReadableStream` the `for await` protocol on engines that lack it (Safari before 27, Android WebView
 * before Chrome 124). Dependencies that iterate a stream at module evaluation throw without it.
 */

interface IterationOptions {
  preventCancel?: boolean;
}

async function* readAll<T>(stream: ReadableStream<T>, options?: IterationOptions): AsyncIterableIterator<T> {
  const reader = stream.getReader();
  let finished = false;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        finished = true;
        return;
      }
      yield value;
    }
  } finally {
    if (!finished && !options?.preventCancel) await reader.cancel();
    reader.releaseLock();
  }
}

/** Installs the iterator on `ReadableStream.prototype` when the engine has none. Returns whether it did. */
export function installReadableStreamAsyncIterator(): boolean {
  if (typeof ReadableStream === 'undefined') return false;
  // lib.dom types the iterator as always present, so the prototype is written through a plain record.
  const proto = ReadableStream.prototype as unknown as Record<PropertyKey, unknown>;
  if (typeof proto[Symbol.asyncIterator] === 'function') return false;
  const values = function values(this: ReadableStream<unknown>, options?: IterationOptions) {
    return readAll(this, options);
  };
  proto.values = values;
  proto[Symbol.asyncIterator] = values;
  return true;
}

installReadableStreamAsyncIterator();
