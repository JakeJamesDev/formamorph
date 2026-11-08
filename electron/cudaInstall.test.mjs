// @vitest-environment node
// A real range server and a real temp data folder: the install is about what lands on disk.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import { zipSync, unzipSync } from 'fflate';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createCudaInstall } = require('./cudaInstall.cjs');
const modelDownload = require('./modelDownload.cjs');

const CHUNK = 1024;
const TAG = 'b9';
const HOST = 'https://github.com/ggml-org/llama.cpp/releases/download';

/** Deterministic bytes, so a chunk at the wrong offset changes the digest. */
const noise = (n, seed) => Uint8Array.from({ length: n }, (_, i) => (i * 31 + seed + (i >> 8)) % 251);
const ZIPS = {
  [`llama-${TAG}-bin-win-cuda-13.4-x64.zip`]: Buffer.from(zipSync({ 'llama-server.exe': noise(3000, 1), 'ggml-cuda.dll': noise(2000, 2) }, { level: 0 })),
  'cudart-llama-bin-win-cuda-13.4-x64.zip': Buffer.from(zipSync({ 'cublas64_13.dll': noise(4000, 3) }, { level: 0 })),
};
const NAMES = Object.keys(ZIPS);
const digestOf = (buf) => `sha256:${crypto.createHash('sha256').update(buf).digest('hex')}`;

const pinWith = (over = {}) => ({
  tag: TAG,
  cuda: {
    assets: NAMES.map((name) => ({
      name, url: `${HOST}/${TAG}/${name}`, size: ZIPS[name].length, unpackedSize: 9000,
      digest: digestOf(ZIPS[name]), ...(over[name] ?? {}),
    })),
  },
});

let tmp;
let servers = [];

/** Serves each zip by name with range support. `holdFrom` holds ranges of `holdName` at or past an offset until `release()`. */
async function zipServer({ files = ZIPS, holdName = null, holdFrom = Infinity } = {}) {
  const state = { requests: [], held: [] };
  const srv = http.createServer((req, res) => {
    const name = decodeURIComponent(req.url.split('/').pop());
    const body = files[name];
    if (!body) { res.writeHead(404); res.end(); return; }
    const m = /bytes=(\d+)-(\d+)?/.exec(req.headers.range || '');
    const start = m ? Number(m[1]) : 0;
    const end = m && m[2] !== undefined ? Number(m[2]) : body.length - 1;
    if (!(m && start === end)) state.requests.push({ name, start, end });
    const answer = () => {
      if (!m) { res.writeHead(200, { 'content-length': String(body.length) }); res.end(body); return; }
      res.writeHead(206, { 'content-range': `bytes ${start}-${end}/${body.length}`, 'content-length': String(end - start + 1) });
      res.end(body.subarray(start, end + 1));
    };
    if (name === holdName && start >= holdFrom && start !== end) state.held.push(answer);
    else answer();
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  servers.push(srv);
  const base = `http://127.0.0.1:${srv.address().port}`;
  const fetchImpl = (url, init) => fetch(String(url).replace(/^https:\/\/[^/]+/, base), init);
  const release = () => { for (const a of state.held.splice(0)) a(); };
  return { state, fetchImpl, release };
}

const unzipInto = async (zip, dir) => {
  for (const [name, bytes] of Object.entries(unzipSync(fs.readFileSync(zip)))) fs.writeFileSync(path.join(dir, name), bytes);
};

const SUPPORTED = { nvidia: true, support: { supported: true } };

function makeInstall({ fetchImpl, pin = pinWith(), probe = () => SUPPORTED, free = () => 10 ** 12, stopEngine = async () => {}, statuses = [] } = {}) {
  return createCudaInstall({
    enginesDir: path.join(tmp, 'engines'),
    pin,
    downloader: modelDownload.createDownloader({ allowedHosts: ['github.com'], busyMessage: 'busy', hostMessage: 'github only' }),
    probe,
    stopEngine,
    freeSpace: free,
    extract: unzipInto,
    downloadOptions: { fetchImpl, chunkSize: CHUNK },
    onStatus: (s) => statuses.push(s),
  });
}

const installDir = () => path.join(tmp, 'engines', `llama-server-cuda-${TAG}`);
const until = async (check) => {
  for (let i = 0; i < 400 && !check(); i++) await new Promise((r) => setTimeout(r, 5));
  expect(check()).toBe(true);
};

beforeEach(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cuda-install-')); });
afterEach(async () => {
  for (const s of servers.splice(0)) { s.closeAllConnections(); await new Promise((r) => s.close(r)); }
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe('CUDA install', () => {
  it('downloads both assets, unpacks them with a marker, and reads installed', async () => {
    const { fetchImpl } = await zipServer();
    const statuses = [];
    const cuda = makeInstall({ fetchImpl, statuses });
    expect((await cuda.status()).state).toBe('not-installed');

    const done = await cuda.install();
    expect(done).toMatchObject({ state: 'installed', tag: TAG, nvidia: true });
    expect(fs.readdirSync(installDir()).sort()).toEqual(['cublas64_13.dll', 'cuda-install.json', 'ggml-cuda.dll', 'llama-server.exe']);
    expect(fs.readFileSync(path.join(installDir(), 'ggml-cuda.dll'))).toEqual(Buffer.from(noise(2000, 2)));
    expect(fs.existsSync(path.join(tmp, 'engines', 'staging', TAG))).toBe(false);

    const total = NAMES.reduce((n, k) => n + ZIPS[k].length, 0);
    const downloading = statuses.filter((s) => s.state === 'downloading');
    expect(downloading.length).toBeGreaterThan(2);
    expect(downloading.every((s) => s.total === total && s.received <= total)).toBe(true);
    expect(downloading.map((s) => s.phase)).toEqual(expect.arrayContaining(['download', 'verify', 'unpack']));
    expect(statuses.at(-1).state).toBe('installed');
  });

  it('Cancel keeps the partials, and the next install fetches only the missing ranges', async () => {
    const cudart = NAMES[1];
    const held = await zipServer({ holdName: cudart, holdFrom: CHUNK * 2 });
    const cuda = makeInstall({ fetchImpl: held.fetchImpl });
    const first = cuda.install();
    await until(() => held.state.held.length > 0);
    cuda.cancel();
    const after = await first;
    expect(after.state).toBe('not-installed');
    expect(after.error).toBeUndefined();
    expect(after.partialBytes).toBe(ZIPS[NAMES[0]].length + CHUNK * 2);
    held.release();

    const fresh = await zipServer();
    const resumed = makeInstall({ fetchImpl: fresh.fetchImpl });
    expect((await resumed.install()).state).toBe('installed');
    expect(fresh.state.requests.some((r) => r.name === NAMES[0])).toBe(false);
    expect(fresh.state.requests.filter((r) => r.name === cudart).every((r) => r.start >= CHUNK * 2)).toBe(true);
  });

  it('a digest mismatch installs nothing and deletes the partial', async () => {
    const tampered = { ...ZIPS, [NAMES[1]]: Buffer.from(ZIPS[NAMES[1]]).fill(7, 100, 110) };
    const { fetchImpl } = await zipServer({ files: tampered });
    const cuda = makeInstall({ fetchImpl });
    const result = await cuda.install();
    expect(result.state).toBe('not-installed');
    expect(result.error).toEqual({ kind: 'digest', asset: NAMES[1] });
    expect(fs.existsSync(installDir())).toBe(false);
    const staged = fs.readdirSync(path.join(tmp, 'engines', 'staging', TAG));
    expect(staged).toEqual([NAMES[0]]);
  });

  it('refuses to start without room for both zips plus the unpacked folder, and says how much', async () => {
    const { fetchImpl, state } = await zipServer();
    const pin = pinWith();
    const needed = pin.cuda.assets.reduce((n, a) => n + a.size + a.unpackedSize, 0);
    const cuda = makeInstall({ fetchImpl, pin, free: () => needed - 1 });
    const result = await cuda.install();
    expect(result.error).toEqual({ kind: 'no-space', neededBytes: needed, freeBytes: needed - 1 });
    expect(state.requests).toEqual([]);

    const roomy = makeInstall({ fetchImpl, pin, free: () => needed });
    expect((await roomy.install()).state).toBe('installed');
  });

  it('reads unsupported with the support reason, and installs nothing', async () => {
    const { fetchImpl, state } = await zipServer();
    const verdict = { supported: false, reason: 'driver-too-old', driverFloor: 580, cardName: 'NVIDIA GeForce RTX 3060' };
    const cuda = makeInstall({ fetchImpl, probe: () => ({ nvidia: true, support: verdict }) });
    expect(await cuda.install()).toMatchObject({ state: 'unsupported', support: verdict });
    expect(state.requests).toEqual([]);
  });

  it('reads stale for an older tag\'s folder', async () => {
    const old = path.join(tmp, 'engines', 'llama-server-cuda-b7');
    fs.mkdirSync(old, { recursive: true });
    fs.writeFileSync(path.join(old, 'cuda-install.json'), JSON.stringify({ tag: 'b7', digests: [] }));
    const { fetchImpl } = await zipServer();
    expect(await makeInstall({ fetchImpl }).status()).toMatchObject({ state: 'stale', tag: 'b7' });
  });

  it('a folder whose marker digests differ from the pin is not installed', async () => {
    const { fetchImpl } = await zipServer();
    await makeInstall({ fetchImpl }).install();
    const other = pinWith({ [NAMES[0]]: { digest: `sha256:${'0'.repeat(64)}` } });
    expect((await makeInstall({ fetchImpl, pin: other }).status()).state).toBe('not-installed');
  });

  it('Remove stops the engine before it deletes the folder', async () => {
    const { fetchImpl } = await zipServer();
    const order = [];
    const cuda = makeInstall({
      fetchImpl,
      stopEngine: async () => { order.push(fs.existsSync(installDir()) ? 'stop with folder' : 'stop without folder'); },
    });
    await cuda.install();
    const result = await cuda.remove();
    expect(order).toEqual(['stop with folder']);
    expect(result.state).toBe('not-installed');
    expect(fs.existsSync(installDir())).toBe(false);
  });

  it('a Cancel that lands between the two assets stops before the second one starts', async () => {
    // A downloader that finishes the first asset and then sees Cancel, when no download is left to abort.
    const started = [];
    let cuda;
    const downloader = {
      download: async ({ fileName, destDir }) => {
        started.push(fileName);
        fs.writeFileSync(path.join(destDir, fileName), ZIPS[fileName]);
        cuda.cancel();
        return path.join(destDir, fileName);
      },
      cancel: () => {},
    };
    cuda = createCudaInstall({
      enginesDir: path.join(tmp, 'engines'), pin: pinWith(), downloader, probe: () => SUPPORTED,
      stopEngine: async () => {}, freeSpace: () => 10 ** 12, extract: unzipInto,
    });
    const after = await cuda.install();
    expect(after.state).toBe('not-installed');
    expect(after.error).toBeUndefined();
    expect(started).toEqual([NAMES[0]]);
  });

  it('an install asked for during a removal joins it rather than racing the delete', async () => {
    const { fetchImpl, state } = await zipServer();
    let release;
    const cuda = makeInstall({ fetchImpl, stopEngine: () => new Promise((r) => { release = r; }) });
    await cuda.install();
    const before = state.requests.length;
    const removal = cuda.remove();
    await until(() => typeof release === 'function');
    const joined = cuda.install();
    await new Promise((r) => setTimeout(r, 20)); // the joined call settles while the engine is still stopping
    release();
    expect((await joined).state).toBe('not-installed');
    expect((await removal).state).toBe('not-installed');
    expect(state.requests.length).toBe(before);
    expect(fs.existsSync(installDir())).toBe(false);
  });

  it('re-reads the machine facts on a refresh, so a driver update shows', async () => {
    const { fetchImpl } = await zipServer();
    let verdict = { supported: false, reason: 'driver-too-old', driverFloor: 580 };
    const cuda = makeInstall({ fetchImpl, probe: () => ({ nvidia: true, support: verdict }) });
    expect((await cuda.status()).state).toBe('unsupported');
    verdict = { supported: true };
    expect((await cuda.status()).state).toBe('unsupported');
    expect((await cuda.status({ refresh: true })).state).toBe('not-installed');
  });

  it('a model download running at the same time is untouched by the CUDA download and its Cancel', async () => {
    const model = noise(CHUNK * 4, 9);
    const modelSrv = await zipServer({ files: { 'm.gguf': Buffer.from(model) }, holdName: 'm.gguf', holdFrom: CHUNK });
    const modelDir = path.join(tmp, 'models');
    const modelJob = modelDownload.download({
      url: 'https://huggingface.co/o/r/resolve/main/m.gguf', fileName: 'm.gguf', destDir: modelDir,
      fetchImpl: modelSrv.fetchImpl, chunkSize: CHUNK,
    }, () => {});
    await until(() => modelSrv.state.held.length > 0);

    const held = await zipServer({ holdName: NAMES[1], holdFrom: CHUNK });
    const cuda = makeInstall({ fetchImpl: held.fetchImpl });
    const job = cuda.install();
    await until(() => held.state.held.length > 0);
    cuda.cancel();
    expect((await job).state).toBe('not-installed');
    held.release();

    modelSrv.release();
    await expect(modelJob).resolves.toBe(path.join(modelDir, 'm.gguf'));
    expect(fs.readFileSync(path.join(modelDir, 'm.gguf'))).toEqual(Buffer.from(model));
  });
});
