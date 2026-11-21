/**
 * @vitest-environment node
 * (No DOM needed; node keeps the QuickJS WASM engine loading through its filesystem path.)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { executeStatCode, type SandboxWeather, type StatCodeRunOptions } from './statCodeExecutor';
import { withWorldWrites } from './chainedWorld';
import { mergeWorldWrites } from './worldWrites';
import type { SandboxState } from './statCodeTurn';
import type { Stat } from '@/types';

const health: Stat = {
  id: 'h', name: 'Health', type: 'number', description: '', min: 0, max: 100, value: 10, regen: 0, descriptors: [],
};

/** A world that allows Rain and Storm: Clear is always allowed, Snow and Bright Sun are not. */
const RAINY: SandboxWeather = { current: 'rain', allowed: ['clear', 'rain', 'storm'] };

const run = (code: string, weather: SandboxWeather | null = RAINY, over: Partial<StatCodeRunOptions> = {}) =>
  executeStatCode(code, [health], null, { ...(weather ? { weather } : {}), ...over });

describe('world.weather in a script', () => {
  beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}));
  afterEach(() => vi.restoreAllMocks());

  it('reads the World Weather', async () => {
    const res = await executeStatCode('return world.weather === "rain" ? 1 : 0;', [health], health, { weather: RAINY });
    expect(res.value).toBe(1);
    expect((await run('world.weather;')).worldWrites).toBeUndefined();
  });

  it.each(['clear', 'rain', 'storm'] as const)('sets the weather to %s as a world write', async (kind) => {
    const res = await run(`world.weather = "${kind}";`, { current: 'snow', allowed: ['clear', 'rain', 'storm'] });
    expect(res.error).toBeNull();
    expect(res.worldWrites).toEqual({ weather: kind });
  });

  it('sets each allowed kind a world can hold, Snow and Bright Sun included', async () => {
    const all: SandboxWeather = { current: 'clear', allowed: ['clear', 'rain', 'snow', 'storm', 'brightSun'] };
    for (const kind of ['snow', 'brightSun'] as const) {
      expect((await run(`world.weather = "${kind}";`, all)).worldWrites).toEqual({ weather: kind });
    }
  });

  it('reads the weather it set in the same run, and the last set wins', async () => {
    const res = await executeStatCode('world.weather = "storm"; world.weather = "clear"; return world.weather === "clear" ? 1 : 0;', [health], health, { weather: RAINY });
    expect(res.value).toBe(1);
    expect(res.worldWrites).toEqual({ weather: 'clear' });
  });

  it('stops with an error that names a kind outside the allowed list', async () => {
    const res = await run('world.weather = "snow";');
    expect(res.kind).toBe('throw');
    expect(res.error).toContain('"snow"');
    expect(res.worldWrites).toBeUndefined();
  });

  it('stops a script that catches the error too', async () => {
    const res = await run('try { world.weather = "snow"; } catch (e) {}');
    expect(res.error).toContain('"snow"');
  });

  it('stops with an error for a value that is no kind at all', async () => {
    expect((await run('world.weather = 3;')).error).toContain('3');
    expect((await run('world.weather = null;')).error).toContain('null');
  });

  it('stops with an error that names Weather while it is off, and reads null', async () => {
    const off = await run('world.weather = "rain";', null);
    expect(off.kind).toBe('throw');
    expect(off.error).toContain('Weather is off');
    const read = await executeStatCode('return world.weather === null ? 1 : 0;', [health], health, {});
    expect(read.value).toBe(1);
  });

  it('leaves the run options alone, so a run from the same state reads the weather as before', async () => {
    const options = { weather: RAINY };
    const first = await executeStatCode('world.weather = "storm";', [health], null, options);
    expect(first.worldWrites).toEqual({ weather: 'storm' });
    const again = await executeStatCode('return world.weather === "rain" ? 1 : 0;', [health], health, options);
    expect(again.value).toBe(1);
    expect(options.weather.current).toBe('rain');
  });

  it('lists a write from a read-only run instead of setting it', async () => {
    const res = await run('world.weather = "storm";', RAINY, { readOnly: true });
    expect(res.worldWrites).toBeUndefined();
  });
});

describe('weather writes across scripts', () => {
  it('lets a later script read what an earlier one set', () => {
    const state = { weather: RAINY } as SandboxState;
    const next = withWorldWrites(state, { weather: 'storm' });
    expect(next.weather?.current).toBe('storm');
    expect(state.weather?.current).toBe('rain');
  });

  it('keeps a world with Weather off without weather', () => {
    const state = {} as SandboxState;
    expect(withWorldWrites(state, { weather: 'storm' }).weather).toBeUndefined();
  });

  it('merges writes with the later weather winning', () => {
    expect(mergeWorldWrites({ weather: 'rain' }, { weather: 'storm' })).toEqual({ weather: 'storm' });
    expect(mergeWorldWrites({ weather: 'rain' }, { minutes: 5 })).toEqual({ weather: 'rain', minutes: 5 });
  });
});
