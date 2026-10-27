import { describe, it, expect, afterEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BUILDS, fetchLlamaServer, listAssets, platformsFromArgs, readPin } from './fetchLlamaServer.mjs';

// The asset names of the pinned tag's real release, recorded with the API. A pin bump re-records this file.
const recorded = async () => JSON.parse(await readFile(path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'llamaServerAssets.b11927.json'), 'utf8'));

const json = (status, body) => new Response(JSON.stringify(body), { status });

describe('asset-name mapping', () => {
  it('pins the tag the recorded asset list was taken from', async () => {
    expect(await readPin()).toBe('b11927');
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
