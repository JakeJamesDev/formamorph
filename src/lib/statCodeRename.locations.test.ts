/**
 * @vitest-environment node
 * (No DOM needed; node keeps the QuickJS WASM engine loading through its filesystem path.)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Entity, Script, Stat, Trait } from '@/types';
import { planCodeRename, codeRenameTarget } from './statCodeRename';
import { type StatCodeWorld } from './statCodeTestRun';
import { tryWorldToolScript } from '@/lib/tools/worldToolTry';
import { withToolCode } from '@/lib/tools/worldTools';
import { boxScripts } from '@/test/scriptFixtures';
import { scriptWorldTool } from '@/test/worldToolFixtures';

const stat = (id: string, code: string): Stat =>
  ({ id, name: id, type: 'number', value: 0, min: 0, max: 100, scripts: boxScripts({ after: code }) } as Stat);
const scripts: Script[] = [{ id: 'weather', timing: 'after', code: 'location.move("Inn");\nlocation.move(where);' }];
const rename = (over: Parameters<typeof planCodeRename>[0] extends infer I ? Partial<I> : never) => planCodeRename({
  root: 'locations', oldName: 'Inn', newName: 'Harbor Steps', stats: [], otherNames: [], ...over,
});

describe('a location rename in location.move', () => {
  it('rewrites the literal in a world script, a World Tool, a stat and a trait, each at its own home', () => {
    const trait: Trait = { id: 'brave', name: 'Brave', statChanges: [], scripts: [{ id: 'b1', timing: 'after', code: "location.move('Inn');" }] };
    const plan = rename({
      worldScripts: scripts, worldTools: [scriptWorldTool('t', 'travel', 'location.move("Inn");')],
      stats: [stat('a', 'location.move("Inn");')], traits: [trait],
    });
    expect(plan?.references).toBe(4);
    expect(plan?.edits).toEqual([
      { home: { kind: 'world' }, name: 'World', scripts: { weather: 'location.move("Harbor Steps");\nlocation.move(where);' } },
      { home: { kind: 'tool', toolId: 't' }, name: 'travel', scripts: { t: 'location.move("Harbor Steps");' } },
      { home: { kind: 'stat', statId: 'a' }, name: 'a', scripts: { after: 'location.move("Harbor Steps");' } },
      { home: { kind: 'trait', traitId: 'brave' }, name: 'Brave', scripts: { b1: "location.move('Harbor Steps');" } },
    ]);
  });

  it('rewrites an entity’s own stat in its own box', () => {
    const mara: Entity = { id: 'mara', name: 'Mara', stats: [stat('m', 'location.move("Inn");')] };
    const plan = rename({ entities: [mara] });
    expect(plan?.edits.map(({ home }) => home)).toEqual([{ kind: 'entity', entityId: 'mara', statId: 'm' }]);
  });

  it('keeps the author’s quote, and escapes it in the new name', () => {
    const plan = rename({ newName: `Tor's "Rest"`, worldScripts: [{ id: 'w', timing: 'after', code: `location.move('Inn'); location.move("Inn");` }] });
    expect(plan?.edits[0].scripts.w).toBe(String.raw`location.move('Tor\'s "Rest"'); location.move("Tor's \"Rest\"");`);
  });

  it('leaves a name that is not the renamed one, a computed name and a comparison alone', () => {
    const plan = rename({
      worldScripts: [{ id: 'w', timing: 'after', code: 'location.move("Moon"); location.move(where); if (location.name === "Inn") {}' }],
    });
    expect(plan).toBeNull();
  });

  it('offers nothing for a name another location already carries, or an unchanged name', () => {
    expect(rename({ worldScripts: scripts, otherNames: ['Harbor Steps'] })).toBeNull();
    expect(rename({ worldScripts: scripts, newName: 'Inn' })).toBeNull();
  });

  // Calls by a shared name reach the first location with it, so a rename of one of the two can't say which calls moved.
  it('offers nothing while another location still carries the old name', () => {
    expect(rename({ worldScripts: scripts, otherNames: ['Inn'] })).toBeNull();
  });

  it('reads a location’s find-and-replace target as a location rename', () => {
    expect(codeRenameTarget('location:loc-1', 'name')).toEqual({ root: 'locations' });
    expect(codeRenameTarget('location:loc-1', 'aiDescription')).toBeNull();
  });
});

describe('the rename keeps a World Tool moving', () => {
  beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}));
  afterEach(() => vi.restoreAllMocks());

  it('moves to the renamed place only once the code is rewritten', async () => {
    const world: StatCodeWorld = {
      stats: [], statGroups: [], traits: [], traitGroups: [], entities: [], entityGroups: [], placeholders: [], placeholderGroups: [],
      dictionaries: [], locations: [{ id: 'inn', name: 'Harbor Steps', isStarting: true }],
    };
    const tool = scriptWorldTool('t', 'travel', 'location.move("Inn");');
    const plan = rename({ worldTools: [tool] });
    const [moved] = withToolCode([tool], plan!.edits[0].scripts);

    expect((await tryWorldToolScript(moved, '{}', world)).writes).toEqual(['location.move: Harbor Steps']);
    // Left as it was, the Tool names a place that no longer exists.
    expect((await tryWorldToolScript(tool, '{}', world)).failure).toBe('script');
  });
});
