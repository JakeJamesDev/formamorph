/**
 * @vitest-environment node
 * (No DOM needed; node keeps the QuickJS WASM engine loading through its filesystem path.)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { executeStatCode, type StatCodeRunOptions } from './statCodeExecutor';
import type { Stat } from '@/types';

const health: Stat = {
  id: 'h', name: 'Health', type: 'number', description: '', min: 0, max: 100, value: 10, regen: 0, descriptors: [],
};

const narration = (over: Partial<NonNullable<StatCodeRunOptions['narration']>> = {}) => ({
  sentence: 'The door creaks.', full: 'Earlier. The door creaks. Wind', index: 1, sent: ['Earlier.'], buffered: [], ...over,
});

describe('executeStatCode in During AI Output', () => {
  beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}));
  afterEach(() => vi.restoreAllMocks());

  it('reads the sentence, the narration so far and the index', async () => {
    const res = await executeStatCode(
      'return JSON.stringify([narration.sentence, narration.full, narration.index]);',
      [health], health, { narration: narration() },
    );
    expect(res.sentence).toBe(JSON.stringify(['The door creaks.', 'Earlier. The door creaks. Wind', 1]));
  });

  it('takes the sentence from an assignment to narration.sentence', async () => {
    const res = await executeStatCode(
      "narration.sentence = narration.sentence.replace('door', '[door](https://example.test)');",
      [health], health, { narration: narration() },
    );
    expect(res).toMatchObject({ error: null, sentence: 'The [door](https://example.test) creaks.' });
  });

  it('takes the sentence from a returned string, on a stat script and on a world script', async () => {
    const code = 'return narration.sentence.toUpperCase();';
    expect((await executeStatCode(code, [health], health, { narration: narration() })).sentence).toBe('THE DOOR CREAKS.');
    expect((await executeStatCode(code, [health], null, { narration: narration() })).sentence).toBe('THE DOOR CREAKS.');
  });

  it('leaves the sentence as it came when the code does not touch it', async () => {
    const res = await executeStatCode('stats.Health.value += 1;', [health], health, { narration: narration() });
    expect(res.sentence).toBe('The door creaks.');
  });

  it('still writes stats from the same script', async () => {
    const res = await executeStatCode('stats.Health.value += 1;', [health], null, { narration: narration() });
    expect(res.statWrites).toEqual([{ id: 'h', name: 'Health', value: 11 }]);
  });

  it('fails a sentence that is not a string', async () => {
    const res = await executeStatCode('narration.sentence = 5;', [health], health, { narration: narration() });
    expect(res).toMatchObject({ value: null, kind: 'bad-write' });
    expect(res.error).toMatch(/narration\.sentence/);
  });

  it('reads the released sentences and the ones the reveal holds', async () => {
    const res = await executeStatCode(
      'return JSON.stringify([narration.sent, narration.buffered]);',
      [health], health, { narration: narration({ index: 3, sent: ['One.'], buffered: ['Two.', 'Three.'] }) },
    );
    expect(res.sentence).toBe(JSON.stringify([['One.'], ['Two.', 'Three.']]));
  });

  it('keeps sent and buffered read-only', async () => {
    const swap = await executeStatCode(
      "narration.sent = []; narration.buffered = ['x']; narration.sent[0] = 'y'; return narration.sent.join('|');",
      [health], health, { narration: narration() },
    );
    expect(swap.sentence).toBe('Earlier.');
    expect(swap.readOnlyWrites).toEqual(expect.arrayContaining(['narration.sent', 'narration.buffered']));
    const grow = await executeStatCode("narration.buffered.push('x');", [health], health, { narration: narration() });
    expect(grow.error).toMatch(/object is not extensible/);
  });

  it('drops writes to the read-only fields and reports them', async () => {
    const res = await executeStatCode('narration.index = 9; narration.full = "x";', [health], health, { narration: narration() });
    expect(res.error).toBeNull();
    expect(res.readOnlyWrites).toEqual(expect.arrayContaining(['narration.index', 'narration.full']));
    expect(res.sentence).toBe('The door creaks.');
  });

  it.each(['tell', 'toast', 'confirm', 'ask', 'input'])('fails a script that calls player.%s, naming the timing', async (call) => {
    const res = await executeStatCode(`player.${call}('Hello');`, [health], health, { narration: narration() });
    expect(res).toMatchObject({ value: null, kind: 'throw' });
    expect(res.error).toContain(`player.${call}`);
    expect(res.error).toContain('During AI Output');
  });

  it('has no narration outside the timing', async () => {
    const res = await executeStatCode('return narration.index;', [health], health);
    expect(res.kind).toBe('throw');
    expect(res.sentence).toBeUndefined();
  });

  it('drops every write of a script that fails after it wrote', async () => {
    const res = await executeStatCode(
      "stats.Health.value += 1; narration.sentence = 'changed'; throw new Error('late');",
      [health], null, { narration: narration() },
    );
    expect(res.kind).toBe('throw');
    expect(res.statWrites).toBeUndefined();
    expect(res.sentence).toBeUndefined();
  });
});
