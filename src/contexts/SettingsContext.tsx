import { createContext, useContext, useState, useEffect, useRef, type ReactNode } from 'react';
import { defaultSystemPrompt, defaultChoicesPrompt, defaultStatUpdatesPrompt, defaultLocationChangePrompt, defaultThinkingPrompt } from '../components/game/GamePrompts';
import type { ParagraphLimit } from '../lib/outputLength';

export type ThinkingMode = 'off' | 'precall' | 'inline';
export type { ParagraphLimit };

const APP_ID = 'FORMAMORPH';
export const DEFAULT_ENDPOINT = 'https://mistral.lyonade.net/v1/chat/completions';

// Converts a setting to/from its stored string form. Reusable codecs cover the common shapes.
interface Codec<T> {
  parse: (raw: string) => T;
  serialize: (value: T) => string;
}
const stringCodec: Codec<string> = { parse: (r) => r, serialize: (v) => v };
const boolCodec: Codec<boolean> = { parse: (r) => JSON.parse(r), serialize: (v) => JSON.stringify(v) };
const intCodec: Codec<number> = { parse: (r) => parseInt(r), serialize: (v) => String(v) };
const floatCodec: Codec<number> = { parse: (r) => parseFloat(r), serialize: (v) => String(v) };

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
  const [endpointUrl, setEndpointUrl] = usePersistentState<string>(`${APP_ID}_endpointUrl`, import.meta.env.VITE_DEFAULT_ENDPOINT || DEFAULT_ENDPOINT, stringCodec);
  const [apiToken, setApiToken] = usePersistentState<string>(`${APP_ID}_apiToken`, import.meta.env.VITE_DEFAULT_API_TOKEN || '', stringCodec);
  const [modelName, setModelName] = usePersistentState<string>(`${APP_ID}_modelName`, import.meta.env.VITE_DEFAULT_MODEL_NAME || 'shuyuej/Mistral-Nemo-Instruct-2407-GPTQ', stringCodec);
  const [maxTokens, setMaxTokens] = usePersistentState<number>(`${APP_ID}_maxTokens`, parseInt(import.meta.env.VITE_DEFAULT_MAX_TOKENS) || 1024, intCodec);
  const [aiMessageLimit, setAiMessageLimit] = usePersistentState<number>(`${APP_ID}_aiMessageLimit`, parseInt(import.meta.env.VITE_DEFAULT_AI_MESSAGE_LIMIT) || 3900, intCodec);
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
    endpointUrl,
    setEndpointUrl,
    apiToken,
    setApiToken,
    modelName,
    setModelName,
    maxTokens,
    setMaxTokens,
    aiMessageLimit,
    setAiMessageLimit,
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
