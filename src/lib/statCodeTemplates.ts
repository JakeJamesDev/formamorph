/**
 * Templates for stat scripts, world scripts and World Tool scripts: a bundled read-only set plus whatever the author
 * saves locally. A template is ordinary sandbox code carrying inline slots, and filling a slot form
 * generates plain editable JS into the code field — nothing links the finished script back to its template.
 *
 * Slot syntax is `{{name:type=default}}`; `type` and `=default` are both optional, and repeating a name
 * reuses the first occurrence's declaration. Substitution is textual, so a template controls its own
 * quoting: a `stat`, `placeholder`, `trait`, `entity`, `location`, `param` or `daypart` slot emits a quoted string, while
 * `number`, `choice` and `text` emit their value as typed (which is what lets a choice supply a comparison
 * operator). `trait(slot)` and `stat(slot)` list the traits or stats of the entity that `entity` slot picked, and
 * `trait(persona)` and `stat(persona)` list the persona's, unless the template declares an `entity` slot named `persona`.
 */

import type { ScriptTiming, ToolParam, ToolParamType, ToolScriptTiming } from '@/types';
import { SCRIPT_TIMING_LABEL, SCRIPT_TIMINGS } from './scripts';
import { WORLD_SCRIPT_TEMPLATES } from './worldScriptTemplates';
import { WORLD_TOOL_TEMPLATES } from './worldToolTemplates';

export const SLOT_TYPES = ['stat', 'placeholder', 'trait', 'entity', 'location', 'param', 'number', 'daypart', 'choice', 'text'] as const;
export type SlotType = (typeof SLOT_TYPES)[number];

/** The slot types filled from a list of names: the world's own, or a Tool's Parameters. Each renders as a quoted string. */
export const NAME_SLOT_TYPES = ['stat', 'placeholder', 'trait', 'entity', 'location', 'param'] as const satisfies readonly SlotType[];
export type NameSlotType = (typeof NAME_SLOT_TYPES)[number];

export const isNameSlotType = (type: SlotType): type is NameSlotType =>
  (NAME_SLOT_TYPES as readonly SlotType[]).includes(type);

/** The six dayparts a `daypart` slot offers — the set `gameClock.daypart()` emits. */
export const DAYPART_OPTIONS = ['night', 'dawn', 'morning', 'midday', 'afternoon', 'evening'] as const;

/** The Parameter types a `param` slot can create. A list needs options, which a slot can't give. */
export const SLOT_PARAM_TYPES = ['string', 'number', 'boolean'] as const satisfies readonly ToolParamType[];
export type SlotParamType = (typeof SLOT_PARAM_TYPES)[number];

export interface TemplateSlot {
  name: string;
  type: SlotType;
  /** The type of Parameter a `param` slot picks or creates. Always set for a `param` slot. */
  paramType?: SlotParamType;
  /** Prefills the form control. Absent when the template declared no `=default`. */
  defaultValue?: string;
  /** The `choice(a|b|…)` options, in declaration order. Only ever set for `choice` slots. */
  options?: string[];
  /** Whose traits or stats a `trait` or `stat` slot lists: `persona`, or the name of an `entity` slot. Absent, the world's. */
  owner?: string;
}

/** The `trait(…)` or `stat(…)` owner that lists the persona's traits or stats. */
export const PERSONA_SLOT_OWNER = 'persona';

/** The surface a template is written for: a stat script box, a world script box, or a World Tool's Script box. */
export type TemplateKind = 'script' | 'worldScript' | 'worldTool';

/** The timings each kind's boxes run at, in the order its picker lists them. */
export const TEMPLATE_TIMINGS = {
  script: SCRIPT_TIMINGS,
  worldScript: SCRIPT_TIMINGS,
  worldTool: ['call', 'output', 'after'],
} as const satisfies { script: readonly ScriptTiming[]; worldScript: readonly ScriptTiming[]; worldTool: readonly ToolScriptTiming[] };

/** Each kind's timing names wherever an author reads them. */
export const TEMPLATE_TIMING_LABEL: {
  script: Record<ScriptTiming, string>; worldScript: Record<ScriptTiming, string>; worldTool: Record<ToolScriptTiming, string>;
} = {
  script: SCRIPT_TIMING_LABEL,
  worldScript: SCRIPT_TIMING_LABEL,
  worldTool: { call: 'On Call', output: 'During AI Output', after: 'After the AI' },
};

/** The names of every timing a template runs in. */
export const templateTimingLabels = (template: CodeTemplate): string[] => {
  const labels: Record<string, string> = TEMPLATE_TIMING_LABEL[template.kind];
  return template.timings.map((timing) => labels[timing]);
};

/** `template` running in the picked timings of its kind, in its kind's order. Anything else picked drops. */
export const withTimings = (template: CodeTemplate, picked: readonly unknown[]): CodeTemplate => {
  const timings = TEMPLATE_TIMINGS[template.kind].filter((timing) => picked.includes(timing));
  // The kind's own list holds only that kind's timings, which the union can't express.
  return { ...template, timings } as CodeTemplate;
};

/** The timing type of one kind's boxes. */
export type TemplateTiming<K extends TemplateKind> = K extends 'worldTool' ? ToolScriptTiming : ScriptTiming;

interface TemplateFields {
  id: string;
  name: string;
  description: string;
  code: string;
}

/** A code template. `timings` lists every box it works in and is never empty. */
export type CodeTemplate =
  | TemplateFields & { kind: 'script'; timings: ScriptTiming[] }
  | TemplateFields & { kind: 'worldScript'; timings: ScriptTiming[] }
  | TemplateFields & { kind: 'worldTool'; timings: ToolScriptTiming[] };

/** The templates of `kind` whose timings hold `timing`, in their given order: one box's menu. */
export const templatesFor = <K extends TemplateKind>(
  templates: readonly CodeTemplate[],
  kind: K,
  timing: TemplateTiming<K>,
): CodeTemplate[] => templates.filter((template) =>
  template.kind === kind && (template.timings as readonly string[]).includes(timing));

/**
 * A stored or imported entry as a template, or null when it is none. An entry with no `kind` is the version 1
 * shape: a stat script with `['before']`, or `['after']` for any other timing. Timings outside the kind's set
 * drop, and an entry left with none is null. Idempotent.
 */
export function readTemplate(entry: unknown): CodeTemplate | null {
  if (!entry || typeof entry !== 'object') return null;
  const row = entry as Record<string, unknown>;
  if (typeof row.name !== 'string' || typeof row.code !== 'string') return null;
  const fields: TemplateFields = {
    id: typeof row.id === 'string' ? row.id : '',
    name: row.name,
    description: typeof row.description === 'string' ? row.description : '',
    code: row.code,
  };
  if (row.kind === undefined) return { ...fields, kind: 'script', timings: [row.timing === 'before' ? 'before' : 'after'] };
  if (row.kind !== 'script' && row.kind !== 'worldScript' && row.kind !== 'worldTool') return null;
  const template = withTimings({ ...fields, kind: row.kind, timings: [] }, Array.isArray(row.timings) ? row.timings : []);
  return template.timings.length ? template : null;
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
export function findSlotRanges(code: string): { from: number; to: number; name: string }[] {
  return [...(code || '').matchAll(SLOT_PATTERN)].map(match => ({
    from: match.index,
    to: match.index + match[0].length,
    name: match[1],
  }));
}

const isSlotType = (value: string): value is SlotType => (SLOT_TYPES as readonly string[]).includes(value);
const isSlotParamType = (value: string): value is SlotParamType => (SLOT_PARAM_TYPES as readonly string[]).includes(value);

/**
 * Read a template's slot declarations in source order. A repeated name collapses to the single control
 * that fills every occurrence; only its first declaration counts, and a later one that contradicts it is
 * reported rather than applied. A `param` slot outside a World Tool template is reported and reads as text.
 */
export function parseTemplateSlots(code: string, kind?: TemplateKind): ParsedTemplate {
  const slots: TemplateSlot[] = [];
  const byName = new Map<string, TemplateSlot>();
  const errors: string[] = [];

  for (const match of (code || '').matchAll(SLOT_PATTERN)) {
    const [, name, rawType, rawOptions, rawDefault] = match;
    const existing = byName.get(name);
    const stray = kind !== undefined && kind !== 'worldTool' && rawType === 'param';

    if (existing) {
      if (rawType && !stray && rawType !== existing.type) {
        errors.push(`Slot "${name}" is declared as both ${existing.type} and ${rawType}.`);
      }
      continue;
    }

    const type: SlotType = rawType && isSlotType(rawType) && !stray ? rawType : 'text';
    if (rawType && !isSlotType(rawType)) {
      errors.push(`Slot "${name}" has unknown type "${rawType}" — treating it as text.`);
    } else if (stray) {
      errors.push(`Slot "${name}" is a parameter slot, which only World Tool templates take — treating it as text.`);
    }

    const options = rawOptions === undefined
      ? undefined
      : rawOptions.split('|').map(option => option.trim()).filter(Boolean);

    if (type === 'choice' && (!options || options.length === 0)) {
      errors.push(`Slot "${name}" is a choice but lists no options.`);
    }

    const slot: TemplateSlot = { name, type };
    if (rawDefault !== undefined && rawDefault !== '') slot.defaultValue = rawDefault;
    if (type === 'param') {
      const paramType = options?.[0];
      const known = paramType === undefined || isSlotParamType(paramType);
      if (!known) errors.push(`Slot "${name}" has unknown Parameter type "${paramType}" — treating it as text.`);
      slot.paramType = known && paramType ? paramType : 'string';
    } else if ((type === 'trait' || type === 'stat') && options?.length === 1) slot.owner = options[0];
    else if (options && options.length > 0) slot.options = options;

    byName.set(name, slot);
    slots.push(slot);
  }

  // A tie to anything but an entity slot or `persona` is dropped, so the slot lists the world's names.
  for (const slot of slots) {
    if (slot.owner === undefined || slot.owner === PERSONA_SLOT_OWNER || byName.get(slot.owner)?.type === 'entity') continue;
    delete slot.owner;
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

/** The name a Parameter slot gives the Parameter it creates: the declared name, else the slot's own. */
export const newParamName = (slot: TemplateSlot): string => slot.defaultValue ?? slot.name;

/** Where a slot starts before anyone has answered it: what it declared, or its type's own first option. */
function slotStartingPoint(slot: TemplateSlot): string {
  if (slot.type === 'param') return newParamName(slot);
  if (slot.defaultValue !== undefined) return slot.defaultValue;
  if (slot.type === 'daypart') return DAYPART_OPTIONS[0];
  return slot.type === 'choice' ? (slot.options?.[0] ?? '') : '';
}

/**
 * The Parameters a filled template reads that the Tool doesn't have yet: one per missing name, in slot
 * order, each with the slot's type. A name the Tool already holds adds nothing, whatever its type.
 */
export function missingParams(
  slots: readonly TemplateSlot[],
  values: Record<string, string>,
  have: readonly Pick<ToolParam, 'name' | 'type'>[],
): ToolParam[] {
  const names = new Set(have.map((param) => param.name));
  const created: ToolParam[] = [];
  for (const slot of slots) {
    if (slot.type !== 'param') continue;
    const name = resolveSlotValue(slot, values);
    if (!name || names.has(name)) continue;
    names.add(name);
    created.push({ name, type: slot.paramType ?? 'string', description: '', required: true, options: [] });
  }
  return created;
}

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

/** How one filled slot reaches the generated code. Name and daypart slots are emitted as JSON so an
 *  authored name containing a quote can't break out of its literal; the rest are pasted as typed. */
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

// A stat or trait slot's answer is a name, or an owner's name behind this control-character mark.
const OWNER_MARK = '\u0001owner\u0001';

/** The answer a stat or trait slot takes for the owner's own stat or trait `name`. */
export const ownerAnswer = (name: string): string => OWNER_MARK + name;

/** Which list a stat or trait slot's answer came from, and the name. A plain answer is the world's. */
export function slotAnswer(answer: string): { route: 'owner' | 'world'; name: string } {
  return answer.startsWith(OWNER_MARK)
    ? { route: 'owner', name: answer.slice(OWNER_MARK.length) }
    : { route: 'world', name: answer };
}

// `stats` or `traits` as the word that indexes a slot, by `[` or `?.[`: not a member of something (`foo.stats`) or a longer name.
const indexedBy = (list: string) => new RegExp(`(^|[^\\w$.])(${list})(\\s*(?:\\?\\.\\s*)?\\[\\s*)$`);
const OWNER_ROUTES: Partial<Record<SlotType, RegExp>> = { stat: indexedBy('stats'), trait: indexedBy('traits') };

/** Fill a template's slots and return runnable sandbox code. Unfilled slots stand for their declared
 *  default, so a partially completed form still previews. An owner's answer reroutes the `stats` or `traits`
 *  that indexes its slot to `owner.stats` or `owner.traits`. A slot used any other way gets the bare name. */
export function fillTemplate(code: string, values: Record<string, string>): string {
  const source = code || '';
  const { slots } = parseTemplateSlots(source);
  const byName = new Map(slots.map(slot => [slot.name, slot]));

  let out = '';
  let from = 0;
  for (const match of source.matchAll(SLOT_PATTERN)) {
    out += source.slice(from, match.index);
    from = match.index + match[0].length;
    const slot = byName.get(match[1]);
    if (!slot) continue;
    let answer = resolveSlotValue(slot, values);
    const ownerRoute = OWNER_ROUTES[slot.type];
    if (ownerRoute) {
      const { route, name } = slotAnswer(answer);
      answer = name;
      if (route === 'owner') out = out.replace(ownerRoute, (_all, lead: string, list: string, open: string) => `${lead}owner.${list}${open}`);
    }
    out += renderSlot(slot, answer);
  }
  return out + source.slice(from);
}

/**
 * The bundled templates, every menu's in one list. Eight value formulas rather than a longer literal list: a
 * signed rate covers decay and growth, a comparison slot covers both threshold directions, a direction slot
 * covers counting up and down, and "regen toward target" with the target set to the stat's max is the
 * soft-capped regen. A template that reads `clock.deltaHours` lists After the AI alone, since every other
 * timing reads a zero delta.
 *
 * Each reads its own bounds from the stat it belongs to instead of assuming 0–100. The World Tool and world
 * script sets lead, from their own files.
 */
export const BUILT_IN_TEMPLATES: readonly CodeTemplate[] = [
  ...WORLD_TOOL_TEMPLATES,
  ...WORLD_SCRIPT_TEMPLATES,
  {
    id: 'builtin-weighted-blend',
    kind: 'script',
    timings: ['before', 'after', 'start', 'switch'],
    name: 'Weighted Blend',
    description: 'Combine two other stats. A weight of 0.5 is a plain average; 1 is all of the first stat.',
    code: `const a = stats[{{firstStat:stat}}].value;
const b = stats[{{secondStat:stat}}].value;
const weight = {{weight:number=0.5}};
return a * weight + b * (1 - weight);`,
  },
  {
    id: 'builtin-inverse',
    kind: 'script',
    timings: ['before', 'after', 'start', 'switch'],
    name: 'Inverse of Another Stat',
    description: "Invert another stat across this stat's range. High Rest reads as low Fatigue.",
    code: `const source = stats[{{source:stat}}];
return source.max - source.value;`,
  },
  {
    id: 'builtin-threshold-flag',
    kind: 'script',
    timings: ['before', 'after', 'start', 'switch'],
    name: 'Threshold Flag',
    description: 'Set this stat to Max when another stat passes a threshold, and to Min when it does not.',
    code: `const source = stats[{{source:stat}}].value;
return source {{comparison:choice(>=|<=)=>=}} {{threshold:number=50}} ? self.max : self.min;`,
  },
  {
    id: 'builtin-per-turn-change',
    kind: 'script',
    timings: ['after'],
    name: 'Hourly Change',
    description: 'Change by a fixed amount per story hour. A negative rate decreases (hunger, fuel). A positive rate increases. Stacks with Regen, so set one or the other.',
    code: `const ratePerHour = {{ratePerHour:number=-5}};
return self.value + ratePerHour * clock.deltaHours;`,
  },
  {
    id: 'builtin-timer',
    kind: 'script',
    timings: ['before', 'after'],
    name: 'Timer',
    description: 'Move across this stat’s range over a set number of story hours, up or down.',
    code: `const totalHours = {{totalHours:number=24}};
const fraction = Math.min(1, Math.max(0, clock.elapsedHours / totalHours));
const progress = '{{direction:choice(up|down)=up}}' === 'up' ? fraction : 1 - fraction;
return self.min + (self.max - self.min) * progress;`,
  },
  {
    id: 'builtin-daypart-modifier',
    kind: 'script',
    timings: ['before', 'after', 'start', 'switch'],
    name: 'Daypart Modifier',
    description: 'Follow another stat, with a bonus that only applies during one part of the day.',
    code: `const base = stats[{{base:stat}}].value;
return base + (clock.daypart === {{when:daypart=night}} ? {{bonus:number=20}} : 0);`,
  },
  {
    id: 'builtin-random-roll',
    kind: 'script',
    timings: ['before', 'after'],
    name: 'Random Per-Turn Roll',
    description: 'A fresh random value each turn, spread across this stat’s range.',
    code: `// clock.elapsedHours keeps the roll moving even when the clock seed hasn't changed between turns.
const roll = (Math.random() * 100 + clock.elapsedHours) % 100;
return self.min + (self.max - self.min) * (roll / 100);`,
  },
  {
    id: 'builtin-regen-toward-target',
    kind: 'script',
    timings: ['after'],
    name: 'Regen Toward Target',
    description: 'Move toward a target value from either side. The step shrinks near the target. Set the target to this stat’s max for a soft-capped regen. Stacks with Regen, so set one or the other.',
    code: `const value = self.value;
const target = {{target:number=100}};
const rate = {{rate:number=0.1}};
return value + (target - value) * rate * clock.deltaHours;`,
  },
  {
    id: 'builtin-bound-from-stat',
    kind: 'script',
    timings: ['before', 'after', 'start', 'switch'],
    name: 'Bound From Another Stat',
    description: 'Set this stat’s Min, Max, or Regen from another stat times a factor. The value keeps its normal changes.',
    code: `const source = stats[{{source:stat}}].value;
self.{{bound:choice(max|min|regen)=max}} = Math.round(source * {{factor:number=2}});`,
  },
  {
    id: 'builtin-persona-trait-bonus',
    kind: 'script',
    timings: ['before', 'after', 'start', 'switch'],
    name: 'Bonus From Persona Trait',
    description: 'Follow another stat, with a bonus while the played persona has a trait on. A persona with no such trait gets no bonus.',
    code: `const base = stats[{{base:stat}}].value;
const active = persona.traits[{{trait:trait(persona)}}].enabled;
return base + (active ? {{bonus:number=10}} : 0);`,
  },
  {
    id: 'builtin-entity-trait-penalty',
    kind: 'script',
    timings: ['before', 'after', 'start', 'switch'],
    name: 'Penalty From Entity Trait',
    description: 'Follow another stat, with a penalty while one entity has a trait on. An entity that isn’t in the game adds no penalty.',
    code: `const base = stats[{{base:stat}}].value;
const active = entities[{{entity:entity}}].traits[{{trait:trait(entity)}}].enabled;
return base - (active ? {{penalty:number=10}} : 0);`,
  },
  {
    id: 'builtin-dice-roll-consequences',
    kind: 'script',
    timings: ['after'],
    name: 'Dice Roll With Consequences',
    description: 'Roll a d20 each turn and pin the placeholder to the value for that roll. A 1 halves one stat. A 20 adds 1 to another. This stat keeps the roll. Set its range to 1–20.',
    // Writes to one stat field apply in stat order. The last write wins.
    code: `const roll = Math.floor(Math.random() * 20) + 1;
const target = placeholders[{{bandPlaceholder:placeholder}}];
if (target.values.length) target.pin(target.values[Math.floor((roll - 1) / 20 * target.values.length)]);
const penalty = stats[{{penaltyStat:stat}}];
const bonus = stats[{{bonusStat:stat}}];
if (roll === 1) penalty.value = penalty.value / 2;
if (roll === 20) bonus.value += 1;
return roll;`,
  },
  {
    id: 'builtin-placeholder-follows-stat',
    kind: 'script',
    timings: ['before', 'after', 'start'],
    name: 'Placeholder by Range',
    description: "Map this stat's range onto the placeholder's values. Min pins the first value. Max pins the last.",
    code: `const target = placeholders[{{placeholder:placeholder}}];
const span = self.max - self.min || 1;
const band = Math.floor((self.value - self.min) / span * target.values.length);
if (target.values.length) target.pin(target.values[Math.max(0, Math.min(band, target.values.length - 1))]);`,
  },
  {
    id: 'builtin-trait-by-threshold',
    kind: 'script',
    timings: ['before', 'after', 'start'],
    name: 'Trait by Threshold',
    description: 'Switch a trait on while this stat is past a threshold, and off when it returns. Code can switch a trait the player cannot toggle.',
    code: `traits[{{trait:trait}}].enabled = self.value {{comparison:choice(>=|<=)=>=}} {{threshold:number=50}};`,
  },
  {
    id: 'builtin-opening-value',
    kind: 'script',
    timings: ['before'],
    name: 'Opening Turn Value',
    description: 'Set a value on the opening turn only. Later turns do not run it. Use it for a value the first narration must read.',
    // The before box reads the clock at turn start, so the opening turn is the one with no hours behind
    // it. Returning nothing leaves the value where the turn found it.
    code: `if (clock.elapsedHours > 0) return;
return {{openingValue:number=50}};`,
  },
  {
    id: 'builtin-random-starting-value',
    kind: 'script',
    timings: ['start'],
    name: 'Random Starting Value',
    description: 'Start this stat at a random whole number between two limits. Both limits stay inside this stat’s range.',
    // Both limits clamp to the stat's own bounds and sort, so no slot value starts the stat out of range.
    code: `const [low, high] = [{{low:number=20}}, {{high:number=80}}]
  .map((limit) => Math.min(self.max, Math.max(self.min, limit)))
  .sort((a, b) => a - b);
return low + Math.floor(Math.random() * (high - low + 1));`,
  },
  {
    id: 'builtin-start-from-persona-trait',
    kind: 'script',
    timings: ['start'],
    name: 'Start From Persona Trait',
    description: 'Start this stat at one value when the played persona has a trait on, and at another when it doesn’t.',
    code: `const active = persona.traits[{{trait:trait(persona)}}].enabled;
return active ? {{withTrait:number=75}} : {{withoutTrait:number=25}};`,
  },
  {
    id: 'builtin-change-on-trait-switch',
    kind: 'script',
    timings: ['switch'],
    name: 'Change When a Trait Switches',
    description: 'Add a signed amount to this stat when a trait turns on. A negative amount subtracts. A switch-off changes nothing.',
    code: `if (trait.name !== {{trait:trait}} || !trait.enabled) return;
return self.value + {{amount:number=10}};`,
  },
  {
    id: 'builtin-mirror-trait',
    kind: 'script',
    timings: ['switch'],
    name: 'Mirror a Trait',
    description: 'Set this stat to Max when a trait turns on, and to Min when it turns off.',
    code: `if (trait.name !== {{trait:trait}}) return;
return trait.enabled ? self.max : self.min;`,
  },
  {
    id: 'builtin-replace-word',
    kind: 'script',
    timings: ['output'],
    name: 'Replace a Word',
    description: 'Replace one word with another in each narration sentence. The match uses the exact spelling and case.',
    // The word sits in a template literal in the generated code, so an apostrophe or quote in it is safe.
    code: `return narration.sentence.split(\`{{word:text=door}}\`).join(\`{{replacement:text=[redacted]}}\`);`,
  },
  {
    id: 'builtin-count-word',
    kind: 'script',
    timings: ['output'],
    name: 'Count a Word',
    description: 'Add an amount to this stat for each narration sentence that contains a word. The sentence stays as written.',
    // Output code that returns anything replaces the sentence, so this one writes the stat and returns nothing.
    code: `if (!narration.sentence.includes(\`{{word:text=door}}\`)) return;
self.value += {{amount:number=1}};`,
  },
  {
    id: 'builtin-bold-word-past-threshold',
    kind: 'script',
    timings: ['output'],
    name: 'Bold a Word Past a Threshold',
    description: 'Bold a word in the narration while this stat is past a threshold. Below it, the sentence stays as written.',
    code: `if (!(self.value {{comparison:choice(>=|<=)=>=}} {{threshold:number=25}})) return;
return narration.sentence.split(\`{{word:text=door}}\`).join(\`**{{word}}**\`);`,
  },
];

/** Whether a template is one of the bundled, read-only ones. */
export const isBuiltInTemplate = (id: string): boolean => BUILT_IN_TEMPLATES.some(template => template.id === id);
