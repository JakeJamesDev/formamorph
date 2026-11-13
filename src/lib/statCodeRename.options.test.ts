/**
 * @vitest-environment node
 * (No DOM needed; node keeps the QuickJS WASM engine loading through its filesystem path.)
 */
import { describe, expect, it } from 'vitest';
import { planCodeRename } from './statCodeRename';
import { executeStatCode } from './statCodeExecutor';
import type { PlayerStat, Script, WorldOption } from '@/types';

const lit = (name: string): WorldOption => ({ id: 'lit', name, type: 'boolean', shownToPlayer: true, midGame: false, default: false });
const lighter: Script = { id: 'lighter', timing: 'after', code: 'options["Lanterns Lit"] = true; if (options.Other) {}' };
const reader: PlayerStat = {
  id: 'glow', name: 'Glow', type: 'number', description: '', min: 0, max: 10, value: 0, regen: 0, descriptors: [],
  scripts: [{ id: 'read', timing: 'after', code: 'return options["Lanterns Lit"] ? 1 : 0;' }],
};

describe('a World Option rename', () => {
  it('rewrites every script that names the Option, and nothing else', () => {
    const plan = planCodeRename({
      root: 'options', oldName: 'Lanterns Lit', newName: 'Lamps', stats: [reader], worldScripts: [lighter], otherNames: ['Other'],
    });
    expect(plan?.references).toBe(2);
    expect(plan?.edits).toEqual([
      { home: { kind: 'world' }, name: 'World', scripts: { lighter: 'options["Lamps"] = true; if (options.Other) {}' } },
      { home: { kind: 'stat', statId: 'glow' }, name: 'Glow', scripts: { read: 'return options["Lamps"] ? 1 : 0;' } },
    ]);
  });

  it('leaves the rewritten script writing the renamed Option', async () => {
    const plan = planCodeRename({ root: 'options', oldName: 'Lanterns Lit', newName: 'Lamps', stats: [], worldScripts: [lighter], otherNames: [] });
    const code = plan!.edits[0].scripts.lighter;
    const out = await executeStatCode(code, [], null, { worldOptions: [lit('Lamps')] });
    expect(out.optionWrites).toEqual([{ id: 'lit', value: true }]);
  });

  it('offers nothing for a name onto another Option’s', () => {
    expect(planCodeRename({ root: 'options', oldName: 'Lanterns Lit', newName: 'Other', stats: [], worldScripts: [lighter], otherNames: ['Other'] })).toBeNull();
  });
});
