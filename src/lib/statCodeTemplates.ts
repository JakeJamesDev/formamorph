/**
 * Templates for a stat's Dynamic Value Calculation code: a bundled read-only set plus whatever the author
 * saves locally. A template is ordinary sandbox code carrying inline slots, and filling a slot form
 * generates plain editable JS into the code field — nothing links the finished stat back to its template.
 *
 * Slot syntax is `{{name:type=default}}`; `type` and `=default` are both optional, and repeating a name
 * reuses the first occurrence's declaration. Substitution is textual, so a template controls its own
 * quoting: a `stat`, `placeholder`, `trait` or `daypart` slot emits a quoted string, while `number`,
 * `choice` and `text` emit their value verbatim (which is what lets a choice supply a comparison operator).
 */

export const SLOT_TYPES = ['stat', 'placeholder', 'trait', 'number', 'daypart', 'choice', 'text'] as const;
export type SlotType = (typeof SLOT_TYPES)[number];

/** The slot types filled from a list of the world's own names. Each renders as a quoted string. */
export const NAME_SLOT_TYPES = ['stat', 'placeholder', 'trait'] as const satisfies readonly SlotType[];
export type NameSlotType = (typeof NAME_SLOT_TYPES)[number];

export const isNameSlotType = (type: SlotType): type is NameSlotType =>
  (NAME_SLOT_TYPES as readonly SlotType[]).includes(type);

/** The six dayparts a `daypart` slot offers — the set `gameClock.daypart()` emits. */
export const DAYPART_OPTIONS = ['night', 'dawn', 'morning', 'midday', 'afternoon', 'evening'] as const;

export interface TemplateSlot {
  name: string;
  type: SlotType;
  /** Prefills the form control. Absent when the template declared no `=default`. */
  defaultValue?: string;
  /** The `choice(a|b|…)` options, in declaration order. Only ever set for `choice` slots. */
  options?: string[];
}

export interface StatCodeTemplate {
  id: string;
  name: string;
  description: string;
  code: string;
}

/** A template's slots plus anything malformed in its source, so a bad template shows an error instead of
 *  silently dropping a control. */
export interface ParsedTemplate {
  slots: TemplateSlot[];
  errors: string[];
}

// `{{ name : type(options) = default }}`. The default runs to the closing braces, so it may contain
// anything but `}` — enough for operators and numbers, and slots needing more belong in the code body.
const SLOT_PATTERN = /\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*(?::\s*([A-Za-z]+)\s*(?:\(([^)]*)\))?\s*)?(?:=\s*([^}]*?)\s*)?\}\}/g;

/** Where each slot sits in the source, for surfaces that colour the syntax rather than fill it in. Shares
 *  the one pattern, so a slot the parser accepts is a slot the editor marks. */
export function findSlotRanges(code: string): { from: number; to: number }[] {
  return [...(code || '').matchAll(SLOT_PATTERN)].map(match => ({
    from: match.index,
    to: match.index + match[0].length,
  }));
}

const isSlotType = (value: string): value is SlotType => (SLOT_TYPES as readonly string[]).includes(value);

/**
 * Read a template's slot declarations in source order. A repeated name collapses to the single control
 * that fills every occurrence; only its first declaration counts, and a later one that contradicts it is
 * reported rather than applied.
 */
export function parseTemplateSlots(code: string): ParsedTemplate {
  const slots: TemplateSlot[] = [];
  const byName = new Map<string, TemplateSlot>();
  const errors: string[] = [];

  for (const match of (code || '').matchAll(SLOT_PATTERN)) {
    const [, name, rawType, rawOptions, rawDefault] = match;
    const existing = byName.get(name);

    if (existing) {
      if (rawType && rawType !== existing.type) {
        errors.push(`Slot "${name}" is declared as both ${existing.type} and ${rawType}.`);
      }
      continue;
    }

    const type: SlotType = rawType ? (isSlotType(rawType) ? rawType : 'text') : 'text';
    if (rawType && !isSlotType(rawType)) {
      errors.push(`Slot "${name}" has unknown type "${rawType}" — treating it as text.`);
    }

    const options = rawOptions === undefined
      ? undefined
      : rawOptions.split('|').map(option => option.trim()).filter(Boolean);

    if (type === 'choice' && (!options || options.length === 0)) {
      errors.push(`Slot "${name}" is a choice but lists no options.`);
    }

    const slot: TemplateSlot = { name, type };
    if (rawDefault !== undefined && rawDefault !== '') slot.defaultValue = rawDefault;
    if (options && options.length > 0) slot.options = options;

    byName.set(name, slot);
    slots.push(slot);
  }

  return { slots, errors };
}

/** A slot's name as a form caption: `ratePerHour` reads as "Rate Per Hour". Templates name slots the way
 *  code names things, and a raw identifier as a field label is both unfriendly and off the title-case
 *  style every other caption follows. */
export function humanizeSlotName(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

/** Where a slot starts before anyone has answered it: what it declared, or its type's own first option. */
const slotStartingPoint = (slot: TemplateSlot): string => slot.defaultValue
  ?? (slot.type === 'daypart' ? DAYPART_OPTIONS[0] : slot.type === 'choice' ? (slot.options?.[0] ?? '') : '');

/**
 * What a slot stands for given the answers so far. Blank and unanswered are the same thing: a template
 * that declares a default has no way to express "deliberately empty", so clearing a field returns it to
 * what the template asked for rather than to nothing.
 *
 * Every surface reads a slot through here — the form, its validation, and the code it generates — so the
 * value an author sees in the field is the one that ends up in the code.
 */
export function resolveSlotValue(slot: TemplateSlot, values: Record<string, string>): string {
  const answer = (values[slot.name] ?? '').trim();
  return answer !== '' ? answer : slotStartingPoint(slot);
}

/** The starting form state for a template: each slot's declared default, or a sensible empty value. */
export function defaultSlotValues(slots: TemplateSlot[]): Record<string, string> {
  const values: Record<string, string> = {};
  for (const slot of slots) values[slot.name] = slotStartingPoint(slot);
  return values;
}

/** How one filled slot reaches the generated code. String-valued slots are emitted as JSON so an authored
 *  name containing a quote can't break out of its literal; the rest are pasted as written. */
function renderSlot(slot: TemplateSlot, raw: string): string {
  const value = (raw ?? '').trim();
  if (isNameSlotType(slot.type)) return JSON.stringify(value);
  switch (slot.type) {
    case 'daypart':
      return JSON.stringify(value);
    case 'text':
      return value;
    case 'number': {
      const parsed = Number(value);
      // A blank or unparseable number would generate code that throws at run time; 0 keeps it valid and
      // the form flags the field, so the author sees the problem before the sandbox does.
      return Number.isFinite(parsed) ? String(parsed) : '0';
    }
    case 'choice':
      return value;
  }
}

/** Every slot whose supplied value can't be used as-is, keyed by slot name. */
export function validateSlotValues(slots: TemplateSlot[], values: Record<string, string>): Record<string, string> {
  const problems: Record<string, string> = {};
  for (const slot of slots) {
    const value = resolveSlotValue(slot, values);
    if (value === '') {
      problems[slot.name] = 'Required';
    } else if (slot.type === 'number' && !Number.isFinite(Number(value))) {
      problems[slot.name] = 'Must be a number';
    } else if (slot.type === 'choice' && slot.options && !slot.options.includes(value)) {
      problems[slot.name] = 'Not one of the options';
    }
  }
  return problems;
}

/** Fill a template's slots and return runnable sandbox code. Unfilled slots stand for their declared
 *  default, so a partially completed form still previews. */
export function fillTemplate(code: string, values: Record<string, string>): string {
  const { slots } = parseTemplateSlots(code);
  const byName = new Map(slots.map(slot => [slot.name, slot]));

  return (code || '').replace(SLOT_PATTERN, (_match, name: string) => {
    const slot = byName.get(name);
    if (!slot) return '';
    return renderSlot(slot, resolveSlotValue(slot, values));
  });
}

/**
 * The bundled templates. Eight value formulas rather than a longer literal list: a signed rate covers
 * decay and growth, a comparison slot covers both threshold directions, a direction slot covers counting
 * up and down, and "regen toward target" with the target set to the stat's max is the soft-capped regen.
 * Three more show each write the sandbox reads back: a bound on `self`, a placeholder pin, a trait switch.
 *
 * Each reads its own bounds from the stat it belongs to instead of assuming 0–100, and the four that
 * name a clock variable thereby qualify for the every-turn run schedule (see `usesStatClock`).
 */
export const BUILT_IN_TEMPLATES: readonly StatCodeTemplate[] = [
  {
    id: 'builtin-weighted-blend',
    name: 'Weighted Blend',
    description: 'Combine two other stats. A weight of 0.5 is a plain average; 1 is all of the first stat.',
    code: `const a = stats[{{firstStat:stat}}].value;
const b = stats[{{secondStat:stat}}].value;
const weight = {{weight:number=0.5}};
return a * weight + b * (1 - weight);`,
  },
  {
    id: 'builtin-inverse',
    name: 'Inverse of a Stat',
    description: 'Mirror another stat within its own range — high Rest becomes low Fatigue.',
    code: `const source = stats[{{source:stat}}];
return source.max - source.value;`,
  },
  {
    id: 'builtin-threshold-flag',
    name: 'Threshold Flag',
    description: 'Snap to this stat’s max or min depending on whether another stat has crossed a line.',
    code: `const source = stats[{{source:stat}}].value;
return source {{comparison:choice(>=|<=)=>=}} {{threshold:number=50}} ? self.max : self.min;`,
  },
  {
    id: 'builtin-per-turn-change',
    name: 'Per-Turn Change',
    description: 'Drift by a fixed amount per story hour. A negative rate drains (hunger, fuel), a positive one fills. Stacks with Regen, so set one or the other.',
    code: `const ratePerHour = {{ratePerHour:number=-5}};
return self.value + ratePerHour * deltaHours;`,
  },
  {
    id: 'builtin-timer',
    name: 'Timer',
    description: 'Sweep across this stat’s range over a set number of story hours, counting up to it or down from it.',
    code: `const totalHours = {{totalHours:number=24}};
const fraction = Math.min(1, Math.max(0, elapsedHours / totalHours));
const progress = '{{direction:choice(up|down)=up}}' === 'up' ? fraction : 1 - fraction;
return self.min + (self.max - self.min) * progress;`,
  },
  {
    id: 'builtin-daypart-modifier',
    name: 'Daypart Modifier',
    description: 'Follow another stat, with a bonus that only applies during one part of the day.',
    code: `const base = stats[{{base:stat}}].value;
return base + (daypart === {{when:daypart=night}} ? {{bonus:number=20}} : 0);`,
  },
  {
    id: 'builtin-random-roll',
    name: 'Random Per-Turn Roll',
    description: 'A fresh random value each turn, spread across this stat’s range. Use only one of these per world — a second would draw the same numbers.',
    code: `// elapsedHours keeps the roll moving even when the clock seed hasn't changed between turns.
const roll = (Math.random() * 100 + elapsedHours) % 100;
return self.min + (self.max - self.min) * (roll / 100);`,
  },
  {
    id: 'builtin-regen-toward-target',
    name: 'Regen Toward Target',
    description: 'Ease toward a resting value from either side, slowing as it arrives. Set the target to this stat’s max for a soft-capped regen. Stacks with Regen, so set one or the other.',
    code: `const value = self.value;
const target = {{target:number=100}};
const rate = {{rate:number=0.1}};
return value + (target - value) * rate * deltaHours;`,
  },
  {
    id: 'builtin-bound-from-stat',
    name: 'Bound From Another Stat',
    description: 'Set this stat’s Min, Max, or Regen from another stat times a factor. The value keeps its normal changes.',
    code: `const source = stats[{{source:stat}}].value;
self.{{bound:choice(max|min|regen)=max}} = Math.round(source * {{factor:number=2}});`,
  },
  {
    id: 'builtin-placeholder-follows-stat',
    name: 'Placeholder Follows This Stat',
    description: 'Pin a placeholder to one of its values by where this stat sits in its range: the first value at Min, the last at Max.',
    code: `const target = placeholders[{{placeholder:placeholder}}];
const span = self.max - self.min || 1;
const band = Math.floor((self.value - self.min) / span * target.values.length);
if (target.values.length) target.pin(target.values[Math.max(0, Math.min(band, target.values.length - 1))]);`,
  },
  {
    id: 'builtin-trait-by-threshold',
    name: 'Trait by Threshold',
    description: 'Switch a trait on while this stat is past a line, and off once it comes back. Code can switch a trait the player can’t toggle.',
    code: `traits[{{trait:trait}}].enabled = self.value {{comparison:choice(>=|<=)=>=}} {{threshold:number=50}};`,
  },
];

/** Whether a template is one of the bundled, read-only ones. */
export const isBuiltInTemplate = (id: string): boolean => BUILT_IN_TEMPLATES.some(template => template.id === id);
