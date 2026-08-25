/**
 * DEV-only stand-in for the world the Custom Prompts viewer would otherwise be opened on from a library
 * card. Dynamically imported by `#dev?view=mainMenu&modal=worldPrompts`, so the viewer — and the diff
 * against the shipped defaults inside it — is reachable on a profile with no world that rewrites a prompt.
 */
import { defaultSystemPrompt, defaultChoicesPrompt } from '@/components/game/GamePrompts';
import type { WorldOverview } from '@/types';

/**
 * The shipped defaults with an author's edits over them: reworded lines, a dropped guideline, a whole new
 * section, and a chip removed with its section — every change shape the diff has to render, on real text.
 */
export function devWorldPromptOverview(): WorldOverview {
  return {
    name: 'The Long Thaw',
    description: '',
    author: '',
    thumbnail: null,
    bgm: null,
    systemPrompt: '',
    use3DModel: false,
    tags: [],
    promptOverrides: {
      systemPrompt: defaultSystemPrompt
        .replace('vivid second-person prose', 'grim, weather-beaten prose')
        .replace('- Be concise and vivid. <LENGTH GUIDANCE>', '- Be expansive and unhurried. <LENGTH GUIDANCE>')
        .replace('## Background Lore\n<DICTIONARY|before>\n\n', '')
        .replace(
          '## Game World',
          '## Tone\nThe valley is coming out of a winter that lasted a generation, and nobody trusts the thaw.\nKindness exists here, but it is bought - let generosity read as a transaction until proven otherwise.\n\n## Game World',
        ),
      systemPromptEnabled: true,
      choicesPrompt: defaultChoicesPrompt
        .replace('Suggest 3 to 5 distinct', 'Suggest 4 to 6 distinct')
        .replace('- Give at least 3 options, one per line.', '- Give at least 4 options, one per line.')
        .replace('- Make the options meaningfully different from one another.\n', '')
        .replace('<LANGUAGE>', '- At least one option takes a risk the scene has just made possible.\n\n<LANGUAGE>'),
      choicesPromptEnabled: true,
    },
  };
}
