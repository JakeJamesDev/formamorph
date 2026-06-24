import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { defaultSystemPrompt, defaultChoicesPrompt, defaultStatUpdatesPrompt, defaultLocationChangePrompt } from '../components/game/GamePrompts';

const APP_ID = 'FORMAMORPH';
export const DEFAULT_ENDPOINT = 'https://mistral.lyonade.net/v1/chat/completions';

function useProvideSettings() {
  const [bgmEnabled, setBgmEnabled] = useState<boolean>(() => {
    const savedBgm = localStorage.getItem('bgmEnabled');
    return savedBgm ? JSON.parse(savedBgm) : true;
  });

  const [language, setLanguage] = useState<string>(() => {
    const savedLanguage = localStorage.getItem('language');
    return savedLanguage || 'English';
  });

  const [shortform, setShortform] = useState<boolean>(() => {
    const saved = localStorage.getItem(`${APP_ID}_shortform`);
    return saved ? JSON.parse(saved) : true;
  });

  const [autoscroll, setAutoscroll] = useState<boolean>(() => {
    const saved = localStorage.getItem(`${APP_ID}_autoscroll`);
    return saved ? JSON.parse(saved) : false;
  });

  const [endpointUrl, setEndpointUrl] = useState<string>(() => {
    const saved = localStorage.getItem(`${APP_ID}_endpointUrl`);
    return saved ? saved : (import.meta.env.VITE_DEFAULT_ENDPOINT || DEFAULT_ENDPOINT);
  });

  const [apiToken, setApiToken] = useState<string>(() => {
    const saved = localStorage.getItem(`${APP_ID}_apiToken`);
    return saved ? saved : (import.meta.env.VITE_DEFAULT_API_TOKEN || '');
  });

  const [modelName, setModelName] = useState<string>(() => {
    const saved = localStorage.getItem(`${APP_ID}_modelName`);
    return saved ? saved : (import.meta.env.VITE_DEFAULT_MODEL_NAME || 'shuyuej/Mistral-Nemo-Instruct-2407-GPTQ');
  });

  const [maxTokens, setMaxTokens] = useState<number>(() => {
    const saved = localStorage.getItem(`${APP_ID}_maxTokens`);
    return saved ? parseInt(saved) : (parseInt(import.meta.env.VITE_DEFAULT_MAX_TOKENS) || 1024);
  });

  const [aiMessageLimit, setAiMessageLimit] = useState<number>(() => {
    const saved = localStorage.getItem(`${APP_ID}_aiMessageLimit`);
    return saved ? parseInt(saved) : (parseInt(import.meta.env.VITE_DEFAULT_AI_MESSAGE_LIMIT) || 3900);
  });

  const [systemPrompt, setSystemPrompt] = useState<string>(() => {
    const saved = localStorage.getItem(`${APP_ID}_narrationPrompt2`);
    return saved ? saved : defaultSystemPrompt;
  });

  const [choicesPrompt, setChoicesPrompt] = useState<string>(() => {
    const saved = localStorage.getItem(`${APP_ID}_choicesPrompt2`);
    return saved ? saved : defaultChoicesPrompt;
  });

  const [statUpdatesPrompt, setStatUpdatesPrompt] = useState<string>(() => {
    const saved = localStorage.getItem(`${APP_ID}_statUpdatesPrompt2`);
    return saved ? saved : defaultStatUpdatesPrompt;
  });

  const [locationChangePromptText, setLocationChangePromptText] = useState<string>(() => {
    const saved = localStorage.getItem(`${APP_ID}_locationChangePrompt`);
    return saved ? saved : defaultLocationChangePrompt;
  });

  const [vramHelperUrl, setVramHelperUrl] = useState<string>(() => {
    const saved = localStorage.getItem(`${APP_ID}_vramHelperUrl`);
    return saved ? saved : 'http://localhost:5179';
  });

  const [ttsVolume, setTtsVolume] = useState<number>(() => {
    const saved = localStorage.getItem(`${APP_ID}_ttsVolume`);
    return saved !== null ? parseFloat(saved) : 1;
  });

  // Save settings to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('bgmEnabled', JSON.stringify(bgmEnabled));
  }, [bgmEnabled]);

  useEffect(() => {
    localStorage.setItem('language', language);
  }, [language]);

  useEffect(() => {
    localStorage.setItem(`${APP_ID}_shortform`, JSON.stringify(shortform));
  }, [shortform]);

  useEffect(() => {
    localStorage.setItem(`${APP_ID}_autoscroll`, JSON.stringify(autoscroll));
  }, [autoscroll]);

  useEffect(() => {
    localStorage.setItem(`${APP_ID}_endpointUrl`, endpointUrl);
  }, [endpointUrl]);

  useEffect(() => {
    localStorage.setItem(`${APP_ID}_apiToken`, apiToken);
  }, [apiToken]);

  useEffect(() => {
    localStorage.setItem(`${APP_ID}_modelName`, modelName);
  }, [modelName]);

  useEffect(() => {
    localStorage.setItem(`${APP_ID}_maxTokens`, maxTokens.toString());
  }, [maxTokens]);

  useEffect(() => {
    localStorage.setItem(`${APP_ID}_aiMessageLimit`, aiMessageLimit.toString());
  }, [aiMessageLimit]);

  useEffect(() => {
    localStorage.setItem(`${APP_ID}_narrationPrompt2`, systemPrompt);
  }, [systemPrompt]);

  useEffect(() => {
    localStorage.setItem(`${APP_ID}_choicesPrompt2`, choicesPrompt);
  }, [choicesPrompt]);

  useEffect(() => {
    localStorage.setItem(`${APP_ID}_statUpdatesPrompt2`, statUpdatesPrompt);
  }, [statUpdatesPrompt]);

  useEffect(() => {
    localStorage.setItem(`${APP_ID}_locationChangePrompt`, locationChangePromptText);
  }, [locationChangePromptText]);

  useEffect(() => {
    localStorage.setItem(`${APP_ID}_vramHelperUrl`, vramHelperUrl);
  }, [vramHelperUrl]);

  useEffect(() => {
    localStorage.setItem(`${APP_ID}_ttsVolume`, ttsVolume.toString());
  }, [ttsVolume]);

  const value = {
    bgmEnabled,
    setBgmEnabled,
    language,
    setLanguage,
    shortform,
    setShortform,
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
