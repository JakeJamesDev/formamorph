/**
 * @vitest-environment node
 * (No DOM needed; node keeps the QuickJS WASM engine loading through its filesystem path. The real sandbox
 * runs here rather than a stub — a check whose whole job is "what happens when this actually runs" proves
 * nothing against a fake.)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Entity, Script, Stat, Trait, WorldOverview } from '@/types';
import { checkedScriptCount, checkScripts, SCRIPT_EXECUTION, SCRIPT_UNKNOWN_NAME } from './scriptCheck';
import { editorPromptRun } from '@/lib/editorScriptPrompts';
import { groupFindings, ruleScripts, type RuleWorld } from './rules';
import { boxScripts } from '@/test/scriptFixtures';

const base = (stats: Stat[]): RuleWorld => ({
  worldOverview: { name: 'Sedge Landing', description: '', systemPrompt: 'Narrate the fen.' } as WorldOverview,
  stats,
  locations: [{ id: 'harbor', name: 'Harbor Steps', isStarting: true }],
  entities: [], traits: [], statUpdates: [], dictionaries: [], placeholders: [],
});

const stat = (over: Partial<Stat> & { id: string; name: string }): Stat => ({
  type: 'number', description: '', min: 0, max: 100, regen: 0, descriptors: [], ...over,
});

describe('the on-demand script check', () => {
  // The executor logs its error paths to console.error by design; keep test output clean.
  beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}));
  afterEach(() => vi.restoreAllMocks());

  it('says nothing about code that runs and returns a number', async () => {
    expect(await checkScripts(base([
      stat({ id: 's1', name: 'Fertility', scripts: boxScripts({ after: 'return 25;' }) }),
      stat({ id: 's2', name: 'Vigor' }),
    ]))).toEqual([]);
  });

  it('runs a move to a location of the world clean, and fails a move to one it lacks', async () => {
    const world = (code: string): RuleWorld => ({ ...base([]), scripts: [{ id: 'w', timing: 'after', code }] });
    expect(await checkScripts(world('if (location.name === "Harbor Steps") location.move("harbor"); clock.advance(5); discover("Tor");'))).toEqual([]);
    const [found] = await checkScripts(world('location.move("Harbor Stairs");'));
    expect(found?.ruleId).toBe(SCRIPT_EXECUTION.id);
  });

  it('reads an empty memories list (Q12)', async () => {
    const world = (code: string): RuleWorld => ({ ...base([]), scripts: [{ id: 'w', timing: 'after', code }] });
    expect(await checkScripts(world('if (memories.length !== 0) throw new Error("memories hold " + memories.length);'))).toEqual([]);
    // The control: the same read throws when the list is empty, so the clean run above did read it.
    const [found] = await checkScripts(world('if (memories.length === 0) throw new Error("empty");'));
    expect(found?.ruleId).toBe(SCRIPT_EXECUTION.id);
  });

  it('runs memory and diary writes for an entity of the world clean, and does not fail a diary for one it lacks (Q2: open cast)', async () => {
    const world = (code: string): RuleWorld => ({
      ...base([]), entities: [{ id: 'tor', name: 'Tor', description: '' } as Entity], scripts: [{ id: 'w', timing: 'after', code }],
    });
    expect(await checkScripts(world('memories.add("The gate fell."); memories.pin("Tor lied."); entities.Tor.diary("I lied.");'))).toEqual([]);
    const rows = async (code: string) => (await checkScripts(world(code))).map((f) => [f.ruleId, f.message]);
    expect(await rows('entities.Mira.diary("Hello.");')).toEqual([[
      SCRIPT_UNKNOWN_NAME.id, '“World · After the AI” writes a diary for “Mira”, a name the cast lacks. Play may discover it.',
    ]]);
    expect(await rows('entities.Mira.diary("Hello."); entities.Bo.diary("Hi.");')).toEqual([[
      SCRIPT_UNKNOWN_NAME.id, '“World · After the AI” writes a diary for “Mira”, “Bo”, names the cast lacks. Play may discover them.',
    ]]);
    expect(await rows('entities.Mira.diary("Hello."); traits.Bold.enabled = true;')).toEqual([[
      SCRIPT_UNKNOWN_NAME.id,
      '“World · After the AI” writes to unknown names. Writes ignored: no trait is named “Bold”. It also writes a diary for “Mira”, a name the cast lacks. Play may discover it.',
    ]]);
  });

  it('runs a persona-only entity’s trait Script outside the opening cast, as play with no persona does (ticket 04 ruling)', async () => {
    const albus: Entity = {
      id: 'albus', name: 'Albus', persona: true, personaOnly: true,
      traits: [{ id: 'sly', name: 'Sly', statChanges: [], scripts: [{ id: 's', timing: 'after', code: 'if (owner.name !== "" || self.enabled) throw new Error("cast");\nentities.Albus.diary("Hm.");' }] }],
    };
    expect((await checkScripts({ ...base([]), entities: [albus] })).map((f) => [f.ruleId, f.message])).toEqual([[
      SCRIPT_UNKNOWN_NAME.id, '“Sly · After the AI” of “Albus” writes a diary for “Albus”, a name the cast lacks. Play may discover it.',
    ]]);
  });

  it('reads the turn-one clock of each timing, as Test Code does (Q2)', async () => {
    const world = (timing: Script['timing'], hours: number): RuleWorld => ({
      ...base([]), scripts: [{ id: 'w', timing, code: `if (clock.elapsedHours !== ${hours} || clock.deltaHours !== ${hours}) throw new Error("clock");` }],
    });
    expect(await checkScripts(world('before', 0))).toEqual([]);
    expect(await checkScripts(world('start', 0))).toEqual([]);
    expect(await checkScripts(world('after', 1))).toEqual([]);
    const [found] = await checkScripts(world('after', 0));
    expect(found?.ruleId).toBe(SCRIPT_EXECUTION.id);
  });

  it('reads a switched-off stat as off, as play does (Q2: the authored enabled map)', async () => {
    const world = base([
      stat({ id: 'luck', name: 'Luck', value: 5, enabled: false }),
      stat({ id: 'grit', name: 'Grit', value: 5, scripts: boxScripts({ after: 'if (stats.Luck.enabled || !stats.Grit.enabled) throw new Error("on"); return 5;' }) }),
    ]);
    expect(await checkScripts(world)).toEqual([]);
  });

  it('runs every script the static rules read, and names each by the same row', async () => {
    const fails: Script[] = [{ id: 'f', timing: 'after', code: 'throw new Error("x");' }];
    const ash: Entity = {
      id: 'ash', name: 'Ash', stats: [stat({ id: 'grit', name: 'Grit', scripts: fails })],
      traits: [{ id: 'grim', name: 'Grim', statChanges: [], scripts: fails }],
    };
    const world: RuleWorld = {
      ...base([stat({ id: 'mana', name: 'Mana', scripts: fails })]),
      scripts: fails, entities: [ash], traits: [{ id: 'brave', name: 'Brave', statChanges: [], scripts: fails }],
    };
    const ran = (await checkScripts(world)).flatMap((f) => f.items);
    expect(ran).toEqual(ruleScripts(world).map(({ item }) => item));
    expect(ran.map((item) => item.section)).toEqual(['scripts', 'stats', 'entities', 'traits', 'entities']);
    expect(checkedScriptCount(world)).toBe(5);
  });

  it('files each failure under the section that holds its script, one finding per script', async () => {
    const fails: Script[] = [{ id: 'f', timing: 'after', code: 'throw new Error("x");' }];
    const ash: Entity = { id: 'ash', name: 'Ash', traits: [{ id: 'grim', name: 'Grim', statChanges: [], scripts: fails }] };
    const world: RuleWorld = {
      ...base([stat({ id: 'mana', name: 'Mana', scripts: fails })]),
      scripts: fails, entities: [ash], traits: [{ id: 'brave', name: 'Brave', statChanges: [], scripts: fails }],
    };
    const found = await checkScripts(world);
    expect(found.map((f) => [f.section, f.items.map((item) => item.id)])).toEqual([
      ['scripts', ['world|f']], ['stats', ['mana']], ['traits', ['brave']], ['entities', ['ash']],
    ]);
    // Opening an item goes to its own tab, whatever section the row sits under.
    expect(found.map((f) => f.items[0].section)).toEqual(found.map((f) => f.section));
  });

  it('files an unknown-name warning under the section of its script too', async () => {
    const writes: Script[] = [{ id: 'w', timing: 'after', code: 'traits.Nope.enabled = true;' }];
    const found = await checkScripts({
      ...base([]), scripts: writes, traits: [{ id: 'brave', name: 'Brave', statChanges: [], scripts: writes }],
    });
    expect(found.map((f) => [f.ruleId, f.section])).toEqual([
      [SCRIPT_UNKNOWN_NAME.id, 'scripts'], [SCRIPT_UNKNOWN_NAME.id, 'traits'],
    ]);
  });

  it("reads a stat gate against each stat's authored start", async () => {
    const at = (start: number) => {
      const world = base([stat({ id: 'rage', name: 'Rage', value: start, scripts: boxScripts({ after: 'if (!traits.Berserk.available) throw new Error("locked"); return 1;' }) })]);
      world.traits = [{
        id: 'berserk', name: 'Berserk', statChanges: [],
        requires: [{ all: [{ kind: 'stat', id: 'rage', operator: '>=', value: 80, unit: 'raw' }] }],
      }];
      return checkScripts(world);
    };
    expect(await at(85)).toEqual([]);
    expect((await at(70)).map((f) => f.ruleId)).toEqual([SCRIPT_EXECUTION.id]);
  });

  it('runs code that reads a placeholder the world has, and reports none', async () => {
    const world = base([stat({ id: 's1', name: 'Fertility', scripts: boxScripts({ after: 'return placeholders.Mood.value === "calm" ? 1 : 2;' }) })]);
    world.placeholders = [{ id: 'mood', name: 'Mood', values: [{ id: 'v:calm', text: 'calm' }] }];
    expect(await checkScripts(world)).toEqual([]);
  });

  it('runs code that reads and switches a trait the world has, and reports none', async () => {
    const world = base([stat({ id: 's1', name: 'Fertility', scripts: boxScripts({ after: 'traits.Cursed.enabled = !traits.Cursed.acquired;' }) })]);
    world.traits = [{ id: 't1', name: 'Cursed', playerDescription: '', aiDescription: '', statChanges: [] }];
    expect(await checkScripts(world)).toEqual([]);
  });

  it('runs code that pins an owner’s placeholder through its entry, and reports only a name the owner lacks', async () => {
    const world = base([
      stat({ id: 's1', name: 'Fertility', scripts: boxScripts({ after: 'entities.Mira.placeholders.Hair.pin("red"); dictionaries.Lore.placeholders.Sky.pin("gray");' }) }),
      // No persona plays in the check, so a pin through it names nothing the check can judge.
      stat({ id: 's2', name: 'Vigor', scripts: boxScripts({ after: 'persona.placeholders.Hair.pin("red"); entities.Mira.placeholders.Hiar.pin("x");' }) }),
    ]);
    world.entities = [{ id: 'mira', name: 'Mira', persona: true, placeholders: [{ id: 'hair', name: 'Hair', values: [] }] }];
    world.dictionaries = [{ id: 'lore', name: 'Lore', entries: [], placeholders: [{ id: 'sky', name: 'Sky', values: [] }] }];
    const found = await checkScripts(world);
    expect(found.map((f) => [f.items[0].id, f.message])).toEqual([['s2', expect.stringContaining('Mira › Hiar')]]);
  });

  it('runs code that sets its own bounds, and reports none', async () => {
    expect(await checkScripts(base([
      stat({ id: 's1', name: 'Fertility', scripts: boxScripts({ after: 'self.max = 200; self.regen = 2;' }) }),
    ]))).toEqual([]);
  });

  // A write to a name the world lacks is dropped at run time, so the author only learns of the typo here.
  it('reports a write to a placeholder or trait the world does not have, as a warning naming the stat', async () => {
    const world = base([
      stat({ id: 's1', name: 'Fertility', scripts: boxScripts({ after: 'placeholders.Mood.value = "calm"; placeholders.Moood = "x";' }) }),
      stat({ id: 's2', name: 'Weave', scripts: boxScripts({ after: 'traits.Cursd.enabled = true; traits.Blessed.enabled = true;' }) }),
    ]);
    world.placeholders = [{ id: 'mood', name: 'Mood', values: [{ id: 'v:calm', text: 'calm' }] }];
    world.traits = [{ id: 't1', name: 'Cursed', playerDescription: '', aiDescription: '', statChanges: [] }];
    const found = await checkScripts(world);
    expect(found.map((f) => [f.ruleId, f.severity, f.items[0].id])).toEqual([
      [SCRIPT_UNKNOWN_NAME.id, 'warning', 's1'],
      [SCRIPT_UNKNOWN_NAME.id, 'warning', 's2'],
    ]);
    expect(found[0].message).toContain('Fertility');
    expect(found[0].message).toContain('Moood');
    expect(found[0].message).not.toContain('Mood.');
    expect(found[1].message).toContain('Cursd');
    expect(found[1].message).toContain('Blessed');
  });

  it('reports code that throws, naming the stat and the failure', async () => {
    const [found] = await checkScripts(base([
      stat({ id: 's1', name: 'Fertility', scripts: boxScripts({ after: 'return stats.find(s => s.name === "Missing").value;' }) }),
    ]));
    expect(found.ruleId).toBe(SCRIPT_EXECUTION.id);
    expect(found.severity).toBe('error');
    expect(found.section).toBe('stats');
    expect(found.items.map((i) => i.id)).toEqual(['s1']);
    expect(found.message).toContain('Fertility');
    expect(found.message).toContain('throws');
  });

  it('reports code that returns something other than a number as its own failure, not as a throw', async () => {
    const [found] = await checkScripts(base([
      stat({ id: 's1', name: 'Fertility', scripts: boxScripts({ after: 'return "25";' }) }),
    ]));
    expect(found.message).toContain('doesn’t return a number');
    expect(found.message).not.toContain('throws');
  });

  it('reports a placeholder written something other than text as a wrong-type write, not as a throw', async () => {
    const [found] = await checkScripts({ ...base([
      stat({ id: 's1', name: 'Fertility', scripts: boxScripts({ after: 'placeholders.Mood.value = {};' }) }),
    ]), placeholders: [{ id: 'p1', name: 'Mood', values: [{ id: 'v1', text: 'calm' }] }] });
    expect(found.ruleId).toBe(SCRIPT_EXECUTION.id);
    expect(found.message).toContain('wrong type');
    expect(found.message).not.toContain('throws');
  });

  it('accepts code that sets its value through self and returns nothing', async () => {
    expect(await checkScripts(base([
      stat({ id: 's1', name: 'Fertility', scripts: boxScripts({ after: 'self.value = 25;' }) }),
    ]))).toEqual([]);
  });

  it('reports code that never finishes as a timeout', async () => {
    const [found] = await checkScripts(base([
      stat({ id: 's1', name: 'Fertility', scripts: boxScripts({ after: 'while (true) {}' }) }),
    ]));
    expect(found.message).toContain('times out');
  });

  it('runs each coded stat against the world’s authored values, so a run mirrors turn one (Q8)', async () => {
    // Vigor opens at its authored 80, so code reading it sees 80.
    const found = await checkScripts(base([
      stat({ id: 's1', name: 'Vigor', value: 80 }),
      stat({
        id: 's2',
        name: 'Fertility',
        scripts: boxScripts({ after: 'const v = stats.Vigor.value; if (v !== 80) throw new Error("saw " + v); return v;' }),
      }),
    ]));
    expect(found).toEqual([]);
  });

  it('checks every coded stat rather than stopping at the first failure', async () => {
    const found = await checkScripts(base([
      stat({ id: 's1', name: 'Fertility', scripts: boxScripts({ after: 'throw new Error("nope");' }) }),
      stat({ id: 's2', name: 'Weave', scripts: boxScripts({ after: 'return "not a number";' }) }),
      stat({ id: 's3', name: 'Vigor', scripts: boxScripts({ after: 'return 10;' }) }),
    ]));
    expect(found.map((f) => f.items[0].id)).toEqual(['s1', 's2']);
  });

  it('says nothing about stats with no code, or blank code', async () => {
    expect(await checkScripts(base([
      stat({ id: 's1', name: 'Vigor' }),
      stat({ id: 's2', name: 'Weave', scripts: boxScripts({ before: '\n', after: '   ' }) }),
    ]))).toEqual([]);
  });

  it('runs both of a stat’s boxes and names the box each row is about', async () => {
    const found = await checkScripts(base([
      stat({ id: 's1', name: 'Fertility', scripts: boxScripts({ before: 'throw new Error("nope");', after: 'return "not a number";' }) }),
    ]));
    expect(found.map((f) => f.message)).toEqual([
      '“Fertility · Before the AI” throws when it runs, so the stat keeps its manual value',
      '“Fertility · After the AI” doesn’t return a number, so the stat keeps its manual value',
    ]);
  });

  it('leaves a stat alone when only its before box holds code and that box runs clean', async () => {
    expect(await checkScripts(base([
      stat({ id: 's1', name: 'Fertility', scripts: boxScripts({ before: 'return 25;' }) }),
    ]))).toEqual([]);
  });

  // The bundled worlds are the check's real workload: every one must come back clean under the new surface.
  it('reports nothing on the bundled worlds', async () => {
    const worlds = import.meta.glob<{ default: RuleWorld }>('../../defaultworlds/*.json', { eager: true });
    const entries = Object.entries(worlds);
    expect(entries.length).toBeGreaterThan(0);
    for (const [path, world] of entries) {
      expect(await checkScripts(world.default), path).toEqual([]);
    }
  });

  it('runs a chip-bearing stat under its code name, so the run agrees with the rule beside it', async () => {
    // The author's own guard is what turns a miss into a row: a name no stat has reads as a blank entry,
    // whose own name is empty. The code name hits, the rolled spelling does not.
    const lookup = (key: string) => `const power = stats[${JSON.stringify(key)}];\n`
      + 'if (!power.name) throw new Error("no such stat");\nreturn power.max;';
    const chipped = (code: string) => ({
      ...base([
        stat({ id: 's1', name: '{{ph:ph-beast:world:p1}} Power', max: 50 }),
        stat({ id: 's2', name: 'Mana', scripts: boxScripts({ after: code }) }),
      ]),
      placeholders: [{ id: 'ph-beast', name: 'Beast', values: [{ id: 'v-wolf', text: 'Wolf' }] }],
    });
    expect(await checkScripts(chipped(lookup('Beast Power')))).toEqual([]);
    const rolled = await checkScripts(chipped(lookup('Wolf Power')));
    expect(rolled).toHaveLength(1);
    expect(rolled[0].ruleId).toBe(SCRIPT_EXECUTION.id);
  });

  it('names its row by the stat the author sees in the list, chips and all', async () => {
    const found = await checkScripts({
      ...base([stat({ id: 's1', name: '{{ph:ph-beast:world:p1}} Power', scripts: boxScripts({ after: 'throw new Error("nope");' }) })]),
      placeholders: [{ id: 'ph-beast', name: 'Beast', values: [{ id: 'v-wolf', text: 'Wolf' }] }],
    });
    expect(found).toHaveLength(1);
    expect(found[0].items[0].name).toBe('{Beast} Power');
  });

  describe('owned and Blueprint boxes', () => {
    const blueprints = { id: 'bp', name: 'Blueprints', parentId: null, system: 'blueprints' as const };
    const creature = (stats: Stat[], over: Partial<Entity> = {}): Entity => ({ id: 'creature', name: 'The Creature', stats, ...over });
    const owned = (stats: Stat[], world: Stat[] = []): RuleWorld => ({ ...base(world), entities: [creature(stats)] });

    it('reports a failing owned box on its entity, naming the stat and the entity', async () => {
      const found = await checkScripts(owned([stat({ id: 'rage', name: 'Rage', scripts: boxScripts({ after: 'throw new Error("nope");' }) })]));
      expect(found.map((f) => [f.ruleId, f.message])).toEqual([[
        SCRIPT_EXECUTION.id, '“Rage · After the AI” of “The Creature” throws when it runs, so the stat keeps its manual value',
      ]]);
      expect(found[0].items).toEqual([{ id: 'creature', name: 'The Creature', section: 'entities' }]);
    });

    it('runs an owned box with its entity as owner and the world as stats, every owner at its authored values (Q8)', async () => {
      const check = 'if (owner.stats.Rage.value !== 7) throw new Error("owner");\n'
        + 'if (stats.Destruction.value !== 3) throw new Error("world");\n'
        + 'if (entities["The Creature"].stats.Rage.value !== 7) throw new Error("entry");\nreturn 1;';
      const world = owned(
        [stat({ id: 'rage', name: 'Rage', value: 7 }), stat({ id: 'fury', name: 'Fury', scripts: boxScripts({ after: check }) })],
        [stat({ id: 'dest', name: 'Destruction', value: 3 })],
      );
      expect(await checkScripts(world)).toEqual([]);
      // A world box reads the same entity through `entities`, and its own owner is empty.
      world.stats = [...world.stats, stat({
        id: 'alarm', name: 'Alarm',
        scripts: boxScripts({ after: 'if (entities["The Creature"].stats.Rage.value !== 7 || owner.stats.Rage.name) throw new Error("x"); return 1;' }),
      })];
      expect(await checkScripts(world)).toEqual([]);
    });

    it('runs a Blueprint box once, with its group’s stats alone as owner, however many owners it has', async () => {
      const guards = { id: 'guards', name: 'Guards', parentId: 'bp' };
      const blueprint = (code: string): RuleWorld => {
        const link = (id: string) => ({ id, originalId: 'guards', kind: 'group' as const, originalName: 'Guards', groupId: null });
        return {
          ...base([
            stat({ id: 'dest', name: 'Destruction', value: 3 }),
            stat({ id: 'guard', name: 'Guard', groupId: 'guards', scripts: boxScripts({ after: code }) }),
            stat({ id: 'watch', name: 'Watch', groupId: 'guards', value: 4 }),
          ]),
          statGroups: [blueprints, guards],
          entities: [
            creature([stat({ id: 'rage', name: 'Rage' })], { statLinks: [link('l1')] }),
            creature([], { id: 'tobb', name: 'Tobb', statLinks: [link('l2')] }),
          ],
        };
      };
      expect(await checkScripts(blueprint(
        'if (owner.stats.Watch.value !== 4 || owner.stats.Rage.name || stats.Destruction.value !== 3) throw new Error("x");\nreturn 1;',
      ))).toEqual([]);
      const found = await checkScripts(blueprint('throw new Error("nope");'));
      expect(found.map((f) => [f.message, f.items])).toEqual([[
        '“Guard · After the AI” throws when it runs, so the stat keeps its manual value', [{ id: 'guard', name: 'Guard', section: 'stats' }],
      ]]);
    });

    it('runs an owner’s overridden code on a linked stat once, with its entity as owner', async () => {
      const guard = stat({ id: 'guard', name: 'Guard', groupId: 'bp', scripts: boxScripts({ after: 'return 1;' }) });
      const owner = (code: string) => creature([stat({ id: 'rage', name: 'Rage', value: 7 })], {
        statLinks: [{
          id: 'link', originalId: 'guard', kind: 'stat', originalName: 'Guard', groupId: null,
          overrides: { guard: { scripts: { value: boxScripts({ after: code }), blueprint: boxScripts({ after: 'return 1;' }) } } },
        }],
      });
      const linked = (code: string) => checkScripts({ ...base([guard]), statGroups: [blueprints], entities: [owner(code)] });
      expect(await linked('if (owner.stats.Rage.value !== 7) throw new Error("owner"); return 2;')).toEqual([]);
      const found = await linked('throw new Error("nope");');
      expect(found.map((f) => [f.message, f.items])).toEqual([[
        '“Guard · After the AI” of “The Creature” throws when it runs, so the stat keeps its manual value',
        [{ id: 'creature', name: 'The Creature', section: 'entities' }],
      ]]);
    });
  });

  it('collapses its findings into one counted row like any other rule', async () => {
    const found = await checkScripts(base([
      stat({ id: 's1', name: 'Fertility', scripts: boxScripts({ after: 'throw new Error("nope");' }) }),
      stat({ id: 's2', name: 'Weave', scripts: boxScripts({ after: 'return "not a number";' }) }),
    ]));
    const [group] = groupFindings(found);
    expect(group.headline).toContain('2');
    expect(group.fixable).toBe(false);
    expect(group.items.map((i) => i.id)).toEqual(['s1', 's2']);
  });

  describe('every script and every timing', () => {
    const brave = (scripts: Script[], over: Partial<Trait> = {}): Trait => ({ id: 'brave', name: 'Brave', statChanges: [], scripts, ...over });

    it('names a named script by its name, timing and stat', async () => {
      const [found] = await checkScripts(base([
        stat({ id: 's1', name: 'Fertility', scripts: [{ id: 'x', name: 'Clamp', timing: 'before', code: 'throw new Error("nope");' }] }),
      ]));
      expect(found.message).toBe('“Clamp” (Before the AI) on “Fertility” throws when it runs, so the stat keeps its manual value');
    });

    it('runs a world script, named by its fallback or its name, and opens its Scripts tab row', async () => {
      const world = { ...base([]), scripts: [
        { id: 'w1', timing: 'after' as const, code: 'throw new Error("nope");' },
        { id: 'w2', name: 'Tide', timing: 'start' as const, code: 'while (true) {}' },
      ] };
      const found = await checkScripts(world);
      expect(found.map((f) => [f.message, f.items])).toEqual([
        ['“World · After the AI” throws when it runs, so the run changes nothing',
          [{ id: 'world|w1', name: 'World · After the AI', section: 'scripts' }]],
        ['“Tide” (At Game Start) on the world times out — it never finishes, so the run changes nothing',
          [{ id: 'world|w2', name: 'Tide', section: 'scripts' }]],
      ]);
    });

    it('runs a trait script with the trait as self, and names it on the Traits tab', async () => {
      const at = (code: string) => checkScripts({ ...base([]), traits: [brave([{ id: 't', timing: 'after', code }])] });
      expect(await at('if (self.name !== "Brave" || self.acquired) throw new Error("self"); return 3;')).toEqual([]);
      const found = await at('throw new Error("nope");');
      expect(found.map((f) => [f.message, f.items])).toEqual([[
        '“Brave · After the AI” throws when it runs, so the run changes nothing', [{ id: 'brave', name: 'Brave', section: 'traits' }],
      ]]);
    });

    it('runs an entity’s own trait script under its entity, and names the entity', async () => {
      const entity: Entity = { id: 'mira', name: 'Mira', traits: [brave([{ id: 't', timing: 'after', code: 'if (owner.name !== "Mira") throw new Error("owner");' }])] };
      expect(await checkScripts({ ...base([]), entities: [entity] })).toEqual([]);
      entity.traits = [brave([{ id: 't', timing: 'after', code: 'throw new Error("nope");' }])];
      const found = await checkScripts({ ...base([]), entities: [entity] });
      expect(found.map((f) => [f.message, f.items])).toEqual([[
        '“Brave · After the AI” of “Mira” throws when it runs, so the run changes nothing', [{ id: 'mira', name: 'Mira', section: 'entities' }],
      ]]);
    });

    it('hands a During AI Output script the sample sentence, and says its sentence passes unchanged on a failure', async () => {
      const output = (code: string) => checkScripts(base([stat({ id: 's1', name: 'Mood', scripts: [{ id: 'o', timing: 'output', code }] })]));
      const reads = 'if (narration.sentence !== "The door opens." || narration.full !== narration.sentence || narration.index !== 0'
        + ' || narration.sent.length || narration.buffered.length) throw new Error("sample"); narration.sentence = "x";';
      expect(await output(reads)).toEqual([]);
      const found = await output('throw new Error("nope");');
      expect(found.map((f) => f.message)).toEqual(['“Mood · During AI Output” throws when it runs, so its sentence passes unchanged']);
    });

    it('fires a switch script on the world’s first trait in tree order, and a trait’s own on itself', async () => {
      const reads = (name: string) => `if (trait.name !== "${name}" || !trait.enabled || trait.owner !== "") throw new Error(trait.name);`;
      const world = {
        ...base([stat({ id: 's1', name: 'Mood', scripts: [{ id: 'sw', timing: 'switch', code: reads('Brave') }] })]),
        // Calm is first in the list, Brave first in the tree: its group sits at the top.
        traits: [
          { id: 'calm', name: 'Calm', statChanges: [], scripts: [{ id: 'own', timing: 'switch' as const, code: `${reads('Calm')} if (self.name !== "Calm") throw new Error("self");` }] },
          brave([], { groupId: 'g' }),
        ],
        traitGroups: [{ id: 'g', name: 'Mood', parentId: null }],
      };
      expect(await checkScripts(world)).toEqual([]);
    });

    it('shows a prompt through the host it is given, and reads the pick', async () => {
      const prompts = editorPromptRun();
      const checking = checkScripts(base([
        stat({ id: 's1', name: 'Mood', scripts: boxScripts({ after: 'if (player.confirm("Drink?")) throw new Error("drank");' }) }),
      ]), prompts.host);
      await vi.waitFor(() => expect(prompts.store.pending()).toHaveLength(1), { timeout: 10_000 });
      prompts.store.answer(prompts.store.pending()[0].id, true);
      expect((await checking).map((f) => f.message)).toEqual(['“Mood · After the AI” throws when it runs, so the stat keeps its manual value']);
    });

    it('names the asking script on its prompt: its own name, or the owner and timing', async () => {
      const prompts = editorPromptRun();
      const ask = (script: Script) => ({ ...script, code: 'player.confirm("Drink?"); return 1;' });
      const checking = checkScripts({
        ...base([
          stat({ id: 's1', name: 'Mood', scripts: [ask({ id: 'a', name: 'Clamp', timing: 'before', code: '' })] }),
          stat({ id: 's2', name: 'Weave', scripts: [ask({ id: 'b', timing: 'after', code: '' })] }),
        ]),
        scripts: [ask({ id: 'c', timing: 'start', code: '' })],
        entities: [{ id: 'mira', name: 'Mira', traits: [brave([ask({ id: 'd', timing: 'after', code: '' })])] }],
      }, prompts.host);
      // The sandbox runs one prompting script at a time, so each prompt opens after the last is answered.
      const askers: (string | undefined)[] = [];
      for (let asked = 0; asked < 4; asked += 1) {
        await vi.waitFor(() => expect(prompts.store.pending()).toHaveLength(1), { timeout: 10_000 });
        const [{ id, request }] = prompts.store.pending();
        askers.push('asker' in request ? request.asker : undefined);
        prompts.store.answer(id, true);
      }
      expect(await checking).toEqual([]);
      expect(askers.sort()).toEqual(['Brave · After the AI', 'Clamp', 'Weave · After the AI', 'World · At Game Start']);
    });

    it('reports a prompt the author closes as canceled', async () => {
      const prompts = editorPromptRun();
      const checking = checkScripts(base([
        stat({ id: 's1', name: 'Mood', scripts: boxScripts({ after: 'player.confirm("Drink?"); return 1;' }) }),
      ]), prompts.host);
      await vi.waitFor(() => expect(prompts.store.pending()).toHaveLength(1), { timeout: 10_000 });
      prompts.store.cancel(prompts.store.pending()[0].id);
      expect((await checking).map((f) => f.message)).toEqual([
        '“Mood · After the AI” asked the player and the prompt was closed, so the run changes nothing',
      ]);
    });

    it('counts every filled script it runs', () => {
      expect(checkedScriptCount({
        ...base([stat({ id: 's1', name: 'Mood', scripts: boxScripts({ before: 'return 1;', after: ' ' }) })]),
        scripts: [{ id: 'w', timing: 'after', code: 'return 1;' }],
        traits: [brave([{ id: 't', timing: 'switch', code: 'return 1;' }])],
      })).toBe(3);
    });
  });
});
