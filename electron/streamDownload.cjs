// Shared streaming-download loop for the desktop downloaders (model GGUFs, app-update zips). Both pump a
// fetch Response body into an open WriteStream the same way; keeping it in one place means the backpressure
// and disk-error handling can't drift between them.

/**
 * Pump `body` (a WHATWG ReadableStream reader source, i.e. a fetch Response body) into the already-open
 * WriteStream `out`, honoring backpressure so a multi-GB file doesn't buffer in memory. `received` seeds the
 * running byte count (non-zero when resuming an append); `onChunk(received)` fires after each chunk with the
 * cumulative total. Resolves the final byte count once the stream is flushed and closed.
 *
 * A mid-write failure (disk full, locked path) would otherwise emit an unhandled 'error' that crashes the
 * main process and hangs the drain wait; it's captured and re-thrown so the caller's catch can preserve or
 * discard the partial. The 'error' listener is intentionally left attached (the stream is discarded after),
 * so the caller's own cleanup (`out.end`/`out.destroy`) is still covered.
 */
async function pumpResponseToFile(body, out, received, onChunk) {
  let writeErr = null;
  out.on('error', (err) => { writeErr = err; });

  const reader = body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (writeErr) throw writeErr;
    if (done) break;
    received += value.length;
    // Respect backpressure; reject the wait on a write error too so we don't hang on a dead stream.
    if (!out.write(Buffer.from(value))) {
      await new Promise((resolve, reject) => {
        const onDrain = () => { out.off('error', onErr); resolve(); };
        const onErr = (err) => { out.off('drain', onDrain); reject(err); };
        out.once('drain', onDrain);
        out.once('error', onErr);
      });
    }
    onChunk(received);
  }
  if (writeErr) throw writeErr;
  await new Promise((resolve, reject) => out.end((err) => (err ? reject(err) : resolve())));
  return received;
}

module.exports = { pumpResponseToFile };
