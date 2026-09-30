import type { useSettings } from '@/contexts/SettingsContext';
import type { useTheme } from '@/components/theme-provider';
import type { EmbeddingDownload } from './useEmbeddingDownload';
import type { FontTuneSource } from '@/components/FontTuneDialog';
import type { RevealAnimationSource } from '@/components/RevealAnimationDemo';
import type { ThemePreviewSource } from '@/components/ThemePreviewDialog';

type SettingsValue = ReturnType<typeof useSettings>;
type ThemeValue = ReturnType<typeof useTheme>;

/** What the Display section reads and writes, under the Settings and theme context names. */
export type DisplaySettingsSource = Pick<SettingsValue,
  | 'themeColor' | 'setThemeColor' | 'fontFamily' | 'setFontFamily'
  | 'bgmEnabled' | 'setBgmEnabled' | 'locationBackground' | 'setLocationBackground'
  | 'backgroundOverlay' | 'setBackgroundOverlay' | 'imageGenDisabled' | 'sceneImageAuto' | 'setSceneImageAuto'
  | 'narrationLayout' | 'setNarrationLayout' | 'language' | 'setLanguage'
  | 'paragraphLimit' | 'setParagraphLimit' | 'markdownOutput' | 'setMarkdownOutput'
  | 'narrationFont' | 'setNarrationFont' | 'narrationScale' | 'setNarrationScale'
  | 'narrationLineHeight' | 'setNarrationLineHeight'
  | 'quoteColor' | 'setQuoteColor' | 'quoteColorMode' | 'activeQuoteColor' | 'setActiveQuoteColor'
  | 'quoteItalic' | 'setQuoteItalic'
  | 'showReasoning' | 'setShowReasoning' | 'showSilentRequests' | 'setShowSilentRequests'
> & ThemeValue & FontTuneSource & RevealAnimationSource & ThemePreviewSource;

/** What the Output section reads and writes. */
export type OutputSettingsSource = Pick<SettingsValue,
  | 'choicesEnabled' | 'setChoicesEnabled' | 'statUpdatesEnabled' | 'setStatUpdatesEnabled'
  | 'locationChangeEnabled' | 'setLocationChangeEnabled' | 'locationAutoApply' | 'setLocationAutoApply'
  | 'thinkingMode' | 'setThinkingMode' | 'limitActiveCharacters' | 'setLimitActiveCharacters'
  | 'activeCharacterLimit' | 'setActiveCharacterLimit'
  | 'reasoningEffort' | 'nativeReasoning' | 'setNativeReasoning' | 'reasoningCapability'
  | 'toolsEnabled' | 'setToolsEnabled'
  | 'memoryDigests' | 'setMemoryDigests' | 'semanticMemory' | 'setSemanticMemory'
  | 'semanticBandCap' | 'setSemanticBandCap' | 'semanticRehydration' | 'setSemanticRehydration'
  | 'timeContext' | 'setTimeContext' | 'aiClock' | 'setAiClock'
  | 'semanticLore' | 'setSemanticLore'
  | 'describeCharacters' | 'setDescribeCharacters' | 'characterDiaries' | 'setCharacterDiaries'
  | 'semanticDiaries' | 'setSemanticDiaries'
  | 'continueChoiceMode' | 'setContinueChoiceMode'
  | 'concurrentTurnRequests' | 'setConcurrentTurnRequests'
  | 'imageAttachments' | 'setImageAttachments'
> & { embeddingModel: EmbeddingDownload };

/** Everything both sections read: the Settings dialog passes the live context, theme, and download. */
export type SettingsSource = DisplaySettingsSource & OutputSettingsSource;
