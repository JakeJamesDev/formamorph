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
    expect((await run('memories.pin(" The bridge is out. "); memories.pin("Mira owes a debt.");')).worldWrites)
      .toEqual({ pins: ['The bridge is out.', 'Mira owes a debt.'] });
  });

  it('adds each turn line in call order, trimmed, apart from the pins', async () => {
    expect((await run('memories.add(" Tor lied. "); memories.pin("Kept."); memories.add("The gate fell.");')).worldWrites)
      .toEqual({ memory: ['Tor lied.', 'The gate fell.'], pins: ['Kept.'] });
  });

  it.each([
    ['a blank pin', 'memories.pin("  ");', /memories\.pin needs a line as text/],
    ['a pin that is not text', 'memories.pin(5);', /memories\.pin needs a line as text/],
    ['a blank turn line', 'memories.add("");', /memories\.add needs a line as text/],
  ])('fails the script on %s and drops its other writes', async (_case, code, message) => {
    const res = await executeStatCode(`stats.Health.value = 50; memories.pin("Kept."); ${code}`, [health], null);
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

    it('writes a line through an entity’s entry, in call order', async () => {
      expect((await diaryRun('entities.Tor.diary(" I saw the gate fall. "); entities["Mira"].diary("He lied to me."); entities.Tor.diary("I ran.");')).worldWrites)
        .toEqual({ diary: [{ entity: 'e-tor', line: 'I saw the gate fall.' }, { entity: 'e-mira', line: 'He lied to me.' }, { entity: 'e-tor', line: 'I ran.' }] });
    });

    it('writes a line through `owner` when an entity owns the script', async () => {
      const res = await executeStatCode('owner.diary("Mine.");', [health], null, { ...cast, owner: cast.entities![0] });
      expect(res.worldWrites).toEqual({ diary: [{ entity: 'e-tor', line: 'Mine.' }] });
    });

    it('finds an entry read by id, then by name, as the old call did', async () => {
      expect((await diaryRun('entities["e-mira"].diary("By id."); const key = "e-tor"; entities[key].diary("By key.");')).worldWrites)
        .toEqual({ diary: [{ entity: 'e-mira', line: 'By id.' }, { entity: 'e-tor', line: 'By key.' }] });
    });

    it('writes a line for an entity discovered in play', async () => {
      const res = await executeStatCode('entities.Wick.diary("I ran the message.");', [health], null, { ...cast, discovered: [{ id: 'd-wick', name: 'Wick' }] });
      expect(res.worldWrites).toEqual({ diary: [{ entity: 'd-wick', line: 'I ran the message.' }] });
    });

    it('keeps move and follow failing on an entry read by id', async () => {
      expect((await diaryRun('entities["e-tor"].follow();')).error).toMatch(/no entity named "e-tor"/);
    });

    it('has no top-level `diary`', async () => {
      expect((await diaryRun('diary("Tor", "Hello.");')).error).toMatch(/'diary' is not defined/);
    });

    it.each([
      ['an entity the game does not have', 'entities.Stranger.diary("Hello.");', /no entity named "Stranger"/],
      ['the persona by name', 'entities.Ash.diary("Hello.");', /no entity named "Ash"/],
      ['the persona', 'persona.diary("Hello.");', /The game has no entity named "Ash"/],
      ['the persona by id', 'entities["e-me"].diary("Hello.");', /no entity named "e-me"/],
      ['a blank line', 'entities.Tor.diary(" ");', /diary needs a line as text/],
      ['a blank line by id', 'entities["e-tor"].diary(" ");', /diary needs a line as text/],
    ])('fails the script on %s', async (_case, code, message) => {
      const res = await diaryRun(`memories.pin("Kept."); ${code}`);
      expect(res.error).toMatch(message);
      expect(res.worldWrites).toBeUndefined();
    });

    it('fails the script on a persona that is no entity', async () => {
      const res = await executeStatCode('persona.diary("Hello.");', [health], null, { ...cast, persona: { name: '', traits: [] } });
      expect(res.error).toMatch(/The persona has no diary/);
    });

    it('fails the script on an unknown entity even when the code catches the throw', async () => {
      const res = await diaryRun('try { entities.Stranger.diary("Hello."); } catch (e) {} memories.pin("Kept.");');
      expect(res.error).toMatch(/Stranger/);
    });

    it('lists an unknown name as a maybe in an open-cast run, and still checks the line', async () => {
      const open = (code: string) => executeStatCode(code, [health], null, { ...cast, openCast: true });
      const res = await open('entities.Stranger.diary("One."); entities.Stranger.diary("Two."); entities.Tor.diary("I lied.");');
      expect(res).toMatchObject({ error: null, maybeDiary: ['Stranger'], worldWrites: { diary: [{ entity: 'e-tor', line: 'I lied.' }] } });
      expect((await open('entities.Stranger.diary("");')).error).toMatch(/diary needs a line as text/);
      expect((await open('persona.diary("Hi.");')).error).toMatch(/no entity named "Ash"/);
    });
  });

  it('keeps the memories verbs read-only', async () => {
    const res = await executeStatCode('memories.pin = null; return typeof memories.pin === "function" ? 1 : 0;', [health], health);
    expect(res.value).toBe(1);
    expect(res.readOnlyWrites).toEqual(['memories.pin']);
  });
});
