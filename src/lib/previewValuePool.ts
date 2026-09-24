import { lengthGuidance, type ParagraphLimit } from './outputLength';
import { type SectionStyle } from './promptPresets';
import { markdownGuidance, markdownDefinitions, activeCharacterGuidance } from '@/components/game/GamePrompts';
import { languageDirective, type LanguageSurface } from './languages';
import { DISCOVER_LATER_LABEL, DISCOVER_PASSAGE_LABEL } from './runtimeCharacters';
import { milestoneMomentValues } from './milestoneMemory';
import { chipValues } from './chipValues/chipValues';
import { sampleChipScene } from './chipValues/sampleScene';

/**
 * The one pool the prompt editor's Preview draws on, in two layers.
 *
 * **Derived** values are computed from the player's own settings and are therefore real wherever they are
 * shown — the length, markdown and cast-size guidance a prompt would actually receive. They need no game.
 *
 * **Sample** values stand in for what only a playthrough can supply. The scene values (world, stats, places,
 * people, lore, clock) come from Chip Values over the sample world, so they render the way play renders
 * them; the per-turn values come from the sample turn. The pane badges them.
 *
 * Both the in-game path and the Settings fallback compose from here. Nothing here reaches a model; it is
 * display-only.
 */

/** Which tokens the derived layer owns — real settings values, never sampled. */
export const DERIVED_TOKENS = ['<LENGTH GUIDANCE>', '<MARKDOWN GUIDANCE>', '<MARKDOWN GUIDANCE|definitions>', '<ACTIVE CHARACTER GUIDANCE>', '<LANGUAGE>'];

/**
 * The sample playthrough's current beat — the values only a live turn supplies. The Anatomy hub cans this
 * same beat as its pipeline material (anatomyPreview.ts), so the editor's Preview pane and the hub cannot
 * tell two different stories about one token.
 */
export const SAMPLE_TURN = {
  /** This turn's action, as the player typed it. */
  action: 'I take the map and start down toward the causeway.',
  /** The narration the model answered with, which every post-narration pass reads. */
  narration:
    'The stair takes you down past the lamp and out onto the flats, where the causeway stones are showing black and streaming. Behind you Wren has not moved, but she is watching, the pole idle across her knees.',
  /** Who the scene composer put in frame — entities only, which is all the real cast can resolve to. */
  sceneCast: ['Wren'],
  /** The cast member the staged passes single out. */
  character: {
    name: 'Wren',
    summary: 'The lamp-keeper who works the Landing rail; unhurried, and watches the water more than she says.',
  },
};

/** The digests the milestone selector judges between turns: one memory already keeps, two just aged in. */
export const SAMPLE_MOMENTS = {
  kept: ['In the tide pools the traveler found an oilcloth packet holding a map marked by Harrow.'],
  fresh: [
    "Wren recognized Harrow's hand on the map and said he had been gone from his stall a month.",
    'Wren said Harrow crosses at the causeway and has not returned from this ebb.',
  ],
};

/** What a rewrite of the singled-out character's note adds: a later turn she took part in. */
const SAMPLE_LATER = 'Wren kept the lamp lit past midnight and asked nothing about the map.';

/** The per-turn tokens: what only a live turn supplies, so no scene carries them. */
const TURN_VALUES: Record<string, string> = {
  '<PLAYER ACTION>': SAMPLE_TURN.action,
  '<NARRATION>': SAMPLE_TURN.narration,
  '<CHARACTER NAME>': SAMPLE_TURN.character.name,
  // Joined the way the scene-tags pass joins the real cast.
  '<IN FRAME>': SAMPLE_TURN.sceneCast.join(', '),
  // Headed the way the character-note pass heads them.
  '<FIRST PASSAGE>': `${DISCOVER_PASSAGE_LABEL}\n${SAMPLE_TURN.narration}`,
  '<LATER MATERIAL>': `${DISCOVER_LATER_LABEL}\n${SAMPLE_LATER}`,
  // Headed and numbered the way the milestone selector sends them.
  ...milestoneMomentValues(SAMPLE_MOMENTS.kept, SAMPLE_MOMENTS.fresh),
  '<SUBJECT>': 'a weathered lamp-keeper on a stone shore',
};

/**
 * Every sampled token: the sample world's scene values from Chip Values, and the sample turn's per-turn
 * values. The derived tokens stay out, so a sample never shadows the player's real setting.
 */
export const SAMPLE_PREVIEW_VALUES: Record<string, string> = { ...TURN_VALUES, ...chipValues(sampleChipScene()) };

/** Settings the derived layer reads. Exactly the inputs the real guidance functions take. */
export interface DerivedPreviewSettings {
  paragraphLimit: ParagraphLimit;
  maxTokens: number | undefined;
  markdownOutput: boolean;
  sectionStyle: SectionStyle;
  limitActiveCharacters: boolean;
  activeCharacterLimit: number;
  /** The AI Language setting, as the language chip renders it. */
  language: string;
}

/**
 * The language chip's value for one prompt surface. The two surfaces that offer the chip name themselves in
 * the directive, so a preview has to be told which one it is rendering; the pool's own entry is the
 * narration wording, and the choices field layers this over it.
 */
export function languagePreviewValue(surface: LanguageSurface, language: string): Record<string, string> {
  return { '<LANGUAGE>': languageDirective(surface, language) };
}

/**
 * The tokens whose real value follows from settings alone, so a preview shows what the model would truly be
 * told rather than a stand-in. Kept out of the sample layer — a sample here would quietly shadow the truth.
 */
export function derivedPreviewValues(s: DerivedPreviewSettings): Record<string, string> {
  return {
    '<LENGTH GUIDANCE>': lengthGuidance(s.paragraphLimit, s.maxTokens),
    '<MARKDOWN GUIDANCE>': markdownGuidance(s.markdownOutput),
    '<MARKDOWN GUIDANCE|definitions>': markdownDefinitions(s.markdownOutput),
    '<ACTIVE CHARACTER GUIDANCE>': activeCharacterGuidance(s.limitActiveCharacters, s.activeCharacterLimit),
    ...languagePreviewValue('narration', s.language),
  };
}

/**
 * The values a Preview should use: samples underneath, real settings-derived guidance over them, and a live
 * game's own context over that. Callers pass `live` only when a playthrough is running.
 */
export function composePreviewValues(
  settings: DerivedPreviewSettings,
  live?: Record<string, string>,
): Record<string, string> {
  return { ...SAMPLE_PREVIEW_VALUES, ...derivedPreviewValues(settings), ...(live ?? {}) };
}
