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

/** The text pair a turn carries; a null side is sent as written. A world's own Stats prompt drops the system side. */
export const statTextFor = (
  builtin: StatTextPrompts | null,
  worldPromptApplies: boolean,
): { system: string | null; user: string | null } => ({
  system: worldPromptApplies ? null : builtin?.system ?? null,
  user: builtin?.user ?? null,
});
