// Built-in endpoint defaults, used when "Use Custom Endpoint" is off. Each honors its VITE_DEFAULT_* override.
// Kept out of SettingsContext so that file only exports components/hooks (react-refresh).
import { isDesktop, DEFAULT_LOCAL_LLM_ENDPOINT } from '@/lib/imageGen/desktop';
// Desktop always defaults to the bundled local engine — VITE_DEFAULT_ENDPOINT is a web/cloud default and
// is deliberately ignored there (so a .env.local set for web testing doesn't leak into desktop builds).
// The web build uses the override when set, else the hosted endpoint.
export const DEFAULT_ENDPOINT = isDesktop()
  ? DEFAULT_LOCAL_LLM_ENDPOINT
  : (import.meta.env.VITE_DEFAULT_ENDPOINT || 'https://api.lyonade.net/v1/chat/completions');
export const DEFAULT_API_TOKEN = import.meta.env.VITE_DEFAULT_API_TOKEN || '';
export const DEFAULT_MODEL_NAME = import.meta.env.VITE_DEFAULT_MODEL_NAME || 'default';
export const DEFAULT_MAX_TOKENS = parseInt(import.meta.env.VITE_DEFAULT_MAX_TOKENS) || 1024;
// 10750 matches the default endpoint's reported max_model_len (api.lyonade.net), so the locked
// value while "Use Custom Endpoint" is off reflects that endpoint's real limit.
export const DEFAULT_CONTEXT_WINDOW = parseInt(import.meta.env.VITE_DEFAULT_CONTEXT_WINDOW) || 10750;

// Desktop bundled-model runtime (used only when the local engine is active). Context size doubles as the
// engine's KV-cache budget (VRAM) and the app's prompt window. GPU layers: null = auto-offload all that
// fit, 0 = CPU-only, N = that many layers. Flash attention trades a little compatibility for less KV-cache
// VRAM + speed. Defaults match engineOptions in electron/main.cjs so no needless reload on boot.
export const DEFAULT_LOCAL_CONTEXT_SIZE = 8192;
// GPU layers as a plain count: 0 = CPU-only, up to LOCAL_GPU_LAYERS_MAX = offload everything (llama.cpp
// clamps to the model's real layer count). Default = full offload.
export const LOCAL_GPU_LAYERS_MAX = 64;
export const DEFAULT_LOCAL_GPU_LAYERS = LOCAL_GPU_LAYERS_MAX;
export const DEFAULT_LOCAL_FLASH_ATTENTION = false;

// Generation sampling for the local model (sent while the local engine is active). Concrete defaults so
// the sliders always show a sensible value rather than a confusing blank.
export const DEFAULT_GEN_TEMPERATURE = 0.7;
export const DEFAULT_GEN_TOP_P = 0.9;
export const DEFAULT_GEN_REPETITION_PENALTY = 1.1;

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

// Fonts (Settings). One shared registry feeds two selectors: the global app Font (Presentation) and the
// Narration Font (Accessibility). All are self-hosted webfonts (see src/fonts.ts); `stack` is the CSS
// family, applied via a CSS variable with the OS stack appended as a glyph fallback (e.g. non-Latin text).
export type FontValue =
  | 'inter' | 'roboto' | 'opensans' | 'lato' | 'montserrat' | 'sourcesans' | 'poppins' | 'jetbrainsmono' // general
  | 'opendyslexic' | 'atkinson' | 'lexend' | 'andika'; // accessibility
// `fsa` overrides the app-wide font-size-adjust target for a font whose apparent size differs at the
// shared x-height (e.g. monospace reads oversized, so it gets a lower target). Omitted = the default.
export const FONT_LIST: { value: FontValue; label: string; stack: string; a11y?: boolean; fsa?: number }[] = [
  { value: 'inter', label: 'Inter', stack: "'Inter Variable', 'Inter'" },
  { value: 'roboto', label: 'Roboto', stack: "'Roboto'" },
  { value: 'opensans', label: 'Open Sans', stack: "'Open Sans Variable', 'Open Sans'" },
  { value: 'lato', label: 'Lato', stack: "'Lato'" },
  { value: 'montserrat', label: 'Montserrat', stack: "'Montserrat Variable', 'Montserrat'" },
  { value: 'sourcesans', label: 'Source Sans 3', stack: "'Source Sans 3 Variable', 'Source Sans 3'" },
  { value: 'poppins', label: 'Poppins', stack: "'Poppins'" },
  { value: 'jetbrainsmono', label: 'JetBrains Mono', stack: "'JetBrains Mono Variable', 'JetBrains Mono', monospace", fsa: 0.48 },
  { value: 'opendyslexic', label: 'OpenDyslexic (dyslexia)', stack: "'OpenDyslexic'", a11y: true },
  { value: 'atkinson', label: 'Atkinson Hyperlegible (low vision)', stack: "'Atkinson Hyperlegible'", a11y: true },
  { value: 'lexend', label: 'Lexend (reading)', stack: "'Lexend Variable', 'Lexend'", a11y: true },
  { value: 'andika', label: 'Andika (literacy)', stack: "'Andika'", a11y: true },
];
/** CSS family stack for a font value, or '' if unknown/sentinel. */
export const fontStack = (value: string): string => FONT_LIST.find((f) => f.value === value)?.stack ?? '';

// Normalize apparent size across fonts by pinning x-height to this target (≈ the system UI font).
export const DEFAULT_FONT_SIZE_ADJUST = 0.52;
/** The font-size-adjust target for a font value — its `fsa` override, else the default. */
export const fontSizeAdjust = (value: string): number => FONT_LIST.find((f) => f.value === value)?.fsa ?? DEFAULT_FONT_SIZE_ADJUST;

// The OS sans stack: both the `system` default (in index.css `:root`) and the fallback appended to a webfont.
export const SYSTEM_FONT_STACK = "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

// Global app font: `system` = the OS stack (default, ships no font).
export type FontChoice = 'system' | FontValue;
export const DEFAULT_FONT: FontChoice = 'system';
export const FONT_OPTIONS = [{ value: 'system', label: 'System (default)', stack: '' }, ...FONT_LIST];

// Narration font: `global` = inherit the app font (default). Same registry otherwise.
export type NarrationFont = 'global' | FontValue;
export const DEFAULT_NARRATION_FONT: NarrationFont = 'global';
export const NARRATION_FONT_OPTIONS = [{ value: 'global', label: 'Use Global', stack: '' }, ...FONT_LIST];

// Narration reading controls (Accessibility). Scale multiplies the inherited story text size (1 = no
// change); line-height 1.5 matches the base. Both apply only to the story reading pane.
export const DEFAULT_NARRATION_SCALE = 1;
export const DEFAULT_NARRATION_LINE_HEIGHT = 1.5;
