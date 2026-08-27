// Pure planning logic for the segmented model downloader: how a file is cut into chunks, which chunks a
// resumed download still owes, and how many connections the pool should run. No fs, no network, no clock —
// the orchestrator in modelDownload.cjs feeds these functions and acts on what they return.

// 64 MB keeps parallel writes largely sequential on a spinning disk while still giving a fast line enough
// work items to spread across the pool.
const DEFAULT_CHUNK_SIZE = 64 * 1024 * 1024;

// Connection policy. `start` is what a first sample is measured against; `growth` is the aggregate gain
// that justifies one more connection; `ceiling` is the politeness limit toward the CDN.
const RAMP = { start: 3, ceiling: 8, growth: 0.15 };

/** Cut a `total`-byte file into the work queue, as `{ index, start, end, length }` with `end` inclusive. */
function planChunks(total, chunkSize = DEFAULT_CHUNK_SIZE) {
  const chunks = [];
  if (!(total > 0) || !(chunkSize > 0)) return chunks;
  for (let start = 0, index = 0; start < total; start += chunkSize, index++) {
    const end = Math.min(start + chunkSize, total) - 1;
    chunks.push({ index, start, end, length: end - start + 1 });
  }
  return chunks;
}

/** Bytes accounted for by the finished chunks. */
function doneBytes(chunks, done) {
  const set = new Set(done);
  return chunks.reduce((n, c) => (set.has(c.index) ? n + c.length : n), 0);
}

/**
 * Chunks a pre-segmented (contiguous, appended) `.part` of `partLength` bytes already holds. Only chunks
 * whose last byte is on disk count; a half-written chunk goes back on the queue.
 */
function legacyDoneIndices(chunks, partLength) {
  return chunks.filter((c) => c.end < partLength).map((c) => c.index);
}

/**
 * Work out what a resumed download still owes. Returns `{ chunks, done, restart }`; `restart` means the
 * partial on disk cannot be trusted and the caller should delete it (and its sidecar) before starting.
 *
 * A sidecar written for a different total or chunk size describes a different file. A full-length `.part`
 * with no sidecar is either stale or a segmented part that lost its sidecar, and its holes are invisible,
 * so it is discarded rather than renamed over.
 */
function resumePlan({ total, chunkSize = DEFAULT_CHUNK_SIZE, partLength = 0, sidecar = null }) {
  const chunks = planChunks(total, chunkSize);
  if (sidecar) {
    if (sidecar.total !== total || sidecar.chunkSize !== chunkSize) return { chunks, done: [], restart: true };
    const valid = new Set(chunks.filter((c) => c.end < partLength).map((c) => c.index));
    return { chunks, done: (sidecar.done || []).filter((i) => valid.has(i)), restart: false };
  }
  if (partLength <= 0) return { chunks, done: [], restart: false };
  if (partLength >= total) return { chunks, done: [], restart: true };
  return { chunks, done: legacyDoneIndices(chunks, partLength), restart: false };
}

/** Fresh pool state. `ramping` stays true until a plateau or an error settles the connection count. */
function initRamp(overrides = {}) {
  return { workers: RAMP.start, ramping: true, best: null, ...overrides };
}

/**
 * Fold one aggregate-throughput sample (bytes/sec) into the pool state. The first sample sets the baseline
 * and buys one more connection to measure against; after that a connection is added only while the
 * aggregate keeps growing by `RAMP.growth`. A plateau or the ceiling ends the ramp for good.
 */
function rampOnSample(state, bytesPerSec) {
  if (!state.ramping) return state;
  if (state.best !== null && !(bytesPerSec > state.best * (1 + RAMP.growth))) {
    return { ...state, ramping: false };
  }
  const workers = Math.min(state.workers + 1, RAMP.ceiling);
  return { ...state, workers, best: bytesPerSec, ramping: workers < RAMP.ceiling };
}

/** Back off after a 429/503 or repeated segment failures: halve the pool and stop adding connections. */
function rampOnError(state) {
  return { ...state, workers: Math.max(1, Math.floor(state.workers / 2)), ramping: false };
}

module.exports = {
  DEFAULT_CHUNK_SIZE, RAMP,
  planChunks, doneBytes, legacyDoneIndices, resumePlan,
  initRamp, rampOnSample, rampOnError,
};
