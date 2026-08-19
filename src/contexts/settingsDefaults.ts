// Type-only: the font tuning shape lives with its clamping and CSS mapping in lib/fontTuning.
import type { FontTuning, FontTuningMap } from '@/lib/fontTuning';
import type { ConnectionStyle } from '@/lib/canvasEdgePath';
import type { TravelView } from '@/lib/travelPrefs';

// Built-in endpoint defaults, behind the read-only "Default" preset. Each honors its VITE_DEFAULT_* override.
// Kept out of SettingsContext so that file only exports components/hooks (react-refresh).
// The hosted endpoint behind the "Default" preset, on both platforms. Desktop used to point this at the
// bundled engine instead; the engine is now its own preset (BUILTIN_ENGINE_PRESET_ID), so "Default" can mean
// one thing everywhere and a desktop install can route some prompts to the engine and others to the cloud.
// Written as a base URL (normalizeEndpointUrl completes it), matching the shape every server's docs hand out.
export const DEFAULT_ENDPOINT = import.meta.env.VITE_DEFAULT_ENDPOINT || 'https://api.lyonade.net/v1';
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
// GPU layers: two sentinels + a literal count. AUTO offloads as many layers as fit VRAM (never OOMs); MAX
// offloads every layer of any model (multi-GPU auto-splits); 0..LOCAL_GPU_LAYERS_MAX = a fixed partial count.
// Sentinels are kept as numbers so the setting/IPC stay numeric; mirrored in electron/llmEngine.cjs + main.cjs.
export const GPU_LAYERS_AUTO = -1;
export const GPU_LAYERS_MAX = -2;
// Upper bound of the Custom-count slider (llama.cpp clamps to the model's real layer count).
export const LOCAL_GPU_LAYERS_MAX = 64;
// Default = Auto: safe for any downloaded model (fits VRAM instead of erroring or under-offloading).
export const DEFAULT_LOCAL_GPU_LAYERS = GPU_LAYERS_AUTO;
// On by default: mature and widely supported (modern llama.cpp auto-enables it), cuts KV-cache VRAM — which
// matters most now that parallel slots split the cache. Only truly old/unsupported backends need it off.
export const DEFAULT_LOCAL_FLASH_ATTENTION = true;
// How many requests the bundled engine decodes at once (context sequences). They share the KV cache, so each
// slot's window is ~contextSize / N — 2 balances a real turn-batch speedup against the halved per-slot window.
export const LOCAL_PARALLEL_REQUESTS_MAX = 8;
export const DEFAULT_LOCAL_PARALLEL_REQUESTS = 2;
// On by default: the engine picks an installed model and loads it as soon as anything routes to it, and a
// finished download loads itself. Off leaves loading to the Load button, so VRAM is only spent on demand.
export const DEFAULT_LOCAL_AUTO_LOAD = true;

// Generation sampling for the local model (sent while the local engine is active). Concrete defaults so
// the sliders always show a sensible value rather than a confusing blank.
export const DEFAULT_GEN_TEMPERATURE = 0.7;
export const DEFAULT_GEN_TOP_P = 0.9;
export const DEFAULT_GEN_REPETITION_PENALTY = 1.1;
// Match node-llama-cpp's own sampler defaults (topK 40, minP 0 = disabled) so exposing these changes
// nothing until the user moves them. See LlamaContext._resolveSamplerConfig.
export const DEFAULT_GEN_TOP_K = 40;
export const DEFAULT_GEN_MIN_P = 0;

// Image generation defaults. There's no shared hosted image server, so these describe a local
// A1111/Forge instance the user runs. Neutral fallbacks keep the built exe generic.
export const DEFAULT_IMAGE_PROVIDER = import.meta.env.VITE_DEFAULT_IMAGE_PROVIDER || 'comfyui';
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
// Draw a scene image automatically at the end of every turn. Off because the render blocks the next
// action (one GPU). No VITE_DEFAULT_* override — a per-player toggle, not a deployment knob.
export const DEFAULT_SCENE_IMAGE_AUTO = false;

// Offer the hard-coded "[Continue the Story]" pseudo-choice beneath the generated ones. 'always' keeps it
// even with the choices request switched off, where it's the only button the panel has left. On because
// it's an accessibility affordance. No VITE_DEFAULT_* override — a per-player toggle, not a deployment knob.
export type ContinueChoiceMode = 'off' | 'on' | 'always';
export const CONTINUE_CHOICE_MODES: { value: ContinueChoiceMode; label: string }[] = [
  { value: 'off', label: 'Off' },
  { value: 'on', label: 'On' },
  { value: 'always', label: 'Always' },
];
export const DEFAULT_CONTINUE_CHOICE: ContinueChoiceMode = 'on';

// Locations Canvas presentation. Per-user editor preferences: they never enter a world export, so no
// VITE_DEFAULT_* override either — nothing about a deployment should decide how one author's canvas draws.
// Snap and the grid are both on so hand placement lines up without anyone opting in.
export const DEFAULT_CANVAS_SNAP = true;
export const DEFAULT_CANVAS_GRID_VISIBLE = true;
// Straight lines are the plainest reading of the map, so curves and elbows are opted into.
export const DEFAULT_CANVAS_CONNECTION_STYLE: ConnectionStyle = 'straight';

// The Change Location dialog's first-open view. A per-player preference like the canvas ones above — the
// dialog thereafter opens on whichever view was used last.
export const DEFAULT_TRAVEL_VIEW: TravelView = 'list';

// Preset color themes. Each (except the base) is a full set of token overrides in index.css keyed by a
// `data-theme` attribute on <html>. Adding a theme = a new value here + a matching
// `.light[data-theme="…"]` / `.dark[data-theme="…"]` block in index.css.
export type ThemeColor = 'blue' | 'purple' | 'graphite' | 'rose' | 'bubblegum' | 'forest' | 'monochrome' | 'highcontrast';
// The theme whose tokens live directly in :root/.dark; it applies with NO data-theme attribute.
export const BASE_THEME_COLOR: ThemeColor = 'blue';
// What a fresh install starts on (independent of the base above).
export const DEFAULT_THEME_COLOR: ThemeColor = 'graphite';

// Desktop auto-update release channel. 'stable' = only final GitHub releases; 'prerelease' = also betas.
// No VITE_DEFAULT_* override (players get stable out of the box), so no .env.local coupling.
export type UpdateChannel = 'stable' | 'prerelease';
export const DEFAULT_UPDATE_CHANNEL: UpdateChannel = 'stable';
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
// `wmax` is the heaviest weight the shipped face can render — the variable axis maximum, or 700 for a
// static face (see src/fonts.ts) — and caps the Customize dialog's bold-weight slider.
// `tuning` is the font's shipped Customize tuning, the baseline its Reset returns to.
export interface FontEntry {
  value: FontValue;
  label: string;
  stack: string;
  a11y?: boolean;
  fsa?: number;
  wmax?: number;
  tuning?: Partial<FontTuning>;
}
export const FONT_LIST: FontEntry[] = [
  { value: 'inter', label: 'Inter', stack: "'Inter Variable', 'Inter'", wmax: 900 },
  { value: 'roboto', label: 'Roboto', stack: "'Roboto'" },
  { value: 'opensans', label: 'Open Sans', stack: "'Open Sans Variable', 'Open Sans'", wmax: 800 },
  { value: 'lato', label: 'Lato', stack: "'Lato'" },
  { value: 'montserrat', label: 'Montserrat', stack: "'Montserrat Variable', 'Montserrat'", wmax: 900 },
  { value: 'sourcesans', label: 'Source Sans 3', stack: "'Source Sans 3 Variable', 'Source Sans 3'", wmax: 900 },
  { value: 'poppins', label: 'Poppins', stack: "'Poppins'" },
  // Its 600 reads too light for markdown bold (ink coverage +24% at 800), so it ships pre-tuned.
  { value: 'jetbrainsmono', label: 'JetBrains Mono', stack: "'JetBrains Mono Variable', 'JetBrains Mono', monospace", fsa: 0.48, wmax: 800, tuning: { boldWeight: 800 } },
  { value: 'opendyslexic', label: 'OpenDyslexic (dyslexia)', stack: "'OpenDyslexic'", a11y: true },
  { value: 'atkinson', label: 'Atkinson Hyperlegible (low vision)', stack: "'Atkinson Hyperlegible'", a11y: true },
  { value: 'lexend', label: 'Lexend (reading)', stack: "'Lexend Variable', 'Lexend'", a11y: true, wmax: 900 },
  { value: 'andika', label: 'Andika (literacy)', stack: "'Andika'", a11y: true },
];
/** CSS family stack for a font value, or '' if unknown/sentinel. */
export const fontStack = (value: string): string => FONT_LIST.find((f) => f.value === value)?.stack ?? '';

// Normalize apparent size across fonts by pinning x-height to this target (≈ the system UI font).
export const DEFAULT_FONT_SIZE_ADJUST = 0.52;
/** The font-size-adjust target for a font value — its `fsa` override, else the default. */
export const fontSizeAdjust = (value: string): number => FONT_LIST.find((f) => f.value === value)?.fsa ?? DEFAULT_FONT_SIZE_ADJUST;

// Static faces ship regular through bold only; a variable face declares its own axis maximum.
export const DEFAULT_FONT_WEIGHT_MAX = 700;
// The OS stack has no shipped face to cap, and the browser synthesizes what it lacks.
export const SYSTEM_FONT_WEIGHT_MAX = 900;
/** The heaviest weight a font value can render — its `wmax`, the OS ceiling for `system`, else 700. */
export const fontWeightMax = (value: string): number =>
  value === 'system' ? SYSTEM_FONT_WEIGHT_MAX : (FONT_LIST.find((f) => f.value === value)?.wmax ?? DEFAULT_FONT_WEIGHT_MAX);
// Saved per-font tunings start empty: every font runs on its registry `tuning` until one is customized.
export const DEFAULT_FONT_TUNINGS: FontTuningMap = {};
/** The font's shipped Customize tuning, as authored (unclamped) — see `fontTuningDefaults`. */
export const fontShippedTuning = (value: string): Partial<FontTuning> => FONT_LIST.find((f) => f.value === value)?.tuning ?? {};

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
