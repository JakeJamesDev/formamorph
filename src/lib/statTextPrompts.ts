import { textStatUpdatesPrompt, textStatUpdatesUserPrompt } from '@/components/game/GamePrompts';
import type { SectionStyle } from './promptPresets';
import { styleTemplate } from './sectionStyle';

/** The stat pass's text prompts for one built-in preset: the shipped text pair rendered in its style. */
export interface StatTextPrompts {
  system: string;
  user: string;
}

export const builtinStatTextPrompts = (style: SectionStyle): StatTextPrompts => ({
  system: styleTemplate(textStatUpdatesPrompt, style),
  user: styleTemplate(textStatUpdatesUserPrompt, style),
});

/** The text pair a turn carries; a null side sends the matching stat prompt as written. */
export type StatText = { [Side in keyof StatTextPrompts]: string | null };

/** The turn's text pair. A world's own Stats prompt (`worldPrompt`) drops the system side. */
export const statTextFor = (builtin: StatTextPrompts | null, { worldPrompt }: { worldPrompt: boolean }): StatText => ({
  system: worldPrompt ? null : builtin?.system ?? null,
  user: builtin?.user ?? null,
});
