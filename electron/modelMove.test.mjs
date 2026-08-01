import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import modelMove from './modelMove.cjs';

const { moveModels, cancel, countMovable, listMovable, isMovable, TEMP_SUFFIX } = modelMove;

// Real files on disk. The whole point of this module is the ORDER of copy/fsync/unlink against a real
// filesystem, which a mocked fs would assert nothing about.
let tmp;
const from = () => path.join(tmp, 'old');
const to = () => path.join(tmp, 'new');

function write(file, bytes) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, Buffer.alloc(bytes, 7));
}

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fm-modelmove-'));
  fs.mkdirSync(from(), { recursive: true });
  fs.mkdirSync(to(), { recursive: true });
});
afterEach(() => {
  vi.restoreAllMocks();
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe('isMovable / listMovable: what comes along', () => {
  it('takes models and resumable partials, leaves everything else', () => {
    expect(isMovable('a.gguf')).toBe(true);
    expect(isMovable('A.GGUF')).toBe(true);
    expect(isMovable('a.gguf.part')).toBe(true);
    expect(isMovable('notes.txt')).toBe(false);
    expect(isMovable('a.gguf.moving')).toBe(false);
  });

  it('counts files and bytes for the prompt', () => {
    write(path.join(from(), 'a.gguf'), 100);
    write(path.join(from(), 'b.gguf.part'), 50);
    write(path.join(from(), 'readme.txt'), 999);
    expect(countMovable(from())).toEqual({ count: 2, bytes: 150 });
  });

  it('reports nothing for a folder that isn\'t there', () => {
    expect(countMovable(path.join(tmp, 'gone'))).toEqual({ count: 0, bytes: 0 });
  });
});

describe('moveModels: the happy path', () => {
  it('moves models and partials, and leaves other files behind', async () => {
    write(path.join(from(), 'a.gguf'), 100);
    write(path.join(from(), 'b.gguf.part'), 50);
    write(path.join(from(), 'notes.txt'), 10);

    const res = await moveModels({ from: from(), to: to() });

    expect(res.moved.sort()).toEqual(['a.gguf', 'b.gguf.part']);
    expect(res.skipped).toEqual([]);
    expect(fs.existsSync(path.join(to(), 'a.gguf'))).toBe(true);
    expect(fs.existsSync(path.join(from(), 'a.gguf'))).toBe(false);
    expect(fs.existsSync(path.join(from(), 'notes.txt'))).toBe(true);
  });

  it('preserves file contents exactly', async () => {
    const body = Buffer.from('gguf-bytes-here');
    fs.writeFileSync(path.join(from(), 'a.gguf'), body);
    await moveModels({ from: from(), to: to() });
    expect(fs.readFileSync(path.join(to(), 'a.gguf'))).toEqual(body);
  });

  it('reports progress that reaches the batch total', async () => {
    write(path.join(from(), 'a.gguf'), 100);
    write(path.join(from(), 'b.gguf'), 200);
    const seen = [];
    const res = await moveModels({ from: from(), to: to() }, (p) => seen.push(p));
    expect(res.moved).toHaveLength(2);
    expect(seen.at(-1)).toMatchObject({ movedBytes: 300, totalBytes: 300 });
  });

  it('does nothing when the folders are the same', async () => {
    write(path.join(from(), 'a.gguf'), 10);
    const res = await moveModels({ from: from(), to: from() });
    expect(res).toEqual({ moved: [], skipped: [], canceled: false });
    expect(fs.existsSync(path.join(from(), 'a.gguf'))).toBe(true);
  });

  it('creates the destination folder when it does not exist yet', async () => {
    write(path.join(from(), 'a.gguf'), 10);
    const fresh = path.join(tmp, 'brand', 'new');
    const res = await moveModels({ from: from(), to: fresh });
    expect(res.moved).toEqual(['a.gguf']);
    expect(fs.existsSync(path.join(fresh, 'a.gguf'))).toBe(true);
  });
});

describe('moveModels: the source file survives anything going wrong', () => {
  // The rule this module exists to enforce. Every failure below must leave the original readable.
  it('keeps the source when the cross-volume copy fails partway', async () => {
    write(path.join(from(), 'a.gguf'), 500);
    const original = fs.readFileSync(path.join(from(), 'a.gguf'));

    // Force the EXDEV path, then break the write stream partway through it.
    vi.spyOn(fs, 'renameSync').mockImplementation(() => {
      const e = new Error('cross-device link not permitted');
      e.code = 'EXDEV';
      throw e;
    });
    const realCreate = fs.createWriteStream;
    vi.spyOn(fs, 'createWriteStream').mockImplementation((p, o) => {
      const s = realCreate(p, o);
      setTimeout(() => s.emit('error', new Error('ENOSPC: no space left on device')), 0);
      return s;
    });

    const res = await moveModels({ from: from(), to: to() });

    expect(res.moved).toEqual([]);
    expect(res.skipped).toHaveLength(1);
    expect(fs.readFileSync(path.join(from(), 'a.gguf'))).toEqual(original);
    expect(fs.existsSync(path.join(to(), 'a.gguf'))).toBe(false);
  });

  it('leaves no half-file wearing the real name after a failed copy', async () => {
    write(path.join(from(), 'a.gguf'), 500);
    vi.spyOn(fs, 'renameSync').mockImplementation(() => {
      const e = new Error('EXDEV');
      e.code = 'EXDEV';
      throw e;
    });
    const realCreate = fs.createWriteStream;
    vi.spyOn(fs, 'createWriteStream').mockImplementation((p, o) => {
      const s = realCreate(p, o);
      setTimeout(() => s.emit('error', new Error('boom')), 0);
      return s;
    });

    await moveModels({ from: from(), to: to() });

    // Neither the final name nor the temp is left lying around.
    expect(fs.readdirSync(to())).toEqual([]);
    expect(fs.readdirSync(to()).some((f) => f.endsWith(TEMP_SUFFIX))).toBe(false);
  });

  it('skips a file whose name is already taken in the destination, keeping both', async () => {
    write(path.join(from(), 'a.gguf'), 10);
    write(path.join(to(), 'a.gguf'), 20);

    const res = await moveModels({ from: from(), to: to() });

    expect(res.moved).toEqual([]);
    expect(res.skipped[0]).toMatchObject({ file: 'a.gguf' });
    expect(fs.statSync(path.join(from(), 'a.gguf')).size).toBe(10); // source untouched
    expect(fs.statSync(path.join(to(), 'a.gguf')).size).toBe(20); // destination not clobbered
  });

  it('carries on past a failure instead of abandoning the batch', async () => {
    write(path.join(from(), 'a.gguf'), 10);
    write(path.join(from(), 'b.gguf'), 10);
    write(path.join(to(), 'a.gguf'), 10); // collides, so a.gguf is skipped

    const res = await moveModels({ from: from(), to: to() });

    expect(res.skipped.map((s) => s.file)).toEqual(['a.gguf']);
    expect(res.moved).toEqual(['b.gguf']);
  });

  it('reports every file as skipped when the destination cannot be created', async () => {
    write(path.join(from(), 'a.gguf'), 10);
    vi.spyOn(fs, 'mkdirSync').mockImplementation(() => { throw new Error('EACCES: permission denied'); });

    const res = await moveModels({ from: from(), to: path.join(tmp, 'nope') });

    expect(res.moved).toEqual([]);
    expect(res.skipped.map((s) => s.file)).toEqual(['a.gguf']);
    expect(fs.existsSync(path.join(from(), 'a.gguf'))).toBe(true);
  });
});

describe('moveModels: cancel', () => {
  it('stops the batch and accounts for every file that stayed', async () => {
    write(path.join(from(), 'a.gguf'), 10);
    write(path.join(from(), 'b.gguf'), 10);
    write(path.join(from(), 'c.gguf'), 10);

    // Cancel as soon as the first file lands, so the rest are never attempted.
    const res = await moveModels({ from: from(), to: to() }, () => cancel());

    expect(res.canceled).toBe(true);
    expect(res.moved).toHaveLength(1);
    // Nothing is unaccounted for: the result names all three either way.
    expect(res.moved.length + res.skipped.length).toBe(3);
    expect(res.skipped.every((s) => s.reason === 'Canceled')).toBe(true);
    for (const s of res.skipped) expect(fs.existsSync(path.join(from(), s.file))).toBe(true);
  });

  it('starts fresh on the next run rather than staying canceled', async () => {
    write(path.join(from(), 'a.gguf'), 10);
    write(path.join(from(), 'b.gguf'), 10);
    await moveModels({ from: from(), to: to() }, () => cancel());

    const res = await moveModels({ from: from(), to: to() });
    expect(res.canceled).toBe(false);
    expect(fs.readdirSync(from())).toEqual([]);
  });
});
