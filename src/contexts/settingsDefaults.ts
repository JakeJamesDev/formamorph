// Built-in endpoint defaults, used when "Use Custom Endpoint" is off. Each honors its VITE_DEFAULT_* override.
// Kept out of SettingsContext so that file only exports components/hooks (react-refresh).
export const DEFAULT_ENDPOINT = import.meta.env.VITE_DEFAULT_ENDPOINT || 'https://api.lyonade.net/v1/chat/completions';
export const DEFAULT_API_TOKEN = import.meta.env.VITE_DEFAULT_API_TOKEN || '';
export const DEFAULT_MODEL_NAME = import.meta.env.VITE_DEFAULT_MODEL_NAME || 'default';
export const DEFAULT_MAX_TOKENS = parseInt(import.meta.env.VITE_DEFAULT_MAX_TOKENS) || 1024;
export const DEFAULT_AI_MESSAGE_LIMIT = parseInt(import.meta.env.VITE_DEFAULT_AI_MESSAGE_LIMIT) || 10512;
