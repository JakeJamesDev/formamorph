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
// Blank by default: a blank endpoint falls back to the selected provider's default at call time
// (see resolveImageEndpoint / DEFAULT_ENDPOINT_BY_PROVIDER in lib/imageGen).
export const DEFAULT_IMAGE_ENDPOINT = import.meta.env.VITE_DEFAULT_IMAGE_ENDPOINT || '';
export const DEFAULT_IMAGE_API_TOKEN = import.meta.env.VITE_DEFAULT_IMAGE_API_TOKEN || '';
export const DEFAULT_IMAGE_MODEL = import.meta.env.VITE_DEFAULT_IMAGE_MODEL || '';
// Prepended to every generated prompt (e.g. quality tags). Neutral by default since good tags are
// model-family specific (SDXL vs Pony vs Flux want different things) — the user fills this in.
export const DEFAULT_IMAGE_POSITIVE = import.meta.env.VITE_DEFAULT_IMAGE_POSITIVE || '';
export const DEFAULT_IMAGE_NEGATIVE = import.meta.env.VITE_DEFAULT_IMAGE_NEGATIVE || 'lowres, bad anatomy, worst quality, low quality, watermark, text';
// Portrait dims are used for character/entity images; landscape for location backgrounds and the world
// thumbnail. Defaults are the standard SDXL portrait/landscape buckets.
export const DEFAULT_IMAGE_PORTRAIT_WIDTH = parseInt(import.meta.env.VITE_DEFAULT_IMAGE_PORTRAIT_WIDTH) || 832;
export const DEFAULT_IMAGE_PORTRAIT_HEIGHT = parseInt(import.meta.env.VITE_DEFAULT_IMAGE_PORTRAIT_HEIGHT) || 1216;
export const DEFAULT_IMAGE_LANDSCAPE_WIDTH = parseInt(import.meta.env.VITE_DEFAULT_IMAGE_LANDSCAPE_WIDTH) || 1216;
export const DEFAULT_IMAGE_LANDSCAPE_HEIGHT = parseInt(import.meta.env.VITE_DEFAULT_IMAGE_LANDSCAPE_HEIGHT) || 832;
export const DEFAULT_IMAGE_STEPS = parseInt(import.meta.env.VITE_DEFAULT_IMAGE_STEPS) || 25;
export const DEFAULT_IMAGE_CFG = parseFloat(import.meta.env.VITE_DEFAULT_IMAGE_CFG) || 7;
export const DEFAULT_IMAGE_SAMPLER = import.meta.env.VITE_DEFAULT_IMAGE_SAMPLER || 'Euler a';
// A1111-only: run the ADetailer face/hand-fix pass (requires the extension installed on the server).
export const DEFAULT_IMAGE_ADETAILER = import.meta.env.VITE_DEFAULT_IMAGE_ADETAILER === 'true';

// Preset color themes. Each (except the base) is a full set of token overrides in index.css keyed by a
// `data-theme` attribute on <html>. Adding a theme = a new value here + a matching
// `.light[data-theme="…"]` / `.dark[data-theme="…"]` block in index.css.
export type ThemeColor = 'blue' | 'purple' | 'graphite' | 'rose' | 'bubblegum' | 'forest' | 'monochrome' | 'highcontrast';
// The theme whose tokens live directly in :root/.dark; it applies with NO data-theme attribute.
export const BASE_THEME_COLOR: ThemeColor = 'blue';
// What a fresh install starts on (independent of the base above).
export const DEFAULT_THEME_COLOR: ThemeColor = 'graphite';
export const THEME_COLORS: { value: ThemeColor; label: string }[] = [
  { value: 'graphite', label: 'Graphite (default)' },
  { value: 'purple', label: 'Purple' },
  { value: 'blue', label: 'Blue' },
  { value: 'rose', label: 'Rose' },
  { value: 'bubblegum', label: 'Bubble Gum' },
  { value: 'forest', label: 'Forest' },
  { value: 'monochrome', label: 'Monochrome' },
  { value: 'highcontrast', label: 'High Contrast' },
];
