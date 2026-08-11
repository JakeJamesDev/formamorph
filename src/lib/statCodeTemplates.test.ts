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
  isBuiltInTemplate,
  BUILT_IN_TEMPLATES,
  DAYPART_OPTIONS,
} from './statCodeTemplates';
import { executeStatCode, usesStatClock } from './statCodeExecutor';
import type { Stat } from '@/types';

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
      const { slots, errors } = parseTemplateSlots(template.code);
      expect(errors, template.name).toEqual([]);
      // A stat slot has no sensible shipped default (world-specific), so fill it here the way the form will.
      const values = { ...defaultSlotValues(slots) };
      for (const slot of slots) if (slot.type === 'stat') values[slot.name] = 'Health';
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

  for (const template of BUILT_IN_TEMPLATES) {
    it(`runs in the sandbox: ${template.name}`, async () => {
      const { slots } = parseTemplateSlots(template.code);
      const values = { ...defaultSlotValues(slots) };
      for (const slot of slots) {
        if (slot.type === 'stat') values[slot.name] = slot.name === 'secondStat' ? 'Strength' : 'Health';
      }
      const result = await executeStatCode(fillTemplate(template.code, values), world, self, {
        deltaHours: 2,
        elapsedHours: 12,
      });
      expect(result.error, template.name).toBeNull();
      expect(typeof result.value, template.name).toBe('number');
    });
  }

  it('gives the time-driven templates an every-turn run schedule and leaves derived ones on stat-change', () => {
    const scheduleById = Object.fromEntries(
      BUILT_IN_TEMPLATES.map(t => [t.id, usesStatClock(t.code)]),
    );
    expect(scheduleById).toEqual({
      'builtin-weighted-blend': false,
      'builtin-inverse': false,
      'builtin-threshold-flag': false,
      'builtin-per-turn-change': true,
      'builtin-timer': true,
      'builtin-daypart-modifier': true,
      'builtin-random-roll': true,
      'builtin-regen-toward-target': true,
    });
  });

  it('computes the values the descriptions promise', async () => {
    const run = async (id: string, values: Record<string, string>, clock?: { deltaHours: number; elapsedHours: number }) => {
      const template = BUILT_IN_TEMPLATES.find(t => t.id === id)!;
      return executeStatCode(fillTemplate(template.code, values), world, self, clock);
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
      const { value, error } = await executeStatCode(code, world, self, { deltaHours: 1, elapsedHours });
      expect(error).toBeNull();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(200);
    }
  });
});
