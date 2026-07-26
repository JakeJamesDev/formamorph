import type { ThinkingMode } from '@/contexts/SettingsContext';

/** The toggles that decide which prompt sub-tabs exist in Settings → Prompts. */
export interface PromptTabFlags {
  thinkingMode: ThinkingMode;
  choicesEnabled: boolean;
  statUpdatesEnabled: boolean;
  locationChangeEnabled: boolean;
  memoryDigests: boolean;
  characterDiaries: boolean;
  aiClock: boolean;
}

/**
 * Which prompt sub-tabs are available for the given settings. Each tab only
 * exists while its governing feature is active. Diaries are read only by the
 * staged character pass, so the Diary tab requires Staged mode even when the
 * persisted Character Diaries flag is on.
 */
export function computePromptTabAvailability(flags: PromptTabFlags): Record<string, boolean> {
  const { thinkingMode, choicesEnabled, statUpdatesEnabled, locationChangeEnabled, memoryDigests, characterDiaries, aiClock } = flags;
  return {
    narration: true,
    thinking: thinkingMode === 'precall',
    choices: choicesEnabled,
    statupdates: statUpdatesEnabled,
    location: locationChangeEnabled,
    summary: memoryDigests,
    diary: thinkingMode === 'staged' && characterDiaries,
    director: thinkingMode === 'staged',
    character: thinkingMode === 'staged',
    storyboard: thinkingMode === 'staged',
    timepassed: aiClock,
  };
}
