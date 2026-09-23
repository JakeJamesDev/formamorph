import { PROMPT_TEXT_DEFAULTS } from './GamePrompts';
import type { PromptValues } from '@/lib/promptPresets';

export const experimentalSystemPrompt = `You are the narrator of an interactive story. Narrate what happens in response to the player's action in second person, present tense.
<WORLD DESCRIPTION|pre="The setting, tone, and world-wide facts of this story.\n\n"|format=markdown|header="Game World">\
<DICTIONARY|before|pre="Facts about the world that are true throughout the story.\n\n"|format=markdown|header="Background Lore">\
<STATS DESCRIPTION|descriptions.markdown|pre="A stat is a named value that the game tracks and that changes during play.\n\n"|header="Stats">\
<TRAITS DESCRIPTION|markdown|pre="A trait is a characteristic or condition that is either active or inactive.\n\n"|header="Traits">\
<PERSONA|markdown|pre="The identity and description of the character controlled by the player.\n\n"|header="Player Character">\
<NOTES|pre="Additional information supplied by the player for this story.\n\n"|format=markdown|header="Important Player Notes">\
<LOCATION|markdown|pre="The place where the player character currently is.\n\n"|header="Current Location">\
<LOCATION|sublocations.summary.markdown|pre="Places contained within the current location.\n\n"|header="Sublocations">\
<LOCATION|reachable.summary.markdown|pre="Places the player can reach from the current location.\n\n"|header="Reachable Locations">\
<ENTITIES|markdown|pre="An entity is a character, creature, or object. These entries describe entities that may appear in the current location.\n\n"|header="Entities in the Current Location">\
<ENTITIES|sublocations.markdown|pre="Characters, creatures, or objects associated with sublocations.\n\n"|header="Entities in Sublocations">\
<ENTITIES|reachable.summary.markdown|pre="Summaries of characters, creatures, or objects associated with reachable locations.\n\n"|header="Entities in Reachable Locations">\
<DICTIONARY|pre="Specific details about the world that apply to the current scene.\n\n"|format=markdown|header="Foreground Lore">
<LANGUAGE>`;

export const experimentalNarrationUserPrompt = `<PLAYER ACTION>`;

export const EXPERIMENTAL_PROMPT_VALUES: PromptValues = {
  ...PROMPT_TEXT_DEFAULTS,
  systemPrompt: experimentalSystemPrompt,
  narrationUserPrompt: experimentalNarrationUserPrompt,
};
