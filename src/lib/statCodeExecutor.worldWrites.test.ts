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

const places: NonNullable<StatCodeRunOptions['places']> = {
  locations: [{ id: 'loc-inn', name: 'Inn' }, { id: 'loc-gate', name: 'North Gate' }],
  location: { id: 'loc-inn', name: 'Inn' },
};

const run = (code: string, over: Partial<StatCodeRunOptions> = {}) => executeStatCode(code, [health], null, { places, ...over });

describe('executeStatCode world writes', () => {
  beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}));
  afterEach(() => vi.restoreAllMocks());

  it('reads where the turn stands', async () => {
    const res = await executeStatCode('return location.name === "Inn" && location.id === "loc-inn" ? 1 : 0;', [health], health, { places });
    expect(res.value).toBe(1);
  });

  it('moves the location by name or by id, the later move winning', async () => {
    expect((await run('location.move("North Gate");')).worldWrites).toEqual({ location: 'loc-gate' });
    expect((await run('location.move("loc-gate"); location.move("Inn");')).worldWrites).toEqual({ location: 'loc-inn' });
  });

  it('adds up the clock advances, in minutes', async () => {
    expect((await run('clock.advance(30); clock.advance(15);')).worldWrites).toEqual({ minutes: 45 });
  });

  it('keeps the clock reading as the run started after an advance', async () => {
    const res = await executeStatCode('const before = clock.elapsedHours; clock.advance(120); return clock.elapsedHours - before;', [health], health, {
      places, clock: { deltaHours: 1, elapsedHours: 5 },
    });
    expect(res.value).toBe(0);
  });

  it('keeps hour and minute at the run-start reading after an advance', async () => {
    const res = await executeStatCode(
      'const h = clock.hour * 60 + clock.minute; clock.advance(120); return (clock.hour * 60 + clock.minute) - h;',
      [health], health, { places, clock: { deltaHours: 1, elapsedHours: 5 } },
    );
    expect(res.value).toBe(0);
  });

  it('discovers each name once, in first-call order, a description filling in a bare call', async () => {
    const res = await run('discover(" Tor "); discover("Mira", "The innkeeper."); discover("Tor", " A smith. "); discover("Mira");');
    expect(res.worldWrites).toEqual({ discover: [{ name: 'Tor', description: 'A smith.' }, { name: 'Mira', description: 'The innkeeper.' }] });
  });

  it('discovers a name no world entity holds, since discover creates', async () => {
    expect((await run('discover("Stranger");')).worldWrites).toEqual({ discover: [{ name: 'Stranger' }] });
  });

  it('writes nothing of the world when the code calls nothing', async () => {
    expect((await run('return;')).worldWrites).toBeUndefined();
  });

  it.each([
    ['an unknown location', 'location.move("Moon");', /Moon/],
    ['a blank discover name', 'discover("  ");', /discover needs a name/],
    ['a blank discover description', 'discover("Tor", "");', /discover needs a description/],
    ['a negative advance', 'clock.advance(-5);', /clock\.advance/],
    ['a non-finite advance', 'clock.advance(Infinity);', /clock\.advance/],
  ])('fails the script on %s and drops its other writes', async (_case, code, message) => {
    const res = await executeStatCode(`stats.Health.value = 50; location.move("Inn"); ${code}`, [health], null, { places });
    expect(res.error).toMatch(message);
    expect(res.statWrites).toBeUndefined();
    expect(res.worldWrites).toBeUndefined();
  });

  it('fails the script on an unknown name even when the code catches the throw', async () => {
    const res = await run('try { location.move("Moon"); } catch (e) {} clock.advance(10);');
    expect(res.error).toMatch(/Moon/);
    expect(res.worldWrites).toBeUndefined();
  });

  it('knows no location when the run names none', async () => {
    const res = await executeStatCode('location.move("Inn");', [health], null);
    expect(res.error).toMatch(/Inn/);
  });
});
