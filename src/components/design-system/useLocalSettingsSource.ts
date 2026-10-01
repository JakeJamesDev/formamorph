import { useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import type { SettingsSource } from '@/components/modals/settingsSource';
import { SETTINGS_OPTIONS } from '@/components/modals/settingsCopy';
import {
  DEFAULT_CONTINUE_CHOICE, DEFAULT_IMAGE_ATTACHMENTS, DEFAULT_FONT, DEFAULT_FONT_TUNINGS, DEFAULT_NARRATION_FONT, DEFAULT_NARRATION_LAYOUT,
  DEFAULT_NARRATION_LINE_HEIGHT, DEFAULT_NARRATION_SCALE, DEFAULT_QUOTE_COLOR, DEFAULT_QUOTE_COLOR_DARK,
  DEFAULT_QUOTE_COLOR_LIGHT, DEFAULT_QUOTE_ITALIC, DEFAULT_SCENE_IMAGE_AUTO, DEFAULT_THEME_COLOR,
} from '@/contexts/settingsDefaults';
import { HIDDEN_SETTING_DEFAULTS } from '@/lib/settingsAdvancedData';
import { DEFAULT_REASONING_SETTING, resolveReasoningSetting } from '@/lib/reasoningEffort';
import { withFontTuning } from '@/lib/fontTuning';
import { usePrefersReducedMotion } from '@/lib/usePrefersReducedMotion';
import {
  DEFAULT_REVEAL_BLUR, DEFAULT_REVEAL_BLUR_AMOUNT, DEFAULT_REVEAL_EASING, DEFAULT_REVEAL_FADE,
  DEFAULT_REVEAL_MIN_DURATION, DEFAULT_REVEAL_MIN_STAGGER, DEFAULT_REVEAL_MOVE, DEFAULT_REVEAL_MOVE_DIRECTION,
  DEFAULT_REVEAL_MOVE_DISTANCE, DEFAULT_REVEAL_SCALE, DEFAULT_REVEAL_SCALE_AMOUNT, DEFAULT_REVEAL_SCALE_DIRECTION,
  DEFAULT_REVEAL_SCALE_MODE,
} from '@/lib/narrationRevealConfig';

/** The stored values behind the local source: everything a section reads that is not derived. */
type LocalSettingsValues = Pick<SettingsSource,
  | 'theme' | 'themeColor' | 'fontFamily' | 'fontTunings'
  | 'bgmEnabled' | 'locationBackground' | 'backgroundOverlay' | 'sceneImageAuto'
  | 'narrationLayout' | 'language' | 'paragraphLimit' | 'markdownOutput'
  | 'narrationFont' | 'narrationScale' | 'narrationLineHeight' | 'quoteColor' | 'quoteItalic'
  | 'showReasoning' | 'showSilentRequests'
  | 'revealFade' | 'revealMove' | 'revealMoveDirection' | 'revealMoveDistance'
  | 'revealScale' | 'revealScaleMode' | 'revealScaleDirection' | 'revealScaleAmount'
  | 'revealBlur' | 'revealBlurAmount' | 'revealEasing' | 'revealMinDuration' | 'revealMinStagger'
  | 'choicesEnabled' | 'statUpdatesEnabled' | 'locationChangeEnabled' | 'locationAutoApply'
  | 'thinkingMode' | 'limitActiveCharacters' | 'activeCharacterLimit' | 'nativeReasoning' | 'toolsEnabled'
  | 'memoryDigests' | 'semanticMemory' | 'semanticBandCap' | 'semanticRehydration'
  | 'timeContext' | 'aiClock' | 'semanticLore' | 'describeCharacters' | 'characterDiaries' | 'semanticDiaries'
  | 'continueChoiceMode' | 'concurrentTurnRequests' | 'imageAttachments'
> & { quoteColorLight: string | null; quoteColorDark: string | null };

/** First-run values. Guarded against a fresh SettingsProvider in this module's test. */
export const LOCAL_SETTINGS_DEFAULTS: LocalSettingsValues = {
  theme: 'system',
  themeColor: DEFAULT_THEME_COLOR,
  fontFamily: DEFAULT_FONT,
  fontTunings: DEFAULT_FONT_TUNINGS,
  bgmEnabled: true,
  locationBackground: true,
  backgroundOverlay: 0,
  sceneImageAuto: DEFAULT_SCENE_IMAGE_AUTO,
  narrationLayout: DEFAULT_NARRATION_LAYOUT,
  language: 'English',
  paragraphLimit: HIDDEN_SETTING_DEFAULTS.paragraphLimit,
  markdownOutput: HIDDEN_SETTING_DEFAULTS.markdownOutput,
  narrationFont: DEFAULT_NARRATION_FONT,
  narrationScale: DEFAULT_NARRATION_SCALE,
  narrationLineHeight: DEFAULT_NARRATION_LINE_HEIGHT,
  quoteColor: DEFAULT_QUOTE_COLOR,
  quoteColorLight: DEFAULT_QUOTE_COLOR_LIGHT,
  quoteColorDark: DEFAULT_QUOTE_COLOR_DARK,
  quoteItalic: DEFAULT_QUOTE_ITALIC,
  showReasoning: HIDDEN_SETTING_DEFAULTS.showReasoning,
  showSilentRequests: HIDDEN_SETTING_DEFAULTS.showSilentRequests,
  revealFade: DEFAULT_REVEAL_FADE,
  revealMove: DEFAULT_REVEAL_MOVE,
  revealMoveDirection: DEFAULT_REVEAL_MOVE_DIRECTION,
  revealMoveDistance: DEFAULT_REVEAL_MOVE_DISTANCE,
  revealScale: DEFAULT_REVEAL_SCALE,
  revealScaleMode: DEFAULT_REVEAL_SCALE_MODE,
  revealScaleDirection: DEFAULT_REVEAL_SCALE_DIRECTION,
  revealScaleAmount: DEFAULT_REVEAL_SCALE_AMOUNT,
  revealBlur: DEFAULT_REVEAL_BLUR,
  revealBlurAmount: DEFAULT_REVEAL_BLUR_AMOUNT,
  revealEasing: DEFAULT_REVEAL_EASING,
  revealMinDuration: DEFAULT_REVEAL_MIN_DURATION,
  revealMinStagger: DEFAULT_REVEAL_MIN_STAGGER,
  choicesEnabled: true,
  statUpdatesEnabled: true,
  locationChangeEnabled: true,
  locationAutoApply: false,
  thinkingMode: 'off',
  limitActiveCharacters: HIDDEN_SETTING_DEFAULTS.limitActiveCharacters,
  activeCharacterLimit: HIDDEN_SETTING_DEFAULTS.activeCharacterLimit,
  nativeReasoning: DEFAULT_REASONING_SETTING,
  toolsEnabled: HIDDEN_SETTING_DEFAULTS.toolsEnabled,
  memoryDigests: HIDDEN_SETTING_DEFAULTS.memoryDigests,
  semanticMemory: HIDDEN_SETTING_DEFAULTS.semanticMemory,
  semanticBandCap: HIDDEN_SETTING_DEFAULTS.semanticBandCap,
  semanticRehydration: HIDDEN_SETTING_DEFAULTS.semanticRehydration,
  timeContext: HIDDEN_SETTING_DEFAULTS.timeContext,
  aiClock: HIDDEN_SETTING_DEFAULTS.aiClock,
  semanticLore: HIDDEN_SETTING_DEFAULTS.semanticLore,
  describeCharacters: HIDDEN_SETTING_DEFAULTS.describeCharacters,
  characterDiaries: HIDDEN_SETTING_DEFAULTS.characterDiaries,
  semanticDiaries: HIDDEN_SETTING_DEFAULTS.semanticDiaries,
  continueChoiceMode: DEFAULT_CONTINUE_CHOICE,
  concurrentTurnRequests: HIDDEN_SETTING_DEFAULTS.concurrentTurnRequests,
  imageAttachments: DEFAULT_IMAGE_ATTACHMENTS,
};

const systemTheme = (): 'light' | 'dark' =>
  window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';

/**
 * A settings source held in component state. It writes no storage and no root styles; theme persistence
 * and the embedding download report through `report` instead.
 */
export function useLocalSettingsSource(report: (status: string) => void): SettingsSource {
  const [values, setValues] = useState(LOCAL_SETTINGS_DEFAULTS);
  const prefersReducedMotion = usePrefersReducedMotion();

  // Stable setters, so memoized rows skip re-renders the same way they do against the context.
  const setters = useMemo(() => {
    const set = <K extends keyof LocalSettingsValues>(key: K): Dispatch<SetStateAction<LocalSettingsValues[K]>> =>
      (action) => setValues((prev) => ({
        ...prev,
        [key]: typeof action === 'function' ? (action as (p: LocalSettingsValues[K]) => LocalSettingsValues[K])(prev[key]) : action,
      }));
    return {
      setTheme: (theme: LocalSettingsValues['theme']) => {
        set('theme')(theme);
        const label = SETTINGS_OPTIONS.theme.find((o) => o.value === theme)?.label ?? theme;
        report(`Settings saves the ${label} theme at this step. The reference kept the app theme.`);
      },
      setThemeColor: set('themeColor'),
      setFontFamily: set('fontFamily'),
      setFontTuning: (font: LocalSettingsValues['fontFamily'], tuning: Parameters<SettingsSource['setFontTuning']>[1]) =>
        set('fontTunings')((prev) => withFontTuning(prev, font, tuning)),
      setBgmEnabled: set('bgmEnabled'),
      setLocationBackground: set('locationBackground'),
      setBackgroundOverlay: set('backgroundOverlay'),
      setSceneImageAuto: set('sceneImageAuto'),
      setNarrationLayout: set('narrationLayout'),
      setLanguage: set('language'),
      setParagraphLimit: set('paragraphLimit'),
      setMarkdownOutput: set('markdownOutput'),
      setNarrationFont: set('narrationFont'),
      setNarrationScale: set('narrationScale'),
      setNarrationLineHeight: set('narrationLineHeight'),
      setQuoteColor: set('quoteColor'),
      setQuoteColorLight: set('quoteColorLight'),
      setQuoteColorDark: set('quoteColorDark'),
      setQuoteItalic: set('quoteItalic'),
      setShowReasoning: set('showReasoning'),
      setShowSilentRequests: set('showSilentRequests'),
      setRevealFade: set('revealFade'),
      setRevealMove: set('revealMove'),
      setRevealMoveDirection: set('revealMoveDirection'),
      setRevealMoveDistance: set('revealMoveDistance'),
      setRevealScale: set('revealScale'),
      setRevealScaleMode: set('revealScaleMode'),
      setRevealScaleDirection: set('revealScaleDirection'),
      setRevealScaleAmount: set('revealScaleAmount'),
      setRevealBlur: set('revealBlur'),
      setRevealBlurAmount: set('revealBlurAmount'),
      setRevealEasing: set('revealEasing'),
      setRevealMinDuration: set('revealMinDuration'),
      setRevealMinStagger: set('revealMinStagger'),
      setChoicesEnabled: set('choicesEnabled'),
      setStatUpdatesEnabled: set('statUpdatesEnabled'),
      setLocationChangeEnabled: set('locationChangeEnabled'),
      setLocationAutoApply: set('locationAutoApply'),
      setThinkingMode: set('thinkingMode'),
      setLimitActiveCharacters: set('limitActiveCharacters'),
      setActiveCharacterLimit: set('activeCharacterLimit'),
      setNativeReasoning: set('nativeReasoning'),
      setToolsEnabled: set('toolsEnabled'),
      setMemoryDigests: set('memoryDigests'),
      setSemanticMemory: set('semanticMemory'),
      setSemanticBandCap: set('semanticBandCap'),
      setSemanticRehydration: set('semanticRehydration'),
      setTimeContext: set('timeContext'),
      setAiClock: set('aiClock'),
      setSemanticLore: set('semanticLore'),
      setDescribeCharacters: set('describeCharacters'),
      setCharacterDiaries: set('characterDiaries'),
      setSemanticDiaries: set('semanticDiaries'),
      setContinueChoiceMode: set('continueChoiceMode'),
      setConcurrentTurnRequests: set('concurrentTurnRequests'),
      setImageAttachments: set('imageAttachments'),
      embeddingModel: {
        loading: false,
        progress: null,
        error: null,
        start: () => report('Settings downloads the embedding model at this step. The reference skipped the download.'),
        dispose: () => report('Settings unloads the embedding model at this step. The reference skipped the unload.'),
      },
    };
  }, [report]);

  const resolvedTheme = values.theme === 'system' ? systemTheme() : values.theme;
  const {
    revealFade, revealMove, revealMoveDirection, revealMoveDistance, revealScale, revealScaleMode,
    revealScaleDirection, revealScaleAmount, revealBlur, revealBlurAmount,
  } = values;
  const revealSpec = useMemo(() => ({
    fade: revealFade,
    move: prefersReducedMotion ? false : revealMove, moveDirection: revealMoveDirection, moveDistance: revealMoveDistance,
    scale: prefersReducedMotion ? false : revealScale, scaleMode: revealScaleMode, scaleDirection: revealScaleDirection, scaleAmount: revealScaleAmount,
    blur: revealBlur, blurAmount: revealBlurAmount,
  }), [prefersReducedMotion, revealFade, revealMove, revealMoveDirection, revealMoveDistance, revealScale, revealScaleMode, revealScaleDirection, revealScaleAmount, revealBlur, revealBlurAmount]);

  return {
    ...values,
    ...setters,
    resolvedTheme,
    // The quote color follows the reference theme, since the page's root keeps the app theme.
    quoteColorMode: resolvedTheme,
    activeQuoteColor: resolvedTheme === 'dark' ? values.quoteColorDark : values.quoteColorLight,
    setActiveQuoteColor: resolvedTheme === 'dark' ? setters.setQuoteColorDark : setters.setQuoteColorLight,
    revealSpec,
    prefersReducedMotion,
    reasoningEffort: resolveReasoningSetting(values.nativeReasoning),
    reasoningCapability: null,
    imageGenDisabled: false,
  };
}
