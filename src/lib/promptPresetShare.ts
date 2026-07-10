import { PROMPT_TEXT_KEYS, type PromptValues, type SectionStyle, type VerbatimMap, type ReasoningMap } from './promptPresets';
import type { PromptSamplerMap } from './promptSamplers';

/** Wire identity + schema version for a shared prompt preset. `FORMAT_VERSION` bumps only on a breaking change
 *  to the shared shape; the source app version is stamped separately for the older/newer import warning. */
export const SHARE_KIND = 'formamorph-prompt-preset';
export const FORMAT_VERSION = 1;
/** Prefix on the copy-paste share code so non-preset text is rejected fast and the format is recognizable. */
export const SHARE_CODE_PREFIX = 'FMPRESET1:';

/** The serialized artifact: preset content + stamps. Tuning is optional (a text-only preset omits it). */
export interface SharedPreset {
  kind: typeof SHARE_KIND;
  formatVersion: number;
  appVersion: string;
  name: string;
  style: SectionStyle;
  values: PromptValues;
  samplers?: PromptSamplerMap;
  reasoning?: ReasoningMap;
  verbatim?: VerbatimMap;
}

/** The preset payload an import yields (id is minted when added to the store). */
export interface ImportedPreset {
  name: string;
  style: SectionStyle;
  values: PromptValues;
  samplers?: PromptSamplerMap;
  reasoning?: ReasoningMap;
  verbatim?: VerbatimMap;
}

export interface ParseResult {
  ok: boolean;
  preset?: ImportedPreset;
  sourceAppVersion?: string;
  /** Human-readable notes (version mismatch, dropped unknown keys, newer format) — shown but non-blocking. */
  warnings: string[];
  error?: string;
}

/** Build the shareable artifact from a (resolved) preset. Built-ins should be materialized to concrete
 *  values/tuning by the caller before export. */
export function buildSharedPreset(
  input: { name: string; style: SectionStyle; values: PromptValues; samplers?: PromptSamplerMap; reasoning?: ReasoningMap; verbatim?: VerbatimMap },
  appVersion: string,
): SharedPreset {
  return {
    kind: SHARE_KIND,
    formatVersion: FORMAT_VERSION,
    appVersion,
    name: input.name,
    style: input.style,
    values: input.values,
    ...(input.samplers && Object.keys(input.samplers).length ? { samplers: input.samplers } : {}),
    ...(input.reasoning && Object.keys(input.reasoning).length ? { reasoning: input.reasoning } : {}),
    ...(input.verbatim && Object.keys(input.verbatim).length ? { verbatim: input.verbatim } : {}),
  };
}

/** Pretty JSON for the `.json` file export. */
export function serializeSharedJson(shared: SharedPreset): string {
  return JSON.stringify(shared, null, 2);
}

/** Compact, prefixed, UTF-8-safe base64 for the copy-paste share code. */
export function serializeSharedCode(shared: SharedPreset): string {
  return SHARE_CODE_PREFIX + b64encode(JSON.stringify(shared));
}

/** Parse a `.json` file's text into a validated preset (or an error). `currentAppVersion` drives the mismatch warning. */
export function parseSharedJson(raw: string, currentAppVersion: string): ParseResult {
  let obj: unknown;
  try { obj = JSON.parse(raw); } catch { return { ok: false, warnings: [], error: "That file isn't valid JSON." }; }
  return sanitize(obj, currentAppVersion);
}

/** Parse either form (a `.json` body or a share code) — JSON when the text starts with `{`, else a code. */
export function parseSharedAny(text: string, currentAppVersion: string): ParseResult {
  return text.trim().startsWith('{') ? parseSharedJson(text, currentAppVersion) : parseSharedCode(text, currentAppVersion);
}

/** Parse a copy-paste share code (with or without the prefix) into a validated preset (or an error). */
export function parseSharedCode(code: string, currentAppVersion: string): ParseResult {
  const trimmed = code.trim();
  const body = trimmed.startsWith(SHARE_CODE_PREFIX) ? trimmed.slice(SHARE_CODE_PREFIX.length) : trimmed;
  let json: string;
  try { json = b64decode(body); } catch { return { ok: false, warnings: [], error: "That share code isn't readable." }; }
  return parseSharedJson(json, currentAppVersion);
}

/** Validate + sanitize a decoded object into an ImportedPreset. Unknown text keys and malformed tuning entries
 *  are dropped (not fatal); a version/format mismatch is a warning, not a block. */
function sanitize(obj: unknown, currentAppVersion: string): ParseResult {
  if (!obj || typeof obj !== 'object') return { ok: false, warnings: [], error: 'Not a preset file.' };
  const o = obj as Record<string, unknown>;
  if (o.kind !== SHARE_KIND) return { ok: false, warnings: [], error: 'This file is not a Formamorph prompt preset.' };

  const warnings: string[] = [];
  const sourceAppVersion = typeof o.appVersion === 'string' ? o.appVersion : undefined;
  const formatVersion = typeof o.formatVersion === 'number' ? o.formatVersion : 0;
  if (formatVersion > FORMAT_VERSION) warnings.push('This preset was made with a newer format; anything unrecognized was skipped.');
  if (sourceAppVersion && sourceAppVersion !== currentAppVersion) {
    warnings.push(`This preset was made for Formamorph ${sourceAppVersion} (you have ${currentAppVersion}); it was imported as-is.`);
  }

  // Text values: keep only known keys with string values; drop anything else. Missing keys inherit the default.
  const rawValues = (o.values && typeof o.values === 'object') ? o.values as Record<string, unknown> : {};
  const values: Partial<PromptValues> = {};
  let droppedKeys = 0;
  for (const [k, v] of Object.entries(rawValues)) {
    if ((PROMPT_TEXT_KEYS as readonly string[]).includes(k) && typeof v === 'string') values[k as keyof PromptValues] = v;
    else droppedKeys++;
  }
  if (droppedKeys > 0) warnings.push(`${droppedKeys} unrecognized field(s) were ignored.`);

  const style: SectionStyle = o.style === 'labels' ? 'labels' : 'markdown';
  const name = typeof o.name === 'string' && o.name.trim() ? o.name.trim() : 'Imported Preset';

  const preset: ImportedPreset = { name, style, values: values as PromptValues };
  if (o.samplers && typeof o.samplers === 'object') preset.samplers = o.samplers as PromptSamplerMap;
  const reasoning = sanitizeReasoning(o.reasoning);
  if (reasoning) preset.reasoning = reasoning;
  const verbatim = sanitizeVerbatim(o.verbatim);
  if (verbatim) preset.verbatim = verbatim;

  return { ok: true, preset, sourceAppVersion, warnings };
}

/** Keep only string-valued reasoning entries. */
function sanitizeReasoning(raw: unknown): ReasoningMap | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const out: ReasoningMap = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) if (typeof v === 'string') out[k] = v as ReasoningMap[string];
  return Object.keys(out).length ? out : undefined;
}

/** Keep only finite-number verbatim entries. */
function sanitizeVerbatim(raw: unknown): VerbatimMap | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) if (typeof v === 'number' && Number.isFinite(v)) out[k] = v;
  return Object.keys(out).length ? (out as VerbatimMap) : undefined;
}

// --- UTF-8-safe base64 (prompt text carries em-dashes, curly quotes, etc.; btoa alone is Latin1-only) ---

function b64encode(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function b64decode(code: string): string {
  const bin = atob(code);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
