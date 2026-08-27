// Desktop-only model downloader: pulls a GGUF from Hugging Face into the models folder over several
// parallel range requests, writing into one preallocated `.part` file and renaming on success (so a
// cancelled or failed download never leaves a half-file that looks valid). A JSON sidecar beside the
// `.part` records which chunks landed, so a download resumes across an app restart. Servers that ignore
// range requests fall back to the original single-stream path. One download at a time.
const fs = require('node:fs');
const path = require('node:path');
const { pumpResponseToFile } = require('./streamDownload.cjs');
const {
  DEFAULT_CHUNK_SIZE, planChunks, doneBytes, resumePlan, initRamp, rampOnSample, rampOnError,
} = require('./downloadPlan.cjs');

// Only fetch from Hugging Face. net.fetch follows HF's redirect to its CDN internally, so validating the
// initial host is enough.
const ALLOWED_HOSTS = new Set(['huggingface.co']);

const PROGRESS_INTERVAL_MS = 250; // aggregated progress events, not one per network chunk
const SAMPLE_INTERVAL_MS = 2000;  // throughput window the connection ramp measures
const MAX_SEGMENT_ATTEMPTS = 5;
const BACKOFF_BASE_MS = 500;
const MAX_BACKOFF_MS = 10000;

// Required lazily: this module is imported by tests that run outside Electron.
const electronFetch = (...args) => require('electron').net.fetch(...args);

let current = null; // { controller, fileName }

function isAllowed(url) {
  try { return ALLOWED_HOSTS.has(new URL(url).host); } catch { return false; }
}

/** On-disk size of a file, or 0 if it doesn't exist. */
function sizeOf(p) {
  try { return fs.statSync(p).size; } catch { return 0; }
}

function partPathFor(destDir, fileName) {
  return path.join(destDir, `${path.basename(fileName)}.part`);
}

const sidecarPathFor = (partPath) => `${partPath}.json`;

function readSidecar(p) {
  try {
    const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
    if (!raw || typeof raw.total !== 'number' || typeof raw.chunkSize !== 'number' || !Array.isArray(raw.done)) {
      return null;
    }
    return raw;
  } catch { return null; }
}

/** Write the sidecar through a temp file so an interrupted write can't leave torn JSON behind. */
function writeSidecar(p, state) {
  const tmp = `${p}.tmp`;
  try {
    fs.writeFileSync(tmp, JSON.stringify(state));
    fs.renameSync(tmp, p);
  } catch {
    // The download still works; resume just falls back to a restart. Take the temp with it — nothing
    // else in the app ever lists, moves, or deletes a stray `.tmp`.
    removeFile(tmp);
  }
}

function removeFile(p) {
  try { fs.unlinkSync(p); return true; } catch { return false; }
}

/** Delete a resume sidecar and any temp left by a half-finished write of it. */
function removeSidecar(p) {
  removeFile(`${p}.tmp`);
  return removeFile(p);
}

const delay = (ms, signal) => new Promise((resolve) => {
  const timer = setTimeout(finish, ms);
  function finish() {
    clearTimeout(timer);
    if (signal) signal.removeEventListener('abort', finish);
    resolve();
  }
  if (signal) signal.addEventListener('abort', finish, { once: true });
});

const writeAt = (fd, buf, position) => new Promise((resolve, reject) => {
  fs.write(fd, buf, 0, buf.length, position, (err) => (err ? reject(err) : resolve()));
});

/** Total byte count out of a `content-range: bytes start-end/total` header, or 0 when it says `*`. */
function totalFromContentRange(header) {
  if (!header || !header.includes('/')) return 0;
  const total = Number(header.split('/')[1]);
  return Number.isFinite(total) && total > 0 ? total : 0;
}

/** First byte offset a `content-range` header describes, or null when it says nothing usable. */
function startFromContentRange(header) {
  const match = /bytes\s+(\d+)-/.exec(header || '');
  return match ? Number(match[1]) : null;
}

/**
 * Ask for one byte to learn the file size and whether the server honors ranges. Returns
 * `{ segmented: true, total }` when the segmented path can run, `{ segmented: false }` when it can't —
 * a 200 means ranges are ignored, and a 206 without a total leaves nothing to plan against.
 */
async function probeRanges(url, fetchImpl, signal) {
  const res = await fetchImpl(url, { signal, headers: { Range: 'bytes=0-0' } });
  const total = res.status === 206 ? totalFromContentRange(res.headers.get('content-range')) : 0;
  try { await res.body?.cancel(); } catch { /* already closed */ }
  if (res.status === 206) return total > 0 ? { segmented: true, total } : { segmented: false };
  if (!res.ok) throw new Error(`Download failed: HTTP ${res.status}`);
  return { segmented: false };
}

/**
 * The original one-connection path, kept for servers that ignore range requests. Resumes by appending to
 * an existing contiguous `.part`; a 416 means that partial is stale, so it is discarded and restarted.
 */
async function runSingleStream({ url, fileName, tmpPath, finalPath, fetchImpl, signal }, onProgress) {
  let out = null;
  try {
    let startOffset = sizeOf(tmpPath);
    let res = await fetchImpl(url, { signal, headers: startOffset > 0 ? { Range: `bytes=${startOffset}-` } : {} });

    if (startOffset > 0 && res.status === 416) {
      removeFile(tmpPath);
      startOffset = 0;
      res = await fetchImpl(url, { signal });
    }

    let received;
    let total;
    let append;
    if (startOffset > 0 && res.status === 206) {
      const cr = res.headers.get('content-range');
      total = totalFromContentRange(cr) || startOffset + (Number(res.headers.get('content-length')) || 0);
      received = startOffset;
      append = true;
    } else {
      if (!res.ok) throw new Error(`Download failed: HTTP ${res.status}`);
      total = Number(res.headers.get('content-length')) || 0;
      received = 0;
      append = false;
    }
    if (!res.body) throw new Error('Download failed: empty response body.');

    out = fs.createWriteStream(tmpPath, { flags: append ? 'a' : 'w' });
    onProgress({ fileName, received, total, done: false }); // seed the bar at the resumed position

    received = await pumpResponseToFile(res.body, out, received, (r) =>
      onProgress({ fileName, received: r, total, done: false }),
    );
    out = null;
    fs.renameSync(tmpPath, finalPath);
    onProgress({ fileName, received, total: total || received, done: true });
    return finalPath;
  } catch (e) {
    // Keep the .part on disk so the next attempt resumes — flush and close it, but don't delete.
    if (out) { try { await new Promise((r) => out.end(r)); } catch { /* ignore */ } }
    throw e;
  }
}

/**
 * The segmented path: a queue of chunks drained by a pool of range requests, all writing into one
 * preallocated `.part` at their own offsets. The pool starts at three connections and grows only while
 * aggregate throughput keeps improving; 429/503 and repeated segment failures shrink it again. Only a
 * full bitmap whose bytes match the server's total renames the file.
 */
async function runSegmented({ url, fileName, tmpPath, finalPath, total, chunkSize, fetchImpl, signal, backoffBaseMs }, onProgress) {
  const sidecarPath = sidecarPathFor(tmpPath);
  const plan = resumePlan({ total, chunkSize, partLength: sizeOf(tmpPath), sidecar: readSidecar(sidecarPath) });
  if (plan.restart) {
    removeFile(tmpPath);
    removeSidecar(sidecarPath);
  }

  const { chunks } = plan;
  const doneSet = new Set(plan.done);
  const inflight = new Map(); // chunk index → bytes written on the current attempt
  const queue = chunks.filter((c) => !doneSet.has(c.index));
  let completedBytes = doneBytes(chunks, plan.done);

  let fd;
  try { fd = fs.openSync(tmpPath, 'r+'); } catch { fd = fs.openSync(tmpPath, 'w+'); }

  const persist = () => writeSidecar(sidecarPath, { total, chunkSize, done: [...doneSet] });
  const receivedNow = () => {
    let n = completedBytes;
    for (const bytes of inflight.values()) n += bytes;
    return n;
  };
  const emit = () => onProgress({ fileName, received: receivedNow(), total, done: false });

  let cursor = 0;
  let running = 0;
  let failure = null;
  let ramp = initRamp();
  let windowBytes = 0;
  let notify = () => {};

  async function writeChunk(body, chunk) {
    const reader = body.getReader();
    let offset = chunk.start;
    inflight.set(chunk.index, 0);
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      const buf = Buffer.from(value);
      if (offset + buf.length > chunk.end + 1) throw new Error('Download failed: a segment overran its range.');
      await writeAt(fd, buf, offset);
      offset += buf.length;
      inflight.set(chunk.index, offset - chunk.start);
      windowBytes += buf.length;
    }
    if (offset !== chunk.end + 1) throw new Error('Download failed: a segment ended short.');
    inflight.delete(chunk.index);
    doneSet.add(chunk.index);
    completedBytes += chunk.length;
    persist();
    emit();
  }

  async function fetchChunk(chunk) {
    for (let attempt = 1; ; attempt++) {
      try {
        const res = await fetchImpl(url, { signal, headers: { Range: `bytes=${chunk.start}-${chunk.end}` } });
        if (res.status === 429 || res.status === 503) {
          try { await res.body?.cancel(); } catch { /* already closed */ }
          throw new Error(`Download throttled: HTTP ${res.status}`);
        }
        if (res.status !== 206) throw new Error(`Download failed: HTTP ${res.status}`);
        // The body is about to be written at the offset we asked for, so a server or proxy that answers
        // with a different range would silently corrupt the file at full length.
        const servedStart = startFromContentRange(res.headers.get('content-range'));
        if (servedStart !== null && servedStart !== chunk.start) {
          try { await res.body?.cancel(); } catch { /* already closed */ }
          throw new Error('Download failed: a segment came back for the wrong range.');
        }
        if (!res.body) throw new Error('Download failed: empty response body.');
        await writeChunk(res.body, chunk);
        return;
      } catch (err) {
        inflight.delete(chunk.index);
        if (signal.aborted) throw err;
        // Back off politely: fewer connections, then a growing pause before the retry.
        ramp = rampOnError(ramp);
        if (attempt >= MAX_SEGMENT_ATTEMPTS) throw err;
        await delay(Math.min(backoffBaseMs * 2 ** (attempt - 1), MAX_BACKOFF_MS), signal);
      }
    }
  }

  function spawn() {
    running++;
    void (async () => {
      try {
        while (!failure && !signal.aborted && cursor < queue.length && running <= ramp.workers) {
          await fetchChunk(queue[cursor++]);
        }
      } catch (err) {
        if (!failure) failure = err;
      } finally {
        running--;
        notify();
      }
    })();
  }

  function fillPool() {
    while (running < ramp.workers && cursor < queue.length && !failure && !signal.aborted) spawn();
  }

  const progressTimer = setInterval(emit, PROGRESS_INTERVAL_MS);
  const sampleTimer = setInterval(() => {
    const bytesPerSec = (windowBytes * 1000) / SAMPLE_INTERVAL_MS;
    windowBytes = 0;
    if (!ramp.ramping) return;
    ramp = rampOnSample(ramp, bytesPerSec);
    fillPool();
  }, SAMPLE_INTERVAL_MS);

  try {
    fs.ftruncateSync(fd, total); // preallocate so every chunk can write at its own offset
    persist();
    emit(); // seed the bar at the resumed position

    fillPool();
    while (running > 0) {
      await new Promise((resolve) => { notify = resolve; });
      fillPool();
    }

    if (failure) throw failure;
    if (signal.aborted) throw new Error('DOWNLOAD_PAUSED');
    // Never rename off a partial write: every chunk must be marked and the bytes must add up.
    if (doneSet.size !== chunks.length || completedBytes !== total) {
      throw new Error('Download failed: the file is incomplete.');
    }
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    fd = null;
    fs.renameSync(tmpPath, finalPath);
    removeSidecar(sidecarPath);
    onProgress({ fileName, received: total, total, done: true });
    return finalPath;
  } finally {
    clearInterval(progressTimer);
    clearInterval(sampleTimer);
    if (fd !== null) {
      persist(); // keep the bitmap so the next attempt only fetches what is missing
      try { fs.closeSync(fd); } catch { /* already closed */ }
    }
  }
}

/**
 * Download `url` → `<destDir>/<fileName>`, reporting { fileName, received, total, done } via onProgress.
 * Resumes whatever a previous attempt left behind (HF LFS files are immutable, so old bytes stay valid).
 * On any interruption the `.part` and its sidecar are left in place for a later resume; only success
 * renames. `fetchImpl`, `chunkSize` and `backoffBaseMs` exist so the orchestrator can be driven without
 * Electron and without waiting out real retry pauses.
 */
async function download(
  { url, fileName, destDir, fetchImpl = electronFetch, chunkSize = DEFAULT_CHUNK_SIZE, backoffBaseMs = BACKOFF_BASE_MS },
  onProgress,
) {
  if (current) throw new Error('A model download is already in progress.');
  if (!isAllowed(url)) throw new Error('Model downloads are only allowed from huggingface.co.');

  fs.mkdirSync(destDir, { recursive: true });
  const finalPath = path.join(destDir, path.basename(fileName));
  const tmpPath = `${finalPath}.part`;

  const controller = new AbortController();
  current = { controller, fileName };
  try {
    const probe = await probeRanges(url, fetchImpl, controller.signal);
    const args = { url, fileName, tmpPath, finalPath, fetchImpl, signal: controller.signal };
    if (probe.segmented) {
      return await runSegmented({ ...args, total: probe.total, chunkSize, backoffBaseMs }, onProgress);
    }
    // Without ranges there is no way to fill a segmented partial's holes, so drop it rather than append.
    if (readSidecar(sidecarPathFor(tmpPath))) {
      removeFile(tmpPath);
      removeSidecar(sidecarPathFor(tmpPath));
    }
    return await runSingleStream(args, onProgress);
  } catch (e) {
    // A user-initiated pause aborts the fetch; surface it as a recognizable, non-error signal.
    if (controller.signal.aborted) throw new Error('DOWNLOAD_PAUSED');
    throw e;
  } finally {
    current = null;
  }
}

/** Abort the in-flight download, if any. The partial is preserved for a later resume. */
function cancel() {
  if (current) current.controller.abort();
}

/** Bytes of `partPath` that are really downloaded — the sidecar bitmap when there is one. */
function receivedBytes(partPath) {
  const sidecar = readSidecar(sidecarPathFor(partPath));
  if (!sidecar) return sizeOf(partPath);
  return doneBytes(planChunks(sidecar.total, sidecar.chunkSize), sidecar.done);
}

/** Partial (.part) downloads present in `destDir`, as [{ fileName, received }] (fileName without .part). */
function listPartials(destDir) {
  try {
    return fs.readdirSync(destDir)
      .filter((f) => f.toLowerCase().endsWith('.gguf.part'))
      .map((f) => ({ fileName: f.slice(0, -'.part'.length), received: receivedBytes(path.join(destDir, f)) }));
  } catch {
    return [];
  }
}

/** Delete a partial download and its resume sidecar (so "Discard" leaves nothing behind). */
function discardPartial(destDir, fileName) {
  const partPath = partPathFor(destDir, fileName);
  removeSidecar(sidecarPathFor(partPath));
  return removeFile(partPath);
}

module.exports = { download, cancel, listPartials, discardPartial };
