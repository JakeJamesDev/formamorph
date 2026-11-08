import { describe, it, expect, afterEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, readdir, readlink, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { zipSync } from 'fflate';
import { BUILDS, CUDA_ASSETS, bumpPin, cudaAssetsOf, fetchLlamaServer, listAssets, platformsFromArgs, readPin, verifyCudaPin, zipUnpackedSize } from './fetchLlamaServer.mjs';

// The asset names of the pinned tag's real release, recorded with the API. A pin bump re-records this file.
const recorded = async () => JSON.parse(await readFile(path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'llamaServerAssets.b12078.json'), 'utf8'));

const json = (status, body) => new Response(JSON.stringify(body), { status });

describe('asset-name mapping', () => {
  it('pins the tag the recorded asset list was taken from', async () => {
    expect(await readPin()).toBe('b12078');
  });

  it('maps every desktop build to an asset the pinned release has', async () => {
    const names = await recorded();
    const tag = await readPin();
    for (const build of BUILDS) expect(names, build.id).toContain(build.asset(tag));
  });

  it('covers Windows, macOS on both architectures, and Linux Vulkan plus CPU', () => {
    expect(BUILDS.map((b) => b.id)).toEqual(['win-x64-vulkan', 'mac-arm64', 'mac-x64', 'linux-x64-vulkan', 'linux-x64-cpu']);
  });

  it('never maps a CUDA build', () => {
    for (const build of BUILDS) expect(build.asset('b1')).not.toMatch(/cuda/i);
  });
});

describe('platformsFromArgs', () => {
  it('defaults to the host platform, so Windows never unpacks the macOS symlinks', () => {
    expect(platformsFromArgs([], 'win32')).toEqual(['win']);
    expect(platformsFromArgs([], 'darwin')).toEqual(['mac']);
    expect(platformsFromArgs([], 'linux')).toEqual(['linux']);
  });

  it('fetches every platform with --all and one with --platform', () => {
    expect(platformsFromArgs(['--all'], 'win32')).toBeUndefined();
    expect(platformsFromArgs(['--platform', 'mac'], 'win32')).toEqual(['mac']);
  });

  it('refuses a host with no build', () => {
    expect(() => platformsFromArgs([], 'freebsd')).toThrow(/--all/);
  });
});

describe('fetchLlamaServer', () => {
  const dirs = [];
  const tmp = async (prefix) => { const d = await mkdtemp(path.join(os.tmpdir(), prefix)); dirs.push(d); return d; };
  afterEach(async () => { for (const d of dirs.splice(0)) await rm(d, { recursive: true, force: true }); });

  it('refuses an unknown tag with a clear error and downloads nothing', async () => {
    const dest = await tmp('llama-test-');
    const calls = [];
    const fetchImpl = async (url) => { calls.push(url); return json(404, { message: 'Not Found' }); };
    await expect(fetchLlamaServer({ tag: 'b0', dest, fetchImpl })).rejects.toThrow(/no release tagged "b0"/);
    expect(calls).toHaveLength(1);
    expect(await readdir(dest)).toEqual([]);
  });

  it('refuses a release that lacks a mapped asset and names it', async () => {
    const dest = await tmp('llama-test-');
    const fetchImpl = async () => json(200, { assets: [] });
    await expect(fetchLlamaServer({ tag: 'b1', platforms: ['win'], dest, fetchImpl })).rejects.toThrow(/llama-b1-bin-win-vulkan-x64\.zip/);
  });

  it('downloads once, then nothing on a second run with the same tag', async () => {
    const dest = await tmp('llama-test-');
    const src = await tmp('llama-src-');
    // A release tarball nests its files under one folder.
    await mkdir(path.join(src, 'llama-b1'));
    await writeFile(path.join(src, 'llama-b1', 'llama-server'), 'binary');
    spawnSync('tar', ['-czf', 'asset.tar.gz', 'llama-b1'], { cwd: src });
    const bytes = await readFile(path.join(src, 'asset.tar.gz'));
    const assets = BUILDS.filter((b) => b.platform === 'mac').map((b) => ({ name: b.asset('b1'), browser_download_url: `https://x/${b.id}` }));
    const downloads = [];
    const fetchImpl = async (url) => {
      if (url.includes('api.github.com')) return json(200, { assets });
      downloads.push(url);
      return new Response(bytes);
    };

    expect(await fetchLlamaServer({ tag: 'b1', platforms: ['mac'], dest, fetchImpl })).toEqual(['mac-arm64', 'mac-x64']);
    expect(downloads).toHaveLength(2);
    expect(await readFile(path.join(dest, 'mac-arm64', 'llama-server'), 'utf8')).toBe('binary');

    const calls = [];
    const offline = async (url) => { calls.push(url); throw new Error('network used'); };
    expect(await fetchLlamaServer({ tag: 'b1', platforms: ['mac'], dest, fetchImpl: offline })).toEqual([]);
    expect(calls).toEqual([]);
  });

  // Windows cannot create the fixture's symlink without Developer Mode; CI runs this on Linux.
  it.skipIf(process.platform === 'win32')('keeps the library symlinks relative, so they resolve after the work dir is gone', async () => {
    const dest = await tmp('llama-test-');
    const src = await tmp('llama-src-');
    await mkdir(path.join(src, 'llama-b1'));
    await writeFile(path.join(src, 'llama-b1', 'libx.so.0.8.0'), 'library');
    await symlink('libx.so.0.8.0', path.join(src, 'llama-b1', 'libx.so.0'));
    spawnSync('tar', ['-czf', 'asset.tar.gz', 'llama-b1'], { cwd: src });
    const bytes = await readFile(path.join(src, 'asset.tar.gz'));
    const assets = BUILDS.filter((b) => b.platform === 'linux').map((b) => ({ name: b.asset('b1'), browser_download_url: `https://x/${b.id}` }));
    const fetchImpl = async (url) => (url.includes('api.github.com') ? json(200, { assets }) : new Response(bytes));

    expect(await fetchLlamaServer({ tag: 'b1', platforms: ['linux'], dest, fetchImpl })).toEqual(['linux-x64-vulkan', 'linux-x64-cpu']);
    for (const id of ['linux-x64-vulkan', 'linux-x64-cpu']) {
      expect(await readlink(path.join(dest, id, 'libx.so.0'))).toBe('libx.so.0.8.0');
      expect(await readFile(path.join(dest, id, 'libx.so.0'), 'utf8')).toBe('library');
    }
  });

  it('asks the release again when the folder holds another tag', async () => {
    const dest = await tmp('llama-test-');
    await mkdir(path.join(dest, 'win-x64-vulkan'));
    await writeFile(path.join(dest, 'win-x64-vulkan', '.asset'), 'llama-b1-bin-win-vulkan-x64.zip\n');
    const calls = [];
    const fetchImpl = async (url) => { calls.push(url); return json(404, {}); };
    await expect(fetchLlamaServer({ tag: 'b2', platforms: ['win'], dest, fetchImpl })).rejects.toThrow(/"b2"/);
    expect(calls).toHaveLength(1);
  });

  it('lists asset names with their download URLs', async () => {
    const fetchImpl = async () => json(200, { assets: [{ name: 'a.zip', browser_download_url: 'https://x/a.zip' }] });
    expect((await listAssets('b1', fetchImpl)).get('a.zip')).toBe('https://x/a.zip');
  });
});

describe('CUDA pin', () => {
  const dirs = [];
  const tmp = async (prefix) => { const d = await mkdtemp(path.join(os.tmpdir(), prefix)); dirs.push(d); return d; };
  afterEach(async () => { for (const d of dirs.splice(0)) await rm(d, { recursive: true, force: true }); });

  const HEX_A = 'a'.repeat(64);
  const HEX_B = 'b'.repeat(64);
  // Two real zips: entry sizes 3 + 5 and 7, so the unpacked sizes are 8 and 7.
  const ZIPS = [
    Buffer.from(zipSync({ 'llama-server.exe': new Uint8Array(3), 'ggml-cuda.dll': new Uint8Array(5) })),
    Buffer.from(zipSync({ 'cublas64_13.dll': new Uint8Array(7) })),
  ];
  const UNPACKED = [8, 7];
  const ranged = (zip) => async (_url, init) => {
    const [start, end] = /bytes=(\d+)-(\d+)/.exec(init.headers.Range).slice(1).map(Number);
    return new Response(zip.subarray(start, end + 1), { status: 206 });
  };
  const release = (tag, { digests = [HEX_A, HEX_B], sizes = ZIPS.map((z) => z.length), skip = [] } = {}) => ({
    assets: CUDA_ASSETS.map((c, i) => ({ name: c.asset(tag), digest: `sha256:${digests[i]}`, size: sizes[i], browser_download_url: `https://x/${c.id}` })).filter((a) => !skip.includes(a.name)),
  });
  /** The release API at its own URL, and each asset's zip behind range requests at its download URL. */
  const serving = (body) => async (url, init) => {
    const i = CUDA_ASSETS.findIndex((c) => url === `https://x/${c.id}`);
    return i < 0 ? json(200, body) : ranged(ZIPS[i])(url, init);
  };
  const pinOf = (tag, digests = [HEX_A, HEX_B]) => ({
    tag,
    cuda: { assets: CUDA_ASSETS.map((c, i) => ({ name: c.asset(tag), digest: `sha256:${digests[i]}`, size: ZIPS[i].length, unpackedSize: UNPACKED[i] })) },
  });

  it('names only the two win-x64 CUDA 13.4 assets, the cudart one without a tag', () => {
    expect(CUDA_ASSETS.map((c) => c.asset('b9'))).toEqual(['llama-b9-bin-win-cuda-13.4-x64.zip', 'cudart-llama-bin-win-cuda-13.4-x64.zip']);
  });

  it('commits a pin whose CUDA assets the recorded release has', async () => {
    const pin = JSON.parse(await readFile(path.join(path.dirname(fileURLToPath(import.meta.url)), 'llamaServerPin.json'), 'utf8'));
    const names = await recorded();
    expect(pin.cuda.assets.map((a) => a.name)).toEqual(CUDA_ASSETS.map((c) => c.asset(pin.tag)));
    for (const a of pin.cuda.assets) {
      expect(names).toContain(a.name);
      expect(a.digest).toMatch(/^sha256:[0-9a-f]{64}$/);
      expect(a.size).toBeGreaterThan(0);
      expect(a.unpackedSize).toBeGreaterThan(a.size);
    }
  });

  it('bump writes the tag with both asset names, digests, sizes and unpacked sizes', async () => {
    const file = path.join(await tmp('pin-'), 'pin.json');
    await bumpPin('b9', { fetchImpl: serving(release('b9')), file });
    expect(JSON.parse(await readFile(file, 'utf8'))).toEqual(pinOf('b9'));
  });

  it.each([0, 1])('bump refuses a release that lacks CUDA asset %i and leaves the pin alone', async (i) => {
    const file = path.join(await tmp('pin-'), 'pin.json');
    await writeFile(file, 'old');
    const skip = [CUDA_ASSETS[i].asset('b9')];
    await expect(bumpPin('b9', { fetchImpl: serving(release('b9', { skip })), file })).rejects.toThrow(/lacks CUDA assets/);
    expect(await readFile(file, 'utf8')).toBe('old');
  });

  it('bump refuses an asset the API lists without a digest', async () => {
    const body = release('b9');
    delete body.assets[1].digest;
    await expect(cudaAssetsOf('b9', serving(body))).rejects.toThrow(/digest/);
  });

  it('the gate passes when the release matches the pin', async () => {
    await expect(verifyCudaPin({ pin: pinOf('b9'), fetchImpl: serving(release('b9')) })).resolves.toBeUndefined();
  });

  it('the gate fails when the pinned release lacks a CUDA asset', async () => {
    const skip = [CUDA_ASSETS[1].asset('b9')];
    await expect(verifyCudaPin({ pin: pinOf('b9'), fetchImpl: serving(release('b9', { skip })) })).rejects.toThrow(/lacks CUDA assets: cudart-llama-bin-win-cuda-13\.4-x64\.zip/);
  });

  it('the gate fails when a digest differs from the pin', async () => {
    const changed = release('b9', { digests: [HEX_A, 'c'.repeat(64)] });
    await expect(verifyCudaPin({ pin: pinOf('b9'), fetchImpl: serving(changed) })).rejects.toThrow(/cudart-llama-bin-win-cuda-13\.4-x64\.zip has digest sha256:c+/);
  });

  it('the gate fails when a size differs from the pin', async () => {
    const changed = release('b9', { sizes: [ZIPS[0].length, ZIPS[1].length + 1] });
    await expect(verifyCudaPin({ pin: pinOf('b9'), fetchImpl: serving(changed) })).rejects.toThrow(/cudart-llama-bin-win-cuda-13\.4-x64\.zip has size/);
  });

  it('the gate fails for a pin with no unpacked size', async () => {
    const pin = pinOf('b9');
    delete pin.cuda.assets[0].unpackedSize;
    await expect(verifyCudaPin({ pin, fetchImpl: serving(release('b9')) })).rejects.toThrow(/no unpacked size/);
  });

  it('reads a zip\'s unpacked size past a trailing comment', async () => {
    const zip = Buffer.from(zipSync({ a: new Uint8Array(11) }, { comment: 'x'.repeat(300) }));
    expect(await zipUnpackedSize('https://x/a', zip.length, ranged(zip))).toBe(11);
  });

  it('the gate fails for a pin with no CUDA assets', async () => {
    await expect(verifyCudaPin({ pin: { tag: 'b9' }, fetchImpl: serving(release('b9')) })).rejects.toThrow(/llama-server:bump/);
  });
});
