import { describe, expect, it } from 'vitest';
import { migrateDiaryCalls, migrateEntityScriptText, migrateItemEvent, migrateMemoriesAppend, migrateMemoryCalls, migratePlayerInput, migrateWorldScriptText, NO_CONTEXT, type ScriptTextRewrite } from '@/lib/scriptTextMigration';
import { migrateWorld } from '@/lib/version';
import { executeStatCode } from '@/lib/statCodeExecutor';
import type { Script, World } from '@/types';

describe('migrateDiaryCalls', () => {
  it.each([
    ['a plain name literal, dotted', 'diary("Mira", "She hid the key.");', 'entities.Mira.diary("She hid the key.");'],
    ['single quotes', "diary('Mira', line);", 'entities.Mira.diary(line);'],
    ['a literal with a space, bracketed with the author’s quotes', "diary('Old Tom', line);", "entities['Old Tom'].diary(line);"],
    ['an expression, bracketed', 'diary(name, `Saw ${x}.`);', 'entities[name].diary(`Saw ${x}.`);'],
    ['a member expression', 'diary(trait.owner, "Hm.");', 'entities[trait.owner].diary("Hm.");'],
    ['a call nested in the line', 'diary("Mira", diary(who, "a"));', 'entities.Mira.diary(entities[who].diary("a"));'],
    ['a trailing comma', 'diary("Mira", "x",);', 'entities.Mira.diary("x",);'],
    ['a template chip', 'diary({{entity:entity}}, line);', 'diary({{entity:entity}}, line);'],
  ])('rewrites %s', (_case, code, expected) => {
    expect(migrateDiaryCalls(code)).toBe(expected);
  });

  it.each([
    ['a script that declares its own diary', 'const diary = (a, b) => a + b;\nreturn diary(1, 2);'],
    ['a parameter named diary', 'function f(diary) { return diary("Mira", 1); }'],
    ['a member call', 'notes.diary("Mira", "x");'],
    ['one argument', 'diary("Mira");'],
    ['three arguments', 'diary("Mira", "x", 1);'],
    ['a spread', 'diary(...args);'],
    ['a comment between the arguments', 'diary("Mira", /* who */ "x");'],
    ['a bare read', 'const d = diary;'],
    ['the word in a string', 'const s = "diary(\\"Mira\\", x)";'],
  ])('leaves %s as written', (_case, code) => {
    expect(migrateDiaryCalls(code)).toBe(code);
  });

  it('reads a literal entity id as that entity’s name, as the old call found an id first', () => {
    const entityNames = new Map([['e-mira', 'Mira'], ['e-tom', 'Old Tom'], ['Tor', 'Wick']]);
    expect(migrateDiaryCalls('diary("e-mira", a); diary(\'e-tom\', b); diary("Tor", c); diary(id, d);', { entityNames }))
      .toBe('entities.Mira.diary(a); entities["Old Tom"].diary(b); entities.Wick.diary(c); entities[id].diary(d);');
  });

  it('changes nothing on a second run', () => {
    const code = 'diary("Mira", "a");\nif (x) diary(name, diary("Tor", "b"));\ndiary(\'Old Tom\', "c");';
    const once = migrateDiaryCalls(code);
    expect(once).not.toBe(code);
    expect(migrateDiaryCalls(once)).toBe(once);
  });

  it('runs the rewritten call as the old one ran', async () => {
    const entities = [{ id: 'e-mira', name: 'Mira', traits: [] }, { id: 'e-tom', name: 'Old Tom', traits: [] }];
    const code = migrateDiaryCalls('const who = "Old Tom";\ndiary("Mira", "a");\ndiary(who, "b");');
    const res = await executeStatCode(code, [], null, { entities });
    expect(res.worldWrites).toEqual({ diary: [{ entity: 'e-mira', line: 'a' }, { entity: 'e-tom', line: 'b' }] });
  });
});

describe('migrateMemoryCalls', () => {
  it.each([
    ['an add', 'memory.add("Tor lied.");', 'memories.add("Tor lied.");'],
    ['a pin', 'if (x) memory.pin(line);', 'if (x) memories.pin(line);'],
    ['both, with a call in the line', 'memory.add(a); memory.pin(memory.add.name);', 'memories.add(a); memories.pin(memories.add.name);'],
    ['a spaced dot', 'memory . add("x");', 'memories . add("x");'],
    ['a bare read of a verb', 'const add = memory.add;', 'const add = memories.add;'],
  ])('rewrites %s', (_case, code, expected) => {
    expect(migrateMemoryCalls(code)).toBe(expected);
  });

  it.each([
    ['a script that declares its own memory', 'const memory = { add: (x) => x };\nmemory.add(1);'],
    ['a parameter named memory', 'function f(memory) { memory.add(1); }'],
    ['another member', 'memory.clear();'],
    ['a member of something else', 'notes.memory.add("x");'],
    ['a bracketed member', 'memory["add"]("x");'],
    ['the word in a string', 'const s = "memory.add(x)";'],
    ['a bare read', 'const m = memory;'],
  ])('leaves %s as written', (_case, code) => {
    expect(migrateMemoryCalls(code)).toBe(code);
  });

  it('changes nothing on a second run', () => {
    const once = migrateMemoryCalls('memory.add("a");\nmemory.pin("b");');
    expect(once).toBe('memories.add("a");\nmemories.pin("b");');
    expect(migrateMemoryCalls(once)).toBe(once);
  });

  it('runs the rewritten calls as the old ones ran', async () => {
    const res = await executeStatCode(migrateMemoriesAppend(migrateMemoryCalls('memory.add(" Tor lied. "); memory.pin("Kept.");')), [], null);
    expect(res.worldWrites).toEqual({ memory: ['Tor lied.'], pins: ['Kept.'] });
  });
});

describe('migrateMemoriesAppend', () => {
  it.each([
    ['an add', 'memories.add("Tor lied.");', 'memories.append("Tor lied.");'],
    ['a call in a branch', 'if (x) memories.add(line);', 'if (x) memories.append(line);'],
    ['a spaced dot', 'memories . add("x");', 'memories . append("x");'],
    ['two adds and a pin', 'memories.add(a); memories.pin(b); memories.add(c);', 'memories.append(a); memories.pin(b); memories.append(c);'],
    ['a bare read of the verb', 'const f = memories.add;', 'const f = memories.append;'],
  ])('rewrites %s', (_case, code, expected) => {
    expect(migrateMemoriesAppend(code)).toBe(expected);
  });

  it.each([
    ['a script that declares its own memories', 'const memories = { add: (x) => x };\nmemories.add(1);'],
    ['a parameter named memories', 'function f(memories) { memories.add(1); }'],
    ['another member', 'memories.pin("x");'],
    ['an element verb', 'memories[0].add("x");'],
    ['a member of something else', 'notes.memories.add("x");'],
    ['a bracketed member', 'memories["add"]("x");'],
    ['the word in a string', 'const s = "memories.add(x)";'],
    ['the new verb', 'memories.append("x");'],
  ])('leaves %s as written', (_case, code) => {
    expect(migrateMemoriesAppend(code)).toBe(code);
  });

  it('changes nothing on a second run', () => {
    const once = migrateMemoriesAppend('memories.add("a");\nmemories.pin("b");');
    expect(once).toBe('memories.append("a");\nmemories.pin("b");');
    expect(migrateMemoriesAppend(once)).toBe(once);
  });

  it('runs the rewritten call as the old one ran', async () => {
    const res = await executeStatCode(migrateMemoriesAppend('memories.add(" Tor lied. ");'), [], null);
    expect(res.worldWrites).toEqual({ memory: ['Tor lied.'] });
  });
});

describe('migratePlayerInput', () => {
  it.each([
    ['a call', 'const n = player.askText("Name?");', 'const n = player.input("Name?");'],
    ['a call with a placeholder', 'player . askText("Name?", "A name");', 'player . input("Name?", "A name");'],
    ['two calls', 'player.askText(a); player.askText(b);', 'player.input(a); player.input(b);'],
  ])('rewrites %s', (_case, code, expected) => {
    expect(migratePlayerInput(code)).toBe(expected);
  });

  it.each([
    ['a script that declares its own player', 'const player = { askText: (q) => q };\nplayer.askText("x");'],
    ['another member', 'player.confirm("x");'],
    ['a member of something else', 'game.player.askText("x");'],
    ['the word in a string', 'const s = "player.askText(x)";'],
  ])('leaves %s as written', (_case, code) => {
    expect(migratePlayerInput(code)).toBe(code);
  });

  it('changes nothing on a second run', () => {
    const once = migratePlayerInput('player.askText("a");');
    expect(once).toBe('player.input("a");');
    expect(migratePlayerInput(once)).toBe(once);
  });
});

const script = (id: string, code: string): Script => ({ id, timing: 'after', code });
const toolOf = (id: string, code: string) => ({
  id, name: id, description: '', params: [], emptyResult: '', offeredTo: [], handler: { kind: 'script', code, timing: 'after' },
});

/** A world with a script in every home the pass reaches. */
const worldWith = (code: string): Record<string, unknown> => ({
  stats: [{ id: 's1', name: 'Health', scripts: [script('stat', code)] }],
  traits: [{ id: 't1', name: 'Bold', statChanges: [], scripts: [script('trait', code)] }],
  scripts: [script('world', code)],
  items: [{ id: 'i1', name: 'Lamp', scripts: [script('item', code)] }],
  tools: [toolOf('tool', code), { ...toolOf('lookup', code), handler: { kind: 'template', body: code } }],
  entities: [{
    id: 'e1', name: 'Mira',
    stats: [{ id: 'es', name: 'Mood', scripts: [script('entityStat', code)] }],
    traits: [{ id: 'et', name: 'Shy', statChanges: [], scripts: [script('entityTrait', code)] }],
    statLinks: [{ id: 'sl', originalId: 's1', kind: 'stat', originalName: 'Health', groupId: null,
      overrides: { s1: { scripts: { value: [script('statLink', code)], blueprint: [script('statLinkBlueprint', code)] } } } }],
    traitLinks: [{ id: 'tl', originalId: 't1', kind: 'trait', originalName: 'Bold', groupId: null,
      overrides: { t1: { scripts: { value: [script('traitLink', code)], blueprint: [script('traitLinkBlueprint', code)] } } } }],
  }],
});

/** Every script text of the world, by script id or Tool id. A world without links lists none of theirs. */
function codesOf(world: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  const add = (list: unknown) => { for (const s of list as Script[]) out[s.id] = s.code; };
  const w = world as unknown as World & { tools: { id: string; handler: { kind: string; code?: string; body?: string } }[] };
  for (const stat of w.stats) add(stat.scripts);
  for (const trait of w.traits) add(trait.scripts);
  add(w.scripts);
  for (const item of w.items ?? []) add(item.scripts);
  for (const tool of w.tools) out[tool.id] = tool.handler.code ?? tool.handler.body ?? '';
  const [entity] = w.entities;
  for (const stat of entity.stats!) add(stat.scripts);
  for (const trait of entity.traits!) add(trait.scripts);
  const statOverride = entity.statLinks?.[0].overrides?.s1.scripts;
  if (statOverride) { add(statOverride.value); add(statOverride.blueprint); }
  const traitOverride = entity.traitLinks?.[0].overrides?.t1.scripts;
  if (traitOverride) { add(traitOverride.value); add(traitOverride.blueprint); }
  return out;
}

describe('migrateItemEvent', () => {
  const item = (timing: string) => ({ ...NO_CONTEXT, timing, itemScript: true });

  it.each([
    ['the event Item Instance', 'self.event.copy.lose();', 'instance.lose();'],
    ['a member of it', 'stats.Gold.value += self.event.copy.quantity;', 'stats.Gold.value += instance.quantity;'],
    ['the timing, as the script’s own', 'if (self.event.timing === "lost") return;', 'if ("lost" === "lost") return;'],
    ['the quantity', 'const n = self.event.quantity;', 'const n = args.quantity;'],
    ['the use target', 'if (self.event.target) self.event.target.setUses(3);', 'if (args.target) args.target.setUses(3);'],
    ['a dotted item entry’s copies', 'items.Lamp.copies.length', 'items.Lamp.instances.length'],
    ['a bracketed one', 'for (const c of items["Hooded Lantern"].copies) c.setUses(3);', 'for (const c of items["Hooded Lantern"].instances) c.setUses(3);'],
    ['self’s copies in an item script', 'const [lamp] = self.copies;', 'const [lamp] = self.instances;'],
    ['an optional read', 'self.event?.copy; self?.event.quantity; items.Lamp?.copies;', 'instance; args.quantity; items.Lamp?.instances;'],
    ['every form in one script', 'self.event.copy.moveTo(items.Gem.copies[0].owner, self.event.quantity);', 'instance.moveTo(items.Gem.instances[0].owner, args.quantity);'],
  ])('rewrites %s', (_name, code, out) => {
    expect(migrateItemEvent(code, item('lost'))).toBe(out);
    expect(migrateItemEvent(out, item('lost'))).toBe(out);
  });

  it.each([
    ['a comment', '// self.event.copy and items.Lamp.copies'],
    ['a string', 'player.tell("self.event.copy");'],
    ['another object’s event', 'const e = turn.self.event.copy; other.event.copy;'],
    ['copies on anything but an item entry', 'const copies = 1; const n = list.copies; placeholders.Lamp.copies;'],
    ['the bare event', 'const event = self.event;'],
    ['a script that declares instance', 'const instance = 1; self.event.copy.lose();'],
    ['a script that declares args', 'const args = {}; return self.event.quantity;'],
    ['a script that declares items', 'const items = {}; items.Lamp.copies;'],
  ])('leaves %s alone', (_name, code) => {
    expect(migrateItemEvent(code, item('gained'))).toBe(code);
  });

  it('leaves self’s copies alone outside an item script', () => {
    expect(migrateItemEvent('self.copies;', { ...NO_CONTEXT, timing: 'after' })).toBe('self.copies;');
  });

  it('leaves the timing alone when the script has none', () => {
    expect(migrateItemEvent('self.event.timing', NO_CONTEXT)).toBe('self.event.timing');
  });

  it('rewrites each item script with its own timing through migrateWorld, and a migrated script runs', async () => {
    const world = migrateWorld({
      version: '3.6.0',
      items: [{ id: 'i1', name: 'Coin', scripts: [
        { id: 'a', timing: 'gained', code: 'return self.event.timing;' },
        { id: 'b', timing: 'lost', code: 'stats.Gold.value += self.event.copy.quantity * self.event.quantity;' },
      ] }],
    });
    expect(world.items?.[0].scripts?.map((s) => s.code)).toEqual([
      'return "gained";',
      'stats.Gold.value += instance.quantity * args.quantity;',
    ]);
    const gold = { id: 'g', name: 'Gold', type: 'number' as const, description: '', min: 0, max: 100, value: 0, regen: 0, descriptors: [] };
    const was = { id: 'c', where: { kind: 'you' as const }, quantity: 3, equipped: false, slot: '', occupies: [], allowed: [], hidden: false };
    const result = await executeStatCode(world.items![0].scripts![1].code, [gold], null, {
      items: [{ id: 'i1', name: 'Coin', instances: [] }], itemEvent: { itemId: 'i1', timing: 'lost', instanceId: 'c', was, args: { quantity: 2 } },
    });
    expect(result.error).toBeNull();
    expect(result.statWrites).toEqual([expect.objectContaining({ name: 'Gold', value: 6 })]);
  });
});

describe('migrateWorldScriptText', () => {
  const SCRIPT_HOMES = ['stat', 'trait', 'world', 'item', 'tool', 'entityStat', 'entityTrait', 'statLink', 'statLinkBlueprint', 'traitLink', 'traitLinkBlueprint'];

  it('applies a registered rewrite to a stat, a trait, a world and a World Tool script, and every entity home', () => {
    const shout: ScriptTextRewrite = (code) => code.toUpperCase();
    const world = worldWith('return 1;');
    migrateWorldScriptText(world, [shout]);
    const codes = codesOf(world);
    for (const home of SCRIPT_HOMES) expect(codes[home], home).toBe('RETURN 1;');
    expect(codes.lookup).toBe('return 1;');
  });

  it('turns player.askText into player.input in every script home, and a second load changes nothing', () => {
    const world = worldWith('return player.askText("Name?");');
    migrateWorldScriptText(world);
    const codes = codesOf(world);
    for (const home of SCRIPT_HOMES) expect(codes[home], home).toBe('return player.input("Name?");');
    const after = { ...world };
    migrateWorldScriptText(world);
    for (const key of Object.keys(after)) expect(world[key], key).toBe(after[key]);
  });

  it('runs the rewrites in order', () => {
    const world = worldWith('a');
    migrateWorldScriptText(world, [(code) => `${code}b`, (code) => `${code}c`]);
    expect(codesOf(world).world).toBe('abc');
  });

  it('keeps every record’s reference when no rewrite changes its text', () => {
    const world = worldWith('return 1;');
    const before = { ...world };
    migrateWorldScriptText(world, [(code) => code]);
    for (const key of Object.keys(before)) expect(world[key], key).toBe(before[key]);
  });
});

describe('migrateEntityScriptText', () => {
  it('rewrites an entity’s own stats, traits and link overrides, and keeps a record no rewrite changes', () => {
    const world = worldWith('diary("e1", "a");');
    const entity = (world.entities as unknown[])[0];
    const codes = codesOf({ ...worldWith('x'), entities: [migrateEntityScriptText(entity)] });
    for (const home of ['entityStat', 'entityTrait', 'statLink', 'statLinkBlueprint', 'traitLink', 'traitLinkBlueprint']) {
      expect(codes[home], home).toBe('entities.Mira.diary("a");');
    }
    const plain = (worldWith('return 1;').entities as unknown[])[0];
    expect(migrateEntityScriptText(plain)).toBe(plain);
  });
});

describe('migrateWorld', () => {
  it('reads a literal id as the entity’s code name, chips resolved', () => {
    const migrated = migrateWorld({
      placeholders: [{ id: 'ph-title', name: 'Title', values: [{ id: 'v', text: 'Dame' }] }],
      entities: [{ id: 'e-mira', name: 'Mira {{ph:ph-title:world:v}}' }],
      scripts: [script('world', 'diary("e-mira", "a");')],
    });
    expect(migrated.scripts![0].code).toBe('entities["Mira Title"].diary("a");');
  });

  it('rewrites the old diary calls in every script, and a second load changes nothing', () => {
    const code = 'diary("Mira", "She hid the key.");\ndiary(name, x);';
    // The fixture's stat link points at no Blueprint, so the load drops it; the pass's own test covers that home.
    const migrated = migrateWorld(worldWith(code)) as unknown as Record<string, unknown>;
    const { lookup, ...codes } = codesOf(migrated);
    expect(lookup).toBe(code);
    expect(Object.keys(codes)).toEqual(expect.arrayContaining(['stat', 'trait', 'world', 'tool', 'entityStat', 'entityTrait']));
    for (const [home, text] of Object.entries(codes)) expect(text, home).toBe('entities.Mira.diary("She hid the key.");\nentities[name].diary(x);');
    const again = migrateWorld(JSON.parse(JSON.stringify(migrated))) as unknown as Record<string, unknown>;
    expect(codesOf(again)).toEqual({ lookup, ...codes });
  });

  it('rewrites memories.add in every script of a shipped world, and a second load changes nothing', () => {
    const code = 'memories.add("Tor lied.");\nmemories.pin(line);';
    const migrated = migrateWorld(worldWith(code)) as unknown as Record<string, unknown>;
    const { lookup, ...codes } = codesOf(migrated);
    expect(Object.keys(codes)).toEqual(expect.arrayContaining(['stat', 'trait', 'world', 'tool', 'entityStat', 'entityTrait']));
    for (const [home, text] of Object.entries(codes)) expect(text, home).toBe('memories.append("Tor lied.");\nmemories.pin(line);');
    const again = migrateWorld(JSON.parse(JSON.stringify(migrated))) as unknown as Record<string, unknown>;
    expect(codesOf(again)).toEqual({ lookup, ...codes });
  });

  it('rewrites the old memory calls in every script, and a second load changes nothing', () => {
    const code = 'memory.add("Tor lied.");\nmemory.pin(line);';
    const migrated = migrateWorld(worldWith(code)) as unknown as Record<string, unknown>;
    const { lookup, ...codes } = codesOf(migrated);
    expect(Object.keys(codes)).toEqual(expect.arrayContaining(['stat', 'trait', 'world', 'tool', 'entityStat', 'entityTrait']));
    for (const [home, text] of Object.entries(codes)) expect(text, home).toBe('memories.append("Tor lied.");\nmemories.pin(line);');
    const again = migrateWorld(JSON.parse(JSON.stringify(migrated))) as unknown as Record<string, unknown>;
    expect(codesOf(again)).toEqual({ lookup, ...codes });
  });
});
