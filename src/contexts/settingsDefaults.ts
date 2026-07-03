// Built-in endpoint defaults, used when "Use Custom Endpoint" is off. Each honors its VITE_DEFAULT_* override.
// Kept out of SettingsContext so that file only exports components/hooks (react-refresh).
export const DEFAULT_ENDPOINT = import.meta.env.VITE_DEFAULT_ENDPOINT || 'https://api.lyonade.net/v1/chat/completions';
export const DEFAULT_API_TOKEN = import.meta.env.VITE_DEFAULT_API_TOKEN || '';
export const DEFAULT_MODEL_NAME = import.meta.env.VITE_DEFAULT_MODEL_NAME || 'default';
export const DEFAULT_MAX_TOKENS = parseInt(import.meta.env.VITE_DEFAULT_MAX_TOKENS) || 1024;
// 10750 matches the default endpoint's reported max_model_len (api.lyonade.net), so the locked
// value while "Use Custom Endpoint" is off reflects that endpoint's real limit.
export const DEFAULT_CONTEXT_WINDOW = parseInt(import.meta.env.VITE_DEFAULT_CONTEXT_WINDOW) || 10750;

// Image generation defaults. There's no shared hosted image server, so these describe a local
// A1111/Forge instance the user runs. Neutral fallbacks keep the built exe generic.
export const DEFAULT_IMAGE_PROVIDER = import.meta.env.VITE_DEFAULT_IMAGE_PROVIDER || 'a1111';
export const DEFAULT_IMAGE_ENDPOINT = import.meta.env.VITE_DEFAULT_IMAGE_ENDPOINT || 'http://127.0.0.1:7860';
export const DEFAULT_IMAGE_API_TOKEN = import.meta.env.VITE_DEFAULT_IMAGE_API_TOKEN || '';
export const DEFAULT_IMAGE_MODEL = import.meta.env.VITE_DEFAULT_IMAGE_MODEL || '';
// Prepended to every generated prompt (e.g. quality tags). Neutral by default since good tags are
// model-family specific (SDXL vs Pony vs Flux want different things) — the user fills this in.
export const DEFAULT_IMAGE_POSITIVE = import.meta.env.VITE_DEFAULT_IMAGE_POSITIVE || '';
export const DEFAULT_IMAGE_NEGATIVE = import.meta.env.VITE_DEFAULT_IMAGE_NEGATIVE || 'lowres, bad anatomy, worst quality, low quality, watermark, text';
export const DEFAULT_IMAGE_WIDTH = parseInt(import.meta.env.VITE_DEFAULT_IMAGE_WIDTH) || 1024;
export const DEFAULT_IMAGE_HEIGHT = parseInt(import.meta.env.VITE_DEFAULT_IMAGE_HEIGHT) || 1024;
export const DEFAULT_IMAGE_STEPS = parseInt(import.meta.env.VITE_DEFAULT_IMAGE_STEPS) || 25;
export const DEFAULT_IMAGE_CFG = parseFloat(import.meta.env.VITE_DEFAULT_IMAGE_CFG) || 7;
export const DEFAULT_IMAGE_SAMPLER = import.meta.env.VITE_DEFAULT_IMAGE_SAMPLER || 'Euler a';
