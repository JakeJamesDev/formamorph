import { DEFAULT_CHANGE_BY, bindingBy, resolveMorphAlias } from './bodyMorphs';
import { COLOR_CHANNELS } from './avatarLook';
import { mixOklab } from './oklab';
import type { ColorBinding, ColorChannel, ColorPin, MorphBinding, MorphPin } from '@/types';

/** What the previewed Avatar offers: its slider keys and its own color for each channel it has. */
export interface PreviewModel {
  sliders: readonly string[];
  colors: Readonly<Partial<Record<ColorChannel, string>>>;
}

/** The look the Preview shows: a value for each of the model's sliders and a color for each of its channels. */
export interface PreviewLook {
  sliders: Readonly<Record<string, number>>;
  colors: Readonly<Partial<Record<ColorChannel, string>>>;
}

/** The trait rows the Preview reads and writes. */
export interface TraitLookRows {
  morphPins?: MorphPin[];
  colorPins?: ColorPin[];
}

/** A slider's value on the model when no row sets it. */
export const MODEL_SLIDER = 0;

/** The model's slider key a row names, or null when the model lacks it. */
const keyOn = (model: PreviewModel, name: string) => resolveMorphAlias(name, (key) => model.sliders.includes(key));

const sameColor = (a: string | undefined, b: string | undefined) => (a ?? '').toLowerCase() === (b ?? '').toLowerCase();

/** The model's channels, in the shared channel order. */
export const modelChannels = (model: PreviewModel): ColorChannel[] => COLOR_CHANNELS.filter((channel) => model.colors[channel]);

/** Each slider row's control key: null for a row the model lacks, or a later row on a key an earlier one holds. */
function controlKeys(pins: readonly MorphPin[], model: PreviewModel): (string | null)[] {
  const bound = new Set<string>();
  return pins.map((pin) => {
    const key = keyOn(model, pin.name);
    if (key === null || bound.has(key)) return null;
    bound.add(key);
    return key;
  });
}

/** The look a trait's rows give the model: each row's Set To, and the model's own where no row binds. */
export function traitLook(rows: TraitLookRows, model: PreviewModel): PreviewLook {
  const sliders: Record<string, number> = Object.fromEntries(model.sliders.map((key) => [key, MODEL_SLIDER]));
  const pins = rows.morphPins ?? [];
  controlKeys(pins, model).forEach((key, i) => { if (key !== null) sliders[key] = pins[i].value; });
  const colors: Partial<Record<ColorChannel, string>> = {};
  for (const channel of modelChannels(model)) {
    colors[channel] = rows.colorPins?.find((pin) => pin.channel === channel)?.color ?? model.colors[channel];
  }
  return { sliders, colors };
}

/** `look` with one slider dragged to `value`. */
export const withSlider = (look: PreviewLook, key: string, value: number): PreviewLook =>
  ({ ...look, sliders: { ...look.sliders, [key]: value } });

/** `look` with one channel picked as `color`. */
export const withColor = (look: PreviewLook, channel: ColorChannel, color: string): PreviewLook =>
  ({ ...look, colors: { ...look.colors, [channel]: color } });

/** The controls the author changed, kept across a change of Avatar. A key an Avatar lacks stays here and is saved. */
export interface PreviewEdits {
  sliders: Readonly<Record<string, number>>;
  colors: Readonly<Partial<Record<ColorChannel, string>>>;
}

export const NO_EDITS: PreviewEdits = { sliders: {}, colors: {} };

/** Whether two slider keys are one control: the same key, or aliases of one slider. */
const sameSlider = (a: string, b: string) => resolveMorphAlias(a, (key) => key === b) !== null;

/** `sliders` without the edit on the slider `key` names, under whichever alias it was made. */
const withoutSlider = (sliders: PreviewEdits['sliders'], key: string) =>
  Object.fromEntries(Object.entries(sliders).filter(([edited]) => !sameSlider(edited, key)));

/** One edit per slider: a drag replaces an earlier one made under any of its aliases. */
export const editSlider = (edits: PreviewEdits, key: string, value: number): PreviewEdits =>
  ({ ...edits, sliders: { ...withoutSlider(edits.sliders, key), [key]: value } });

export const editColor = (edits: PreviewEdits, channel: ColorChannel, color: string): PreviewEdits =>
  ({ ...edits, colors: { ...edits.colors, [channel]: color } });

/** `edits` without the slider's edit, so every Avatar shows its own opening value again. */
export const clearSlider = (edits: PreviewEdits, key: string): PreviewEdits =>
  ({ ...edits, sliders: withoutSlider(edits.sliders, key) });

/** `edits` without the channel's edit, so every Avatar shows its own opening color again. */
export const clearColor = (edits: PreviewEdits, channel: ColorChannel): PreviewEdits => {
  const { [channel]: _gone, ...colors } = edits.colors;
  return { ...edits, colors };
};

/** What one Avatar shows: its opening look with the edits laid over the controls it has, an alias's edit included. */
export function lookWithEdits(base: PreviewLook, edits: PreviewEdits): PreviewLook {
  let look = base;
  for (const key of Object.keys(base.sliders)) {
    const edited = Object.keys(edits.sliders).find((name) => sameSlider(name, key));
    if (edited !== undefined) look = withSlider(look, key, edits.sliders[edited]);
  }
  for (const channel of Object.keys(base.colors) as ColorChannel[]) {
    const color = edits.colors[channel];
    if (color !== undefined) look = withColor(look, channel, color);
  }
  return look;
}

export const sliderChanged = (look: PreviewLook, base: PreviewLook, key: string) => look.sliders[key] !== base.sliders[key];

export const colorChanged = (look: PreviewLook, base: PreviewLook, channel: ColorChannel) =>
  !sameColor(look.colors[channel], base.colors[channel]);

/** Whether any control differs from the look the Preview opened with. */
export function lookChanged(look: PreviewLook, base: PreviewLook): boolean {
  return Object.keys(look.sliders).some((key) => sliderChanged(look, base, key))
    || (Object.keys(look.colors) as ColorChannel[]).some((channel) => colorChanged(look, base, channel));
}

/** An Avatar the Preview loaded: its model and the look it opened with. */
export interface LoadedAvatar<M extends PreviewModel = PreviewModel> {
  model: M;
  base: PreviewLook;
}

/**
 * The trait's rows after Save across every Avatar the author opened. Each Avatar writes the edits to the
 * controls it has, an alias's edit included, so a change made on one Avatar survives a switch to another.
 */
export function traitRowsOnSaveAcross(rows: TraitLookRows, avatars: readonly LoadedAvatar[], edits: PreviewEdits): TraitLookRows {
  let out: TraitLookRows = rows;
  for (const { model, base } of avatars) out = traitRowsOnSave(out, model, base, lookWithEdits(base, edits));
  return out;
}

/** Whether any opened Avatar differs from the look it opened with. */
export const avatarsChanged = (avatars: readonly LoadedAvatar[], edits: PreviewEdits) =>
  avatars.some(({ base }) => lookChanged(lookWithEdits(base, edits), base));

/**
 * The trait's rows after Save. A row keeps its place and takes its control's value. A control with no row adds
 * one only when it differs from the look the Preview opened with. A row the model lacks stays as it is.
 */
export function traitRowsOnSave(rows: TraitLookRows, model: PreviewModel, base: PreviewLook, look: PreviewLook): TraitLookRows {
  const pins = rows.morphPins ?? [];
  const keys = controlKeys(pins, model);
  const bound = new Set(keys);
  const morphPins = pins.map((pin, i) => {
    const key = keys[i];
    return key === null ? pin : { ...pin, value: look.sliders[key] };
  });
  for (const key of Object.keys(look.sliders)) {
    if (!bound.has(key) && sliderChanged(look, base, key)) morphPins.push({ name: key, value: look.sliders[key] });
  }
  // As for sliders, the first row on a channel holds its control.
  const held = new Set<ColorChannel>();
  const colorPins = (rows.colorPins ?? []).map((pin) => {
    const color = look.colors[pin.channel];
    if (color === undefined || held.has(pin.channel)) return pin;
    held.add(pin.channel);
    return { ...pin, color };
  });
  for (const channel of Object.keys(look.colors) as ColorChannel[]) {
    const color = look.colors[channel];
    if (color !== undefined && !held.has(channel) && colorChanged(look, base, channel)) colorPins.push({ channel, color });
  }
  return { morphPins: morphPins.length ? morphPins : undefined, colorPins: colorPins.length ? colorPins : undefined };
}

/** The stat rows the Preview reads and writes. */
export interface StatLookRows {
  morphBindings?: MorphBinding[];
  colorBindings?: ColorBinding[];
}

/** A stat's rows as the look at Max: each slider at the model's own value plus its Change By, each color at its Target Color. */
export const statLookRows = (rows: StatLookRows): TraitLookRows => ({
  morphPins: rows.morphBindings?.map((binding) => ({ name: binding.name, value: MODEL_SLIDER + bindingBy(binding) })),
  colorPins: rows.colorBindings,
});

/** The stat's rows from the look at Max: Change By is the value at Max less the model's own. The default is stored as absent. */
export const statRowsFromLook = (rows: TraitLookRows): StatLookRows => ({
  morphBindings: rows.morphPins?.map(({ name, value }) => {
    const by = value - MODEL_SLIDER;
    return by === DEFAULT_CHANGE_BY ? { name } : { name, by };
  }),
  colorBindings: rows.colorPins,
});

/** The look a stat at `progress` (0 at Min, 1 at Max) gives the model, from its look at Max, with the game's color blend. */
export function shownLook(look: PreviewLook, model: PreviewModel, progress: number): PreviewLook {
  const sliders = Object.fromEntries(Object.entries(look.sliders)
    .map(([key, value]) => [key, MODEL_SLIDER + progress * (value - MODEL_SLIDER)]));
  const colors: Partial<Record<ColorChannel, string>> = {};
  for (const channel of Object.keys(look.colors) as ColorChannel[]) {
    const target = look.colors[channel];
    const own = model.colors[channel];
    colors[channel] = own === undefined || target === undefined || progress >= 1 ? target : mixOklab(own, target, progress);
  }
  return { sliders, colors };
}
