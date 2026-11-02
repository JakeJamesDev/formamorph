/**
 * @vitest-environment node
 * (No DOM needed; node keeps the QuickJS WASM engine loading through its filesystem path.)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { executeStatCode, type SandboxEntity, type StatCodeRunOptions } from './statCodeExecutor';
import type { Stat } from '@/types';

const health: Stat = {
  id: 'h', name: 'Health', type: 'number', description: '', min: 0, max: 100, value: 10, regen: 0, descriptors: [],
};

const places: NonNullable<StatCodeRunOptions['places']> = {
  locations: [{ id: 'loc-tomb', name: 'Tomb' }, { id: 'loc-barrow', name: 'Barrow' }],
  location: { id: 'loc-tomb', name: 'Tomb' },
};

const wight: SandboxEntity = { id: 'e-wight', name: 'Wight', traits: [] };
const albus: SandboxEntity = { id: 'e-albus', name: 'Albus', traits: [] };
const hero: SandboxEntity = { id: 'e-hero', name: 'Hero', traits: [] };

const run = (code: string, over: Partial<StatCodeRunOptions> = {}) =>
  executeStatCode(code, [health], null, { places, entities: [wight, albus, hero], persona: hero, ...over });

describe('executeStatCode entity writes', () => {
  beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}));
  afterEach(() => vi.restoreAllMocks());

  it('moves an entity to a location found by id, then by name', async () => {
    const res = await run('entities.Wight.move("loc-barrow"); entities.Albus.move("Tomb");');
    expect(res.error).toBeNull();
    expect(res.worldWrites).toEqual({
      entities: [{ entity: 'e-wight', kind: 'move', location: 'loc-barrow' }, { entity: 'e-albus', kind: 'move', location: 'loc-tomb' }],
    });
  });

  it('prefers an id over a name another location holds', async () => {
    const swapped = { ...places, locations: [{ id: 'Barrow', name: 'Tomb' }, { id: 'loc-barrow', name: 'Barrow' }] };
    expect((await run('entities.Wight.move("Barrow");', { places: swapped })).worldWrites?.entities)
      .toEqual([{ entity: 'e-wight', kind: 'move', location: 'Barrow' }]);
  });

  it('records follow and unfollow in call order', async () => {
    const res = await run('entities.Albus.follow(); entities.Wight.unfollow(); entities.Albus.unfollow();');
    expect(res.worldWrites?.entities).toEqual([
      { entity: 'e-albus', kind: 'follow' }, { entity: 'e-wight', kind: 'unfollow' }, { entity: 'e-albus', kind: 'unfollow' },
    ]);
  });

  it('reaches the entity through owner', async () => {
    const res = await executeStatCode('owner.follow();', [health], null, { places, entities: [wight, hero], persona: hero, owner: wight });
    expect(res.worldWrites?.entities).toEqual([{ entity: 'e-wight', kind: 'follow' }]);
  });

  it.each([
    ['an unknown location', 'entities.Wight.move("Moon");', /The world has no location named "Moon"/],
    ['an unknown entity', 'entities.Nobody.follow();', /The game has no entity named "Nobody"/],
    ['the persona', 'persona.move("Barrow");', /The persona moves with the player/],
    ['the persona by name', 'entities.Hero.unfollow();', /The persona moves with the player/],
  ])('fails the script on %s and drops its other writes', async (_case, code, message) => {
    const res = await run(`stats.Health.value = 50; entities.Albus.follow(); ${code}`);
    expect(res.error).toMatch(message);
    expect(res.statWrites).toBeUndefined();
    expect(res.worldWrites).toBeUndefined();
  });

  it('fails the script on an unknown target even when the code catches the throw', async () => {
    const res = await run('try { entities.Wight.move("Moon"); } catch (e) {} entities.Albus.follow();');
    expect(res.error).toMatch(/Moon/);
    expect(res.worldWrites).toBeUndefined();
  });

  it('fails the script on the unnamed persona', async () => {
    const res = await executeStatCode('persona.follow();', [health], null, { places, entities: [wight], persona: { id: 'p', name: '', traits: [] } });
    expect(res.error).toMatch(/The persona moves with the player/);
  });

  describe('met and meet()', () => {
    const stranger: SandboxEntity = { ...albus, met: false };
    const known: SandboxEntity = { ...wight, met: true };
    const cast = { entities: [stranger, known, hero], persona: hero };
    const read = (code: string, over: Partial<StatCodeRunOptions> = cast) =>
      executeStatCode(code, [health], null, { places, ...over });
    // Packs booleans into Health, one bit per expression, so a run's reads come back through a stat write.
    const bits = (...exprs: string[]) => `stats.Health.value = ${exprs.map((e, i) => `(${e} ? ${1 << i} : 0)`).join(' + ')};`;
    const packed = (res: Awaited<ReturnType<typeof read>>) => (res.statWrites?.[0] as { value: number } | undefined)?.value;

    it('reads met per entity, true for the persona and false for a blank entry', async () => {
      const res = await read(bits('entities.Albus.met', 'entities.Wight.met', 'persona.met', 'entities.Nobody.met'));
      expect(res.error).toBeNull();
      expect(packed(res)).toBe(0b0110);
    });

    it('records meet and lets a later read in the same run see it', async () => {
      const res = await read(`const before = entities.Albus.met; entities.Albus.meet(); ${bits('before', 'entities.Albus.met', 'entities.Wight.met')}`);
      expect(res.error).toBeNull();
      expect(packed(res)).toBe(0b110);
      expect(res.worldWrites?.entities).toEqual([{ entity: 'e-albus', kind: 'meet' }]);
    });

    it('leaves another entity unmet when one is met', async () => {
      const other: SandboxEntity = { ...wight, met: false };
      const res = await read(`entities.Albus.meet(); ${bits('entities.Albus.met', 'entities.Wight.met')}`, { entities: [stranger, other, hero], persona: hero });
      expect(packed(res)).toBe(0b01);
    });

    it('reaches the entity through owner', async () => {
      const res = await read(`owner.meet(); ${bits('owner.met')}`, { entities: [stranger, hero], persona: hero, owner: stranger });
      expect(packed(res)).toBe(1);
      expect(res.worldWrites?.entities).toEqual([{ entity: 'e-albus', kind: 'meet' }]);
    });

    it('fails the script on an unknown entity', async () => {
      const res = await read('entities.Nobody.meet();');
      expect(res.error).toMatch(/The game has no entity named "Nobody"/);
    });

    it('does nothing when the persona meets, since the persona is always met', async () => {
      const res = await read(`persona.meet(); ${bits('persona.met')}`);
      expect(res.error).toBeNull();
      expect(packed(res)).toBe(1);
      expect(res.worldWrites).toBeUndefined();
    });
  });

  it('reports an assignment over a write as read-only', async () => {
    const res = await run('entities.Wight.move = 1;');
    expect(res.error).toBeNull();
    expect(res.readOnlyWrites).toEqual(['entities.Wight.move']);
  });
});
