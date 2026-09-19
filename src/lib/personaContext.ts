import type { Entity } from '@/types';
import { expandScopedTokens, renderEntityRoster, type ContextOpts } from './locationContext';
import { NONE_PLACEHOLDER } from './promptFallbacks';

/**
 * The `<PERSONA>` chip's value: the entity the player plays, as one entity block. Full and Summary are the
 * entity builder's own rendering, so a persona reads exactly like a cast member. Name is the name and
 * pronouns only, for use inside a sentence.
 */
export function buildPersonaContext(persona: Entity | null, opts: ContextOpts = {}): string {
  if (!persona) return NONE_PLACEHOLDER;
  if (opts.nameOnly) {
    const pronouns = persona.pronouns?.trim();
    return pronouns ? `${persona.name} (${pronouns})` : persona.name;
  }
  return renderEntityRoster([persona.id], [persona], opts);
}

/** Every `<PERSONA>` token (content × format) mapped to its value. */
export function personaContextValues(persona: Entity | null): Record<string, string> {
  return expandScopedTokens('<PERSONA>', { '': (opts) => buildPersonaContext(persona, opts) });
}
