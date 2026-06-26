import { createContext, useContext, useState, useEffect, useRef, useCallback, type ReactNode } from 'react';
import { defaultSystemPrompt, defaultChoicesPrompt, defaultStatUpdatesPrompt, defaultLocationChangePrompt, defaultThinkingPrompt } from '../components/game/GamePrompts';
import { DEFAULT_ENDPOINT, DEFAULT_API_TOKEN, DEFAULT_MODEL_NAME, DEFAULT_MAX_TOKENS, DEFAULT_CONTEXT_WINDOW } from './settingsDefaults';
import { fetchContextLength } from '../lib/contextLength';
import type { ParagraphLimit } from '../lib/outputLength';

export type DetectStatus = 'idle' | 'detecting' | 'success' | 'error';

export type ThinkingMode = 'off' | 'precall' | 'inline';
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
    parse: (r) => (r === 'precall' || r === 'inline' ? r : 'off'),
    serialize: (v) => v,
  });
  const [thinkingPrompt, setThinkingPrompt] = usePersistentState<string>(`${APP_ID}_thinkingPrompt`, defaultThinkingPrompt, stringCodec);
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
    thinkingMode,
    setThinkingMode,
    thinkingPrompt,
    setThinkingPrompt,
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
