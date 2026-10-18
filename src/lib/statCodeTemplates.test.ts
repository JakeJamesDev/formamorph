/**
 * @vitest-environment node
 * (The built-in templates are run through the real QuickJS sandbox, which needs node's filesystem path.)
 */
import { describe, it, expect } from 'vitest';
import {
  parseTemplateSlots,
  humanizeSlotName,
  defaultSlotValues,
  resolveSlotValue,
  validateSlotValues,
  fillTemplate,
  ownerAnswer,
  slotAnswer,
  isBuiltInTemplate,
  isNameSlotType,
  PERSONA_SLOT_OWNER,
  BUILT_IN_TEMPLATES,
  DAYPART_OPTIONS,
  readTemplate,
  missingParams,
  templatesFor,
  templateTimingLabels,
  type CodeTemplate,
  type TemplateSlot,
} from './statCodeTemplates';
import { readsTurnStart } from './statCodeTiming';
import { SCRIPT_TIMINGS } from './scripts';
import { SAMPLE_SENTENCE, sampleNarration } from './scriptTestSamples';
import { executeStatCode, type SandboxEntity, type SandboxTrait } from './statCodeExecutor';
import { phMap, phWrite } from '@/test/sandboxPlaceholders';
import type { ScriptTiming, Stat } from '@/types';

const makeStat = (over: Partial<Stat>): Stat => ({
  id: '1',
  name: 'Stat',
  type: 'number',
  description: '',
  min: 0,
  max: 100,
  value: 0,
  regen: 0,
  descriptors: [],
  ...over,
});

describe('parseTemplateSlots', () => {
  it('reads name, type, default and choice options', () => {
    const { slots, errors } = parseTemplateSlots(
      'a {{one:stat}} b {{two:number=5}} c {{three:choice(x|y)=y}} d {{four}}',
    );
    expect(errors).toEqual([]);
    expect(slots).toEqual([
      { name: 'one', type: 'stat' },
      { name: 'two', type: 'number', defaultValue: '5' },
      { name: 'three', type: 'choice', defaultValue: 'y', options: ['x', 'y'] },
      { name: 'four', type: 'text' },
    ]);
  });

  it('collapses a repeated name to one slot', () => {
    const { slots } = parseTemplateSlots('{{rate:number=2}} and {{rate}} again');
    expect(slots).toHaveLength(1);
    expect(slots[0].defaultValue).toBe('2');
  });

  it('reports a contradicting redeclaration, an unknown type, and an empty choice', () => {
    expect(parseTemplateSlots('{{a:number}} {{a:stat}}').errors).toEqual([
      'Slot "a" is declared as both number and stat.',
    ]);
    expect(parseTemplateSlots('{{a:colour}}').errors).toEqual([
      'Slot "a" has unknown type "colour" — treating it as text.',
    ]);
    expect(parseTemplateSlots('{{a:choice()}}').errors).toEqual([
      'Slot "a" is a choice but lists no options.',
    ]);
  });

  it('ties a trait slot to the persona or to an entity slot, and drops a tie to anything else without an error', () => {
    const { slots, errors } = parseTemplateSlots('{{who:entity}} {{a:trait(who)}} {{b:trait(persona)}} {{c:trait}}');
    expect(errors).toEqual([]);
    expect(slots).toEqual([
      { name: 'who', type: 'entity' },
      { name: 'a', type: 'trait', owner: 'who' },
      { name: 'b', type: 'trait', owner: 'persona' },
      { name: 'c', type: 'trait' },
    ]);
    // A tie to anything but an entity slot is no tie: no error, and the world's traits, as on v3.1.2.
    const loose = parseTemplateSlots('{{n:number}} {{a:trait(n)}} {{b:trait(nobody)}}');
    expect(loose.errors).toEqual([]);
    expect(loose.slots.find((slot) => slot.name === 'a')).toEqual({ name: 'a', type: 'trait' });
    expect(loose.slots.find((slot) => slot.name === 'b')).toEqual({ name: 'b', type: 'trait' });
    // A list was never a tie, so a saved template that wrote one still parses clean.
    expect(parseTemplateSlots('{{t:trait(a|b)}}')).toEqual({ slots: [{ name: 't', type: 'trait', options: ['a', 'b'] }], errors: [] });
  });

  it('ties a stat slot to the persona or to an entity slot the same way, in every kind', () => {
    for (const kind of ['script', 'worldTool'] as const) {
      const { slots, errors } = parseTemplateSlots('{{who:entity}} {{a:stat(who)}} {{b:stat(persona)}} {{c:stat(nobody)}}', kind);
      expect(errors).toEqual([]);
      expect(slots).toEqual([
        { name: 'who', type: 'entity' },
        { name: 'a', type: 'stat', owner: 'who' },
        { name: 'b', type: 'stat', owner: 'persona' },
        { name: 'c', type: 'stat' },
      ]);
    }
  });
});

describe('a typed parameter slot', () => {
  it('reads its Parameter type and the default name, and takes a plain slot as text named after itself', () => {
    const { slots, errors } = parseTemplateSlots('{{sides:param(number)=die}} {{flag:param(boolean)}} {{line:param}}', 'worldTool');
    expect(errors).toEqual([]);
    expect(slots).toEqual([
      { name: 'sides', type: 'param', paramType: 'number', defaultValue: 'die' },
      { name: 'flag', type: 'param', paramType: 'boolean' },
      { name: 'line', type: 'param', paramType: 'string' },
    ]);
    expect(defaultSlotValues(slots)).toEqual({ sides: 'die', flag: 'flag', line: 'line' });
  });

  it('reports a type the Tool editor cannot create and reads it as text', () => {
    for (const type of ['colour', 'enum']) {
      const { slots, errors } = parseTemplateSlots(`{{a:param(${type})}}`, 'worldTool');
      expect(errors).toEqual([`Slot "a" has unknown Parameter type "${type}" — treating it as text.`]);
      expect(slots[0]).toMatchObject({ paramType: 'string' });
    }
  });

  it('lists the Parameters a fill leaves missing, once each, with the slot’s type', () => {
    const { slots } = parseTemplateSlots('{{a:param(number)=amount}} {{b:param=line}} {{c:param(number)=have}} {{d:param(number)=amount}}', 'worldTool');
    const have = [{ name: 'have', type: 'number' as const }, { name: 'unrelated', type: 'string' as const }];
    expect(missingParams(slots, defaultSlotValues(slots), have)).toEqual([
      { name: 'amount', type: 'number', description: '', required: true, options: [] },
      { name: 'line', type: 'string', description: '', required: true, options: [] },
    ]);
    expect(missingParams(slots, { ...defaultSlotValues(slots), a: 'have' }, have).map((param) => param.name)).toEqual(['line', 'amount']);
  });
});

describe('humanizeSlotName', () => {
  it('turns a code identifier into a title-case caption', () => {
    expect(humanizeSlotName('ratePerHour')).toBe('Rate Per Hour');
    expect(humanizeSlotName('source')).toBe('Source');
    expect(humanizeSlotName('total_hours')).toBe('Total Hours');
    expect(humanizeSlotName('firstStat')).toBe('First Stat');
  });

  it('leaves an already-readable name alone', () => {
    expect(humanizeSlotName('Threshold')).toBe('Threshold');
  });
});

describe('built-in slot captions', () => {
  it('read as captions rather than identifiers', () => {
    const captions = BUILT_IN_TEMPLATES.flatMap(template =>
      parseTemplateSlots(template.code).slots.map(slot => humanizeSlotName(slot.name)));
    // Every caption starts capitalized and none still carries a camelCase hump.
    for (const caption of captions) {
      expect(caption).toMatch(/^[A-Z]/);
      expect(caption).not.toMatch(/[a-z][A-Z]/);
    }
  });
});

describe('defaultSlotValues', () => {
  it('prefills declared defaults and falls back per type', () => {
    const { slots } = parseTemplateSlots('{{a:number=3}} {{b:daypart}} {{c:choice(x|y)}} {{d:stat}}');
    expect(defaultSlotValues(slots)).toEqual({ a: '3', b: DAYPART_OPTIONS[0], c: 'x', d: '' });
  });
});

describe('resolveSlotValue', () => {
  const slotsOf = (code: string) => parseTemplateSlots(code).slots;

  it('stands for the declared default until the slot has been answered', () => {
    const [rate] = slotsOf('{{ratePerHour:number=-5}}');
    expect(resolveSlotValue(rate, {})).toBe('-5');
  });

  it('returns the answer once there is one', () => {
    const [rate] = slotsOf('{{ratePerHour:number=-5}}');
    expect(resolveSlotValue(rate, { ratePerHour: '2' })).toBe('2');
  });

  // Clearing a field is the same as never having answered it — a template that declares a default has
  // no way to say "deliberately blank", and the code it generates uses the default either way.
  it('returns a cleared field to what the template asked for', () => {
    const [rate] = slotsOf('{{ratePerHour:number=-5}}');
    expect(resolveSlotValue(rate, { ratePerHour: '' })).toBe('-5');
    expect(resolveSlotValue(rate, { ratePerHour: '   ' })).toBe('-5');
  });

  it('falls to the type’s own first option where the template declared nothing', () => {
    const [when, pick, which] = slotsOf('{{when:daypart}} {{pick:choice(x|y)}} {{which:stat}}');
    expect(resolveSlotValue(when, {})).toBe(DAYPART_OPTIONS[0]);
    expect(resolveSlotValue(pick, {})).toBe('x');
    expect(resolveSlotValue(which, {})).toBe('');
  });
});

describe('validateSlotValues', () => {
  const { slots } = parseTemplateSlots('{{a:number}} {{b:choice(x|y)}} {{c:stat}}');

  it('accepts well-formed values', () => {
    expect(validateSlotValues(slots, { a: '-2.5', b: 'y', c: 'Health' })).toEqual({});
  });

  it('flags blanks, non-numbers and off-list choices', () => {
    expect(validateSlotValues(slots, { a: 'lots', b: 'z', c: '' })).toEqual({
      a: 'Must be a number',
      b: 'Not one of the options',
      c: 'Required',
    });
  });

  // A slot the template gave a default is answered from the moment it is written, so an author typing
  // one into their code must not be told they left it out.
  it('asks nothing of a slot that declares its own default', () => {
    const { slots: withDefaults } = parseTemplateSlots('{{a:number=-5}} {{b:choice(x|y)=y}} {{c:stat}}');
    expect(validateSlotValues(withDefaults, {})).toEqual({ c: 'Required' });
  });
});

describe('fillTemplate', () => {
  it('quotes stat and daypart values but pastes numbers and choices verbatim', () => {
    const filled = fillTemplate(
      "s.name === {{who:stat}} && daypart === {{when:daypart}} && x {{op:choice(>=|<=)}} {{n:number}}",
      { who: 'Health', when: 'dawn', op: '>=', n: '7' },
    );
    expect(filled).toBe('s.name === "Health" && daypart === "dawn" && x >= 7');
  });

  // A saved author template's text slot holds code, not a string.
  it('pastes a text slot as typed', () => {
    expect(fillTemplate('stats.{{field:text=value}} + {{expr:text}}', { expr: 'self.max / 2' }))
      .toBe('stats.value + self.max / 2');
  });

  it('quotes an entity slot like the other name slots', () => {
    expect(fillTemplate('entities[{{who:entity}}]', { who: 'Old "Mira"' })).toBe('entities["Old \\"Mira\\""]');
  });

  it('escapes a stat name containing a quote instead of breaking the literal', () => {
    expect(fillTemplate('{{who:stat}}', { who: 'Ka"os' })).toBe('"Ka\\"os"');
  });

  it('falls back to the declared default when a value is missing', () => {
    expect(fillTemplate('{{n:number=12}}', {})).toBe('12');
  });

  it('reads a cleared value as the default too, so the code matches the form', () => {
    expect(fillTemplate('{{n:number=12}}', { n: '' })).toBe('12');
  });

  it('substitutes every occurrence of a repeated slot', () => {
    expect(fillTemplate('{{n:number=1}} + {{n}}', { n: '4' })).toBe('4 + 4');
  });

  it('emits 0 for an unparseable number rather than invalid code', () => {
    expect(fillTemplate('{{n:number}}', { n: 'abc' })).toBe('0');
  });

  describe('a trait slot picked from the owner’s traits', () => {
    const owner = ownerAnswer('Scarred');

    it('reroutes the `traits` it indexes through to `owner.traits`, and leaves a world pick on `traits`', () => {
      expect(fillTemplate('traits[{{t:trait}}].enabled', { t: owner })).toBe('owner.traits["Scarred"].enabled');
      expect(fillTemplate('traits?.[{{t:trait}}]', { t: owner })).toBe('owner.traits?.["Scarred"]');
      expect(fillTemplate('{{t:trait}}; persona.traits[{{t}}]', { t: owner })).toBe('"Scarred"; persona.traits["Scarred"]');
      expect(fillTemplate('traits[{{t:trait}}].enabled', { t: 'Scarred' })).toBe('traits["Scarred"].enabled');
    });

    it('runs through the sandbox as the owner’s trait', async () => {
      const rage = makeStat({ id: 'r', name: 'Rage', value: 9 });
      // The world holds a Scarred that is off, so only the owner's route reads on.
      const code = 'return traits[{{t:trait}}].enabled ? 1 : 2;';
      const options = {
        traits: [{ name: 'Scarred', enabled: false, acquired: false }],
        owner: { name: 'Bram', id: 'bram', traits: [{ name: 'Scarred', enabled: true, acquired: true }], stats: { stats: [rage] } },
      };
      expect(await executeStatCode(fillTemplate(code, { t: owner }), [], rage, options)).toMatchObject({ value: 1, error: null });
      expect(await executeStatCode(fillTemplate(code, { t: 'Scarred' }), [], rage, options)).toMatchObject({ value: 2, error: null });
    });
  });

  describe('a stat slot picked from the owner’s stats', () => {
    const owner = ownerAnswer('Rage');

    it('reroutes the `stats` it indexes through to `owner.stats`', () => {
      expect(fillTemplate('const a = stats[{{s:stat}}].value;', { s: owner })).toBe('const a = owner.stats["Rage"].value;');
      expect(fillTemplate('stats [ {{s:stat}} ].value', { s: owner })).toBe('owner.stats [ "Rage" ].value');
      expect(fillTemplate('stats?.[{{s:stat}}]?.value', { s: owner })).toBe('owner.stats?.["Rage"]?.value');
    });

    it('leaves a world pick on `stats`, and reads a plain answer as the world’s', () => {
      expect(fillTemplate('stats[{{s:stat}}].value', { s: 'Rage' })).toBe('stats["Rage"].value');
      expect(fillTemplate('stats[{{s:stat}}].value', {})).toBe('stats[""].value');
    });

    it('reroutes each use of a repeated slot', () => {
      expect(fillTemplate('stats[{{s:stat}}].max - stats[{{s}}].value', { s: owner })).toBe('owner.stats["Rage"].max - owner.stats["Rage"].value');
    });

    it('quotes the bare name where the slot is not indexed through `stats`', () => {
      expect(fillTemplate('const name = {{s:stat}}; foo.stats[{{s}}]; owner.stats[{{s}}]', { s: owner }))
        .toBe('const name = "Rage"; foo.stats["Rage"]; owner.stats["Rage"]');
    });

    it('escapes a quote in the name', () => {
      expect(fillTemplate('stats[{{s:stat}}]', { s: ownerAnswer('Ka"os') })).toBe('owner.stats["Ka\\"os"]');
    });

    it('splits an answer into its route and name', () => {
      expect(slotAnswer(owner)).toEqual({ route: 'owner', name: 'Rage' });
      expect(slotAnswer('Rage')).toEqual({ route: 'world', name: 'Rage' });
    });

    it('reads as filled, and runs through the sandbox as the owner’s stat', async () => {
      const slot: TemplateSlot = { name: 's', type: 'stat' };
      expect(validateSlotValues([slot], { s: owner })).toEqual({});
      const rage = { id: 'r', name: 'Rage', type: 'number', description: '', min: 0, max: 100, value: 9, regen: 0 } as Stat;
      const gold = { ...rage, id: 'g', name: 'Rage', value: 40 } as Stat;
      const result = await executeStatCode(fillTemplate('return stats[{{s:stat}}].value;', { s: owner }), [gold], rage, {
        owner: { name: 'Bram', id: 'bram', traits: [], stats: { stats: [rage] } },
      });
      expect(result).toMatchObject({ value: 9, error: null });
      const world = await executeStatCode(fillTemplate('return stats[{{s:stat}}].value;', { s: 'Rage' }), [gold], rage, {
        owner: { name: 'Bram', id: 'bram', traits: [], stats: { stats: [rage] } },
      });
      expect(world).toMatchObject({ value: 40, error: null });
    });
  });
});

describe('built-in templates', () => {
  it('have unique ids that isBuiltInTemplate recognizes, and no others', () => {
    const ids = BUILT_IN_TEMPLATES.map(t => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(isBuiltInTemplate(id)).toBe(true);
    expect(isBuiltInTemplate('something-else')).toBe(false);
  });

  it('declare only slots whose defaults survive validation', () => {
    for (const template of BUILT_IN_TEMPLATES) {
      const { slots, errors } = parseTemplateSlots(template.code, template.kind);
      expect(errors, template.name).toEqual([]);
      // A name slot has no sensible shipped default (world-specific), so fill it here the way the form will.
      const values = { ...defaultSlotValues(slots) };
      for (const slot of slots) {
        if (isNameSlotType(slot.type)) {
          values[slot.name] = { stat: 'Health', placeholder: 'Mood', trait: 'Cursed', entity: 'Mira', location: 'Inn', param: 'amount' }[slot.type];
        }
      }
      expect(validateSlotValues(slots, values), template.name).toEqual({});
    }
  });

  // The real bar: filled built-in code must actually run in the sandbox and return a number. A template
  // that only looks right is worthless, so each one goes through the same executor the game uses.
  const world: Stat[] = [
    makeStat({ id: 'self', name: 'Subject', value: 40, min: 0, max: 200 }),
    makeStat({ id: 'h', name: 'Health', value: 80 }),
    makeStat({ id: 's', name: 'Strength', value: 20 }),
  ];
  const self = world[0];
  const placeholders = phMap([
    { name: 'Mood', value: 'calm', values: ['calm', 'wary', 'angry', 'furious'], roll: () => 'calm' },
  ]);
  const traits: SandboxTrait[] = [
    { name: 'Cursed', enabled: true, acquired: true },
    { name: 'Blessed', enabled: false, acquired: false },
  ];
  const scarred: SandboxTrait = { name: 'Scarred', enabled: true, acquired: true };
  const wounded: SandboxTrait = { name: 'Wounded', enabled: true, acquired: true };
  const mira: SandboxEntity = { name: 'Mira', traits: [wounded] };
  const rook: SandboxEntity = { name: 'Rook', traits: [{ ...scarred }] };
  const castOptions = { placeholders, traits, persona: rook, entities: [mira, rook] };
  /** The world's names, the way the picker fills a slot of each kind. */
  const pickFor = (slot: TemplateSlot): string | undefined => {
    switch (slot.type) {
      case 'stat': return slot.name === 'secondStat' || slot.name === 'bonusStat' ? 'Strength' : 'Health';
      case 'placeholder': return placeholders[0].name;
      case 'trait': return slot.owner === PERSONA_SLOT_OWNER ? scarred.name : slot.owner ? wounded.name : traits[0].name;
      case 'entity': return mira.name;
      default: return undefined;
    }
  };

  // World Tool templates run through Try It's runner in worldToolTemplates.runsClean.test.ts.
  for (const template of BUILT_IN_TEMPLATES.filter((t) => t.kind === 'script')) {
    it(`runs in the sandbox: ${template.name}`, async () => {
      const { slots } = parseTemplateSlots(template.code);
      const values = { ...defaultSlotValues(slots) };
      for (const slot of slots) {
        const picked = pickFor(slot);
        if (picked !== undefined) values[slot.name] = picked;
      }
      // The clock its first timing hands it: the opening turn's zero hours where the turn start is read, which
      // is the turn those templates are written for, and a measured turn after the AI.
      const clock = template.kind === 'script' && readsTurnStart(template.timings[0])
        ? { deltaHours: 0, elapsedHours: 0 }
        : { deltaHours: 2, elapsedHours: 12 };
      const timing = template.kind === 'script' ? template.timings[0] : undefined;
      const result = await executeStatCode(fillTemplate(template.code, values), world, self, {
        ...castOptions, clock,
        ...(timing === 'output' && { narration: sampleNarration(SAMPLE_SENTENCE) }),
        ...(timing === 'switch' && { switchedTrait: { ...traits[0], owner: '' } }),
      });
      expect(result.error, template.name).toBeNull();
      // A template writes a value, a bound, a placeholder, a trait or a sentence; one that does nothing is broken.
      const wrote = result.value !== null || !!result.bounds || !!result.placeholders?.length || !!result.traits?.length
        || (result.sentence !== undefined && result.sentence !== SAMPLE_SENTENCE);
      expect(wrote, template.name).toBe(true);
    });
  }

  describe('the start and output templates', () => {
    const build = (id: string, values: Record<string, string>) => {
      const template = BUILT_IN_TEMPLATES.find(t => t.id === id)!;
      return fillTemplate(template.code, values);
    };

    it('starts a stat inside its range even when a limit is outside it or the limits are swapped', async () => {
      const code = build('builtin-random-starting-value', { low: '900', high: '-50' });
      for (let run = 0; run < 20; run++) {
        const { value, error } = await executeStatCode(code, world, self, { clock: { deltaHours: 0, elapsedHours: 0 } });
        expect(error).toBeNull();
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(200);
      }
    });

    it('replaces a word that holds an apostrophe', async () => {
      const code = build('builtin-replace-word', { word: "o'clock", replacement: 'hour' });
      const { sentence, error } = await executeStatCode(code, world, self, { narration: sampleNarration("It is ten o'clock.") });
      expect(error).toBeNull();
      expect(sentence).toBe('It is ten hour.');
    });
  });

  // The three write templates prove themselves by what the host reads back, not by a returned number:
  // a bound on `self`, a pin on a placeholder, and a switch on a trait.
  describe('the write templates', () => {
    const run = (id: string, values: Record<string, string>) => {
      const template = BUILT_IN_TEMPLATES.find(t => t.id === id)!;
      return executeStatCode(fillTemplate(template.code, values), world, self, { placeholders, traits });
    };

    it('sets the chosen bound from another stat times a factor, and leaves the value alone', async () => {
      // Health 80 × 2 lands Max at 160; Min and Regen are untouched.
      const result = await run('builtin-bound-from-stat', { source: 'Health', bound: 'max', factor: '2' });
      expect(result).toEqual({ value: null, error: null, bounds: { max: 160 } });
      // The same template writes Regen when the choice says so.
      const regen = await run('builtin-bound-from-stat', { source: 'Strength', bound: 'regen', factor: '0.5' });
      expect(regen.bounds).toEqual({ regen: 10 });
    });

    it('pins a placeholder to the value at the subject’s position in its range', async () => {
      // The subject sits at 40 of 0–200: a fifth of the way, so the first of four values.
      expect((await run('builtin-placeholder-follows-stat', { placeholder: 'Mood' })).placeholders)
        .toEqual([phWrite('Mood', 'calm')]);
      const high = { ...self, value: 200 };
      const template = BUILT_IN_TEMPLATES.find(t => t.id === 'builtin-placeholder-follows-stat')!;
      const atMax = await executeStatCode(
        fillTemplate(template.code, { placeholder: 'Mood' }), [high, ...world.slice(1)], high, { placeholders, traits },
      );
      // At Max the index would run past the list; it clamps to the last value.
      expect(atMax.placeholders).toEqual([phWrite('Mood', 'furious')]);
    });

    // The template hands over one of the placeholder's own values. On an Object that is one text, which
    // pins a one-item list, so the same template runs on either kind.
    it('pins an Object to a one-item list from the same template', async () => {
      const [hair] = phMap([{ name: 'Hair', value: ['grey', 'long'], roll: () => 'grey' }]);
      const template = BUILT_IN_TEMPLATES.find(t => t.id === 'builtin-placeholder-follows-stat')!;
      const result = await executeStatCode(
        fillTemplate(template.code, { placeholder: 'Hair' }), world, self, { placeholders: [...placeholders, hair], traits },
      );
      expect(result.error).toBeNull();
      expect(result.placeholders).toEqual([phWrite('Hair', ['grey'])]);
    });

    it('sets the opening value on the opening turn and leaves later turns alone', async () => {
      const template = BUILT_IN_TEMPLATES.find(t => t.id === 'builtin-opening-value')!;
      const code = fillTemplate(template.code, { openingValue: '75' });
      const at = (elapsedHours: number) =>
        executeStatCode(code, world, self, { clock: { deltaHours: 0, elapsedHours }, placeholders, traits });

      // The before box reads the clock at turn start, so the opening turn is the one at hour zero.
      expect((await at(0)).value).toBe(75);
      // Any later turn returns nothing, which leaves the value the turn found.
      expect(await at(1)).toEqual({ value: null, error: null });
      expect(await at(96)).toEqual({ value: null, error: null });
    });

    it('switches a trait on past the line and off below it', async () => {
      // 40 >= 50 is false, so an enabled trait switches off.
      expect((await run('builtin-trait-by-threshold', { trait: 'Cursed', comparison: '>=', threshold: '50' })).traits)
        .toEqual([{ name: 'Cursed', enabled: false }]);
      // 40 <= 50 is true, so an unacquired trait switches on.
      expect((await run('builtin-trait-by-threshold', { trait: 'Blessed', comparison: '<=', threshold: '50' })).traits)
        .toEqual([{ name: 'Blessed', enabled: true }]);
    });

    it('quotes placeholder and trait slots so a name with a space still reaches the map', () => {
      expect(fillTemplate('placeholders[{{p:placeholder}}].value', { p: 'Hair Color' }))
        .toBe('placeholders["Hair Color"].value');
      expect(fillTemplate('traits[{{t:trait}}].enabled', { t: 'Night Owl' }))
        .toBe('traits["Night Owl"].enabled');
    });
  });

  describe('Dice Roll With Consequences', () => {
    const template = BUILT_IN_TEMPLATES.find(t => t.id === 'builtin-dice-roll-consequences')!;
    const values = { bandPlaceholder: 'Mood', penaltyStat: 'Health', bonusStat: 'Strength' };
    // The sandbox's Math.random is QuickJS's own and cannot be seeded, so each case fixes the die.
    // `faces` is the unit draw the code scales by 20: 0 rolls a 1, 0.5 an 11, 0.99 a 20.
    const rollWith = (faces: number) =>
      executeStatCode(`Math.random = () => ${faces};\n${fillTemplate(template.code, values)}`, world, self, castOptions);

    it('lists the two target stats and the placeholder as slots, captioned like the other templates', () => {
      expect(parseTemplateSlots(template.code).slots.map(slot => [slot.type, humanizeSlotName(slot.name)])).toEqual([
        ['placeholder', 'Band Placeholder'],
        ['stat', 'Penalty Stat'],
        ['stat', 'Bonus Stat'],
      ]);
    });

    it('halves the penalty stat on a 1 and writes nothing else', async () => {
      const result = await rollWith(0);
      expect(result).toEqual({
        value: 1, error: null,
        statWrites: [{ id: 'h', name: 'Health', value: 40 }],
        placeholders: [phWrite('Mood', 'calm')],
      });
    });

    it('adds 1 to the bonus stat on a 20 and writes nothing else', async () => {
      const result = await rollWith(0.99);
      expect(result).toEqual({
        value: 20, error: null,
        statWrites: [{ id: 's', name: 'Strength', value: 21 }],
        placeholders: [phWrite('Mood', 'furious')],
      });
    });

    it('leaves both stats alone on any other roll and still pins the band', async () => {
      // A roll of 11 sits in the third of the placeholder's four bands.
      expect(await rollWith(0.5)).toEqual({ value: 11, error: null, placeholders: [phWrite('Mood', 'angry')] });
      // The rolls next to each edge are plain rolls: 2 does not halve, 19 does not add.
      const two = await rollWith(0.06);
      expect([two.value, two.statWrites, two.placeholders]).toEqual([2, undefined, [phWrite('Mood', 'calm')]]);
      const nineteen = await rollWith(0.9);
      expect([nineteen.value, nineteen.statWrites, nineteen.placeholders]).toEqual([19, undefined, [phWrite('Mood', 'furious')]]);
    });

    // Four bands over 20 rolls change at 5 to 6, 10 to 11 and 15 to 16.
    it('moves the pinned band at the edges between bands', async () => {
      const pinned = async (faces: number) => (await rollWith(faces)).placeholders;
      expect(await pinned(0.21)).toEqual([phWrite('Mood', 'calm')]);
      expect(await pinned(0.26)).toEqual([phWrite('Mood', 'wary')]);
      expect(await pinned(0.51)).toEqual([phWrite('Mood', 'angry')]);
      expect(await pinned(0.76)).toEqual([phWrite('Mood', 'furious')]);
    });

    it('is in the After the AI menu', () => {
      expect(templatesFor(BUILT_IN_TEMPLATES, 'script', 'after')).toContain(template);
    });
  });

  describe('the trait reader templates', () => {
    const run = (id: string, values: Record<string, string>, options: Parameters<typeof executeStatCode>[3]) => {
      const template = BUILT_IN_TEMPLATES.find(t => t.id === id)!;
      return executeStatCode(fillTemplate(template.code, values), world, self, options);
    };

    it('adds the bonus while the played persona has the trait on, and not otherwise', async () => {
      const values = { base: 'Health', trait: 'Scarred', bonus: '10' };
      // Health 80 plus the bonus.
      expect((await run('builtin-persona-trait-bonus', values, castOptions)).value).toBe(90);
      const off = { ...castOptions, persona: { ...rook, traits: [{ ...scarred, enabled: false }] } };
      expect((await run('builtin-persona-trait-bonus', values, off)).value).toBe(80);
      // No persona in play reads every trait as off, and the run does not fail.
      const none = await run('builtin-persona-trait-bonus', values, { ...castOptions, persona: undefined });
      expect(none).toEqual({ value: 80, error: null });
    });

    it('keeps a trait name with a quote inside its string', async () => {
      const values = { base: 'Health', trait: `Scar's "mark"`, bonus: '10' };
      const options = { ...castOptions, persona: { ...rook, traits: [{ name: `Scar's "mark"`, enabled: true, acquired: true }] } };
      expect((await run('builtin-persona-trait-bonus', values, options)).value).toBe(90);
    });

    it('keeps an entity name and its trait name with quotes inside their strings', async () => {
      const values = { base: 'Health', entity: `Old "Mira"`, trait: `Mira's wound`, penalty: '15' };
      const quoted: SandboxEntity = { name: `Old "Mira"`, traits: [{ name: `Mira's wound`, enabled: true, acquired: true }] };
      expect((await run('builtin-entity-trait-penalty', values, { ...castOptions, entities: [quoted] })).value).toBe(65);
    });

    it('subtracts the penalty while the named entity has the trait on, and not when it is out of play', async () => {
      const values = { base: 'Health', entity: 'Mira', trait: 'Wounded', penalty: '15' };
      expect((await run('builtin-entity-trait-penalty', values, castOptions)).value).toBe(65);
      const gone = await run('builtin-entity-trait-penalty', values, { ...castOptions, entities: [rook] });
      expect(gone).toEqual({ value: 80, error: null });
    });
  });

  it('computes the values the descriptions promise', async () => {
    const run = async (id: string, values: Record<string, string>, clock?: { deltaHours: number; elapsedHours: number }) => {
      const template = BUILT_IN_TEMPLATES.find(t => t.id === id)!;
      return executeStatCode(fillTemplate(template.code, values), world, self, { clock });
    };

    // Weight 0.5 is the plain average of Health 80 and Strength 20.
    expect(await run('builtin-weighted-blend', { firstStat: 'Health', secondStat: 'Strength', weight: '0.5' }))
      .toEqual({ value: 50, error: null });

    // Health sits at 80 of 100, so its inverse is 20.
    expect(await run('builtin-inverse', { source: 'Health' })).toEqual({ value: 20, error: null });

    // Health 80 >= 50, so the flag takes the subject's own max (200), not a hardcoded 100.
    expect(await run('builtin-threshold-flag', { source: 'Health', comparison: '>=', threshold: '50' }))
      .toEqual({ value: 200, error: null });
    // Flipping the comparison drops it to the subject's min.
    expect(await run('builtin-threshold-flag', { source: 'Health', comparison: '<=', threshold: '50' }))
      .toEqual({ value: 0, error: null });

    // A -5/hour drain over a two-hour turn takes the subject from 40 to 30.
    expect(await run('builtin-per-turn-change', { ratePerHour: '-5' }, { deltaHours: 2, elapsedHours: 2 }))
      .toEqual({ value: 30, error: null });

    // Half of a 24-hour timer, counting up across the subject's 0–200 range.
    expect(await run('builtin-timer', { totalHours: '24', direction: 'up' }, { deltaHours: 1, elapsedHours: 12 }))
      .toEqual({ value: 100, error: null });
    // Counting down is the mirror, which is why the two share one template.
    expect(await run('builtin-timer', { totalHours: '24', direction: 'down' }, { deltaHours: 1, elapsedHours: 18 }))
      .toEqual({ value: 50, error: null });

    // Hour 12 of a default calendar is midday, so a night bonus stays off and Health passes through.
    expect(await run('builtin-daypart-modifier', { base: 'Health', when: 'night', bonus: '20' }, { deltaHours: 1, elapsedHours: 4 }))
      .toEqual({ value: 80, error: null });
    // Naming the daypart the clock actually reads adds the bonus.
    const midday = await run('builtin-daypart-modifier', { base: 'Health', when: 'midday', bonus: '20' }, { deltaHours: 1, elapsedHours: 4 });
    expect(midday).toEqual({ value: 100, error: null });

    // Easing from 40 toward 100 at 0.1/hour over two hours covers a fifth of the gap: 40 + 60*0.2.
    expect(await run('builtin-regen-toward-target', { target: '100', rate: '0.1' }, { deltaHours: 2, elapsedHours: 2 }))
      .toEqual({ value: 52, error: null });
  });

  it('keeps the random roll inside the subject’s range', async () => {
    const template = BUILT_IN_TEMPLATES.find(t => t.id === 'builtin-random-roll')!;
    const code = fillTemplate(template.code, {});
    for (const elapsedHours of [1, 7, 23]) {
      const { value, error } = await executeStatCode(code, world, self, { clock: { deltaHours: 1, elapsedHours } });
      expect(error).toBeNull();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(200);
    }
  });
});

describe('which menus a template shows in', () => {
  const menu = (timing: ScriptTiming) => templatesFor(BUILT_IN_TEMPLATES, 'script', timing).map(t => t.name);

  it('keeps the clock-delta templates out of every menu but After the AI', () => {
    for (const timing of ['before', 'start', 'output', 'switch'] as const) {
      expect(menu(timing), timing).not.toContain('Hourly Change');
      expect(menu(timing), timing).not.toContain('Regen Toward Target');
    }
    expect(menu('after')).toEqual(expect.arrayContaining(['Hourly Change', 'Regen Toward Target']));
  });

  it('lists one formula in each menu it works in', () => {
    for (const timing of ['before', 'after', 'start', 'switch'] as const) expect(menu(timing), timing).toContain('Weighted Blend');
    expect(menu('output')).not.toContain('Weighted Blend');
  });

  // `deltaHours` is 0, `delta` is zeros and `previous` is the stat itself in every timing that reads the turn
  // start, so a template built on any of them runs there and quietly does nothing.
  it('offers no template built on a reading its timing zeroes', () => {
    const deadAtTurnStart = /deltaHours|delta[.]|previous/;
    for (const timing of SCRIPT_TIMINGS.filter(readsTurnStart)) {
      for (const template of templatesFor(BUILT_IN_TEMPLATES, 'script', timing)) {
        expect(template.code, `${template.name} at ${timing}`).not.toMatch(deadAtTurnStart);
      }
    }
  });

  it('shows each new template only in its own timing’s menu', () => {
    const own = {
      start: ['Random Starting Value', 'Start From Persona Trait'],
      switch: ['Change When a Trait Switches', 'Mirror a Trait'],
      output: ['Replace a Word', 'Count a Word', 'Bold a Word Past a Threshold'],
    } as const;
    for (const [timing, names] of Object.entries(own) as [ScriptTiming, readonly string[]][]) {
      expect(menu(timing), timing).toEqual(expect.arrayContaining([...names]));
      for (const other of SCRIPT_TIMINGS.filter(t => t !== timing)) {
        for (const name of names) expect(menu(other), `${name} in ${other}`).not.toContain(name);
      }
    }
  });

  it('never lists a template in a menu of the other kind', () => {
    const tool: CodeTemplate = { id: 't', kind: 'worldTool', name: 'Tool', description: '', code: '', timings: ['after'] };
    const stat: CodeTemplate = { id: 's', kind: 'script', name: 'Stat', description: '', code: '', timings: ['after'] };
    expect(templatesFor([tool, stat], 'script', 'after')).toEqual([stat]);
    expect(templatesFor([tool, stat], 'worldTool', 'after')).toEqual([tool]);
  });

  it('names every timing a template runs in', () => {
    const blend = BUILT_IN_TEMPLATES.find(t => t.id === 'builtin-weighted-blend')!;
    expect(templateTimingLabels(blend)).toEqual(['Before the AI', 'After the AI', 'At Game Start', 'When a Trait Switches']);
  });
});

describe('readTemplate', () => {
  it('reads its own output back unchanged', () => {
    for (const entry of [{ name: 'a', code: 'x', timing: 'before' }, { name: 'b', code: 'y', kind: 'worldTool', timings: ['after', 'call'] }]) {
      const once = readTemplate(entry);
      expect(once).not.toBeNull();
      expect(readTemplate(once)).toEqual(once);
    }
  });

  it('puts the picked timings in the kind’s order', () => {
    expect(readTemplate({ name: 'a', code: 'x', kind: 'worldTool', timings: ['after', 'call'] })?.timings).toEqual(['call', 'after']);
  });

  it('is no template without a name or code', () => {
    expect(readTemplate({ code: 'x' })).toBeNull();
    expect(readTemplate({ name: 'x' })).toBeNull();
    expect(readTemplate(null)).toBeNull();
  });
});
