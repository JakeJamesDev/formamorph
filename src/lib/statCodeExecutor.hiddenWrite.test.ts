/**
 * @vitest-environment node
 * (No DOM needed; node keeps the QuickJS WASM engine loading through its filesystem path.)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { executeStatCode, type SandboxEntity } from './statCodeExecutor';
import { runToolScript } from './tools/toolScript';
import { sampleToolSnapshot } from './tools/sampleToolSnapshot';
import type { Stat } from '@/types';

const makeStat = (over: Partial<Stat>): Stat => ({
  id: '1', name: 'Stat', type: 'number', description: '', min: 0, max: 100, value: 0, regen: 0, descriptors: [], ...over,
});

const rage = makeStat({ id: 'r', name: 'Rage', value: 10, hidden: true });
const luck = makeStat({ id: 'l', name: 'Luck', value: 5 });
const off = makeStat({ id: 'o', name: 'Off', value: 9, hidden: true });
const me = makeStat({ id: 'me', name: 'Dice' });
const trust = makeStat({ id: 't', name: 'Trust', value: 3, hidden: true });
const mira: SandboxEntity = { id: 'mira', name: 'Mira', traits: [], stats: { stats: [trust] } };
const stats = [rage, luck, off, me];

const run = (code: string, self: Stat = me) =>
  executeStatCode(code, stats, self, { enabled: { o: false }, entities: [mira], owner: mira });

describe('executeStatCode hidden writes (Q4, Q10)', () => {
  beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}));
  afterEach(() => vi.restoreAllMocks());

  it('reads each stat’s hidden, and previous.hidden as the turn start', async () => {
    const readings = { r: { previous: { ...rage, hidden: false } } };
    const read = await executeStatCode('return (stats.Rage.hidden ? 1 : 0) + (stats.Rage.previous.hidden ? 0 : 2) + (stats.Luck.hidden ? 4 : 0);',
      stats, me, { readings });
    expect(read.value).toBe(3);
  });

  it('hands back self.hidden as written, changed or not', async () => {
    expect(await run('self.hidden = true;')).toEqual({ value: null, error: null, hidden: true });
    expect(await run('self.hidden = false;')).toEqual({ value: null, error: null, hidden: false });
  });

  it('reads a hidden write back within the run', async () => {
    expect((await run('stats.Rage.hidden = false; self.hidden = true; return (stats.Rage.hidden ? 0 : 1) + (self.hidden ? 2 : 0);')).value).toBe(3);
  });

  it('keeps previous.hidden at the turn start after a write', async () => {
    expect((await run('stats.Rage.hidden = false; return stats.Rage.previous.hidden ? 1 : 0;')).value).toBe(1);
  });

  it('writes hidden on a global stat and on an entity stat, as a value write does', async () => {
    const out = await run('stats.Rage.hidden = false; entities.Mira.stats.Trust.hidden = false;');
    expect(out.statWrites).toEqual([{ id: 'r', name: 'Rage', hidden: false }]);
    expect(out.ownerStatWrites).toEqual([{ ownerId: 'mira', writes: [{ id: 't', name: 'Trust', hidden: false }] }]);
  });

  it('counts an assignment of the current hidden as a write', async () => {
    expect((await run('stats.Luck.hidden = false;')).statWrites).toEqual([{ id: 'l', name: 'Luck', hidden: false }]);
  });

  it('fails the run as a bad write on anything but a boolean, discarding every write', async () => {
    for (const code of ['self.hidden = 0;', 'stats.Rage.hidden = "no";', 'owner.stats.Trust.hidden = null;']) {
      const out = await run(`stats.Luck.value = 9; ${code}`);
      expect(out, code).toMatchObject({ value: null, kind: 'bad-write', error: expect.stringContaining('.hidden must be true or false') });
      expect(out.statWrites, code).toBeUndefined();
    }
  });

  it('drops and reports a write to an unknown name or a switched-off stat', async () => {
    expect(await run('stats.Nope.hidden = false; stats.Off.hidden = false;')).toEqual({
      value: null, error: null, unknownStatWrites: ['stats.Nope.hidden'], disabledStatWrites: ['stats.Off.hidden'],
    });
  });

  it('reads an unknown name as shown', async () => {
    expect((await run('return stats.Nope.hidden === false && stats.Nope.previous.hidden === false ? 1 : 0;')).value).toBe(1);
  });

  it('lists a hidden write as read-only in a user Tool', async () => {
    const out = await runToolScript('entities.Wren.stats.Patience.hidden = true;', {}, sampleToolSnapshot());
    expect(out).toEqual({ text: null, dropped: ['entities.Wren.stats.Patience.hidden'] });
  });
});
