import { createContext, useContext, useState, useEffect, useRef, useCallback, type ReactNode } from 'react';
import { defaultSystemPrompt, defaultChoicesPrompt, defaultStatUpdatesPrompt, defaultLocationChangePrompt, defaultThinkingPrompt, defaultSummaryPrompt, defaultChoicesUserPrompt, defaultStatUpdatesUserPrompt, defaultLocationChangeUserPrompt, defaultSummaryUserPrompt } from '../components/game/GamePrompts';
import { DEFAULT_ENDPOINT, DEFAULT_API_TOKEN, DEFAULT_MODEL_NAME, DEFAULT_MAX_TOKENS, DEFAULT_CONTEXT_WINDOW } from './settingsDefaults';
import { fetchContextLength } from '../lib/contextLength';
import type { ParagraphLimit } from '../lib/outputLength';

export type DetectStatus = 'idle' | 'detecting' | 'success' | 'error';

export type ThinkingMode = 'off' | 'precall' | 'inline' | 'staged';
export type { ParagraphLimit };

const APP_ID = 'FORMAMORPH';

// Converts a setting to/from its stored string form. Reusable codecs cover the common shapes.
interface Codec<T> {
  parse: (raw: string) => T;
  serialize: (value: T) => string;
}
const stringCodec: Codec<string> = { parse: (r) => r, serialize: (v) => v };
const boolCodec: Codec<boolean> = { parse: (r) => JSON.parse(r), serialize: (v) => JSON.stringify(v) };
const intCodec: Codec<number> = { parse: (r) => parseInt(r), serialize: (v) => String(v) };
const floatCodec: Codec<number> = { parse: (r) => parseFloat(r), serialize: (v) => String(v) };
const nullableIntCodec: Codec<number | null> = {
  parse: (r) => (r === '' ? null : parseInt(r)),
  serialize: (v) => (v == null ? '' : String(v)),
};

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

/** useState mirrored to a localStorage `key`: seeds from the stored value (or `defaultValue` when
 *  absent) and writes back on every change. `codec` maps the value to/from its stored string. */
function usePersistentState<T>(key: string, defaultValue: T, codec: Codec<T>) {
  const [value, setValue] = useState<T>(() => {
    const raw = localStorage.getItem(key);
    return raw === null ? defaultValue : codec.parse(raw);
  });
  const codecRef = useRef(codec); // avoid re-running the write effect on inline-codec identity changes
  codecRef.current = codec;
  useEffect(() => {
    localStorage.setItem(key, codecRef.current.serialize(value));
  }, [key, value]);
  return [value, setValue] as const;
}

function useProvideSettings() {
  const migrated = useRef(false);
  if (!migrated.current) {
    migrateDisabledPrompts(); // runs before the prompt/flag state below seeds from localStorage
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

  const [autoscroll, setAutoscroll] = usePersistentState<boolean>(`${APP_ID}_autoscroll`, false, boolCodec);
  // Narrator (and planning/choices) sees stat descriptors instead of raw numbers, for immersion.
  const [hideStatNumbers, setHideStatNumbers] = usePersistentState<boolean>(`${APP_ID}_hideStatNumbers`, true, boolCodec);
  // Let the AI format narration with Markdown (seeds the <MARKDOWN GUIDANCE> token in the game-text prompt).
  const [markdownOutput, setMarkdownOutput] = usePersistentState<boolean>(`${APP_ID}_markdownOutput`, false, boolCodec);
  // Synthesize narration audio sentence-by-sentence as the story streams (vs. after the full text).
  // Default off: streaming TTS competes with the LLM for the GPU when both run on one machine.
  const [streamNarrationAudio, setStreamNarrationAudio] = usePersistentState<boolean>(`${APP_ID}_streamNarrationAudio`, false, boolCodec);
  // The single summaries toggle: generate a lazy per-turn memory digest as turns age out of the
  // verbatim window AND feed those digests into context (recent-verbatim floor + a "story so far" band
  // + lexical rehydration). Default off: extra async request + it changes what's sent to the model.
  const [memoryDigests, setMemoryDigests] = usePersistentState<boolean>(`${APP_ID}_memoryDigests`, false, boolCodec);
  // Reveal "silent" requests (e.g. the memory digest) in the status bar and AI-context viewer.
  // Default off: silent requests do their work without cluttering the UI; this is an inspection toggle.
  const [showSilentRequests, setShowSilentRequests] = usePersistentState<boolean>(`${APP_ID}_showSilentRequests`, false, boolCodec);
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
  const activeMaxTokens = useCustomEndpoint ? maxTokens : DEFAULT_MAX_TOKENS;

  // Context window (tokens): auto-detected from the active endpoint, with an optional manual override.
  const [detectedContextWindow, setDetectedContextWindow] = usePersistentState<number | null>(`${APP_ID}_detectedContextWindow`, null, nullableIntCodec);
  const [contextWindowOverride, setContextWindowOverride] = usePersistentState<number | null>(`${APP_ID}_contextWindowOverride`, null, nullableIntCodec);
  const [detectStatus, setDetectStatus] = useState<DetectStatus>('idle');
  // Like the other endpoint fields, the context window is the built-in default while the custom
  // endpoint is off; the user's override / auto-detection only apply when custom is on.
  const contextWindow = useCustomEndpoint
    ? (contextWindowOverride ?? detectedContextWindow ?? DEFAULT_CONTEXT_WINDOW)
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

  const [systemPrompt, setSystemPrompt] = usePersistentState<string>(`${APP_ID}_narrationPrompt2`, defaultSystemPrompt, stringCodec);
  const [choicesPrompt, setChoicesPrompt] = usePersistentState<string>(`${APP_ID}_choicesPrompt2`, defaultChoicesPrompt, stringCodec);
  const [statUpdatesPrompt, setStatUpdatesPrompt] = usePersistentState<string>(`${APP_ID}_statUpdatesPrompt2`, defaultStatUpdatesPrompt, stringCodec);
  const [locationChangePromptText, setLocationChangePromptText] = usePersistentState<string>(`${APP_ID}_locationChangePrompt`, defaultLocationChangePrompt, stringCodec);
  const [thinkingMode, setThinkingMode] = usePersistentState<ThinkingMode>(`${APP_ID}_thinkingMode`, 'off', {
    parse: (r) => (r === 'precall' || r === 'inline' || r === 'staged' ? r : 'off'),
    serialize: (v) => v,
  });
  const [thinkingPrompt, setThinkingPrompt] = usePersistentState<string>(`${APP_ID}_thinkingPrompt`, defaultThinkingPrompt, stringCodec);
  const [summaryPrompt, setSummaryPrompt] = usePersistentState<string>(`${APP_ID}_summaryPrompt`, defaultSummaryPrompt, stringCodec);
  // Editable user-message templates for the aux requests (framing + task cue), rendered with the
  // <PLAYER ACTION>/<GAME TEXT> runtime tokens. Previously these were hardcoded in GameViewer.
  const [choicesUserPrompt, setChoicesUserPrompt] = usePersistentState<string>(`${APP_ID}_choicesUserPrompt`, defaultChoicesUserPrompt, stringCodec);
  const [statUpdatesUserPrompt, setStatUpdatesUserPrompt] = usePersistentState<string>(`${APP_ID}_statUpdatesUserPrompt`, defaultStatUpdatesUserPrompt, stringCodec);
  const [locationChangeUserPrompt, setLocationChangeUserPrompt] = usePersistentState<string>(`${APP_ID}_locationChangeUserPrompt`, defaultLocationChangeUserPrompt, stringCodec);
  const [summaryUserPrompt, setSummaryUserPrompt] = usePersistentState<string>(`${APP_ID}_summaryUserPrompt`, defaultSummaryUserPrompt, stringCodec);
  // Whether each optional per-turn request is sent (replaces the legacy "type DISABLED" body hack).
  const [choicesEnabled, setChoicesEnabled] = usePersistentState<boolean>(`${APP_ID}_choicesEnabled`, true, boolCodec);
  const [statUpdatesEnabled, setStatUpdatesEnabled] = usePersistentState<boolean>(`${APP_ID}_statUpdatesEnabled`, true, boolCodec);
  const [locationChangeEnabled, setLocationChangeEnabled] = usePersistentState<boolean>(`${APP_ID}_locationChangeEnabled`, true, boolCodec);
  // How many recent turns each prompt receives verbatim (the digest-banding floor). Only Game Text and
  // Thinking consume history today; the rest are stored for when those prompts gain history.
  const [gametextVerbatimTurns, setGametextVerbatimTurns] = usePersistentState<number>(`${APP_ID}_gametextVerbatimTurns`, 3, intCodec);
  const [thinkingVerbatimTurns, setThinkingVerbatimTurns] = usePersistentState<number>(`${APP_ID}_thinkingVerbatimTurns`, 1, intCodec);
  const [choicesVerbatimTurns, setChoicesVerbatimTurns] = usePersistentState<number>(`${APP_ID}_choicesVerbatimTurns`, 3, intCodec);
  const [statUpdatesVerbatimTurns, setStatUpdatesVerbatimTurns] = usePersistentState<number>(`${APP_ID}_statUpdatesVerbatimTurns`, 3, intCodec);
  const [locationChangeVerbatimTurns, setLocationChangeVerbatimTurns] = usePersistentState<number>(`${APP_ID}_locationChangeVerbatimTurns`, 3, intCodec);
  const [summaryVerbatimTurns, setSummaryVerbatimTurns] = usePersistentState<number>(`${APP_ID}_summaryVerbatimTurns`, 3, intCodec);
  const [vramHelperUrl, setVramHelperUrl] = usePersistentState<string>(`${APP_ID}_vramHelperUrl`, 'http://localhost:5179', stringCodec);
  const [ttsVolume, setTtsVolume] = usePersistentState<number>(`${APP_ID}_ttsVolume`, 1, floatCodec);

  const value = {
    bgmEnabled,
    setBgmEnabled,
    language,
    setLanguage,
    paragraphLimit,
    setParagraphLimit,
    autoscroll,
    setAutoscroll,
    hideStatNumbers,
    setHideStatNumbers,
    markdownOutput,
    setMarkdownOutput,
    streamNarrationAudio,
    setStreamNarrationAudio,
    memoryDigests,
    setMemoryDigests,
    showSilentRequests,
    setShowSilentRequests,
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
    gametextVerbatimTurns,
    setGametextVerbatimTurns,
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
    thinkingPrompt,
    setThinkingPrompt,
    summaryPrompt,
    setSummaryPrompt,
    choicesUserPrompt,
    setChoicesUserPrompt,
    statUpdatesUserPrompt,
    setStatUpdatesUserPrompt,
    locationChangeUserPrompt,
    setLocationChangeUserPrompt,
    summaryUserPrompt,
    setSummaryUserPrompt,
    vramHelperUrl,
    setVramHelperUrl,
    ttsVolume,
    setTtsVolume
  };

  return value;
}

type SettingsContextValue = ReturnType<typeof useProvideSettings>;

const SettingsContext = createContext<SettingsContextValue | null>(null);

// eslint-disable-next-line react-refresh/only-export-components
export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};

export const SettingsProvider = ({ children }: { children: ReactNode }) => {
  const value = useProvideSettings();

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
};
