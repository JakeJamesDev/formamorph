// @vitest-environment node
// Main-process code: it needs Node's fetch and AbortController, not jsdom's stand-ins (undici rejects a
// jsdom AbortSignal outright).
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import modelDownload from './modelDownload.cjs';

const { download, cancel, listPartials, discardPartial } = modelDownload;

// A real HTTP server and a real temp directory. The whole point of this module is what lands on disk from
// a set of range requests, which a mocked fs and a mocked fetch would assert nothing about.

const CHUNK = 1024;
const FILE_NAME = 'test-model.gguf';
const URL_BASE = 'https://huggingface.co/org/repo/resolve/main';
const MODEL_URL = `${URL_BASE}/${FILE_NAME}`;

/** Deterministic, non-repeating content, so a chunk written at the wrong offset can't pass. */
const makeBody = (bytes) => Buffer.from(Array.from({ length: bytes }, (_, i) => (i * 31 + (i >> 8)) % 251));

let tmp;
const servers = [];

/**
 * Range-serving mock. Records every request and the peak concurrency, and can be told to misbehave:
 * `ignoreRanges` answers 200 with the whole file, `hangFromOffset` never answers requests at or past an
 * offset, `throttleStarts` answers 429 the first time each listed offset is asked for, and `shortStarts`
 * sends one byte less than asked for.
 */
function rangeServer(body, opts = {}) {
  const state = { requests: [], concurrent: 0, maxConcurrent: 0, throttled: new Set() };
  const barrier = opts.barrier || 0;
  const waiting = [];

  const release = () => { while (waiting.length) waiting.pop()(); };

  const srv = http.createServer(async (req, res) => {
    const range = /bytes=(\d+)-(\d+)?/.exec(req.headers.range || '');
    const start = range ? Number(range[1]) : 0;
    const end = range && range[2] !== undefined ? Number(range[2]) : body.length - 1;
    const isProbe = range && end === start;
    if (!isProbe) state.requests.push({ start, end });

    if (opts.ignoreRanges) {
      res.writeHead(200, { 'content-length': String(body.length) });
      res.end(body);
      return;
    }
    if (!range) {
      res.writeHead(200, { 'content-length': String(body.length) });
      res.end(body);
      return;
    }
    if (opts.throttleStarts?.has(start) && !state.throttled.has(start)) {
      state.throttled.add(start);
      res.writeHead(429, { 'retry-after': '0' });
      res.end('slow down');
      return;
    }
    if (opts.hangFromOffset !== undefined && start >= opts.hangFromOffset) return; // never answers

    if (barrier && !isProbe) {
      state.concurrent++;
      state.maxConcurrent = Math.max(state.maxConcurrent, state.concurrent);
      if (state.concurrent >= barrier) release();
      else await new Promise((r) => { waiting.push(r); setTimeout(r, 200); });
      state.concurrent--;
    }

    const slice = body.subarray(start, end + 1);
    const out = opts.shortStarts?.has(start) ? slice.subarray(0, slice.length - 1) : slice;
    const servedStart = opts.wrongRangeStarts?.has(start) ? 0 : start;
    res.writeHead(206, {
      'content-range': `bytes ${servedStart}-${end}/${opts.unknownTotal ? '*' : body.length}`,
      'content-length': String(out.length),
      'accept-ranges': 'bytes',
    });
    res.end(out);
  });

  servers.push(srv);
  return new Promise((resolve) => {
    srv.listen(0, '127.0.0.1', () => {
      const base = `http://127.0.0.1:${srv.address().port}`;
      // The injected fetch keeps the huggingface.co host allowlist live while talking to the mock.
      const fetchImpl = (url, init) => fetch(String(url).replace('https://huggingface.co', base), init);
      resolve({ srv, fetchImpl, state });
    });
  });
}

const run = (opts, onProgress = () => {}) =>
  download({ url: MODEL_URL, fileName: FILE_NAME, destDir: tmp, chunkSize: CHUNK, ...opts }, onProgress);

const partPath = () => path.join(tmp, `${FILE_NAME}.part`);
const sidecarPath = () => `${partPath()}.json`;
const readSidecar = () => JSON.parse(fs.readFileSync(sidecarPath(), 'utf8'));

async function waitFor(predicate, ms = 3000) {
  const deadline = Date.now() + ms;
  for (;;) {
    const value = predicate();
    if (value) return value;
    if (Date.now() > deadline) throw new Error('waitFor timed out');
    await new Promise((r) => setTimeout(r, 10));
  }
}

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fm-download-'));
});
afterEach(async () => {
  while (servers.length) {
    const srv = servers.pop();
    srv.closeAllConnections?.();
    await new Promise((r) => srv.close(r));
  }
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe('download: the segmented happy path', () => {
  it('fetches the file over parallel ranges and assembles it byte-identically', async () => {
    const body = makeBody(CHUNK * 8);
    const { fetchImpl, state } = await rangeServer(body, { barrier: 3 });

    const finalPath = await run({ fetchImpl });

    expect(finalPath).toBe(path.join(tmp, FILE_NAME));
    expect(fs.readFileSync(finalPath)).toEqual(body);
    expect(state.requests.length).toBe(8);
    expect(state.maxConcurrent).toBeGreaterThanOrEqual(3);
  });

  it('covers the file with one request per chunk, including a short last chunk', async () => {
    const body = makeBody(CHUNK * 2 + 100);
    const { fetchImpl, state } = await rangeServer(body);

    await run({ fetchImpl });

    expect(fs.readFileSync(path.join(tmp, FILE_NAME))).toEqual(body);
    expect(state.requests.map((r) => `${r.start}-${r.end}`).sort()).toEqual(
      ['0-1023', '1024-2047', '2048-2147'].sort(),
    );
  });

  it('removes the part file and its sidecar once the download lands', async () => {
    const { fetchImpl } = await rangeServer(makeBody(CHUNK * 3));
    await run({ fetchImpl });
    expect(fs.existsSync(partPath())).toBe(false);
    expect(fs.existsSync(sidecarPath())).toBe(false);
  });

  it('reports progress ending at done with the full byte count', async () => {
    const body = makeBody(CHUNK * 4);
    const { fetchImpl } = await rangeServer(body);
    const events = [];

    await run({ fetchImpl }, (p) => events.push(p));

    const last = events.at(-1);
    expect(last).toEqual({ fileName: FILE_NAME, received: body.length, total: body.length, done: true });
    expect(events.filter((e) => e.done).length).toBe(1);
    expect(events.every((e) => e.received <= body.length)).toBe(true);
  });
});

describe('download: pause and resume', () => {
  it('keeps the part and sidecar on pause, then fetches only the missing chunks', async () => {
    const body = makeBody(CHUNK * 4);
    // Chunks 0 and 1 land; everything past byte 2048 hangs until the pause aborts it.
    const first = await rangeServer(body, { hangFromOffset: CHUNK * 2 });
    const paused = run({ fetchImpl: first.fetchImpl }).catch((e) => e);

    await waitFor(() => fs.existsSync(sidecarPath()) && readSidecar().done.length === 2);
    cancel();
    expect((await paused).message).toBe('DOWNLOAD_PAUSED');

    expect(fs.existsSync(partPath())).toBe(true);
    expect(fs.existsSync(path.join(tmp, FILE_NAME))).toBe(false);
    expect(readSidecar()).toEqual({ total: body.length, chunkSize: CHUNK, done: [0, 1] });

    const second = await rangeServer(body);
    await run({ fetchImpl: second.fetchImpl });

    expect(fs.readFileSync(path.join(tmp, FILE_NAME))).toEqual(body);
    expect(second.state.requests.map((r) => r.start).sort((a, b) => a - b)).toEqual([CHUNK * 2, CHUNK * 3]);
  });

  it('reports the resumable bytes from the bitmap, not the preallocated file size', async () => {
    const body = makeBody(CHUNK * 4);
    const first = await rangeServer(body, { hangFromOffset: CHUNK * 2 });
    const paused = run({ fetchImpl: first.fetchImpl }).catch((e) => e);
    await waitFor(() => fs.existsSync(sidecarPath()) && readSidecar().done.length === 2);
    cancel();
    await paused;

    // The part file is preallocated at full size; only the bitmap knows what really arrived.
    expect(fs.statSync(partPath()).size).toBe(body.length);
    expect(listPartials(tmp)).toEqual([{ fileName: FILE_NAME, received: CHUNK * 2 }]);
  });

  it('re-uses a legacy contiguous part file instead of discarding it', async () => {
    const body = makeBody(CHUNK * 4);
    // What the single-stream downloader used to leave behind: 2.5 chunks, no sidecar.
    fs.writeFileSync(partPath(), body.subarray(0, CHUNK * 2 + 500));
    const { fetchImpl, state } = await rangeServer(body);

    await run({ fetchImpl });

    expect(fs.readFileSync(path.join(tmp, FILE_NAME))).toEqual(body);
    expect(state.requests.map((r) => r.start).sort((a, b) => a - b)).toEqual([CHUNK * 2, CHUNK * 3]);
  });

  it('discards a sidecar written for a different file size', async () => {
    const body = makeBody(CHUNK * 3);
    fs.writeFileSync(partPath(), Buffer.alloc(CHUNK * 3));
    fs.writeFileSync(sidecarPath(), JSON.stringify({ total: CHUNK * 9, chunkSize: CHUNK, done: [0, 1] }));
    const { fetchImpl, state } = await rangeServer(body);

    await run({ fetchImpl });

    expect(fs.readFileSync(path.join(tmp, FILE_NAME))).toEqual(body);
    expect(state.requests.length).toBe(3); // nothing was trusted; every chunk was re-fetched
  });
});

describe('download: what must never happen', () => {
  it('does not rename when a chunk keeps arriving short', async () => {
    const body = makeBody(CHUNK * 3);
    const { fetchImpl, state } = await rangeServer(body, { shortStarts: new Set([CHUNK * 2]) });

    // backoffBaseMs only shortens the pauses; every retry still runs.
    await expect(run({ fetchImpl, backoffBaseMs: 5 })).rejects.toThrow(/ended short/);

    expect(state.requests.filter((r) => r.start === CHUNK * 2).length).toBe(5); // retried, then gave up
    expect(fs.existsSync(path.join(tmp, FILE_NAME))).toBe(false);
    expect(fs.existsSync(partPath())).toBe(true);
    expect(readSidecar().done).not.toContain(2); // the bad chunk is still owed
  });

  it('refuses a segment that comes back for a different range', async () => {
    const body = makeBody(CHUNK * 3);
    // A proxy answers the second chunk's request with the first chunk's range. The byte count matches,
    // so only the content-range says the file would be assembled wrong.
    const { fetchImpl } = await rangeServer(body, { wrongRangeStarts: new Set([CHUNK]) });

    await expect(run({ fetchImpl, backoffBaseMs: 5 })).rejects.toThrow(/wrong range/);

    expect(fs.existsSync(path.join(tmp, FILE_NAME))).toBe(false);
    expect(readSidecar().done).not.toContain(1);
  });

  it('refuses a URL that is not on huggingface.co', async () => {
    const { fetchImpl } = await rangeServer(makeBody(CHUNK));
    await expect(
      download({ url: 'https://example.com/model.gguf', fileName: FILE_NAME, destDir: tmp, fetchImpl }, () => {}),
    ).rejects.toThrow(/only allowed from huggingface.co/);
  });

  it('runs one download at a time', async () => {
    const body = makeBody(CHUNK * 4);
    const first = await rangeServer(body, { hangFromOffset: CHUNK * 2 });
    const running = run({ fetchImpl: first.fetchImpl }).catch((e) => e);
    await waitFor(() => fs.existsSync(sidecarPath()));

    await expect(run({ fetchImpl: first.fetchImpl })).rejects.toThrow(/already in progress/);

    cancel();
    await running;
  });
});

describe('download: unfriendly servers', () => {
  it('falls back to a single stream when the server ignores ranges', async () => {
    const body = makeBody(CHUNK * 5);
    const { fetchImpl, state } = await rangeServer(body, { ignoreRanges: true });

    await run({ fetchImpl });

    expect(fs.readFileSync(path.join(tmp, FILE_NAME))).toEqual(body);
    expect(fs.existsSync(sidecarPath())).toBe(false);
    expect(state.requests.length).toBe(1); // one whole-file stream, not a chunk queue
  });

  it('drops a segmented partial before falling back, instead of appending to its holes', async () => {
    const body = makeBody(CHUNK * 3);
    // A range server that will not say how big the file is: the segmented path can't plan against it.
    const { fetchImpl } = await rangeServer(body, { unknownTotal: true });
    // What a previous segmented attempt left: a full-length part with holes, plus its bitmap.
    fs.writeFileSync(partPath(), Buffer.alloc(body.length));
    fs.writeFileSync(sidecarPath(), JSON.stringify({ total: body.length, chunkSize: CHUNK, done: [0, 1] }));

    await run({ fetchImpl });

    expect(fs.readFileSync(path.join(tmp, FILE_NAME))).toEqual(body);
    expect(fs.existsSync(sidecarPath())).toBe(false);
  });

  it('backs off and retries a throttled segment', async () => {
    const body = makeBody(CHUNK * 3);
    const { fetchImpl, state } = await rangeServer(body, { throttleStarts: new Set([CHUNK]) });

    await run({ fetchImpl });

    expect(fs.readFileSync(path.join(tmp, FILE_NAME))).toEqual(body);
    expect(state.requests.filter((r) => r.start === CHUNK).length).toBe(2); // 429, then served
  });
});

describe('partial bookkeeping', () => {
  it('discards the sidecar along with the part file', async () => {
    fs.writeFileSync(partPath(), Buffer.alloc(10));
    fs.writeFileSync(sidecarPath(), JSON.stringify({ total: 10, chunkSize: CHUNK, done: [] }));

    expect(discardPartial(tmp, FILE_NAME)).toBe(true);

    expect(fs.existsSync(partPath())).toBe(false);
    expect(fs.existsSync(sidecarPath())).toBe(false);
  });

  it('falls back to the file size for a legacy partial with no sidecar', () => {
    fs.writeFileSync(partPath(), Buffer.alloc(4242));
    expect(listPartials(tmp)).toEqual([{ fileName: FILE_NAME, received: 4242 }]);
  });

  it('ignores a sidecar that does not say what size its chunks are', () => {
    // Without the chunk size the bitmap means nothing: chunk 1 could be any span of the file.
    fs.writeFileSync(partPath(), Buffer.alloc(CHUNK * 3));
    fs.writeFileSync(sidecarPath(), JSON.stringify({ total: CHUNK * 3, done: [1] }));
    expect(listPartials(tmp)).toEqual([{ fileName: FILE_NAME, received: CHUNK * 3 }]);
  });
});
