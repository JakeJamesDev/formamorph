import { describe, expect, it } from 'vitest';
import type { Tool, World } from '@/types';
import { codeDiagnostics } from '@/lib/statCodeAnalysis';
import { userToolsCodec } from '@/lib/promptPresets';
import { parseHelpTools } from '@/lib/formaquestion/helpTools';
import { migrateWorld } from '@/lib/version';
import { buildToolPack, parseToolPack } from './toolPack';
import { runToolScript } from './toolScript';
import { sampleToolSnapshot } from './sampleToolSnapshot';
import { toolScriptSurface } from './toolScriptSurface';
import { migrateToolSurfaceReads, migrateUserToolScript } from './toolTextMigration';
import { readWorldTools } from './worldTools';

describe('the scene reads', () => {
  it.each([
    ['the notes', 'return scene.notes;', 'return notes;'],
    ['the hours elapsed', 'return scene.time.elapsed * 2;', 'return clock.elapsedHours * 2;'],
    ['the location’s id and name', 'return scene.location.id + scene.location.name;', 'return location.id + location.name;'],
    ['a stat by dot', 'return scene.stats.Health > 50;', 'return stats.Health.value > 50;'],
    ['a stat by a literal key, the author’s quotes kept', "return scene.stats['Max HP'] + scene.stats[\"Gold\"];", "return stats['Max HP'].value + stats[\"Gold\"].value;"],
    ['a method on a stat’s number', 'return scene.stats.Health.toFixed(1);', 'return stats.Health.value.toFixed(1);'],
    ['reads nested in a template', 'return `${scene.notes} at ${scene.location.name}`;', 'return `${notes} at ${location.name}`;'],
  ])('rewrite %s', (_case, code, expected) => {
    expect(migrateToolSurfaceReads(code)).toBe(expected);
  });

  it.each([
    ['bare scene.location', 'return scene.location;'],
    ['a location member the old entry lacked', 'return scene.location.description;'],
    ['an optional location read, which read undefined with no location', 'return scene.location?.name;'],
    ['bare scene.time', 'return scene.time ? 1 : 0;'],
    ['an optional time read, which read undefined with the clock off', 'return scene.time?.elapsed;'],
    ['the traits', 'return scene.traits.join(", ");'],
    ['the persona', 'return scene.persona;'],
    ['who is present (Q50)', 'return scene.present.join(", ");'],
    ['who is in the scene (Q50)', 'return scene.inScene;'],
    ['bare scene.stats', 'return Object.keys(scene.stats);'],
    ['a stat by a computed key', 'return scene.stats[args.name];'],
    ['a call on scene.stats', 'return scene.stats.hasOwnProperty("Health");'],
    ['a computed scene member', 'return scene["notes"];'],
    ['a script that declares scene', 'const scene = { notes: "x" };\nreturn scene.notes;'],
    ['a script that declares the new name', 'const notes = scene.notes;\nreturn notes;'],
    ['a script that destructures the new name', 'const { notes } = args;\nreturn notes + scene.notes;'],
    ['a parameter named like the new name', 'return [1].map((location) => scene.location.name);'],
    ['the word in a string', 'return "scene.notes";'],
  ])('leave %s as written', (_case, code) => {
    expect(migrateToolSurfaceReads(code)).toBe(code);
  });

  it('rewrite every exact read and leave the rest of the line alone', () => {
    expect(migrateToolSurfaceReads('return [scene.notes, scene.traits, scene.stats.Health];'))
      .toBe('return [notes, scene.traits, stats.Health.value];');
  });
});

describe('the world lists (Q52)', () => {
  it.each([
    ['a count', 'return world.locations.length;', 'return Object.values(locations).length;'],
    ['names mapped', 'return world.entities.map((e) => e.name).join(", ");', 'return Object.values(entities).map((e) => e.name).join(", ");'],
    ['a filter, then a field', 'return world.entities.filter((e) => e.aliases.includes(args.q)).map((e) => e.id);',
      'return Object.values(entities).filter((e) => e.aliases.includes(args.q)).map((e) => e.id);'],
    ['an item held in a variable, read by field', 'const hit = world.locations.find((l) => l.name === args.q);\nreturn hit ? hit.summary : "";',
      'const hit = Object.values(locations).find((l) => l.name === args.q);\nreturn hit ? hit.summary : "";'],
    ['an index loop', 'let s = "";\nfor (let i = 0; i < world.entities.length; i++) s += world.entities[i].name;\nreturn s;',
      'let s = "";\nfor (let i = 0; i < Object.values(entities).length; i++) s += Object.values(entities)[i].name;\nreturn s;'],
    ['a for…of loop', 'let s = "";\nfor (const l of world.locations) if (l.id === args.id) s = l.summary;\nreturn s;',
      'let s = "";\nfor (const l of Object.values(locations)) if (l.id === args.id) s = l.summary;\nreturn s;'],
    ['an item in a template', 'return world.locations.map((l) => `${l.name}: ${l.summary}`).join("\\n");',
      'return Object.values(locations).map((l) => `${l.name}: ${l.summary}`).join("\\n");'],
    ['a field by a literal key', 'return world.entities[0]["name"];', 'return Object.values(entities)[0]["name"];'],
    ['an item tested by if', 'if (world.entities.find((e) => e.id === args.id)) return "found";\nreturn "none";',
      'if (Object.values(entities).find((e) => e.id === args.id)) return "found";\nreturn "none";'],
    ['a list in parentheses', 'return (world.locations).length;', 'return (Object.values(locations)).length;'],
  ])('rewrite %s', (_case, code, expected) => {
    expect(migrateToolSurfaceReads(code)).toBe(expected);
  });

  it.each([
    ['the list returned', 'return world.locations;'],
    ['an item returned', 'return world.entities.find((e) => e.id === args.id);'],
    ['an item returned through a variable', 'const hit = world.entities[0];\nconst n = hit.name.length;\nreturn hit;'],
    ['an item returned from a callback', 'return world.entities.map((e) => e);'],
    ['an item returned from a block callback', 'return world.locations.filter(function (l) { return l; }).length;'],
    ['an item picked by ||', 'return world.entities[0] || "none";'],
    ['an item picked by a ternary', 'return args.first ? world.entities[0] : "";'],
    ['a stringified list', 'return JSON.stringify(world.locations.slice(0, 2));'],
    ['a spread list', 'return [...world.locations].length;'],
    ['an item’s keys', 'return Object.keys(world.entities[0]).join();'],
    ['an item’s keys by in', 'return "placeholders" in world.entities[0];'],
    ['a destructured item', 'const { name } = world.entities[0];\nreturn name;'],
    ['an item passed to a named function', 'const show = (e) => e.name;\nreturn world.entities.map(show).join();'],
    ['an item stored in a structure', 'const found = [];\nfor (const e of world.entities) found.push(e);\nreturn found.length;'],
    ['an entity’s placeholders read', 'return world.entities.map((e) => e.placeholders.Pole).join();'],
    ['the dictionary, whose entry map drops unnamed and repeated entries (Q55)', 'return world.dictionary.map((d) => d.name).join();'],
    ['placeholders read by a literal key', 'return world.entities[0]["placeholders"].Pole;'],
    ['a field the old item lacked', 'return world.locations.filter((l) => l.starting).length;'],
    ['a list method it does not know', 'return world.entities.reduce((n, e) => n + e.name.length, 0);'],
    ['a script that declares a name the new form reads', 'const entities = [];\nreturn world.entities.length;'],
    ['a script that declares world', 'const world = { locations: [] };\nreturn world.locations.length;'],
  ])('leave %s as written', (_case, code) => {
    expect(migrateToolSurfaceReads(code)).toBe(code);
  });

  it('decide each list on its own', () => {
    expect(migrateToolSurfaceReads('return [world.locations.length, world.entities];'))
      .toBe('return [Object.values(locations).length, world.entities];');
  });
});

const scriptTool = (code: string, id = 'u-1'): Tool => ({
  id, name: `peek_${id}`, description: 'Purpose: read the scene.', params: [], handler: { kind: 'script', code }, emptyResult: 'Nothing.', offeredTo: ['narration'],
});
const codeOf = (tool: Tool | undefined) => (tool?.handler.kind === 'script' ? tool.handler.code : undefined);

/** Settings load: the stored list read back through its codec. */
const loaded = (code: string) => codeOf(userToolsCodec.parse(JSON.stringify([scriptTool(code)]))[0]);

/** A shipped user Tool script reading every row of the exact-equivalent table (spec: Migrations). */
const SHIPPED = [
  'const keeper = world.entities.find((e) => e.name === "Wren");',
  'let first = "";',
  'for (const place of world.locations) if (!first) first = place.name;',
  'return [',
  '  keeper.summary, world.locations.length, first,',
  '  scene.location.name, scene.location.id,',
  '  scene.time.elapsed,',
  '  scene.stats.Health, scene.stats["Resolve"],',
  '  scene.notes,',
  '].join("|");',
].join('\n');

const MIGRATED = [
  'const keeper = Object.values(entities).find((e) => e.name === "Wren");',
  'let first = "";',
  'for (const place of Object.values(locations)) if (!first) first = place.name;',
  'return [',
  '  keeper.summary, Object.values(locations).length, first,',
  '  location.name, location.id,',
  '  clock.elapsedHours,',
  '  stats.Health.value, stats["Resolve"].value,',
  '  notes,',
  '].join("|");',
].join('\n');

// What SHIPPED returned on the sample world before the surface converged, read once from the 3.3.3 runtime.
const SHIPPED_TEXT = 'The unhurried lamp-keeper.|5|The Boathouse|The Landing|landing|58|82|40|Traveler is looking for the person who sold them a false map.';

describe('a shipped user Tool script on settings load', () => {
  it('loads rewritten, runs to the text it gave before, and a second load changes nothing', async () => {
    const once = loaded(SHIPPED);
    expect(once).toBe(MIGRATED);
    expect(await runToolScript(once!, {}, sampleToolSnapshot())).toEqual({ text: SHIPPED_TEXT });
    expect(loaded(once!)).toBe(once);
  });

  it('keeps the settings shape: the Tool reads back with only its code changed', () => {
    const [tool] = userToolsCodec.parse(JSON.stringify([scriptTool(SHIPPED)]));
    expect(tool).toEqual({ ...scriptTool(SHIPPED), handler: { kind: 'script', code: MIGRATED } });
  });

  it('takes the world scripts’ rewrites too, once', () => {
    const once = migrateUserToolScript('memory.add(scene.notes);\nreturn scene.stats.Health;');
    expect(once).toBe('memories.add(notes);\nreturn stats.Health.value;');
    expect(migrateUserToolScript(once)).toBe(once);
  });
});

/** A shipped script whose reads have no exact equivalent (Q28, Q50, Q52). */
const FLAGGED = [
  'const here = scene.location;',
  'if (!scene.time) return null;',
  'if (args.raw) return world.entities;',
  'if (args.lore) return world.dictionary.length;',
  'return [here.name, scene.traits.join(","), scene.persona, scene.present.length, scene.inScene.length].join("|");',
].join('\n');

describe('a shipped read with no exact equivalent', () => {
  it('loads as written', () => {
    expect(loaded(FLAGGED)).toBe(FLAGGED);
  });

  it('is marked in the editor with the new form named (Q51)', () => {
    const marks = codeDiagnostics(FLAGGED, { surface: toolScriptSurface([]) }).map((d) => [FLAGGED.slice(d.from, d.to), d.message]);
    expect(marks).toEqual([
      ['scene.location', '“scene.location” isn’t available in a Tool script. Use “location”.'],
      ['scene.time', '“scene.time” isn’t available in a Tool script. Use “clock”.'],
      ['world.entities', '“world.entities” isn’t available in a Tool script. Use “entities”.'],
      ['world.dictionary', '“world.dictionary” isn’t available in a Tool script. Use “dictionaries”.'],
      ['scene.traits', '“scene.traits” isn’t available in a Tool script. Use “traits”.'],
      ['scene.persona', '“scene.persona” isn’t available in a Tool script. Use “persona.name”.'],
      ['scene.present', '“scene.present” isn’t available in a Tool script. Use “location.present”.'],
      ['scene.inScene', '“scene.inScene” isn’t available in a Tool script. Use “inScene” on each “entities” entry.'],
    ]);
  });

  it('keeps the plain unknown mark for a member the old surface never had', () => {
    expect(codeDiagnostics('return scene.weather;', { surface: toolScriptSurface([]) }).map((d) => d.message))
      .toEqual(['“scene” isn’t available in a Tool script.']);
  });
});

describe('every other way a user Tool arrives', () => {
  it('rewrites a Tool pack imported with old text', () => {
    const pack = JSON.stringify(buildToolPack([scriptTool(SHIPPED), scriptTool(FLAGGED, 'u-2')], '3.3.3'));
    expect(parseToolPack(pack).tools.map(codeOf)).toEqual([MIGRATED, FLAGGED]);
  });

  it('rewrites a stored Formaquestion Tool', () => {
    expect(parseHelpTools([scriptTool(SHIPPED)]).map(codeOf)).toEqual([MIGRATED]);
  });

  it('leaves a World Tool’s text to the world’s own pass', () => {
    const { tools, dropped } = readWorldTools([scriptTool(SHIPPED)]);
    expect(dropped).toEqual([]);
    expect(tools.map(codeOf)).toEqual([SHIPPED]);
    const world = migrateWorld({ tools: [scriptTool('return scene.notes;')] } as unknown as Partial<World>);
    expect(codeOf(world.tools![0])).toBe('return scene.notes;');
  });
});
