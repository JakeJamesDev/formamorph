// Built-in endpoint defaults, used when "Use Custom Endpoint" is off. Each honors its VITE_DEFAULT_* override.
// Kept out of SettingsContext so that file only exports components/hooks (react-refresh).
export const DEFAULT_ENDPOINT = import.meta.env.VITE_DEFAULT_ENDPOINT || 'https://api.lyonade.net/v1/chat/completions';
export const DEFAULT_API_TOKEN = import.meta.env.VITE_DEFAULT_API_TOKEN || '';
export const DEFAULT_MODEL_NAME = import.meta.env.VITE_DEFAULT_MODEL_NAME || 'default';
export const DEFAULT_MAX_TOKENS = parseInt(import.meta.env.VITE_DEFAULT_MAX_TOKENS) || 1024;
// 10750 matches the default endpoint's reported max_model_len (api.lyonade.net), so the locked
// value while "Use Custom Endpoint" is off reflects that endpoint's real limit.
export const DEFAULT_CONTEXT_WINDOW = parseInt(import.meta.env.VITE_DEFAULT_CONTEXT_WINDOW) || 10750;
