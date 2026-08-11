/**
 * Detects whether anything Settings' Simple mode hides is holding a non-default value, so the mode switch
 * can say so. Its field list is the enumeration of what Simple hides; the gates themselves live at the
 * rows' call sites in `SettingsModal`.
 *
 * The caller passes only the fields Advanced would actually show it: several hidden rows render under a
 * condition of their own (the ComfyUI workflow only for ComfyUI, Native Reasoning only under Native
 * thinking), and a marker promising a row that Advanced then doesn't draw is worse than no marker. Fields
 * left out are not compared.
 *
 * Auto-detected values are excluded outright: Context Window is filled in on connect, so it says nothing
 * about what the player chose. Two fields arrive pre-compared because their defaults live in heavier
 * modules — the ComfyUI workflow graph and the active prompt preset.
 */
import {
  DEFAULT_MAX_TOKENS,
  DEFAULT_IMAGE_PORTRAIT_WIDTH, DEFAULT_IMAGE_PORTRAIT_HEIGHT,
  DEFAULT_IMAGE_LANDSCAPE_WIDTH, DEFAULT_IMAGE_LANDSCAPE_HEIGHT,
} from '@/contexts/settingsDefaults';
import type { ParagraphLimit, ReasoningEffort } from '@/contexts/SettingsContext';

export interface SettingsAdvancedInput {
  // Display → Narration
  paragraphLimit: ParagraphLimit;
  markdownOutput: boolean;
  // Output → Reasoning
  reasoningEffort: ReasoningEffort;
  limitActiveCharacters: boolean;
  activeCharacterLimit: number;
  // Output → Memory
  memoryDigests: boolean;
  semanticMemory: boolean;
  semanticBandCap: number;
  semanticRehydration: boolean;
  timeContext: boolean;
  aiClock: boolean;
  semanticLore: boolean;
  // Output → Characters
  characterDiaries: boolean;
  semanticDiaries: boolean;
  /** Its shipped default is seeded from `characterDiaries`, so it is compared against that, not a constant. */
  describeCharacters: boolean;
  // Output → Performance
  concurrentTurnRequests: boolean;
  // Display → Inspection
  showReasoning: boolean;
  showSilentRequests: boolean;
  // Endpoints → Text
  maxTokens: number;
  // Endpoints → Image
  imagePortraitWidth: number;
  imagePortraitHeight: number;
  imageLandscapeWidth: number;
  imageLandscapeHeight: number;
  /** The ComfyUI workflow differs from the shipped graph. */
  imageWorkflowCustom: boolean;
  imageInvokeBoard: string;
  imageInvokeEncoder: string;
  imageInvokeVae: string;
  /** A user-made prompt preset is active, so the hidden Prompts tab holds edits. */
  promptPresetCustom: boolean;
}

/** Every hidden field's shipped default. Guarded against the live context defaults in this module's test. */
export const HIDDEN_SETTING_DEFAULTS = {
  paragraphLimit: 'auto',
  markdownOutput: true,
  reasoningEffort: 'auto',
  limitActiveCharacters: true,
  activeCharacterLimit: 5,
  memoryDigests: true,
  semanticMemory: false,
  semanticBandCap: 12,
  semanticRehydration: false,
  timeContext: false,
  aiClock: false,
  semanticLore: false,
  characterDiaries: false,
  semanticDiaries: false,
  describeCharacters: false,
  concurrentTurnRequests: true,
  showReasoning: true,
  showSilentRequests: false,
  maxTokens: DEFAULT_MAX_TOKENS,
  imagePortraitWidth: DEFAULT_IMAGE_PORTRAIT_WIDTH,
  imagePortraitHeight: DEFAULT_IMAGE_PORTRAIT_HEIGHT,
  imageLandscapeWidth: DEFAULT_IMAGE_LANDSCAPE_WIDTH,
  imageLandscapeHeight: DEFAULT_IMAGE_LANDSCAPE_HEIGHT,
  imageWorkflowCustom: false,
  imageInvokeBoard: '',
  imageInvokeEncoder: '',
  imageInvokeVae: '',
  promptPresetCustom: false,
} satisfies SettingsAdvancedInput;

export function settingsUseAdvancedValues(s: Partial<SettingsAdvancedInput>): boolean {
  return (Object.keys(s) as (keyof SettingsAdvancedInput)[]).some((k) => {
    // Turning on diaries seeds this one on, so that reading is the default rather than a choice — and
    // diaries raise the marker on their own account anyway.
    if (k === 'describeCharacters') return s.describeCharacters !== (s.characterDiaries ?? false);
    return s[k] !== HIDDEN_SETTING_DEFAULTS[k];
  });
}
