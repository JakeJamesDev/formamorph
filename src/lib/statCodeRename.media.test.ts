/**
 * @vitest-environment node
 * (No DOM needed; node keeps the QuickJS WASM engine loading through its filesystem path.)
 */
import { describe, expect, it } from 'vitest';
import type { Entity, Script, Stat, Trait } from '@/types';
import { planCodeRename } from './statCodeRename';
import { mediaNameKeys } from './codeRenameChains';
import { boxScripts } from '@/test/scriptFixtures';
import { scriptWorldTool } from '@/test/worldToolFixtures';

const stat = (id: string, code: string): Stat =>
  ({ id, name: id, type: 'number', value: 0, min: 0, max: 100, scripts: boxScripts({ after: code }) } as Stat);
const world = (code: string): Script[] => [{ id: 'w', timing: 'after', code }];
const rename = (over: Parameters<typeof planCodeRename>[0] extends infer I ? Partial<I> : never) => planCodeRename({
  root: 'media', oldName: 'Wounded', newName: 'Bleeding', stats: [], otherNames: [], noun: 'image', ...over,
});

describe('a Media Entry rename in scripts', () => {
  it('rewrites an assignment in a world script, a World Tool, a stat and a trait, each at its own home', () => {
    const trait: Trait = { id: 'brave', name: 'Brave', statChanges: [], scripts: [{ id: 'b1', timing: 'after', code: "persona.image = 'Wounded';" }] };
    const plan = rename({
      worldScripts: world('entities.Rex.image = "Wounded";\nlocation.ambience = "Rain";'),
      worldTools: [scriptWorldTool('t', 'show', 'world.music = "Wounded";')],
      stats: [stat('a', 'owner.sound = "Wounded";')], traits: [trait],
    });
    expect(plan?.references).toBe(4);
    expect(plan?.noun).toBe('image');
    expect(plan?.edits).toEqual([
      { home: { kind: 'world' }, name: 'World', scripts: { w: 'entities.Rex.image = "Bleeding";\nlocation.ambience = "Rain";' } },
      { home: { kind: 'tool', toolId: 't' }, name: 'show', scripts: { t: 'world.music = "Bleeding";' } },
      { home: { kind: 'stat', statId: 'a' }, name: 'a', scripts: { after: 'owner.sound = "Bleeding";' } },
      { home: { kind: 'trait', traitId: 'brave' }, name: 'Brave', scripts: { b1: "persona.image = 'Bleeding';" } },
    ]);
  });

  it('rewrites an entity’s own stat, and an instance entry’s image', () => {
    const mara: Entity = { id: 'mara', name: 'Mara', stats: [stat('m', 'entities.Guard.instances[0].image = "Wounded";')] };
    const plan = rename({ entities: [mara] });
    expect(plan?.edits.map(({ home }) => home)).toEqual([{ kind: 'entity', entityId: 'mara', statId: 'm' }]);
    expect(plan?.edits[0].scripts.after).toBe('entities.Guard.instances[0].image = "Bleeding";');
  });

  it('rewrites a comparison on either side, in both equality forms', () => {
    const code = 'if (persona.image === "Wounded" || "Wounded" == location.image || entities.Rex.sound !== "Wounded" || "Wounded" != world.music) {}';
    const plan = rename({ worldScripts: world(code) });
    expect(plan?.references).toBe(4);
    expect(plan?.edits[0].scripts.w).toBe(code.replaceAll('Wounded', 'Bleeding'));
  });

  it('keeps the author’s quote, and escapes it in the new name', () => {
    const plan = rename({ newName: `Tor's "Rest"`, worldScripts: world(`persona.image = 'Wounded'; owner.image = "Wounded";`) });
    expect(plan?.edits[0].scripts.w).toBe(String.raw`persona.image = 'Tor\'s "Rest"'; owner.image = "Tor's \"Rest\"";`);
  });

  // The guard the ticket names: a string that merely matches is not a media name.
  it('leaves a matching string outside a media assignment or comparison alone', () => {
    const plan = rename({
      worldScripts: world([
        'persona.name = "Wounded";',
        'const o = { image: "Wounded" }; o.image = "Wounded";',
        'stats.Wounded.value = 1; stats["Wounded"].value = 2;',
        'memories.append("Wounded");',
        'persona.image = `Wounded`; persona.image = pick("Wounded");',
        'persona.image += "Wounded"; if (persona.image < "Wounded") {}',
        'if (persona.name === "Wounded") {}',
      ].join('\n')),
    });
    expect(plan).toBeNull();
  });

  it('rewrites an Item Instance image under items', () => {
    const plan = rename({ worldScripts: world('items.Lamp.instances[0].image = "Wounded";') });
    expect(plan?.edits[0].scripts.w).toBe('items.Lamp.instances[0].image = "Bleeding";');
  });

  it('leaves a same-named key under stats, traits and the like alone', () => {
    const plan = rename({
      worldScripts: world('if (entities.X.stats.sound == "Wounded") {} owner.stats.image = "Wounded"; owner.traits.music == "Wounded";'),
    });
    expect(plan).toBeNull();
  });

  it('leaves a name that is not the renamed one, and a computed name alone', () => {
    expect(rename({ worldScripts: world('persona.image = "Healthy"; persona.image = pick; persona.image = "Wo" + "unded";') })).toBeNull();
  });

  it('leaves a global the author declared over alone', () => {
    expect(rename({ worldScripts: world('const persona = { image: null }; persona.image = "Wounded";') })).toBeNull();
  });

  it('offers nothing for an unchanged or blank name', () => {
    expect(rename({ worldScripts: world('persona.image = "Wounded";'), newName: 'Wounded' })).toBeNull();
    expect(rename({ worldScripts: world('persona.image = "Wounded";'), newName: ' ' })).toBeNull();
  });

  it('moves every literal the drift check reads, so no name is left behind', () => {
    const code = 'persona.image = "Wounded"; if ("Wounded" === location.image) {} entities.X.sound ??= "Wounded";';
    const plan = rename({ worldScripts: world(code) });
    const after = plan!.edits[0].scripts.w;
    expect(mediaNameKeys(after).map((key) => key.name)).toEqual(['Bleeding', 'Bleeding', 'Bleeding']);
  });
});
