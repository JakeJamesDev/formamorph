import React, { createContext, useContext, useState, useEffect } from 'react';
import { defaultSystemPrompt, defaultChoicesPrompt, defaultStatUpdatesPrompt } from '../components/game/GamePrompts.js';

const APP_ID = 'FORMAMORPH';
export const DEFAULT_ENDPOINT = 'https://mistral.lyonade.net/v1/chat/completions';

const SettingsContext = createContext();

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};

export const SettingsProvider = ({ children }) => {
  const [bgmEnabled, setBgmEnabled] = useState(() => {
    const savedBgm = localStorage.getItem('bgmEnabled');
    return savedBgm ? JSON.parse(savedBgm) : true;
  });

  const [language, setLanguage] = useState(() => {
    const savedLanguage = localStorage.getItem('language');
    return savedLanguage || 'English';
  });

  const [shortform, setShortform] = useState(() => {
    const saved = localStorage.getItem(`${APP_ID}_shortform`);
    return saved ? JSON.parse(saved) : true;
  });

  const [autoscroll, setAutoscroll] = useState(() => {
    const saved = localStorage.getItem(`${APP_ID}_autoscroll`);
    return saved ? JSON.parse(saved) : false;
  });

  const [endpointUrl, setEndpointUrl] = useState(() => {
    const saved = localStorage.getItem(`${APP_ID}_endpointUrl`);
    return saved ? saved : (import.meta.env.VITE_DEFAULT_ENDPOINT || DEFAULT_ENDPOINT);
  });

  const [apiToken, setApiToken] = useState(() => {
    const saved = localStorage.getItem(`${APP_ID}_apiToken`);
    return saved ? saved : (import.meta.env.VITE_DEFAULT_API_TOKEN || '');
  });

  const [modelName, setModelName] = useState(() => {
    const saved = localStorage.getItem(`${APP_ID}_modelName`);
    return saved ? saved : (import.meta.env.VITE_DEFAULT_MODEL_NAME || 'shuyuej/Mistral-Nemo-Instruct-2407-GPTQ');
  });

  const [maxTokens, setMaxTokens] = useState(() => {
    const saved = localStorage.getItem(`${APP_ID}_maxTokens`);
    return saved ? parseInt(saved) : (parseInt(import.meta.env.VITE_DEFAULT_MAX_TOKENS) || 1024);
  });

  const [aiMessageLimit, setAiMessageLimit] = useState(() => {
    const saved = localStorage.getItem(`${APP_ID}_aiMessageLimit`);
    return saved ? parseInt(saved) : (parseInt(import.meta.env.VITE_DEFAULT_AI_MESSAGE_LIMIT) || 2000);
  });

  const [systemPrompt, setSystemPrompt] = useState(() => {
    const saved = localStorage.getItem(`${APP_ID}_narrationPrompt2`);
    return saved ? saved : defaultSystemPrompt;
  });

  const [choicesPrompt, setChoicesPrompt] = useState(() => {
    const saved = localStorage.getItem(`${APP_ID}_choicesPrompt2`);
    return saved ? saved : defaultChoicesPrompt;
  });

  const [statUpdatesPrompt, setStatUpdatesPrompt] = useState(() => {
    const saved = localStorage.getItem(`${APP_ID}_statUpdatesPrompt2`);
    return saved ? saved : defaultStatUpdatesPrompt;
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
    setStatUpdatesPrompt
  };

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
};
