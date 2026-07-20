import { randomUUID } from "@/lib/uuid";
import { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo, type ReactNode } from 'react';
import { defaultSystemPrompt, defaultChoicesPrompt, defaultStatUpdatesPrompt, defaultLocationChangePrompt, defaultThinkingPrompt, defaultSummaryPrompt, defaultChoicesUserPrompt, defaultStatUpdatesUserPrompt, defaultLocationChangeUserPrompt, defaultSummaryUserPrompt, defaultDiaryPrompt, defaultDirectorPrompt, defaultDirectorUserPrompt, defaultCharacterPrompt, defaultStoryboardPrompt } from '../components/game/GamePrompts';
import { DEFAULT_ENDPOINT, DEFAULT_API_TOKEN, DEFAULT_MODEL_NAME, DEFAULT_MAX_TOKENS, DEFAULT_CONTEXT_WINDOW, DEFAULT_LOCAL_CONTEXT_SIZE, DEFAULT_LOCAL_GPU_LAYERS, DEFAULT_LOCAL_FLASH_ATTENTION, DEFAULT_LOCAL_PARALLEL_REQUESTS, DEFAULT_GEN_TEMPERATURE, DEFAULT_GEN_TOP_P, DEFAULT_GEN_REPETITION_PENALTY, DEFAULT_GEN_TOP_K, DEFAULT_GEN_MIN_P, DEFAULT_THEME_COLOR, BASE_THEME_COLOR, THEME_COLORS, DEFAULT_FONT, FONT_OPTIONS, SYSTEM_FONT_STACK, DEFAULT_NARRATION_FONT, DEFAULT_NARRATION_SCALE, DEFAULT_NARRATION_LINE_HEIGHT, NARRATION_FONT_OPTIONS, fontStack, fontSizeAdjust, DEFAULT_UPDATE_CHANNEL, type ThemeColor, type FontChoice, type NarrationFont, type UpdateChannel } from './settingsDefaults';
import { isDesktop } from '../lib/imageGen/desktop';
import { DEFAULT_TAG_PROMPT } from '../lib/imagePrompt';
import {
  imageEndpointPresetCodec, makeDefaultStore as makeImageStore, presetStoreFromEnv, DEFAULT_IMAGE_ENDPOINT_VALUES,
  activeValues as imageEndpointActiveValues, setActive as imageSetActive, addPreset as imageAddPreset,
  renamePreset as imageRenamePreset, deletePreset as imageDeletePreset, resetPreset as imageResetPreset,
  updateValue as imageUpdateValue,
  type ImageEndpointPresetStore, type ImageEndpointValues, type ImageEndpointValueKey,
} from '../lib/imageEndpointPresets';
import { fetchContextLength } from '../lib/contextLength';
import { registerDevHook } from '../lib/devRouter';
import { usePersistentState, stringCodec, boolCodec, intCodec, floatCodec, nullableIntCodec } from '../lib/usePersistentState';
import { usePrefersReducedMotion } from '../lib/usePrefersReducedMotion';
import {
  REVEAL_DIRECTIONS, REVEAL_SCALE_MODES, DEFAULT_REVEAL_EASING,
  DEFAULT_REVEAL_FADE, DEFAULT_REVEAL_MOVE, DEFAULT_REVEAL_MOVE_DIRECTION, DEFAULT_REVEAL_MOVE_DISTANCE,
  DEFAULT_REVEAL_SCALE, DEFAULT_REVEAL_SCALE_MODE, DEFAULT_REVEAL_SCALE_DIRECTION, DEFAULT_REVEAL_SCALE_AMOUNT,
  DEFAULT_REVEAL_BLUR, DEFAULT_REVEAL_BLUR_AMOUNT, DEFAULT_REVEAL_MIN_DURATION, DEFAULT_REVEAL_MIN_STAGGER,
  type RevealDirection, type RevealScaleMode, type RevealSpec,
} from '../lib/narrationRevealConfig';
import {
  emptyStore, presetStoreCodec, activeValues, isBuiltInActive, activeStyle, BUILTIN_PRESETS,
  setActive as setActivePreset, addPreset as addPresetOp, renamePreset as renamePresetOp, deletePreset as deletePresetOp, resetPreset as resetPresetOp, updateValue,
  activeSamplers, activeReasoning, activeReasoningBudget, activeVerbatim, updateSamplers, updateReasoning, updateReasoningBudget, updateVerbatim, foldTuningIntoUserPresets,
  addFullPreset, replacePreset,
  type PromptPresetStore, type PromptValues, type VerbatimMap, type PromptPreset,
} from '../lib/promptPresets';
import { buildSharedPreset, type SharedPreset, type ImportedPreset } from '../lib/promptPresetShare';
import { buildStyledValues } from '../lib/sectionStyle';
import { defaultPromptSampler, type PromptSamplerMap, type PromptSampler } from '../lib/promptSamplers';
import type { AIRequestType } from '../types';
import type { ParagraphLimit } from '../lib/outputLength';
import { detectSupportedReasoningEfforts, detectReasoningCapability, isReasoningEngaged, type ReasoningEffortField, type PromptReasoning } from '../lib/reasoningEffort';

/** Lifecycle of the context-window auto-detect probe; `error` is set only on a forced (manual) attempt. */
export type DetectStatus = 'idle' | 'detecting' | 'success' | 'error';

/** Planning strategy run before game text: `off`, a single `precall` pass, `inline` reasoning, or the
 *  multi-stage director/character/storyboarder `staged` pipeline. */
export type ThinkingMode = 'off' | 'precall' | 'inline' | 'staged';
/** Native-reasoning budget hint, sent as `reasoning_effort` under the `off`/Native mode; `auto` omits the
 *  param and lets the endpoint decide, `none` actively suppresses a reasoning model's thinking. The available
 *  levels vary by endpoint (detected at connect); `minimal`/`xhigh`/`max` are backend-specific. A no-op on
 *  models without native reasoning. */
export type ReasoningEffort = 'auto' | 'none' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh' | 'max';
export type { ParagraphLimit };

const APP_ID = 'FORMAMORPH';

/** Build the initial image-endpoint preset store, migrating a pre-preset config from the legacy
 *  individual `FORMAMORPH_image*` keys into the seeded Default preset when present. With no legacy
 *  config, VITE_DEFAULT_IMAGE_PRESETS (if set) seeds named presets; otherwise a single "Default". */
function seedImagePresetStore(): ImageEndpointPresetStore {
  const get = (k: string) => localStorage.getItem(`${APP_ID}_${k}`);
  const legacyKeys = [
    'imageProvider', 'imageEndpoint', 'imageApiToken', 'imageModel', 'imagePositivePrompt', 'imageNegativePrompt',
    'imagePortraitWidth', 'imagePortraitHeight', 'imageLandscapeWidth', 'imageLandscapeHeight', 'imageSteps', 'imageCfg', 'imageSampler',
  ];
  if (!legacyKeys.some((k) => get(k) !== null)) return presetStoreFromEnv() ?? makeImageStore();
  const d = DEFAULT_IMAGE_ENDPOINT_VALUES;
  const str = (k: string, dflt: string) => get(k) ?? dflt;
  const int = (k: string, dflt: number) => { const r = get(k); return r === null ? dflt : parseInt(r); };
  const flt = (k: string, dflt: number) => { const r = get(k); return r === null ? dflt : parseFloat(r); };
  return makeImageStore({
    provider: get('imageProvider') === 'openai' ? 'openai' : 'a1111',
    endpoint: str('imageEndpoint', d.endpoint),
    apiToken: str('imageApiToken', d.apiToken),
    model: str('imageModel', d.model),
    positivePrompt: str('imagePositivePrompt', d.positivePrompt),
    negativePrompt: str('imageNegativePrompt', d.negativePrompt),
    portraitWidth: int('imagePortraitWidth', d.portraitWidth),
    portraitHeight: int('imagePortraitHeight', d.portraitHeight),
    landscapeWidth: int('imageLandscapeWidth', d.landscapeWidth),
    landscapeHeight: int('imageLandscapeHeight', d.landscapeHeight),
    steps: int('imageSteps', d.steps),
    cfg: flt('imageCfg', d.cfg),
    sampler: str('imageSampler', d.sampler),
    adetailer: d.adetailer,
    workflow: d.workflow,
    invokeEncoder: d.invokeEncoder,
    invokeVae: d.invokeVae,
  });
}

/** First-run default theme color. Honors an OS high-contrast request — but only while the user is still
 *  following the OS for appearance (light/dark = "system", the theme provider's default): if they've
 *  explicitly picked light or dark, they're customizing, so we don't force High Contrast on them. Applied
 *  by usePersistentState only when no theme color is stored yet, so it never overrides a later choice. */
function computeDefaultThemeColor(): ThemeColor {
  const storedMode = localStorage.getItem('vite-ui-theme'); // theme provider's key; null ⇒ "system"
  const followingSystem = storedMode === null || storedMode === 'system';
  if (followingSystem && window.matchMedia('(prefers-contrast: more)').matches) return 'highcontrast';
  return DEFAULT_THEME_COLOR;
}

/** Preload a font stack's primary family so it swaps in already at its adjusted size (no natural-size
 *  flash on first pick). Resolves regardless of success; a no-op where the Font Loading API is absent. */
function preloadFont(stack: string): Promise<unknown> {
  if (typeof document === 'undefined' || !('fonts' in document)) return Promise.resolve();
  const family = stack.split(',')[0].trim(); // e.g. "'Inter Variable'"
  return document.fonts.load(`1em ${family}`).catch(() => {});
}

/** The canonical shipped prompt text — authored in markdown headers; the built-in styles derive from it. */
const PROMPT_TEXT_DEFAULTS: PromptValues = {
  systemPrompt: defaultSystemPrompt,
  choicesPrompt: defaultChoicesPrompt,
  statUpdatesPrompt: defaultStatUpdatesPrompt,
  locationChangePromptText: defaultLocationChangePrompt,
  thinkingPrompt: defaultThinkingPrompt,
  summaryPrompt: defaultSummaryPrompt,
  diaryPrompt: defaultDiaryPrompt,
  directorPrompt: defaultDirectorPrompt,
  directorUserPrompt: defaultDirectorUserPrompt,
  characterPrompt: defaultCharacterPrompt,
  storyboardPrompt: defaultStoryboardPrompt,
  choicesUserPrompt: defaultChoicesUserPrompt,
  statUpdatesUserPrompt: defaultStatUpdatesUserPrompt,
  locationChangeUserPrompt: defaultLocationChangeUserPrompt,
  summaryUserPrompt: defaultSummaryUserPrompt,
};

/** Each read-only built-in preset's values, its section style applied to the canonical text (markdown =
 *  identity). Keyed by preset id for O(1) resolution of the active built-in. */
const BUILTIN_VALUES: Record<string, PromptValues> = Object.fromEntries(
  BUILTIN_PRESETS.map((b) => [b.id, buildStyledValues(PROMPT_TEXT_DEFAULTS, b.style)]),
);

/** One-time migration folding the formerly-global per-prompt tuning (samplers, reasoning, verbatim-turns)
 *  onto every user preset, so a preset becomes a self-contained "pack". Built-ins keep defaults; a user on a
 *  built-in with custom tuning reverts to defaults there (by design). Runs once, then retires the old keys. */
function migratePromptTuning() {
  const MARK = `${APP_ID}_promptTuningMigrated`;
  if (localStorage.getItem(MARK)) return;
  const readJson = <T,>(key: string, fallback: T): T => {
    try { const r = localStorage.getItem(`${APP_ID}_${key}`); return r ? (JSON.parse(r) as T) : fallback; } catch { return fallback; }
  };
  const rawStore = localStorage.getItem(`${APP_ID}_promptPresets`);
  const store = rawStore ? presetStoreCodec.parse(rawStore) : emptyStore;
  const samplers = readJson<PromptSamplerMap>('promptSamplers', {});
  const reasoning = readJson<Record<string, PromptReasoning>>('promptReasoning', {});
  // Only carry verbatim values the user actually changed from the shipped default.
  const verbatimDefs: [string, AIRequestType, number][] = [
    ['narrationVerbatimTurns', 'narration', 3], ['thinkingVerbatimTurns', 'thinking', 1],
    ['choicesVerbatimTurns', 'choices', 3], ['statUpdatesVerbatimTurns', 'statUpdates', 3],
    ['locationChangeVerbatimTurns', 'locationChange', 3], ['summaryVerbatimTurns', 'summary', 3],
  ];
  const verbatim: VerbatimMap = {};
  for (const [key, kind, def] of verbatimDefs) {
    const raw = localStorage.getItem(`${APP_ID}_${key}`);
    if (raw != null) { const n = parseInt(raw); if (!Number.isNaN(n) && n !== def) verbatim[kind] = n; }
  }
  const folded = foldTuningIntoUserPresets(store, samplers, reasoning, verbatim);
  localStorage.setItem(`${APP_ID}_promptPresets`, presetStoreCodec.serialize(folded));
  for (const key of ['promptSamplers', 'promptReasoning', ...verbatimDefs.map((v) => v[0])]) {
    localStorage.removeItem(`${APP_ID}_${key}`);
  }
  localStorage.setItem(MARK, '1');
}

/** One-time migration of the legacy "type DISABLED into the prompt body" hack to per-prompt Enabled
 *  flags. A prompt whose stored body is exactly "DISABLED" is turned off and its body reset to default. */
function migrateDisabledPrompts() {
  const pairs: [string, string][] = [
    [`${APP_ID}_choicesPrompt2`, `${APP_ID}_choicesEnabled`],
    [`${APP_ID}_statUpdatesPrompt2`, `${APP_ID}_statUpdatesEnabled`],
    [`${APP_ID}_locationChangePrompt`, `${APP_ID}_locationChangeEnabled`],
  ];
  for (const [promptKey, flagKey] of pairs) {
    if (localStorage.getItem(flagKey) === null && localStorage.getItem(promptKey) === 'DISABLED') {
      localStorage.setItem(flagKey, 'false');
      localStorage.removeItem(promptKey); // re-seeds to the default body, no longer the sentinel
    }
  }
}

function useProvideSettings() {
  const migrated = useRef(false);
  if (!migrated.current) {
    migrateDisabledPrompts(); // runs before the prompt/flag state below seeds from localStorage
    migratePromptTuning(); // folds legacy global tuning onto user presets before presetStore seeds
    migrated.current = true;
  }

  const [bgmEnabled, setBgmEnabled] = usePersistentState<boolean>('bgmEnabled', true, boolCodec);
  const [language, setLanguage] = usePersistentState<string>('language', 'English', stringCodec);

  // Custom: validates the stored value and migrates the legacy shortform boolean (true→single,
  // false→none); new users default to auto. The two-key migration doesn't fit usePersistentState.
  const [paragraphLimit, setParagraphLimit] = useState<ParagraphLimit>(() => {
    const saved = localStorage.getItem(`${APP_ID}_paragraphLimit`);
    if (saved === 'none' || saved === 'single' || saved === 'auto') return saved;
    const legacy = localStorage.getItem(`${APP_ID}_shortform`);
    if (legacy !== null) return JSON.parse(legacy) ? 'single' : 'none';
    return 'auto';
  });
  useEffect(() => {
    localStorage.setItem(`${APP_ID}_paragraphLimit`, paragraphLimit);
  }, [paragraphLimit]);

  // Per-word narration reveal. Fade / Move / Scale / Blur are independent, stackable effects; when none
  // is on the reveal falls back to the smooth character crawl. Each has its own options. See
  // RevealAnimationDemo. Direction/mode use validating codecs so a stale value falls back cleanly.
  const dirCodec = {
    parse: (r: string): RevealDirection => (REVEAL_DIRECTIONS.some((d) => d.value === r) ? (r as RevealDirection) : 'bottom'),
    serialize: (v: RevealDirection): string => v,
  };
  const scaleModeCodec = {
    parse: (r: string): RevealScaleMode => (REVEAL_SCALE_MODES.some((m) => m.value === r) ? (r as RevealScaleMode) : 'uniform'),
    serialize: (v: RevealScaleMode): string => v,
  };
  const [revealFade, setRevealFade] = usePersistentState<boolean>(`${APP_ID}_revealFade`, DEFAULT_REVEAL_FADE, boolCodec);
  const [revealMove, setRevealMove] = usePersistentState<boolean>(`${APP_ID}_revealMove`, DEFAULT_REVEAL_MOVE, boolCodec);
  const [revealMoveDirection, setRevealMoveDirection] = usePersistentState<RevealDirection>(`${APP_ID}_revealMoveDir`, DEFAULT_REVEAL_MOVE_DIRECTION, dirCodec);
  const [revealMoveDistance, setRevealMoveDistance] = usePersistentState<number>(`${APP_ID}_revealMoveDist`, DEFAULT_REVEAL_MOVE_DISTANCE, floatCodec);
  const [revealScale, setRevealScale] = usePersistentState<boolean>(`${APP_ID}_revealScaleOn`, DEFAULT_REVEAL_SCALE, boolCodec);
  const [revealScaleMode, setRevealScaleMode] = usePersistentState<RevealScaleMode>(`${APP_ID}_revealScaleMode`, DEFAULT_REVEAL_SCALE_MODE, scaleModeCodec);
  const [revealScaleDirection, setRevealScaleDirection] = usePersistentState<RevealDirection>(`${APP_ID}_revealScaleDir`, DEFAULT_REVEAL_SCALE_DIRECTION, dirCodec);
  const [revealScaleAmount, setRevealScaleAmount] = usePersistentState<number>(`${APP_ID}_revealScaleAmt`, DEFAULT_REVEAL_SCALE_AMOUNT, floatCodec);
  const [revealBlur, setRevealBlur] = usePersistentState<boolean>(`${APP_ID}_revealBlur`, DEFAULT_REVEAL_BLUR, boolCodec);
  const [revealBlurAmount, setRevealBlurAmount] = usePersistentState<number>(`${APP_ID}_revealBlurAmt`, DEFAULT_REVEAL_BLUR_AMOUNT, floatCodec);
  const [revealEasing, setRevealEasing] = usePersistentState<string>(`${APP_ID}_revealEasing`, DEFAULT_REVEAL_EASING, stringCodec);
  // Minimum reveal pace (ms): the rate-derived timing is floored to these so a fast model stays readable.
  // 0 = no floor. Not part of revealSpec — they gate the timing, not the composed animation.
  const [revealMinDuration, setRevealMinDuration] = usePersistentState<number>(`${APP_ID}_revealMinDuration`, DEFAULT_REVEAL_MIN_DURATION, intCodec);
  const [revealMinStagger, setRevealMinStagger] = usePersistentState<number>(`${APP_ID}_revealMinStagger`, DEFAULT_REVEAL_MIN_STAGGER, intCodec);
  // Respect the OS "reduce motion" setting: force the spatial-motion effects (Move, Scale) off at
  // runtime so a motion-sensitive reader never gets sliding/zooming text. Fade and Blur (no spatial
  // displacement) still apply. The saved toggles are untouched — they resume if the setting is cleared.
  const prefersReducedMotion = usePrefersReducedMotion();
  const revealSpec = useMemo<RevealSpec>(() => ({
    fade: revealFade,
    move: prefersReducedMotion ? false : revealMove, moveDirection: revealMoveDirection, moveDistance: revealMoveDistance,
    scale: prefersReducedMotion ? false : revealScale, scaleMode: revealScaleMode, scaleDirection: revealScaleDirection, scaleAmount: revealScaleAmount,
    blur: revealBlur, blurAmount: revealBlurAmount,
  }), [prefersReducedMotion, revealFade, revealMove, revealMoveDirection, revealMoveDistance, revealScale, revealScaleMode, revealScaleDirection, revealScaleAmount, revealBlur, revealBlurAmount]);
  // Show the current location's image as the game background. Off = a blank, themed background color.
  const [locationBackground, setLocationBackground] = usePersistentState<boolean>(`${APP_ID}_locationBackground`, true, boolCodec);
  // Opacity (0–1) of a background-colored overlay drawn over the location image to fade it toward the
  // theme background color. 0 = full image (no overlay). Only applies while locationBackground is on.
  const [backgroundOverlay, setBackgroundOverlay] = usePersistentState<number>(`${APP_ID}_backgroundOverlay`, 0, floatCodec);
  // Let the AI format narration with Markdown (seeds the <MARKDOWN GUIDANCE> token in the game-text prompt).
  const [markdownOutput, setMarkdownOutput] = usePersistentState<boolean>(`${APP_ID}_markdownOutput`, true, boolCodec);
  // Synthesize narration audio sentence-by-sentence as the story streams (vs. after the full text).
  // Default off: streaming TTS competes with the LLM for the GPU when both run on one machine.
  const [streamNarrationAudio, setStreamNarrationAudio] = usePersistentState<boolean>(`${APP_ID}_streamNarrationAudio`, false, boolCodec);
  // The single summaries toggle: generate a lazy per-turn memory digest as turns age out of the
  // verbatim window AND feed those digests into context (recent-verbatim floor + a "story so far" band
  // + lexical rehydration). Default off: extra async request + it changes what's sent to the model.
  const [memoryDigests, setMemoryDigests] = usePersistentState<boolean>(`${APP_ID}_memoryDigests`, false, boolCodec);
  // Fire the post-narration aux requests (choices + stat updates + location router) concurrently instead of
  // one after another. Default on: ~29% faster turns on a parallel-capable endpoint (LM Studio "Parallel",
  // Ollama), harmless on serial endpoints (they queue). Turn off if a VRAM-tight local engine slows or OOMs
  // under concurrent decodes.
  const [concurrentTurnRequests, setConcurrentTurnRequests] = usePersistentState<boolean>(`${APP_ID}_concurrentTurnRequests`, true, boolCodec);
  // Autosave the world's single autosave slot after every completed turn (starting with the opening). On by default.
  const [autosaveEnabled, setAutosaveEnabled] = usePersistentState<boolean>(`${APP_ID}_autosaveEnabled`, true, boolCodec);
  // Lazily write a per-character first-person diary entry for each turn's participants as turns age out.
  // Write-side only for now (entries are stored + inspectable, not yet fed back into the character pass).
  // Default off: extra async requests (one per participant) that matter mostly on a local endpoint.
  const [characterDiaries, setCharacterDiaries] = usePersistentState<boolean>(`${APP_ID}_characterDiaries`, false, boolCodec);
  // Reveal "silent" requests (e.g. the memory digest) in the status bar and AI-context viewer.
  // Default off: silent requests do their work without cluttering the UI; this is an inspection toggle.
  const [showSilentRequests, setShowSilentRequests] = usePersistentState<boolean>(`${APP_ID}_showSilentRequests`, false, boolCodec);
  // Show a reasoning model's (or an inline-thinking) private scratchpad as a collapsible aside above each turn's
  // narration. Default on: reasoning-model users see it; it's captured/saved regardless so toggling on reveals it.
  const [showReasoning, setShowReasoning] = usePersistentState<boolean>(`${APP_ID}_showReasoning`, true, boolCodec);
  // Desktop auto-update release channel (stable | prerelease). Surfaced in the update dialog, not Settings.
  const [updateChannel, setUpdateChannel] = usePersistentState<UpdateChannel>(`${APP_ID}_updateChannel`, DEFAULT_UPDATE_CHANNEL, {
    parse: (r) => (r === 'prerelease' ? 'prerelease' : 'stable'),
    serialize: (v) => v,
  });
  const [endpointUrl, setEndpointUrl] = usePersistentState<string>(`${APP_ID}_endpointUrl`, DEFAULT_ENDPOINT, stringCodec);
  const [apiToken, setApiToken] = usePersistentState<string>(`${APP_ID}_apiToken`, DEFAULT_API_TOKEN, stringCodec);
  const [modelName, setModelName] = usePersistentState<string>(`${APP_ID}_modelName`, DEFAULT_MODEL_NAME, stringCodec);
  const [maxTokens, setMaxTokens] = usePersistentState<number>(`${APP_ID}_maxTokens`, DEFAULT_MAX_TOKENS, intCodec);

  // Gates the custom endpoint fields. Fresh installs default off (use built-in defaults above); existing users
  // with any non-default stored value default on, so a saved/working config isn't silently dropped.
  const [useCustomEndpoint, setUseCustomEndpoint] = useState<boolean>(() => {
    const saved = localStorage.getItem(`${APP_ID}_useCustomEndpoint`);
    if (saved !== null) return JSON.parse(saved);
    return (
      (localStorage.getItem(`${APP_ID}_endpointUrl`) ?? DEFAULT_ENDPOINT) !== DEFAULT_ENDPOINT ||
      (localStorage.getItem(`${APP_ID}_apiToken`) ?? DEFAULT_API_TOKEN) !== DEFAULT_API_TOKEN ||
      (localStorage.getItem(`${APP_ID}_modelName`) ?? DEFAULT_MODEL_NAME) !== DEFAULT_MODEL_NAME ||
      (localStorage.getItem(`${APP_ID}_maxTokens`) ?? String(DEFAULT_MAX_TOKENS)) !== String(DEFAULT_MAX_TOKENS)
    );
  });
  useEffect(() => {
    localStorage.setItem(`${APP_ID}_useCustomEndpoint`, JSON.stringify(useCustomEndpoint));
  }, [useCustomEndpoint]);

  // What the app actually sends with: the user's values when custom is on, the built-in defaults otherwise.
  const activeEndpointUrl = useCustomEndpoint ? endpointUrl : DEFAULT_ENDPOINT;
  const activeApiToken = useCustomEndpoint ? apiToken : DEFAULT_API_TOKEN;
  const activeModelName = useCustomEndpoint ? modelName : DEFAULT_MODEL_NAME;
  // Honor the user's cap on a custom endpoint AND on the desktop local engine (their own machine); only the
  // shared default cloud endpoint forces the built-in default.
  const activeMaxTokens = (useCustomEndpoint || isDesktop()) ? maxTokens : DEFAULT_MAX_TOKENS;

  // Context window (tokens): auto-detected from the active endpoint, with an optional manual override.
  const [detectedContextWindow, setDetectedContextWindow] = usePersistentState<number | null>(`${APP_ID}_detectedContextWindow`, null, nullableIntCodec);
  const [contextWindowOverride, setContextWindowOverride] = usePersistentState<number | null>(`${APP_ID}_contextWindowOverride`, null, nullableIntCodec);
  const [detectStatus, setDetectStatus] = useState<DetectStatus>('idle');

  // Desktop bundled-model runtime. Only meaningful when the local engine is active (desktop + no custom
  // endpoint). localContextSize doubles as the engine KV-cache budget and the app's prompt window.
  const [localContextSize, setLocalContextSize] = usePersistentState<number>(`${APP_ID}_localContextSize`, DEFAULT_LOCAL_CONTEXT_SIZE, intCodec);
  const [localGpuLayers, setLocalGpuLayers] = usePersistentState<number>(`${APP_ID}_localGpuLayers`, DEFAULT_LOCAL_GPU_LAYERS, intCodec);
  const [localFlashAttention, setLocalFlashAttention] = usePersistentState<boolean>(`${APP_ID}_localFlashAttention`, DEFAULT_LOCAL_FLASH_ATTENTION, boolCodec);
  // Parallel decode slots for the bundled engine (context sequences); each slot gets ~localContextSize / N.
  const [localParallelRequests, setLocalParallelRequests] = usePersistentState<number>(`${APP_ID}_localParallelRequests`, DEFAULT_LOCAL_PARALLEL_REQUESTS, intCodec);
  // Whether settings panels reveal their extra advanced rows (persisted; simple rows always show).
  const [advancedMode, setAdvancedMode] = usePersistentState<boolean>(`${APP_ID}_advancedMode`, false, boolCodec);
  // Append a `/no_think` directive to requests so reasoning models skip their scratchpad (faster).
  const [disableThinking, setDisableThinking] = usePersistentState<boolean>(`${APP_ID}_disableThinking`, false, boolCodec);
  const localModelActive = isDesktop() && !useCustomEndpoint;

  // Generation sampling for the local model — sent while the local engine is active.
  const [genTemperature, setGenTemperature] = usePersistentState<number>(`${APP_ID}_genTemperature`, DEFAULT_GEN_TEMPERATURE, floatCodec);
  const [genTopP, setGenTopP] = usePersistentState<number>(`${APP_ID}_genTopP`, DEFAULT_GEN_TOP_P, floatCodec);
  const [genRepetitionPenalty, setGenRepetitionPenalty] = usePersistentState<number>(`${APP_ID}_genRepetitionPenalty`, DEFAULT_GEN_REPETITION_PENALTY, floatCodec);
  const [genTopK, setGenTopK] = usePersistentState<number>(`${APP_ID}_genTopK`, DEFAULT_GEN_TOP_K, intCodec);
  const [genMinP, setGenMinP] = usePersistentState<number>(`${APP_ID}_genMinP`, DEFAULT_GEN_MIN_P, floatCodec);

  // Per-prompt tuning (samplers/reasoning/verbatim) is preset-scoped — derived from the active preset and
  // set through it, below where `presetStore` is declared.

  // Context window: a custom endpoint uses its detected/override value; the local engine uses the context
  // size the user set (same number); otherwise the built-in default.
  const contextWindow = useCustomEndpoint
    ? (contextWindowOverride ?? detectedContextWindow ?? DEFAULT_CONTEXT_WINDOW)
    : localModelActive
    ? localContextSize
    : DEFAULT_CONTEXT_WINDOW;

  const detectContextWindow = useCallback(async (force = false) => {
    setDetectStatus('detecting');
    const detected = await fetchContextLength(activeEndpointUrl, activeApiToken, activeModelName);
    if (detected !== null) {
      setDetectedContextWindow(detected);
      if (force) setContextWindowOverride(null); // snap the field back to the detected value
      setDetectStatus('success');
    } else {
      setDetectStatus(force ? 'error' : 'idle'); // auto-attempts fail quietly
    }
  }, [activeEndpointUrl, activeApiToken, activeModelName, setDetectedContextWindow, setContextWindowOverride]);

  // Auto-detect on connect (custom endpoint only); debounced so editing the URL doesn't fire per keystroke.
  useEffect(() => {
    if (!useCustomEndpoint) return;
    const id = setTimeout(() => { void detectContextWindow(false); }, 1000);
    return () => clearTimeout(id);
  }, [useCustomEndpoint, detectContextWindow]);

  // Which reasoning_effort levels each endpoint+model accepts, probed once and remembered per `endpoint|model`
  // so flipping between endpoints (or swapping the model on one) doesn't re-probe. A missing key means "not yet
  // known" — the UI falls back to the universally-accepted levels until detected. Bounded so heavy testers don't
  // grow it without limit; the oldest entry is dropped past the cap.
  const REASONING_CACHE_CAP = 30;
  const reasoningSupportSig = `${activeEndpointUrl}|${activeModelName}`;
  const [reasoningSupportCache, setReasoningSupportCache] = usePersistentState<Record<string, ReasoningEffortField[]>>(
    `${APP_ID}_reasoningSupport`, {}, {
      parse: (r) => { try { const o = JSON.parse(r); return o && typeof o === 'object' && !Array.isArray(o) && Object.values(o).every((v) => Array.isArray(v)) ? o : {}; } catch { return {}; } },
      serialize: (v) => JSON.stringify(v),
    });
  const supportedReasoningEfforts = reasoningSupportCache[reasoningSupportSig] ?? null;

  const detectReasoningEfforts = useCallback(async () => {
    const sig = `${activeEndpointUrl}|${activeModelName}`;
    // `detectSupportedReasoningEfforts` first consults LM Studio's native capability list, so a non-reasoning
    // model resolves to `[]` (→ hide the control, send no reasoning_effort) without a warning-triggering probe.
    const efforts = await detectSupportedReasoningEfforts(activeEndpointUrl, activeApiToken, activeModelName);
    if (!efforts) return;
    setReasoningSupportCache((prev) => {
      const next = { ...prev, [sig]: efforts };
      const keys = Object.keys(next);
      if (keys.length > REASONING_CACHE_CAP) delete next[keys[0]];
      return next;
    });
  }, [activeEndpointUrl, activeApiToken, activeModelName, setReasoningSupportCache]);


  const [thinkingMode, setThinkingMode] = usePersistentState<ThinkingMode>(`${APP_ID}_thinkingMode`, 'off', {
    parse: (r) => (r === 'precall' || r === 'inline' || r === 'staged' ? r : 'off'),
    serialize: (v) => v,
  });
  const REASONING_VALUES = ['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'];
  const [reasoningEffort, setReasoningEffort] = usePersistentState<ReasoningEffort>(`${APP_ID}_reasoningEffort`, 'auto', {
    parse: (r) => (REASONING_VALUES.includes(r) ? (r as ReasoningEffort) : 'auto'),
    serialize: (v) => v,
  });
  // The 15 editable prompt strings live in named presets (one localStorage key). Each keeps its original
  // context field + setter name; values derive from the active preset (Default = read-only shipped text),
  // and setters patch the active preset (a no-op under Default). See src/lib/promptPresets.ts.
  const [presetStore, setPresetStore] = usePersistentState<PromptPresetStore>(`${APP_ID}_promptPresets`, emptyStore, presetStoreCodec);
  const promptValues = useMemo(() => activeValues(presetStore, BUILTIN_VALUES), [presetStore]);
  const {
    systemPrompt, choicesPrompt, statUpdatesPrompt, locationChangePromptText, thinkingPrompt, summaryPrompt,
    diaryPrompt, directorPrompt, directorUserPrompt, characterPrompt, storyboardPrompt,
    choicesUserPrompt, statUpdatesUserPrompt, locationChangeUserPrompt, summaryUserPrompt,
  } = promptValues;
  const setSystemPrompt = (v: string) => setPresetStore((s) => updateValue(s, 'systemPrompt', v));
  const setChoicesPrompt = (v: string) => setPresetStore((s) => updateValue(s, 'choicesPrompt', v));
  const setStatUpdatesPrompt = (v: string) => setPresetStore((s) => updateValue(s, 'statUpdatesPrompt', v));
  const setLocationChangePromptText = (v: string) => setPresetStore((s) => updateValue(s, 'locationChangePromptText', v));
  const setThinkingPrompt = (v: string) => setPresetStore((s) => updateValue(s, 'thinkingPrompt', v));
  const setSummaryPrompt = (v: string) => setPresetStore((s) => updateValue(s, 'summaryPrompt', v));
  const setDiaryPrompt = (v: string) => setPresetStore((s) => updateValue(s, 'diaryPrompt', v));
  const setDirectorPrompt = (v: string) => setPresetStore((s) => updateValue(s, 'directorPrompt', v));
  const setDirectorUserPrompt = (v: string) => setPresetStore((s) => updateValue(s, 'directorUserPrompt', v));
  const setCharacterPrompt = (v: string) => setPresetStore((s) => updateValue(s, 'characterPrompt', v));
  const setStoryboardPrompt = (v: string) => setPresetStore((s) => updateValue(s, 'storyboardPrompt', v));
  const setChoicesUserPrompt = (v: string) => setPresetStore((s) => updateValue(s, 'choicesUserPrompt', v));
  const setStatUpdatesUserPrompt = (v: string) => setPresetStore((s) => updateValue(s, 'statUpdatesUserPrompt', v));
  const setLocationChangeUserPrompt = (v: string) => setPresetStore((s) => updateValue(s, 'locationChangeUserPrompt', v));
  const setSummaryUserPrompt = (v: string) => setPresetStore((s) => updateValue(s, 'summaryUserPrompt', v));

  // Preset-scoped tuning derives from the active preset (built-ins → empty → defaults); setters patch the
  // active preset and no-op under a built-in, mirroring the text setters above.
  const promptSamplers = useMemo(() => activeSamplers(presetStore), [presetStore]);
  const promptReasoning = useMemo(() => activeReasoning(presetStore), [presetStore]);
  const promptReasoningBudget = useMemo(() => activeReasoningBudget(presetStore), [presetStore]);

  // Reasoning is "engaged" only when the user has opted into it somewhere — a Thinking mode, a global native
  // effort, or a per-prompt positive level. When it isn't, the app sends no `reasoning_effort` at all (so a
  // plain endpoint like LM Studio isn't hit with fields it rejects, e.g. the aux prompts' `none`) and skips
  // the support probe entirely, matching the pre-reasoning behavior for the many users who never touch it.
  const reasoningEngaged = useMemo(
    () => isReasoningEngaged(thinkingMode, reasoningEffort, promptReasoning),
    [thinkingMode, reasoningEffort, promptReasoning],
  );

  // Probe the endpoint's accepted reasoning levels only once reasoning is actually engaged and we have no
  // cached list yet; debounced so editing the URL doesn't fire per keystroke.
  useEffect(() => {
    if (!reasoningEngaged || supportedReasoningEfforts !== null) return;
    const id = setTimeout(() => { void detectReasoningEfforts(); }, 1200);
    return () => clearTimeout(id);
  }, [reasoningEngaged, supportedReasoningEfforts, detectReasoningEfforts]);

  // The reasoning-capability check hits LM Studio's native model list — a side-effect-free GET that logs no
  // warning — so unlike the effort probe it runs eagerly on every endpoint/model change AND overrides the
  // write-once cache: a model the backend lists as non-reasoning is forced to `[]` (hide the control, send no
  // reasoning_effort) even if an earlier probe cached levels for it; a model listed as reasoning clears a
  // wrongly-cached `[]` so levels re-probe. Inconclusive (non-LM-Studio / unlisted / unreachable) leaves the
  // cache untouched, so plain OpenAI endpoints keep the effort-probe behavior.
  useEffect(() => {
    const sig = `${activeEndpointUrl}|${activeModelName}`;
    let cancelled = false;
    const id = setTimeout(async () => {
      const capable = await detectReasoningCapability(activeEndpointUrl, activeApiToken, activeModelName);
      if (cancelled || capable === null) return;
      setReasoningSupportCache((prev) => {
        const current = prev[sig];
        const cachedEmpty = Array.isArray(current) && current.length === 0;
        if (!capable) {
          if (cachedEmpty) return prev; // already marked non-reasoning
          const next = { ...prev, [sig]: [] as ReasoningEffortField[] };
          const keys = Object.keys(next);
          if (keys.length > REASONING_CACHE_CAP) delete next[keys[0]];
          return next;
        }
        if (cachedEmpty) { const next = { ...prev }; delete next[sig]; return next; } // reasoning after all → re-probe levels
        return prev;
      });
    }, 1200);
    return () => { cancelled = true; clearTimeout(id); };
  }, [activeEndpointUrl, activeApiToken, activeModelName, setReasoningSupportCache]);
  const verbatimMap = useMemo(() => activeVerbatim(presetStore), [presetStore]);
  const globalForSampler = useCallback(
    (sampler: PromptSampler) => (sampler === 'temperature' ? genTemperature : genRepetitionPenalty),
    [genTemperature, genRepetitionPenalty],
  );
  const setPromptSamplerCustom = useCallback((kind: AIRequestType, sampler: PromptSampler, custom: boolean) => {
    setPresetStore((s) => updateSamplers(s, (prev) => {
      // Seed the custom value with the built-in default so it always starts as a real number, never undefined.
      const value = prev[kind]?.[sampler]?.value ?? defaultPromptSampler(kind, sampler, globalForSampler(sampler), true)!;
      return { ...prev, [kind]: { ...prev[kind], [sampler]: { custom, value } } };
    }));
  }, [globalForSampler, setPresetStore]);
  const setPromptSamplerValue = useCallback((kind: AIRequestType, sampler: PromptSampler, value: number) => {
    setPresetStore((s) => updateSamplers(s, (prev) => ({
      ...prev,
      [kind]: { ...prev[kind], [sampler]: { custom: prev[kind]?.[sampler]?.custom ?? true, value } },
    })));
  }, [setPresetStore]);
  const setPromptReasoning = useCallback((kind: AIRequestType, value: PromptReasoning) => {
    setPresetStore((s) => updateReasoning(s, kind, value));
  }, [setPresetStore]);
  const setPromptReasoningBudget = useCallback((kind: AIRequestType, value: number) => {
    setPresetStore((s) => updateReasoningBudget(s, kind, value));
  }, [setPresetStore]);

  // Preset management (Settings → System Prompts selector).
  const activePresetId = presetStore.activeId;
  const activePresetIsBuiltIn = isBuiltInActive(presetStore);
  const activeSectionStyle = activeStyle(presetStore);
  const builtinPresets = BUILTIN_PRESETS.map(({ id, name }) => ({ id, name }));
  const promptPresets = presetStore.presets.map((p) => ({ id: p.id, name: p.name }));
  const selectPreset = (id: string) => setPresetStore((s) => setActivePreset(s, id));
  const addPreset = (name: string) => {
    const id = randomUUID();
    setPresetStore((s) => addPresetOp(s, id, name, activeValues(s, BUILTIN_VALUES), activeStyle(s)));
    return id;
  };
  const renamePreset = (id: string, name: string) => setPresetStore((s) => renamePresetOp(s, id, name));
  const deletePreset = (id: string) => setPresetStore((s) => deletePresetOp(s, id));
  const resetPreset = (id: string) => setPresetStore((s) => {
    const style = s.presets.find((p) => p.id === id)?.style ?? 'markdown';
    return resetPresetOp(s, id, buildStyledValues(PROMPT_TEXT_DEFAULTS, style));
  });
  // Share (export/import). Export materializes the selected preset (built-ins → concrete text, empty tuning);
  // import adds a new preset or overwrites one by id, optionally including the shared tuning.
  const activePresetName = BUILTIN_PRESETS.find((b) => b.id === presetStore.activeId)?.name
    ?? presetStore.presets.find((p) => p.id === presetStore.activeId)?.name ?? 'Preset';
  const exportActivePreset = (appVersion: string): SharedPreset =>
    buildSharedPreset({ name: activePresetName, style: activeSectionStyle, values: promptValues, samplers: promptSamplers, reasoning: promptReasoning, reasoningBudget: promptReasoningBudget, verbatim: verbatimMap }, appVersion);
  const importPreset = (imported: ImportedPreset, opts: { includeTuning: boolean; name: string; overwriteId?: string }): string => {
    const style = imported.style;
    const values = { ...buildStyledValues(PROMPT_TEXT_DEFAULTS, style), ...imported.values };
    const content: Omit<PromptPreset, 'id'> = {
      name: opts.name, values, style,
      ...(opts.includeTuning && imported.samplers ? { samplers: imported.samplers } : {}),
      ...(opts.includeTuning && imported.reasoning ? { reasoning: imported.reasoning } : {}),
      ...(opts.includeTuning && imported.reasoningBudget ? { reasoningBudget: imported.reasoningBudget } : {}),
      ...(opts.includeTuning && imported.verbatim ? { verbatim: imported.verbatim } : {}),
    };
    if (opts.overwriteId) { const target = opts.overwriteId; setPresetStore((s) => replacePreset(s, target, content)); return target; }
    const id = randomUUID();
    setPresetStore((s) => addFullPreset(s, id, content));
    return id;
  };
  // Whether each optional per-turn request is sent (replaces the legacy "type DISABLED" body hack).
  const [choicesEnabled, setChoicesEnabled] = usePersistentState<boolean>(`${APP_ID}_choicesEnabled`, true, boolCodec);
  const [statUpdatesEnabled, setStatUpdatesEnabled] = usePersistentState<boolean>(`${APP_ID}_statUpdatesEnabled`, true, boolCodec);
  const [locationChangeEnabled, setLocationChangeEnabled] = usePersistentState<boolean>(`${APP_ID}_locationChangeEnabled`, true, boolCodec);
  // When on, a detected in-scope move is applied immediately instead of prompting a "Move to X?" confirmation.
  const [locationAutoApply, setLocationAutoApply] = usePersistentState<boolean>(`${APP_ID}_locationAutoApply`, false, boolCodec);
  // Staged thinking: cap how many characters the director casts (each gets its own sequential pass). When off,
  // the cast is unbounded. Drives both the hard cap (matchCastToEntities) and the <ACTIVE CHARACTER GUIDANCE> chip.
  const [limitActiveCharacters, setLimitActiveCharacters] = usePersistentState<boolean>(`${APP_ID}_limitActiveCharacters`, true, boolCodec);
  const [activeCharacterLimit, setActiveCharacterLimit] = usePersistentState<number>(`${APP_ID}_activeCharacterLimit`, 5, intCodec);
  // How many recent turns each prompt receives verbatim (the digest-banding floor). Only Narration and
  // Thinking consume history today; the rest are stored for when those prompts gain history.
  const narrationVerbatimTurns = verbatimMap.narration ?? 3;
  const thinkingVerbatimTurns = verbatimMap.thinking ?? 1;
  const choicesVerbatimTurns = verbatimMap.choices ?? 3;
  const statUpdatesVerbatimTurns = verbatimMap.statUpdates ?? 3;
  const locationChangeVerbatimTurns = verbatimMap.locationChange ?? 3;
  const summaryVerbatimTurns = verbatimMap.summary ?? 3;
  const setNarrationVerbatimTurns = (n: number) => setPresetStore((s) => updateVerbatim(s, 'narration', n));
  const setThinkingVerbatimTurns = (n: number) => setPresetStore((s) => updateVerbatim(s, 'thinking', n));
  const setChoicesVerbatimTurns = (n: number) => setPresetStore((s) => updateVerbatim(s, 'choices', n));
  const setStatUpdatesVerbatimTurns = (n: number) => setPresetStore((s) => updateVerbatim(s, 'statUpdates', n));
  const setLocationChangeVerbatimTurns = (n: number) => setPresetStore((s) => updateVerbatim(s, 'locationChange', n));
  const setSummaryVerbatimTurns = (n: number) => setPresetStore((s) => updateVerbatim(s, 'summary', n));
  // Image generation config (Settings → Image Gen → Endpoint). Lives in named, freely-editable presets so
  // the user can keep several image-server configs. The active preset's values back the fields below; the
  // public getter/setter names are unchanged so consumers (GenerateImageButton) don't care about presets.
  const initialImageStore = useRef<ImageEndpointPresetStore | null>(null);
  if (!initialImageStore.current) initialImageStore.current = seedImagePresetStore();
  const [imagePresetStore, setImagePresetStore] = usePersistentState<ImageEndpointPresetStore>(
    `${APP_ID}_imageEndpointPresets`, initialImageStore.current, imageEndpointPresetCodec,
  );
  const imageValues = useMemo(() => imageEndpointActiveValues(imagePresetStore), [imagePresetStore]);
  const patchImage = <K extends ImageEndpointValueKey>(key: K) => (value: ImageEndpointValues[K]) =>
    setImagePresetStore((s) => imageUpdateValue(s, key, value));
  const {
    provider: imageProvider, endpoint: imageEndpoint, apiToken: imageApiToken, model: imageModel,
    positivePrompt: imagePositivePrompt, negativePrompt: imageNegativePrompt,
    portraitWidth: imagePortraitWidth, portraitHeight: imagePortraitHeight,
    landscapeWidth: imageLandscapeWidth, landscapeHeight: imageLandscapeHeight,
    steps: imageSteps, cfg: imageCfg, sampler: imageSampler, adetailer: imageAdetailer,
    workflow: imageWorkflow, invokeEncoder: imageInvokeEncoder, invokeVae: imageInvokeVae,
  } = imageValues;
  const setImageProvider = patchImage('provider');
  const setImageEndpoint = patchImage('endpoint');
  const setImageApiToken = patchImage('apiToken');
  const setImageModel = patchImage('model');
  const setImagePositivePrompt = patchImage('positivePrompt');
  const setImageNegativePrompt = patchImage('negativePrompt');
  const setImagePortraitWidth = patchImage('portraitWidth');
  const setImagePortraitHeight = patchImage('portraitHeight');
  const setImageLandscapeWidth = patchImage('landscapeWidth');
  const setImageLandscapeHeight = patchImage('landscapeHeight');
  const setImageSteps = patchImage('steps');
  const setImageCfg = patchImage('cfg');
  const setImageSampler = patchImage('sampler');
  const setImageAdetailer = patchImage('adetailer');
  const setImageWorkflow = patchImage('workflow');
  const setImageInvokeEncoder = patchImage('invokeEncoder');
  const setImageInvokeVae = patchImage('invokeVae');
  // DEV-only: let preview verification set Image Gen values in one call (`window.__fmDev.setImage({...})`)
  // instead of driving Radix dropdowns by hand. Tree-shaken from prod via the import.meta.env.DEV guard.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    return registerDevHook('setImage', (partial: Partial<ImageEndpointValues>) => {
      setImagePresetStore((s) => (Object.entries(partial) as [ImageEndpointValueKey, ImageEndpointValues[ImageEndpointValueKey]][])
        .reduce((acc, [key, value]) => imageUpdateValue(acc, key, value), s));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- register the dev hook once; setImagePresetStore is stable
  }, []);
  // Preset management (Settings → Image Gen → Endpoint selector). Every preset is editable, including Default.
  const imageEndpointPresets = imagePresetStore.presets.map((p) => ({ id: p.id, name: p.name }));
  const activeImageEndpointPresetId = imagePresetStore.activeId;
  const activeImageEndpointPresetName =
    imagePresetStore.presets.find((p) => p.id === imagePresetStore.activeId)?.name ?? 'Default';
  const selectImageEndpointPreset = (id: string) => setImagePresetStore((s) => imageSetActive(s, id));
  const addImageEndpointPreset = (name: string) => {
    const id = randomUUID();
    setImagePresetStore((s) => imageAddPreset(s, id, name, imageEndpointActiveValues(s)));
    return id;
  };
  const renameImageEndpointPreset = (id: string, name: string) => setImagePresetStore((s) => imageRenamePreset(s, id, name));
  const deleteImageEndpointPreset = (id: string) => setImagePresetStore((s) => imageDeletePreset(s, id));
  const resetImageEndpointPreset = (id: string) => setImagePresetStore((s) => imageResetPreset(s, id));
  // User-editable prompt that turns a subject's description into booru tags (Settings → Image Gen → Tag Prompt).
  const [imageTagPrompt, setImageTagPrompt] = usePersistentState<string>(`${APP_ID}_imageTagPrompt`, DEFAULT_TAG_PROMPT, stringCodec);

  const [vramHelperUrl, setVramHelperUrl] = usePersistentState<string>(`${APP_ID}_vramHelperUrl`, 'http://localhost:5179', stringCodec);

  // Preset color theme. Sets a `data-theme` attribute on <html> that swaps a full token set (see the
  // `[data-theme="…"]` blocks in index.css); the base `blue` theme lives in :root and needs no attribute.
  // The default is computed once (below), then usePersistentState only uses it when nothing is stored —
  // so it seeds a first-run default but never overrides a theme the user has picked.
  const initialThemeColor = useRef<ThemeColor | null>(null);
  if (initialThemeColor.current === null) initialThemeColor.current = computeDefaultThemeColor();
  const [themeColor, setThemeColor] = usePersistentState<ThemeColor>(`${APP_ID}_themeColor`, initialThemeColor.current, {
    parse: (r) => (THEME_COLORS.some((t) => t.value === r) ? (r as ThemeColor) : DEFAULT_THEME_COLOR),
    serialize: (v) => v,
  });
  useEffect(() => {
    const root = document.documentElement;
    if (themeColor === BASE_THEME_COLOR) root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', themeColor);
  }, [themeColor]);

  // App font. Sets the `--app-font` variable (consumed by index.css / Tailwind's font-sans); `system`
  // removes the override so the :root default (OS sans stack) applies. A webfont appends that same stack
  // as a glyph fallback so missing (e.g. non-Latin) characters still render.
  const [fontFamily, setFontFamily] = usePersistentState<FontChoice>(`${APP_ID}_fontFamily`, DEFAULT_FONT, {
    parse: (r) => (FONT_OPTIONS.some((f) => f.value === r) ? (r as FontChoice) : DEFAULT_FONT),
    serialize: (v) => v,
  });
  useEffect(() => {
    const root = document.documentElement;
    const stack = FONT_OPTIONS.find((f) => f.value === fontFamily)?.stack;
    let cancelled = false;
    const apply = () => {
      if (cancelled) return;
      if (!stack) root.style.removeProperty('--app-font');
      else root.style.setProperty('--app-font', `${stack}, ${SYSTEM_FONT_STACK}`);
      // Per-font x-height target (e.g. monospace reads oversized at the shared default).
      root.style.setProperty('font-size-adjust', String(fontSizeAdjust(fontFamily)));
    };
    // Preload the webfont first so it applies already-adjusted (avoids the natural-size flash on first pick).
    if (stack) preloadFont(stack).then(apply);
    else apply();
    return () => { cancelled = true; };
  }, [fontFamily]);

  // Narration (Accessibility): a separate font for the story reading pane (`global` = inherit the app
  // font) plus reading scale + line-height. Applied to `.narration-text` via CSS variables in index.css.
  const [narrationFont, setNarrationFont] = usePersistentState<NarrationFont>(`${APP_ID}_narrationFont`, DEFAULT_NARRATION_FONT, {
    parse: (r) => (NARRATION_FONT_OPTIONS.some((f) => f.value === r) ? (r as NarrationFont) : DEFAULT_NARRATION_FONT),
    serialize: (v) => v,
  });
  const [narrationScale, setNarrationScale] = usePersistentState<number>(`${APP_ID}_narrationScale`, DEFAULT_NARRATION_SCALE, floatCodec);
  const [narrationLineHeight, setNarrationLineHeight] = usePersistentState<number>(`${APP_ID}_narrationLineHeight`, DEFAULT_NARRATION_LINE_HEIGHT, floatCodec);
  useEffect(() => {
    const root = document.documentElement;
    // Scale + line-height apply immediately (slider changes shouldn't wait on a font load).
    root.style.setProperty('--narration-scale', String(narrationScale));
    root.style.setProperty('--narration-line-height', String(narrationLineHeight));
    const stack = fontStack(narrationFont); // '' for `global` ⇒ inherit --app-font
    let cancelled = false;
    const apply = () => {
      if (cancelled) return;
      if (!stack) root.style.removeProperty('--narration-font');
      else root.style.setProperty('--narration-font', `${stack}, ${SYSTEM_FONT_STACK}`);
      // `global` ⇒ inherit the app-wide target; a specific narration font uses its own (e.g. mono).
      if (narrationFont === 'global') root.style.removeProperty('--narration-fsa');
      else root.style.setProperty('--narration-fsa', String(fontSizeAdjust(narrationFont)));
    };
    if (stack) preloadFont(stack).then(apply);
    else apply();
    return () => { cancelled = true; };
  }, [narrationFont, narrationScale, narrationLineHeight]);
  const [ttsVolume, setTtsVolume] = usePersistentState<number>(`${APP_ID}_ttsVolume`, 1, floatCodec);
  const [ttsSpeed, setTtsSpeed] = usePersistentState<number>(`${APP_ID}_ttsSpeed`, 1, floatCodec);
  const [ttsHighlight, setTtsHighlight] = usePersistentState<boolean>(`${APP_ID}_ttsHighlight`, true, boolCodec);

  const value = {
    bgmEnabled,
    setBgmEnabled,
    themeColor,
    setThemeColor,
    fontFamily,
    setFontFamily,
    narrationFont,
    setNarrationFont,
    narrationScale,
    setNarrationScale,
    narrationLineHeight,
    setNarrationLineHeight,
    language,
    setLanguage,
    paragraphLimit,
    setParagraphLimit,
    revealFade,
    setRevealFade,
    revealMove,
    setRevealMove,
    revealMoveDirection,
    setRevealMoveDirection,
    revealMoveDistance,
    setRevealMoveDistance,
    revealScale,
    setRevealScale,
    revealScaleMode,
    setRevealScaleMode,
    revealScaleDirection,
    setRevealScaleDirection,
    revealScaleAmount,
    setRevealScaleAmount,
    revealBlur,
    setRevealBlur,
    revealBlurAmount,
    setRevealBlurAmount,
    revealEasing,
    setRevealEasing,
    revealMinDuration,
    setRevealMinDuration,
    revealMinStagger,
    setRevealMinStagger,
    revealSpec,
    prefersReducedMotion,
    locationBackground,
    setLocationBackground,
    backgroundOverlay,
    setBackgroundOverlay,
    markdownOutput,
    setMarkdownOutput,
    streamNarrationAudio,
    setStreamNarrationAudio,
    memoryDigests,
    setMemoryDigests,
    concurrentTurnRequests,
    setConcurrentTurnRequests,
    autosaveEnabled,
    setAutosaveEnabled,
    characterDiaries,
    setCharacterDiaries,
    showSilentRequests,
    setShowReasoning,
    showReasoning,
    setShowSilentRequests,
    updateChannel,
    setUpdateChannel,
    endpointUrl,
    setEndpointUrl,
    apiToken,
    setApiToken,
    modelName,
    setModelName,
    maxTokens,
    setMaxTokens,
    useCustomEndpoint,
    setUseCustomEndpoint,
    activeEndpointUrl,
    activeApiToken,
    activeModelName,
    activeMaxTokens,
    contextWindow,
    contextWindowOverride,
    setContextWindowOverride,
    detectedContextWindow,
    detectStatus,
    detectContextWindow,
    localContextSize,
    setLocalContextSize,
    localGpuLayers,
    setLocalGpuLayers,
    localFlashAttention,
    setLocalFlashAttention,
    localParallelRequests,
    setLocalParallelRequests,
    advancedMode,
    setAdvancedMode,
    disableThinking,
    setDisableThinking,
    localModelActive,
    genTemperature,
    setGenTemperature,
    genTopP,
    setGenTopP,
    genRepetitionPenalty,
    setGenRepetitionPenalty,
    genTopK,
    setGenTopK,
    genMinP,
    setGenMinP,
    promptSamplers,
    setPromptSamplerCustom,
    setPromptSamplerValue,
    systemPrompt,
    setSystemPrompt,
    choicesPrompt,
    setChoicesPrompt,
    statUpdatesPrompt,
    setStatUpdatesPrompt,
    locationChangePromptText,
    setLocationChangePromptText,
    choicesEnabled,
    setChoicesEnabled,
    statUpdatesEnabled,
    setStatUpdatesEnabled,
    locationChangeEnabled,
    setLocationChangeEnabled,
    locationAutoApply,
    setLocationAutoApply,
    limitActiveCharacters,
    setLimitActiveCharacters,
    activeCharacterLimit,
    setActiveCharacterLimit,
    narrationVerbatimTurns,
    setNarrationVerbatimTurns,
    thinkingVerbatimTurns,
    setThinkingVerbatimTurns,
    choicesVerbatimTurns,
    setChoicesVerbatimTurns,
    statUpdatesVerbatimTurns,
    setStatUpdatesVerbatimTurns,
    locationChangeVerbatimTurns,
    setLocationChangeVerbatimTurns,
    summaryVerbatimTurns,
    setSummaryVerbatimTurns,
    thinkingMode,
    setThinkingMode,
    reasoningEffort,
    setReasoningEffort,
    supportedReasoningEfforts,
    reasoningEngaged,
    promptReasoning,
    setPromptReasoning,
    promptReasoningBudget,
    setPromptReasoningBudget,
    thinkingPrompt,
    setThinkingPrompt,
    summaryPrompt,
    setSummaryPrompt,
    diaryPrompt,
    setDiaryPrompt,
    directorPrompt,
    setDirectorPrompt,
    directorUserPrompt,
    setDirectorUserPrompt,
    characterPrompt,
    setCharacterPrompt,
    storyboardPrompt,
    setStoryboardPrompt,
    choicesUserPrompt,
    setChoicesUserPrompt,
    statUpdatesUserPrompt,
    setStatUpdatesUserPrompt,
    locationChangeUserPrompt,
    setLocationChangeUserPrompt,
    summaryUserPrompt,
    setSummaryUserPrompt,
    promptPresets,
    builtinPresets,
    activePresetId,
    activePresetIsBuiltIn,
    activeSectionStyle,
    selectPreset,
    addPreset,
    renamePreset,
    deletePreset,
    resetPreset,
    exportActivePreset,
    importPreset,
    imageProvider,
    setImageProvider,
    imageEndpoint,
    setImageEndpoint,
    imageApiToken,
    setImageApiToken,
    imageModel,
    setImageModel,
    imagePositivePrompt,
    setImagePositivePrompt,
    imageNegativePrompt,
    setImageNegativePrompt,
    imagePortraitWidth,
    setImagePortraitWidth,
    imagePortraitHeight,
    setImagePortraitHeight,
    imageLandscapeWidth,
    setImageLandscapeWidth,
    imageLandscapeHeight,
    setImageLandscapeHeight,
    imageSteps,
    setImageSteps,
    imageCfg,
    setImageCfg,
    imageSampler,
    setImageSampler,
    imageAdetailer,
    setImageAdetailer,
    imageWorkflow,
    setImageWorkflow,
    imageInvokeEncoder,
    setImageInvokeEncoder,
    imageInvokeVae,
    setImageInvokeVae,
    imageEndpointPresets,
    activeImageEndpointPresetId,
    activeImageEndpointPresetName,
    selectImageEndpointPreset,
    addImageEndpointPreset,
    renameImageEndpointPreset,
    deleteImageEndpointPreset,
    resetImageEndpointPreset,
    imageTagPrompt,
    setImageTagPrompt,
    vramHelperUrl,
    setVramHelperUrl,
    ttsVolume,
    setTtsVolume,
    ttsSpeed,
    setTtsSpeed,
    ttsHighlight,
    setTtsHighlight
  };

  return value;
}

type SettingsContextValue = ReturnType<typeof useProvideSettings>;

const SettingsContext = createContext<SettingsContextValue | null>(null);

/** Access all user settings (persisted to localStorage) — endpoint/model/token config, prompt presets,
 *  image-gen presets, TTS, memory/diary toggles, thinking mode — plus their setters and derived active
 *  values. Throws if called outside a `SettingsProvider`. */
// eslint-disable-next-line react-refresh/only-export-components
export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};

/** Provides all persisted user settings (see `useSettings`); runs one-time localStorage migrations and
 *  seeds the prompt/image preset stores on first render. */
export const SettingsProvider = ({ children }: { children: ReactNode }) => {
  const value = useProvideSettings();

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
};
