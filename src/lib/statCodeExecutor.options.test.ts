/**
 * @vitest-environment node
 * (No DOM needed; node keeps the QuickJS WASM engine loading through its filesystem path.)
 */
import { describe, it, expect } from 'vitest';
import { executeStatCode } from './statCodeExecutor';
import type { WorldOption } from '@/types';

const LENGTH: WorldOption = {
  id: 'len', name: 'Reply Length', type: 'choice', shownToPlayer: true, midGame: false,
  values: [{ id: 'short', name: 'Short' }, { id: 'long', name: 'Long' }], default: 'short',
};
const LIT: WorldOption = { id: 'lit', name: 'Lit', type: 'boolean', shownToPlayer: false, midGame: false, default: false };
const HEAT: WorldOption = { id: 'heat', name: 'Heat', type: 'number', shownToPlayer: true, midGame: false, min: 0, max: 10, step: 2, default: 4 };
const worldOptions = [LENGTH, LIT, HEAT];

const run = (code: string, extra: Parameters<typeof executeStatCode>[3] = {}) =>
  executeStatCode(code, [], null, { worldOptions, ...extra });

describe('the options global', () => {
  it('reads each Option by name: a choice’s value name, a boolean, a number, defaults included', async () => {
    // A Tool run's reply carries the return value back as text.
    const reply = await run('return [options["Reply Length"], options.Lit, options.Heat].join("|");', { optionValues: { len: 'long' }, args: {} });
    expect(reply.error).toBeNull();
    expect(reply.reply).toBe('Long|false|4');
  });

  it('writes a choice by value name, a boolean, and a number snapped onto its step and bounds', async () => {
    const out = await run('options["Reply Length"] = "Long"; options.Lit = true; options.Heat = 7.4;');
    expect(out.error).toBeNull();
    expect(out.optionWrites).toEqual([{ id: 'len', value: 'long' }, { id: 'lit', value: true }, { id: 'heat', value: 8 }]);
    const high = await run('options.Heat = 99;');
    expect(high.optionWrites).toEqual([{ id: 'heat', value: 10 }]);
  });

  it('is no write when the value is left as read', async () => {
    const out = await run('options.Lit = false; options["Reply Length"] = "Short";');
    expect(out.optionWrites).toBeUndefined();
  });

  it('fails the run on a value the Option cannot hold', async () => {
    expect((await run('options["Reply Length"] = "Medium";')).kind).toBe('bad-write');
    expect((await run('options.Lit = 1;')).kind).toBe('bad-write');
    expect((await run('options.Heat = "hot";')).kind).toBe('bad-write');
    expect((await run('options["Reply Length"] = "Medium";')).error).toContain('options["Reply Length"] must be one of "Short", "Long"');
  });

  it('drops a write to a name no Option has and lists it', async () => {
    const out = await run('options.Missing = true;');
    expect(out.error).toBeNull();
    expect(out.optionWrites).toBeUndefined();
    expect(out.unknownOptions).toEqual(['options.Missing']);
  });

  it('takes no write in a read-only run and lists it as read-only', async () => {
    const out = await run('options.Lit = true;', { readOnly: true });
    expect(out.optionWrites).toBeUndefined();
    expect(out.readOnlyWrites).toEqual(['options.Lit']);
  });

  it('is empty in a world with no Options', async () => {
    const out = await executeStatCode('return Object.keys(options).length;', [], null, { args: {} });
    expect(out.reply).toBe('0');
  });
});
