/**
 * The help preset file: one custom help preset with the player's Formaquestion Tools and the switches, to move
 * a custom assistant between devices. The file is built from an explicit field list, so no endpoint, token or
 * other device setting rides along. Import applies the whole file or nothing.
 */
import { planToolImport } from '@/lib/tools/toolPack';
import { isRecord, parseTool } from '@/lib/tools/toolValidation';
import type { Tool, ToolEnabledMap } from '@/types';
import { DOCS_LOOKUP } from './docsLookup';
import { HELP_PROMPT_KEYS, type HelpPromptTexts, type HelpRequestKey } from './helpPrompt';
import {
  DEFAULT_HELP_PRESET_ID, DEFAULT_HELP_PRESET_NAME, defaultHelpPreset, HELP_REPETITION_PENALTY_RANGE, HELP_TEMPERATURE_RANGE, mapHelpOptions, type HelpPreset, type HelpPresetOptions, type HelpRequestOptions,
} from './helpPresets';
import { HELP_ROLL } from './helpRoll';
import { HELP_CALL_LIMIT_MAX, type HelpSettings, type HelpSettingsChange } from './helpSettings';
import { HELP_RESERVED_TOOL_NAMES } from './helpTools';

export const HELP_PRESET_FILE_VERSION = 1;

/** A fixed function's switch and Max Calls per Request. */
export interface HelpPresetFileFunction {
  enabled: boolean;
  maxCalls: number;
}

/** A Formaquestion Tool and its switch. */
export interface HelpPresetFileTool {
  tool: Tool;
  enabled: boolean;
}

/** The help preset file. `appVersion` is the build that wrote it, for a person reading the file. */
export interface HelpPresetFile {
  formamorphHelpPreset: number;
  appVersion: string;
  name: string;
  prompts: HelpPromptTexts;
  options: HelpPresetOptions;
  tools: HelpPresetFileTool[];
  /** Keyed by the function name the model sees. */
  functions: Record<string, HelpPresetFileFunction>;
}

/** Every top-level key of the file. */
export const HELP_PRESET_FILE_FIELDS: readonly (keyof HelpPresetFile)[] = ['formamorphHelpPreset', 'appVersion', 'name', 'prompts', 'options', 'tools', 'functions'];

type SwitchKey = { [K in keyof HelpSettings]: HelpSettings[K] extends boolean ? K : never }[keyof HelpSettings];
type LimitKey = { [K in keyof HelpSettings]: HelpSettings[K] extends number ? K : never }[keyof HelpSettings];

/** The settings fields of each fixed function with a switch and a call limit. The face call has neither. */
const FUNCTION_FIELDS: readonly { name: string; enabled: SwitchKey; maxCalls: LimitKey; max: number }[] = [
  { name: DOCS_LOOKUP.name, enabled: 'lookup', maxCalls: 'lookupCallLimit', max: HELP_CALL_LIMIT_MAX },
  { name: HELP_ROLL.name, enabled: 'roll', maxCalls: 'rollCallLimit', max: HELP_CALL_LIMIT_MAX },
];

/** One option block with its fields only. */
const blockOf = ({ temperature, repetitionPenalty, maxTokens }: HelpRequestOptions): HelpRequestOptions => ({ temperature, repetitionPenalty, maxTokens });

/** The blocks with their fields only. */
const blocksOf = (options: HelpPresetOptions): HelpPresetOptions => mapHelpOptions((key) => blockOf(options[key]));

/** The file of the preset `presetId`, the Default preset from the code of this build; null for an id no preset holds. */
export function buildHelpPresetFile(settings: HelpSettings, presetId: string, appVersion: string): HelpPresetFile | null {
  const preset = presetId === DEFAULT_HELP_PRESET_ID ? defaultHelpPreset() : settings.presets.presets.find((p) => p.id === presetId);
  if (!preset) return null;
  const { answer, pick, lookup, code } = preset.prompts;
  return {
    formamorphHelpPreset: HELP_PRESET_FILE_VERSION,
    appVersion,
    name: preset.name,
    prompts: { answer, pick, lookup, code },
    options: blocksOf(preset.options),
    tools: settings.tools.map((tool) => ({ tool: structuredClone(tool), enabled: settings.toolSwitches[tool.id] === true })),
    functions: Object.fromEntries(FUNCTION_FIELDS.map((fn) => [fn.name, { enabled: settings[fn.enabled], maxCalls: settings[fn.maxCalls] }])),
  };
}

/** A file name for the preset `name`. */
export const helpPresetFileName = (name: string): string =>
  `${name.trim().replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '') || 'preset'}.help-preset.json`;

const refusal = (field: string) => new Error(`That preset file has a missing or bad field: ${field}.`);

const isText = (value: unknown): value is string => typeof value === 'string';
const isNumberIn = (value: unknown, { min, max }: { min: number; max: number }): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
const isWholeIn = (value: unknown, min: number, max: number): value is number => Number.isInteger(value) && (value as number) >= min && (value as number) <= max;

/** The record under `key`, else a refusal that names `field`. */
function recordAt(parent: Record<string, unknown>, key: string, field = key): Record<string, unknown> {
  const value = parent[key];
  if (!isRecord(value)) throw refusal(field);
  return value;
}

/** The option block of `key`, else a refusal that names the block or its bad field. */
function parseBlock(options: Record<string, unknown>, key: HelpRequestKey): HelpRequestOptions {
  const field = `options.${key}`;
  const block = recordAt(options, key, field);
  if (!isNumberIn(block.temperature, HELP_TEMPERATURE_RANGE)) throw refusal(`${field}.temperature`);
  if (!isNumberIn(block.repetitionPenalty, HELP_REPETITION_PENALTY_RANGE)) throw refusal(`${field}.repetitionPenalty`);
  if (!isWholeIn(block.maxTokens, 1, Number.MAX_SAFE_INTEGER)) throw refusal(`${field}.maxTokens`);
  return { temperature: block.temperature, repetitionPenalty: block.repetitionPenalty, maxTokens: block.maxTokens };
}

function readTools(raw: unknown): HelpPresetFileTool[] {
  if (!Array.isArray(raw)) throw refusal('tools');
  return raw.map((entry, index) => {
    if (!isRecord(entry)) throw refusal(`tools.${index}`);
    const result = parseTool(entry.tool);
    if ('error' in result) throw new Error(`That preset file has a Tool that can’t be read: ${isRecord(entry.tool) && isText(entry.tool.name) ? `"${entry.tool.name}"` : `tools.${index}`}, ${result.error}.`);
    if (typeof entry.enabled !== 'boolean') throw refusal(`tools.${index}.enabled`);
    return { tool: result.tool, enabled: entry.enabled };
  });
}

/** Reads a help preset file. Throws, naming the problem, on text that is not a whole file of this version. */
export function parseHelpPresetFile(json: string): HelpPresetFile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error('That file isn’t valid JSON.');
  }
  if (!isRecord(parsed) || !('formamorphHelpPreset' in parsed)) throw new Error('That file isn’t a Formaquestion preset.');
  const version = parsed.formamorphHelpPreset;
  if (version !== HELP_PRESET_FILE_VERSION) throw new Error(`That preset file is version ${String(version)}. This build reads version ${HELP_PRESET_FILE_VERSION}.`);
  if (!isText(parsed.appVersion)) throw refusal('appVersion');
  if (!isText(parsed.name) || parsed.name.trim() === '') throw refusal('name');

  const prompts = recordAt(parsed, 'prompts');
  const [answer, pick, lookup, code] = HELP_PROMPT_KEYS.map((key) => {
    if (!isText(prompts[key])) throw refusal(`prompts.${key}`);
    return prompts[key];
  });

  const fileOptions = recordAt(parsed, 'options');
  const options = mapHelpOptions((key) => parseBlock(fileOptions, key));

  const tools = readTools(parsed.tools);

  const storedFunctions = recordAt(parsed, 'functions');
  const functions = Object.fromEntries(FUNCTION_FIELDS.map((fn) => {
    const field = `functions.${fn.name}`;
    const entry = recordAt(storedFunctions, fn.name, field);
    if (typeof entry.enabled !== 'boolean') throw refusal(`${field}.enabled`);
    if (!isWholeIn(entry.maxCalls, 1, fn.max)) throw refusal(`${field}.maxCalls`);
    return [fn.name, { enabled: entry.enabled, maxCalls: entry.maxCalls }];
  }));

  return {
    formamorphHelpPreset: version,
    appVersion: parsed.appVersion,
    name: parsed.name,
    prompts: { answer, pick, lookup, code },
    options,
    tools,
    functions,
  };
}

/** `name`, or `name (n)` with the first free n, among the Default preset and the custom presets, in any case. */
function freePresetName(presets: readonly HelpPreset[], name: string): string {
  const taken = new Set([DEFAULT_HELP_PRESET_NAME, ...presets.map((p) => p.name)].map((n) => n.trim().toLowerCase()));
  const base = name.trim();
  if (!taken.has(base.toLowerCase())) return base;
  for (let n = 2; ; n++) if (!taken.has(`${base} (${n})`.toLowerCase())) return `${base} (${n})`;
}

/**
 * The change a parsed file makes to the settings: the preset joins the list and becomes active, each Tool whose
 * name is free joins with its switch, and the fixed functions take the file's switches and limits. A Tool whose
 * name the list holds, or a fixed function's name, is skipped and named; the stored Tool keeps its own switch.
 */
export function importHelpPresetFile(settings: HelpSettings, file: HelpPresetFile, mintId: () => string): {
  change: HelpSettingsChange;
  presetName: string;
  skipped: string[];
  /** An added Script Tool is on. */
  scriptOn: boolean;
} {
  const store = settings.presets;
  const presetName = freePresetName(store.presets, file.name);
  const preset: HelpPreset = { id: mintId(), name: presetName, prompts: { ...file.prompts }, options: blocksOf(file.options) };

  const added: Tool[] = [];
  const switches: ToolEnabledMap = {};
  const skipped: string[] = [];
  let scriptOn = false;
  for (const { tool, enabled } of file.tools) {
    const plan = planToolImport([...settings.tools, ...added], [tool], mintId, HELP_RESERVED_TOOL_NAMES);
    skipped.push(...plan.skipped);
    for (const joined of plan.added) {
      added.push(joined);
      switches[joined.id] = enabled;
      scriptOn ||= enabled && joined.handler.kind === 'script';
    }
  }

  const functionChange = Object.fromEntries(FUNCTION_FIELDS.flatMap((fn) => [[fn.enabled, file.functions[fn.name].enabled], [fn.maxCalls, file.functions[fn.name].maxCalls]]));
  return {
    change: {
      ...functionChange,
      presets: { activeId: preset.id, presets: [...store.presets, preset] },
      tools: [...settings.tools, ...added],
      toolSwitches: { ...settings.toolSwitches, ...switches },
    },
    presetName,
    skipped,
    scriptOn,
  };
}
