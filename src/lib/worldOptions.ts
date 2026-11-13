// World Options: setup switches that act through placeholder pins and never add text to the AI.

import type { ActionRef } from './actionList';
import type { PlaceholderPin, WorldOption, WorldOptionType, WorldOptionValueOf, WorldOptionValues } from '@/types';

/** The value ids a boolean Option's pin lists sit under. */
export const BOOLEAN_ON = 'on';
export const BOOLEAN_OFF = 'off';

export const NO_WORLD_OPTION_VALUES: WorldOptionValues = {};

/** The Options a world file holds, or none. */
export const parseWorldOptions = (raw: unknown): WorldOption[] =>
  (Array.isArray(raw) ? raw.filter((o): o is WorldOption => !!o && typeof o === 'object' && typeof o.id === 'string') : []);

/** A number Option's step: a whole number of at least 1. */
export const optionStep = (option: { step?: number }) => (option.step && option.step > 0 ? Math.round(option.step) : 1);

/** A number Option's bounds, low first, whichever way the author typed them. */
export const optionRange = (option: { min: number; max: number }): { lo: number; hi: number } =>
  ({ lo: Math.min(option.min, option.max), hi: Math.max(option.min, option.max) });

/** The value id a choice starts on: its default when that names a value, else its first. */
export const choiceDefault = (values: readonly { id: string }[], defaultId: string): string =>
  (values.some((v) => v.id === defaultId) ? defaultId : values[0]?.id ?? '');

/** `n` as a number Option holds it: a whole number on the step grid from `min`, inside `min`–`max`. */
export function snapNumber(option: { min: number; max: number; step?: number }, n: number): number {
  const { lo, hi } = optionRange(option);
  if (!Number.isFinite(n)) return lo;
  const step = optionStep(option);
  const snapped = lo + Math.round((n - lo) / step) * step;
  return Math.min(Math.max(snapped, lo), hi);
}

/** The value a new game starts an Option on. A choice whose default names no value falls to its first. */
export function optionDefault(option: WorldOption): WorldOptionValueOf {
  switch (option.type) {
    case 'choice': return choiceDefault(option.values, option.default);
    case 'boolean': return option.default;
    case 'number': return snapNumber(option, option.default);
  }
}

/** Whether `value` is one the Option accepts as it stands. */
export function acceptsValue(option: WorldOption, value: unknown): value is WorldOptionValueOf {
  switch (option.type) {
    case 'choice': return typeof value === 'string' && option.values.some((v) => v.id === value);
    case 'boolean': return typeof value === 'boolean';
    case 'number': {
      const { lo, hi } = optionRange(option);
      return typeof value === 'number' && Number.isInteger(value) && value >= lo && value <= hi;
    }
  }
}

/** The value a playthrough reads for an Option: its own, else the default. */
export const optionValue = (option: WorldOption, values: WorldOptionValues | undefined): WorldOptionValueOf => {
  const held = values?.[option.id];
  return acceptsValue(option, held) ? held : optionDefault(option);
};

/** The pins one Option value lays: under `valueId`, the choice value's id or a boolean's on/off. */
export interface OptionPins {
  optionId: string;
  valueId: string;
  pins: readonly PlaceholderPin[];
}

/** The pin lists the Options' current values lay, in Options-tab order. A number Option lays none. */
export function optionPinLists(options: readonly WorldOption[] | undefined, values?: WorldOptionValues): OptionPins[] {
  const out: OptionPins[] = [];
  for (const option of options ?? []) {
    const value = optionValue(option, values);
    if (option.type === 'choice') {
      const picked = option.values.find((v) => v.id === value);
      if (picked?.placeholderPins?.length) out.push({ optionId: option.id, valueId: picked.id, pins: picked.placeholderPins });
    } else if (option.type === 'boolean') {
      const pins = value ? option.onPins : option.offPins;
      if (pins?.length) out.push({ optionId: option.id, valueId: value ? BOOLEAN_ON : BOOLEAN_OFF, pins });
    }
  }
  return out;
}

/** The Options the player sees at new game. */
export const shownOptions = (options: readonly WorldOption[] | undefined): WorldOption[] =>
  (options ?? []).filter((o) => o.shownToPlayer);

/** The Options the in-game tab lists: shown to the player and flagged for change during play (Q26). */
export const midGameOptions = (options: readonly WorldOption[] | undefined): WorldOption[] =>
  shownOptions(options).filter((o) => o.midGame);

/** `value` of `option` as an id and a display name, for a Listed Action's facts. */
export function optionValueRef(option: WorldOption, value: WorldOptionValueOf): ActionRef {
  switch (option.type) {
    case 'choice': return { id: String(value), name: option.values.find((v) => v.id === value)?.name ?? String(value) };
    case 'boolean': return value ? { id: BOOLEAN_ON, name: 'On' } : { id: BOOLEAN_OFF, name: 'Off' };
    case 'number': return { id: String(value), name: String(value) };
  }
}

/** A new Option of `type`: shown, set at new game only. `newId` mints a choice's first values. */
export function blankOption(type: WorldOptionType, id: string, name: string, newId: () => string): WorldOption {
  const base = { id, name, shownToPlayer: true, midGame: false };
  switch (type) {
    case 'choice': {
      const values = [{ id: newId(), name: 'Value 1' }, { id: newId(), name: 'Value 2' }];
      return { ...base, type, values, default: values[0].id };
    }
    case 'boolean': return { ...base, type, default: false };
    case 'number': return { ...base, type, min: 0, max: 10, default: 0 };
  }
}

/** The Option switched to `type`, keeping what every type shares. The type's own fields start blank. */
export function withOptionType(option: WorldOption, type: WorldOptionType, newId: () => string): WorldOption {
  if (option.type === type) return option;
  const { id, name, playerDescription, shownToPlayer, midGame } = option;
  return { ...blankOption(type, id, name, newId), shownToPlayer, midGame, ...(playerDescription ? { playerDescription } : {}) };
}

/** `options` with `activeId` moved to where `overId` stands. The same list when either is missing. */
export function reorderOptions(options: readonly WorldOption[], activeId: string, overId: string): readonly WorldOption[] {
  const from = options.findIndex((o) => o.id === activeId);
  const to = options.findIndex((o) => o.id === overId);
  if (from < 0 || to < 0 || from === to) return options;
  const next = [...options];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}
