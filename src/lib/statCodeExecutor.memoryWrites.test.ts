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

const run = (code: string) => executeStatCode(code, [health], null);

describe('executeStatCode memory writes', () => {
  beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}));
  afterEach(() => vi.restoreAllMocks());

  it('pins each line in call order, trimmed', async () => {
    expect((await run('memory.pin(" The bridge is out. "); memory.pin("Mira owes a debt.");')).worldWrites)
      .toEqual({ pins: ['The bridge is out.', 'Mira owes a debt.'] });
  });

  it('adds each turn line in call order, trimmed, apart from the pins', async () => {
    expect((await run('memory.add(" Tor lied. "); memory.pin("Kept."); memory.add("The gate fell.");')).worldWrites)
      .toEqual({ memory: ['Tor lied.', 'The gate fell.'], pins: ['Kept.'] });
  });

  it.each([
    ['a blank pin', 'memory.pin("  ");', /memory\.pin needs a line as text/],
    ['a pin that is not text', 'memory.pin(5);', /memory\.pin needs a line as text/],
    ['a blank turn line', 'memory.add("");', /memory\.add needs a line as text/],
  ])('fails the script on %s and drops its other writes', async (_case, code, message) => {
    const res = await executeStatCode(`stats.Health.value = 50; memory.pin("Kept."); ${code}`, [health], null);
    expect(res.error).toMatch(message);
    expect(res.statWrites).toBeUndefined();
    expect(res.worldWrites).toBeUndefined();
  });

  describe('diary', () => {
    const cast: StatCodeRunOptions = {
      entities: [{ id: 'e-tor', name: 'Tor', traits: [] }, { id: 'e-mira', name: 'Mira', traits: [] }, { id: 'e-me', name: 'Ash', traits: [] }],
      persona: { id: 'e-me', name: 'Ash', traits: [] },
    };
    const diaryRun = (code: string) => executeStatCode(code, [health], null, cast);

    it('writes a line for an entity found by name or by id, in call order', async () => {
      expect((await diaryRun('diary("Tor", " I saw the gate fall. "); diary("e-mira", "He lied to me."); diary("Tor", "I ran.");')).worldWrites)
        .toEqual({ diary: [{ entity: 'e-tor', line: 'I saw the gate fall.' }, { entity: 'e-mira', line: 'He lied to me.' }, { entity: 'e-tor', line: 'I ran.' }] });
    });

    it('writes a line for an entity discovered in play', async () => {
      const res = await executeStatCode('diary("Wick", "I ran the message.");', [health], null, { ...cast, discovered: [{ id: 'd-wick', name: 'Wick' }] });
      expect(res.worldWrites).toEqual({ diary: [{ entity: 'd-wick', line: 'I ran the message.' }] });
    });

    it.each([
      ['an entity the game does not have', 'diary("Stranger", "Hello.");', /no entity named "Stranger"/],
      ['the persona', 'diary("Ash", "Hello.");', /no entity named "Ash"/],
      ['a blank line', 'diary("Tor", " ");', /diary needs a line as text/],
    ])('fails the script on %s', async (_case, code, message) => {
      const res = await diaryRun(`memory.pin("Kept."); ${code}`);
      expect(res.error).toMatch(message);
      expect(res.worldWrites).toBeUndefined();
    });

    it('fails the script on an unknown entity even when the code catches the throw', async () => {
      const res = await diaryRun('try { diary("Stranger", "Hello."); } catch (e) {} memory.pin("Kept.");');
      expect(res.error).toMatch(/Stranger/);
    });
  });

  it('keeps memory read-only', async () => {
    const res = await executeStatCode('memory.pin = null; return typeof memory.pin === "function" ? 1 : 0;', [health], health);
    expect(res.value).toBe(1);
  });
});
