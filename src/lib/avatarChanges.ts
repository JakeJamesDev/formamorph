import type { ColorChannel, Stat, Trait } from '@/types';
import { cleanLabel } from '@/lib/morphLabel';

const COLOR_NAMES: Record<ColorChannel, string> = { skin: 'Skin Color', eye: 'Eye Color', hair: 'Hair Color' };
const COLOR_ORDER: readonly ColorChannel[] = ['skin', 'eye', 'hair'];

/** The most names the hover text lists before it counts the rest. */
const MAX_CHANGE_NAMES = 4;

interface ChangeRows {
  sliders?: readonly { name: string }[];
  colors?: readonly { channel: ColorChannel }[];
}

/** What slider and color rows change on the Avatar: slider names as the player sees them, in row order, then
 *  the colors. A Body pick is not a row here. */
export function avatarChangeNames({ sliders = [], colors = [] }: ChangeRows): string[] {
  const names = new Set<string>();
  for (const { name } of sliders) {
    const label = cleanLabel(name);
    if (label) names.add(label);
  }
  const channels = new Set(colors.map((c) => c.channel));
  for (const channel of COLOR_ORDER) if (channels.has(channel)) names.add(COLOR_NAMES[channel]);
  return [...names];
}

export const traitAvatarChanges = (trait: Pick<Trait, 'morphPins' | 'colorPins'>): string[] =>
  avatarChangeNames({ sliders: trait.morphPins, colors: trait.colorPins });

export const statAvatarChanges = (stat: Pick<Stat, 'morphBindings' | 'colorBindings'>): string[] =>
  avatarChangeNames({ sliders: stat.morphBindings, colors: stat.colorBindings });

const LIST = new Intl.ListFormat('en', { type: 'conjunction' });

/** The icon's hover text: one line that says the Avatar changes, then the names, past four as a count. Never a value. */
export function avatarChangeTip(names: readonly string[]): string {
  const shown = names.slice(0, MAX_CHANGE_NAMES);
  const rest = names.length - shown.length;
  const list = LIST.format(rest > 0 ? [...shown, `${rest} more`] : shown);
  return `Changes the Avatar's appearance.\n${list}.`;
}
