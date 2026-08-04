import { useState, useEffect } from 'react';
import { useSettings, type ThinkingMode, type ReasoningEffort, type ParagraphLimit } from '@/contexts/SettingsContext';
import { DEFAULT_ENDPOINT, DEFAULT_API_TOKEN, DEFAULT_MODEL_NAME, DEFAULT_MAX_TOKENS, THEME_COLORS, FONT_OPTIONS, NARRATION_FONT_OPTIONS, DEFAULT_NARRATION_SCALE, DEFAULT_NARRATION_LINE_HEIGHT, type ThemeColor, type FontChoice, type NarrationFont } from '@/contexts/settingsDefaults';
import { useTheme } from '../theme-provider';
import { ThemePreviewButton } from '@/components/ThemePreviewDialog';
import { LocalModelPanel } from '@/components/modals/LocalModelPanel';
import LlmSetupGuide from '@/components/modals/LlmSetupGuide';
import { SETTINGS_TABS } from '@/components/modals/settingsTabs';
import { Row, CheckRow, Section, SubGroup, RowLabel, HintInfo } from '@/components/SettingsRows';
import { reasoningTabs, reasoningPromptTabs, defaultPromptReasoning, defaultReasoningBudgetPct, REASONING_CONTROL_KINDS, type PromptReasoning } from '@/lib/reasoningEffort';
import { ExportPresetDialog, ImportPresetDialog } from '@/components/modals/PresetShareDialogs';
import { type SharedPreset } from '@/lib/promptPresetShare';
import { APP_VERSION } from '@/lib/version';
import { normalizeEndpointUrl, endpointUrlWasCompleted } from '@/lib/endpointUrl';
import { computePromptTabAvailability } from '@/lib/promptTabAvailability';
import { Settings } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RevealAnimationDemoButton } from "@/components/RevealAnimationDemo";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { loadEmbeddingModel, disposeEmbeddingModel, type EmbeddingLoadProgress } from '@/lib/embeddingWorkerClient';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem, SelectSeparator } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import PromptField from '../prompt/PromptField';
import { PROMPT_KIND_VARIABLES, PROMPT_KIND_USER_VARIABLES, NOW_LINE_VARIABLES, SUBJECT } from '@/lib/promptVariables';
import { defaultPromptSampler } from '@/lib/promptSamplers';
import type { AIRequestType } from '@/types';
import { ConfirmDialog } from '../ConfirmDialog';
import { toast } from 'react-toastify';
import WorldStorageService from '@/services/WorldStorageService';
import { DEFAULT_WORLDS, readDeletedDefaultWorlds, clearDeletedDefaultWorlds } from '@/lib/defaultWorlds';
import { PresetNameDialog } from './PresetNameDialog';
import { defaultSystemPrompt, defaultNarrationUserPrompt, defaultRecapUserPrompt, defaultRehydrateUserPrompt, defaultOocDirectivePrompt, defaultChoicesPrompt, defaultStatUpdatesPrompt, defaultLocationChangePrompt, defaultThinkingPrompt, defaultSummaryPrompt, defaultChoicesUserPrompt, defaultStatUpdatesUserPrompt, defaultLocationChangeUserPrompt, defaultSummaryUserPrompt, defaultDiaryPrompt, defaultDirectorPrompt, defaultDirectorUserPrompt, defaultCharacterPrompt, defaultStoryboardPrompt, defaultNowLinePrompt, defaultTimePassedPrompt, defaultTimePassedUserPrompt, defaultOpeningTimePrompt, defaultOpeningTimeUserPrompt, defaultSceneTagsPrompt, defaultSceneTagsUserPrompt } from '../game/GamePrompts';
import { isDesktop } from '@/lib/imageGen/desktop';
import { fetchComfyMeta, DEFAULT_COMFY_WORKFLOW, type ComfyMeta } from '@/lib/imageGen/comfyui';
import { fetchInvokeMeta, invokeConnectionMessage, encodersFor, vaesFor, PREFIXED_BASES, type InvokeMeta } from '@/lib/imageGen/invokeai';
import { DEFAULT_ENDPOINT_BY_PROVIDER, resolveImageEndpoint } from '@/lib/imageGen';
import { TokenAutocomplete } from '@/components/TokenAutocomplete';
import { COMMON_LANGUAGES } from '@/lib/languages';
import ImageSetupGuide from './ImageSetupGuide';
import ComfyWorkflowGuide from './ComfyWorkflowGuide';
import { DEFAULT_TAG_PROMPT, SUBJECT_GUIDANCE } from '@/lib/imagePrompt';

// Segmented-control options: a short tab label plus the helper text shown below the selected one.
const THEME_OPTIONS: { value: 'light' | 'dark' | 'system'; label: string; help: string }[] = [
  { value: 'light', label: 'Light', help: 'Always use the light color scheme.' },
  { value: 'dark', label: 'Dark', help: 'Always use the dark color scheme.' },
  { value: 'system', label: 'System', help: 'Recommended. Follow your OS light/dark setting.' },
];

const PARAGRAPH_LIMIT_OPTIONS: { value: ParagraphLimit; label: string; help: string }[] = [
  { value: 'none', label: 'None', help: 'No paragraph limit. The model writes until it finishes or hits the token cap.' },
  { value: 'single', label: 'Single', help: 'One paragraph per turn (stops at the first line break).' },
  { value: 'auto', label: 'Auto', help: 'Recommended. Scales the paragraph count to your Max Output Tokens so responses fit the budget and end cleanly.' },
];
const THINKING_OPTIONS: { value: ThinkingMode; label: string; help: string }[] = [
  { value: 'off', label: 'Native', help: 'Nothing is added to the prompt. Reasoning models think as they normally would; other models respond immediately.' },
  { value: 'inline', label: 'Inline', help: 'The model reasons privately before narrating, in the same request. One fewer round-trip.' },
  { value: 'precall', label: 'Planning', help: 'Recommended. A separate request is sent to plan narration before writing it. Most reliable for small models.' },
  { value: 'staged', label: 'Staged', help: 'Highest quality, slowest. A director picks the cast, each character plans its motivation, and a storyboarder writes the plan — several extra requests per turn.' },
];
/** Sentinel for the InvokeAI "no board" choice — Radix Select rejects an empty-string item value, and the
 *  stored setting is '' (Uncategorized). */
const UNCATEGORIZED_BOARD = '__uncategorized__';

/** A segmented option control that collapses to a dropdown on mobile: a full-width Select below `sm`, the
 *  tab row at `sm+`. Both drive the same value, so option help stacked beneath it (by the caller) is unaffected. */
function OptionSwitcher({ value, onChange, options }: {
  value: string;
  onChange: (v: string) => void;
  options: readonly { value: string; label: string }[];
}) {
  return (
    <>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-full sm:hidden"><SelectValue /></SelectTrigger>
        <SelectContent>
          {options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
        </SelectContent>
      </Select>
      <div className="hidden sm:block">
        <ToggleGroup
          type="single"
          value={value}
          // A single ToggleGroup clears its value when the active item is clicked again; every caller's
          // setting is required, so an empty result is ignored rather than stored.
          onValueChange={(v) => { if (v) onChange(v); }}
          className="grid w-full"
          style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
        >
          {options.map((o) => <ToggleGroupItem key={o.value} value={o.value}>{o.label}</ToggleGroupItem>)}
        </ToggleGroup>
      </div>
    </>
  );
}

/** Parse a numeric `<input>` value, falling back to `min` when it's empty or invalid. Without this a cleared
 *  field yields `Number('') === 0`, which would persist a zero (a 0-token request, a 0px image) to settings. */
const numInput = (raw: string, min: number): number => {
  const n = Number(raw);
  return Number.isFinite(n) && n >= min ? n : min;
};

const REASONING_CAVEAT = 'Only applies to models with native reasoning.';
// Per-value help; the tabs themselves are built from the endpoint's detected support via `reasoningTabs`.
const REASONING_EFFORT_HELP: Record<ReasoningEffort, string> = {
  auto: `No hint sent — the endpoint decides. ${REASONING_CAVEAT}`,
  none: `Disables native reasoning. ${REASONING_CAVEAT}`,
  minimal: `Minimal effort. ${REASONING_CAVEAT}`,
  low: `Low effort. ${REASONING_CAVEAT}`,
  medium: `Medium effort. ${REASONING_CAVEAT}`,
  high: `High effort. ${REASONING_CAVEAT}`,
  xhigh: `Extra-high effort. ${REASONING_CAVEAT}`,
  max: `Maximum effort. ${REASONING_CAVEAT}`,
};

/** Per-prompt control: how many recent turns this prompt receives verbatim (the rest are digested). */
function VerbatimTurnsField({ id, value, onChange, disabled }: { id: string; value: number; onChange: (n: number) => void; disabled?: boolean }) {
  return (
    <div className="flex items-center gap-2 flex-shrink-0">
      <label htmlFor={id} className="text-sm">Verbatim turns</label>
      <Input
        id={id}
        type="number"
        min={0}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Math.max(0, Math.floor(Number(e.target.value)) || 0))}
        className="w-20"
      />
      <span className="hidden sm:inline text-xs text-muted-foreground">recent turns kept in full before older ones are summarized</span>
    </div>
  );
}

// The prompt sub-tab keys map to their `AIRequestType` for per-prompt temperature lookup.
const TAB_TO_REQUEST: Record<string, AIRequestType> = {
  narration: 'narration', thinking: 'thinking', choices: 'choices', statupdates: 'statUpdates',
  location: 'locationChange', summary: 'summary', diary: 'diary', director: 'director',
  character: 'character', storyboard: 'storyboard', timepassed: 'timePassed', timeopening: 'openingTime',
};

/** One custom-sampler override row: a checkbox that enables the override, a slider, and a value readout that
 *  shows "Endpoint default" while off when the sampler is omitted (a non-pinned prompt on a custom endpoint).
 *  On reveals the stored custom value, which persists across toggling and is sent to any endpoint. */
interface SamplerControlProps {
  id: string;
  label: string;
  hint: string;
  custom: boolean;
  value: number;
  /** The value shown when off, or undefined when the prompt omits the sampler (endpoint decides). */
  defaultValue: number | undefined;
  min: number;
  max: number;
  step: number;
  /** When true the whole control is read-only (a built-in prompt preset) — checkbox and slider both locked. */
  disabled?: boolean;
  onCustomChange: (custom: boolean) => void;
  onValueChange: (value: number) => void;
}
function SamplerControl({ id, label, hint, custom, value, defaultValue, min, max, step, disabled, onCustomChange, onValueChange }: SamplerControlProps) {
  const omitsWhenOff = defaultValue === undefined;
  const shown = custom ? value : (defaultValue ?? value);
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Checkbox id={id} checked={custom} disabled={disabled} onCheckedChange={(c) => onCustomChange(c === true)} />
        <label htmlFor={id} className="text-sm">{label}</label>
        <span className="hidden sm:inline text-xs text-muted-foreground">{hint}</span>
      </div>
      <div className="flex items-center gap-3">
        <Slider
          className={`flex-grow${custom && !disabled ? '' : ' opacity-60'}`}
          value={[shown]}
          min={min}
          max={max}
          step={step}
          disabled={disabled || !custom}
          onValueChange={(v) => onValueChange(v[0])}
        />
        <span className="w-28 text-right text-sm tabular-nums">
          {custom || !omitsWhenOff ? shown.toFixed(2) : <span className="text-muted-foreground not-italic">Endpoint default</span>}
        </span>
      </div>
    </div>
  );
}

/** A prompt's Native Reasoning override: `Global | None | <levels>`, shown only for narration/choices under
 *  Native mode. `Global` follows the endpoint-wide level; the rest override this prompt alone. */
function PromptReasoningField({ value, options, onChange, disabled }: {
  value: PromptReasoning;
  options: { value: PromptReasoning; label: string }[];
  onChange: (v: PromptReasoning) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm">Native Reasoning</label>
      <ToggleGroup
        type="single"
        value={value}
        // A single ToggleGroup clears its value when the active item is clicked again; the override always
        // has a level (Global included), so an empty result is ignored rather than stored.
        onValueChange={(v) => { if (v) onChange(v as PromptReasoning); }}
        className="grid w-full"
        style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
      >
        {options.map((t) => (
          <ToggleGroupItem key={t.value} value={t.value} disabled={disabled}>{t.label}</ToggleGroupItem>
        ))}
      </ToggleGroup>
      <span className="text-xs text-muted-foreground">
        Global follows Settings → Generation → Native Reasoning. Only applies to models with native reasoning.
      </span>
    </div>
  );
}

/** A prompt's Native Reasoning BUDGET (local engine only): a % of Max Output Tokens the model may spend on its
 *  thought segment. 0% = no reasoning on this prompt; higher caps it. Replaces the effort control on the local
 *  engine, which budgets the thought segment directly rather than taking a coarse effort hint. */
function PromptReasoningBudgetField({ value, onChange, disabled }: {
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <label className="text-sm">Reasoning Budget</label>
        <span className="hidden sm:inline text-xs text-muted-foreground">share of Max Output Tokens the model may think for; 0% = no reasoning</span>
      </div>
      <div className="flex items-center gap-3">
        <Slider
          className={`flex-grow${disabled ? ' opacity-60' : ''}`}
          value={[value]}
          min={0}
          max={100}
          step={5}
          disabled={disabled}
          onValueChange={(v) => onChange(v[0])}
        />
        <span className="w-28 text-right text-sm tabular-nums">{value === 0 ? <span className="text-muted-foreground not-italic">No reasoning</span> : `${value}%`}</span>
      </div>
    </div>
  );
}

/** The per-prompt Options sub-tab: the verbatim-turns control (only when digests are on and the prompt uses
 *  them), the per-prompt Native Reasoning override (narration/choices under Native only — the effort level on
 *  external endpoints, or the token budget on the local engine), plus one override row per tunable sampler.
 *  `disabled` locks every control when the active prompt preset is built-in (Default/Simple). */
function PromptOptionsPanel({ verbatim, reasoning, reasoningBudget, samplers, disabled }: {
  verbatim: { value: number; set: (n: number) => void } | null;
  reasoning: { value: PromptReasoning; options: { value: PromptReasoning; label: string }[]; set: (v: PromptReasoning) => void } | null;
  reasoningBudget: { value: number; set: (v: number) => void } | null;
  samplers: SamplerControlProps[];
  disabled: boolean;
}) {
  return (
    // px-3 keeps the slider thumb off the scroll frame's edges (the thumb overflows the track ends at 0/max).
    <div className="space-y-5 px-3 py-3">
      {verbatim && <VerbatimTurnsField id="promptVerbatim" value={verbatim.value} onChange={verbatim.set} disabled={disabled} />}
      {reasoning && <PromptReasoningField value={reasoning.value} options={reasoning.options} onChange={reasoning.set} disabled={disabled} />}
      {reasoningBudget && <PromptReasoningBudgetField value={reasoningBudget.value} onChange={reasoningBudget.set} disabled={disabled} />}
      {samplers.map((s) => <SamplerControl key={s.id} {...s} disabled={disabled} />)}
    </div>
  );
}

export const SettingsModal = ({ isOpen, onOpenChange, previewValues, initialTab, initialEndpointTab, initialPromptTab, onWorldsRestored }: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after Restore Default Worlds re-seeds, so a world list on screen can refresh. */
  onWorldsRestored?: () => void;
  /** Live variable values for the prompt-editor Preview tab. Supplied only in-game; absent → no Preview. */
  previewValues?: Record<string, string>;
  /** DEV dev-router: open on this top-level tab instead of the default (see `devRouter.ts`). */
  initialTab?: string;
  /** Which AI Endpoints sub-tab to open ('text-endpoint' | 'img-endpoint' | 'img-tagprompt'). Used by the
   *  "Open Settings" shortcut in the image generation dialog to land straight on Image. */
  initialEndpointTab?: string;
  /** DEV dev-router: which prompt under the Prompts tab to open (e.g. 'narration', 'thinking'). */
  initialPromptTab?: string;
}) => {
  const [activeTab, setActiveTab] = useState<string>(initialTab ?? SETTINGS_TABS[0].value);
  const [endpointTab, setEndpointTab] = useState<string>(initialEndpointTab ?? 'text-endpoint');
  // Deleted-default count, refreshed whenever the modal opens: localStorage isn't reactive, and the player
  // may have deleted a world since it last rendered.
  const [deletedDefaultCount, setDeletedDefaultCount] = useState(0);
  useEffect(() => { if (isOpen) setDeletedDefaultCount(readDeletedDefaultWorlds().size); }, [isOpen]);

  const restoreDefaultWorlds = async () => {
    clearDeletedDefaultWorlds();
    try {
      const { failed } = await WorldStorageService.loadDefaultWorlds(DEFAULT_WORLDS);
      if (failed.length) toast.error(`Some default worlds failed to restore: ${failed.join(', ')}`);
      else toast.success('Default worlds restored');
    } catch {
      toast.error('Could not restore the default worlds');
    }
    setDeletedDefaultCount(readDeletedDefaultWorlds().size);
    onWorldsRestored?.();
  };
  // Honor a later dev-router tab change while the modal stays open (a fresh __fmDev.goto).
  useEffect(() => { if (initialTab) setActiveTab(initialTab); }, [initialTab]);
  useEffect(() => { if (initialEndpointTab) setEndpointTab(initialEndpointTab); }, [initialEndpointTab]);
  const {
    bgmEnabled,
    setBgmEnabled,
    language,
    setLanguage,
    endpointUrl,
    setEndpointUrl,
    apiToken,
    setApiToken,
    modelName,
    setModelName,
    maxTokens,
    setMaxTokens,
    contextWindow,
    contextWindowOverride,
    setContextWindowOverride,
    detectedContextWindow,
    detectStatus,
    detectContextWindow,
    useCustomEndpoint,
    setUseCustomEndpoint,
    builtinTextEndpointPresets,
    textEndpointPresets,
    activeTextEndpointPresetId,
    activeTextEndpointPresetIsBuiltIn,
    activeTextEndpointPresetName,
    selectTextEndpointPreset,
    addTextEndpointPreset,
    renameTextEndpointPreset,
    deleteTextEndpointPreset,
    resetTextEndpointPreset,
    systemPrompt,
    setSystemPrompt,
    choicesPrompt,
    setChoicesPrompt,
    statUpdatesPrompt,
    setStatUpdatesPrompt,
    locationChangePromptText,
    setLocationChangePromptText,
    choicesEnabled,
    setChoicesEnabled,
    statUpdatesEnabled,
    setStatUpdatesEnabled,
    locationChangeEnabled,
    setLocationChangeEnabled,
    locationAutoApply,
    setLocationAutoApply,
    narrationVerbatimTurns,
    setNarrationVerbatimTurns,
    thinkingVerbatimTurns,
    setThinkingVerbatimTurns,
    choicesVerbatimTurns,
    setChoicesVerbatimTurns,
    statUpdatesVerbatimTurns,
    setStatUpdatesVerbatimTurns,
    locationChangeVerbatimTurns,
    setLocationChangeVerbatimTurns,
    summaryVerbatimTurns,
    setSummaryVerbatimTurns,
    thinkingMode,
    setThinkingMode,
    limitActiveCharacters,
    setLimitActiveCharacters,
    activeCharacterLimit,
    setActiveCharacterLimit,
    reasoningEffort,
    setReasoningEffort,
    supportedReasoningEfforts,
    promptReasoning,
    setPromptReasoning,
    promptReasoningBudget,
    setPromptReasoningBudget,
    thinkingPrompt,
    setThinkingPrompt,
    summaryPrompt,
    setSummaryPrompt,
    diaryPrompt,
    setDiaryPrompt,
    directorPrompt,
    setDirectorPrompt,
    directorUserPrompt,
    setDirectorUserPrompt,
    characterPrompt,
    setCharacterPrompt,
    storyboardPrompt,
    setStoryboardPrompt,
    narrationUserPrompt,
    setNarrationUserPrompt,
    recapUserPrompt,
    rehydrateUserPrompt,
    setRehydrateUserPrompt,
    setRecapUserPrompt,
    oocDirectivePrompt,
    setOocDirectivePrompt,
    choicesUserPrompt,
    setChoicesUserPrompt,
    statUpdatesUserPrompt,
    setStatUpdatesUserPrompt,
    locationChangeUserPrompt,
    setLocationChangeUserPrompt,
    summaryUserPrompt,
    nowLinePrompt,
    setNowLinePrompt,
    timePassedPrompt,
    setTimePassedPrompt,
    timePassedUserPrompt,
    setTimePassedUserPrompt,
    openingTimePrompt,
    setOpeningTimePrompt,
    openingTimeUserPrompt,
    setOpeningTimeUserPrompt,
    sceneTagsPrompt,
    setSceneTagsPrompt,
    sceneTagsUserPrompt,
    setSceneTagsUserPrompt,
    sceneImageAuto,
    setSceneImageAuto,
    setSummaryUserPrompt,
    promptPresets,
    builtinPresets,
    activePresetId,
    activePresetIsBuiltIn,
    selectPreset,
    addPreset,
    renamePreset,
    deletePreset,
    resetPreset,
    exportActivePreset,
    importPreset,
    memoryDigests,
    setMemoryDigests,
    semanticMemory,
    setSemanticMemory,
    semanticLore,
    setSemanticLore,
    semanticRehydration,
    timeContext,
    setTimeContext,
    aiClock,
    setAiClock,
    setSemanticRehydration,
    semanticDiaries,
    setSemanticDiaries,
    semanticBandCap,
    setSemanticBandCap,
    concurrentTurnRequests,
    setConcurrentTurnRequests,
    autosaveEnabled,
    setAutosaveEnabled,
    characterDiaries,
    describeCharacters,
    setDescribeCharacters,
    setCharacterDiaries,
    genTemperature,
    genRepetitionPenalty,
    localModelActive,
    promptSamplers,
    setPromptSamplerCustom,
    setPromptSamplerValue,
    showSilentRequests,
    setShowSilentRequests,
    showReasoning,
    setShowReasoning,
    paragraphLimit,
    setParagraphLimit,
    locationBackground,
    setLocationBackground,
    backgroundOverlay,
    setBackgroundOverlay,
    markdownOutput,
    setMarkdownOutput,
    imageProvider,
    setImageProvider,
    imageEndpoint,
    setImageEndpoint,
    imageApiToken,
    setImageApiToken,
    imageModel,
    setImageModel,
    imagePositivePrompt,
    setImagePositivePrompt,
    imageNegativePrompt,
    setImageNegativePrompt,
    imagePortraitWidth,
    setImagePortraitWidth,
    imagePortraitHeight,
    setImagePortraitHeight,
    imageLandscapeWidth,
    setImageLandscapeWidth,
    imageLandscapeHeight,
    setImageLandscapeHeight,
    imageSteps,
    setImageSteps,
    imageCfg,
    setImageCfg,
    imageSampler,
    setImageSampler,
    imageAdetailer,
    setImageAdetailer,
    imageWorkflow,
    setImageWorkflow,
    imageInvokeEncoder,
    imageInvokeBoard,
    setImageInvokeBoard,
    setImageInvokeEncoder,
    imageInvokeVae,
    setImageInvokeVae,
    imageGenDisabled,
    setImageGenDisabled,
    imageEndpointPresets,
    activeImageEndpointPresetId,
    activeImageEndpointPresetName,
    selectImageEndpointPreset,
    addImageEndpointPreset,
    renameImageEndpointPreset,
    deleteImageEndpointPreset,
    resetImageEndpointPreset,
    imageTagPrompt,
    setImageTagPrompt,
    themeColor,
    setThemeColor,
    fontFamily,
    setFontFamily,
    narrationFont,
    setNarrationFont,
    narrationScale,
    setNarrationScale,
    narrationLineHeight,
    setNarrationLineHeight
  } = useSettings();
  const { theme, setTheme } = useTheme();
  const desktop = isDesktop();
  const [connectionGuideOpen, setConnectionGuideOpen] = useState(false);
  // Embedding-model download state for the semantic memory toggle. Local to the modal: the toggle
  // stays on through a failed download (scoring fails open until the model arrives), so this state
  // only drives the progress bar / error row.
  const [embedLoading, setEmbedLoading] = useState(false);
  const [embedProgress, setEmbedProgress] = useState<EmbeddingLoadProgress | null>(null);
  const [embedError, setEmbedError] = useState<string | null>(null);
  const startEmbeddingDownload = () => {
    setEmbedLoading(true);
    setEmbedError(null);
    setEmbedProgress(null);
    loadEmbeddingModel(setEmbedProgress)
      .then(() => setEmbedError(null))
      .catch((err) => setEmbedError((err as Error).message))
      .finally(() => { setEmbedLoading(false); setEmbedProgress(null); });
  };
  const handleSemanticMemoryToggle = (on: boolean) => {
    setSemanticMemory(on);
    if (on) startEmbeddingDownload();
    else if (!semanticLore) void disposeEmbeddingModel(); // model stays while any semantic feature needs it
  };
  const handleSemanticLoreToggle = (on: boolean) => {
    setSemanticLore(on);
    if (on) startEmbeddingDownload();
    else if (!semanticMemory) void disposeEmbeddingModel();
  };
  const handleResetEndpointSettings = () => {
    setEndpointUrl(DEFAULT_ENDPOINT);
    setModelName(DEFAULT_MODEL_NAME);
    setApiToken(DEFAULT_API_TOKEN);
    setContextWindowOverride(null);
    setMaxTokens(DEFAULT_MAX_TOKENS);
  };

  // Single status line under the Context Window field: red for over-limit or a failed manual detect,
  // gray for detecting / detected / the idle helper.
  const contextOverLimit =
    contextWindowOverride != null && detectedContextWindow != null && contextWindowOverride > detectedContextWindow;
  const contextStatus = activeTextEndpointPresetIsBuiltIn
    ? { red: false, text: 'Using the shared endpoint — add or pick a preset to set or detect the context window.' }
    : contextOverLimit
    ? { red: true, text: `Above the detected limit (${detectedContextWindow?.toLocaleString()} tok) — the server may truncate requests.` }
    : detectStatus === 'error'
      ? { red: true, text: "Couldn't detect context length from this endpoint." }
      : detectStatus === 'detecting'
        ? { red: false, text: 'Detecting context length…' }
        : detectStatus === 'success'
          ? { red: false, text: `Detected ${(detectedContextWindow ?? contextWindow).toLocaleString()} tok from the endpoint.` }
          : { red: false, text: 'Auto-detected from your endpoint; lower it if the model feels constantly full.' };

  // Preset name dialog (Add / Rename); the "Add New Preset…" select option opens it in add mode.
  const [presetDialog, setPresetDialog] = useState<{ mode: 'add' | 'rename' } | null>(null);
  const ADD_PRESET_SENTINEL = '__add_preset__';
  const IMPORT_PRESET_SENTINEL = '__import_preset__';
  const [exportShared, setExportShared] = useState<SharedPreset | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const activePresetName = [...builtinPresets, ...promptPresets].find((p) => p.id === activePresetId)?.name ?? '';
  const handlePresetSelect = (v: string) => {
    if (v === ADD_PRESET_SENTINEL) setPresetDialog({ mode: 'add' });
    else if (v === IMPORT_PRESET_SENTINEL) setImportOpen(true);
    else selectPreset(v);
  };
  const handlePresetNameSubmit = (name: string) => {
    if (presetDialog?.mode === 'add') addPreset(name);
    else if (presetDialog?.mode === 'rename') renamePreset(activePresetId, name);
  };

  // AI Endpoints → Image preset name dialog (mirrors the prompt preset one; all presets editable).
  const [imagePresetDialog, setImagePresetDialog] = useState<{ mode: 'add' | 'rename' } | null>(null);
  const IMG_ADD_PRESET_SENTINEL = '__add_image_preset__';

  // AI Endpoints → Text preset name dialog (immutable Default + editable user presets, like the prompts tab).
  const [textPresetDialog, setTextPresetDialog] = useState<{ mode: 'add' | 'rename' } | null>(null);
  const TEXT_ADD_PRESET_SENTINEL = '__add_text_preset__';
  const handleTextPresetSelect = (v: string) => {
    if (v === TEXT_ADD_PRESET_SENTINEL) setTextPresetDialog({ mode: 'add' });
    else selectTextEndpointPreset(v);
  };
  const handleTextPresetNameSubmit = (name: string) => {
    if (textPresetDialog?.mode === 'add') addTextEndpointPreset(name);
    else if (textPresetDialog?.mode === 'rename') renameTextEndpointPreset(activeTextEndpointPresetId, name);
  };

  // ComfyUI checkpoint/sampler lists that back the Model/Sampler autocompletes. Auto-fetched from
  // /object_info whenever ComfyUI is the active provider (debounced on endpoint edits); fails silently
  // when the server isn't up (it's fast and optional — free text still works). Gated on the modal being
  // open, same as the InvokeAI fetch below: the lists only feed this modal's fields.
  const [comfyMeta, setComfyMeta] = useState<ComfyMeta | null>(null);
  const [showImageSetup, setShowImageSetup] = useState(false);
  const [showComfyWorkflow, setShowComfyWorkflow] = useState(false);
  useEffect(() => {
    if (!isOpen || imageProvider !== 'comfyui') return;
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const meta = await fetchComfyMeta(resolveImageEndpoint(imageProvider, imageEndpoint), imageApiToken);
        if (!cancelled) setComfyMeta(meta);
      } catch {
        // silent: ComfyUI not running / unreachable — the fields fall back to free text
      }
    }, 300);
    return () => { cancelled = true; clearTimeout(t); };
  }, [isOpen, imageProvider, imageEndpoint, imageApiToken]);

  // InvokeAI model/submodel lists that back the Model + encoder/VAE override dropdowns. Auto-fetched from
  // /api/v2/models/ whenever InvokeAI is the active provider (debounced); fails silently when unreachable.
  // Gated on the modal being open: the component stays mounted while closed, and the lists only feed the
  // modal's own dropdowns — probing on page load just spams the console when InvokeAI isn't running.
  const [invokeMeta, setInvokeMeta] = useState<InvokeMeta | null>(null);
  const [invokeMetaError, setInvokeMetaError] = useState<string | null>(null);
  useEffect(() => {
    if (!isOpen || imageProvider !== 'invokeai') return;
    let cancelled = false;
    const t = setTimeout(async () => {
      const endpoint = resolveImageEndpoint(imageProvider, imageEndpoint);
      try {
        const meta = await fetchInvokeMeta(endpoint, imageApiToken);
        if (!cancelled) { setInvokeMeta(meta); setInvokeMetaError(null); }
      } catch (error) {
        // Show what actually failed under the Model field (the fields still take free text): a rejected
        // token reads nothing like an unreachable server, and blaming CORS for a 401 sends the user away
        // from the one field that would fix it.
        if (!cancelled) { setInvokeMeta(null); setInvokeMetaError(invokeConnectionMessage(error, endpoint)); }
      }
    }, 300);
    return () => { cancelled = true; clearTimeout(t); };
  }, [isOpen, imageProvider, imageEndpoint, imageApiToken]);
  // The selected model's base when it's one that loads its own encoder + VAE (Z-Image, Anima), else ''.
  // Drives whether those two override rows show at all, and what they offer.
  const invokeSubmodelBase = (() => {
    const base = invokeMeta?.models.find((m) => m.name === imageModel || m.key === imageModel)?.base ?? '';
    return PREFIXED_BASES[base] ? base : '';
  })();
  const handleImagePresetSelect = (v: string) => {
    if (v === IMG_ADD_PRESET_SENTINEL) setImagePresetDialog({ mode: 'add' });
    else selectImageEndpointPreset(v);
  };
  const handleImagePresetNameSubmit = (name: string) => {
    if (imagePresetDialog?.mode === 'add') addImageEndpointPreset(name);
    else if (imagePresetDialog?.mode === 'rename') renameImageEndpointPreset(activeImageEndpointPresetId, name);
  };

  // The selected prompt sub-tab, so the Reset button can target just that prompt.
  const [promptTab, setPromptTab] = useState(initialPromptTab ?? 'narration');
  // DEV dev-router: honor a requested prompt sub-tab (a `subtab=…` in the hash).
  useEffect(() => { if (initialPromptTab) setPromptTab(initialPromptTab); }, [initialPromptTab]);
  const promptResets: Record<string, { label: string; reset: () => void }> = {
    narration: { label: 'Narration', reset: () => setSystemPrompt(defaultSystemPrompt) },
    thinking: { label: 'Planning', reset: () => setThinkingPrompt(defaultThinkingPrompt) },
    choices: { label: 'Choices', reset: () => setChoicesPrompt(defaultChoicesPrompt) },
    statupdates: { label: 'Stat Updates', reset: () => setStatUpdatesPrompt(defaultStatUpdatesPrompt) },
    location: { label: 'Location Change', reset: () => setLocationChangePromptText(defaultLocationChangePrompt) },
    summary: { label: 'Summary', reset: () => setSummaryPrompt(defaultSummaryPrompt) },
    timepassed: { label: 'Clock', reset: () => setTimePassedPrompt(defaultTimePassedPrompt) },
    timeopening: { label: 'Opening', reset: () => setOpeningTimePrompt(defaultOpeningTimePrompt) },
    scenetags: { label: 'Scene Tags', reset: () => setSceneTagsPrompt(defaultSceneTagsPrompt) },
    diary: { label: 'Diary', reset: () => setDiaryPrompt(defaultDiaryPrompt) },
    director: { label: 'Director', reset: () => setDirectorPrompt(defaultDirectorPrompt) },
    character: { label: 'Character', reset: () => setCharacterPrompt(defaultCharacterPrompt) },
    storyboard: { label: 'Storyboard', reset: () => setStoryboardPrompt(defaultStoryboardPrompt) },
  };
  // Each prompt tab only exists while its prompt is enabled (toggled in Generation → System Prompts, or
  // its governing setting for Thinking/Summary). If the open tab is no longer available (disabled since,
  // or on reopen), fall back to Narration so the panel isn't blank.
  const promptAvailable = computePromptTabAvailability({
    thinkingMode, choicesEnabled, statUpdatesEnabled, locationChangeEnabled, memoryDigests, characterDiaries, aiClock,
    sceneImages: !imageGenDisabled,
  });
  const activePromptTab = promptAvailable[promptTab] ? promptTab : 'narration';
  const selectedPrompt = promptResets[activePromptTab] ?? promptResets.narration;

  // Each prompt has a System editor, an Options sub-tab, and — for the aux prompts — a User-message editor.
  // Narration additionally has a Messages view: the conditional user-slot lines that ride the narration
  // exchange (Recap, Recall, Direction), stacked with per-field resets, each hidden with its feature.
  // A System | User | Messages | Options toggle swaps between them (User/Messages only where they exist).
  // `promptView` resets to System on every tab change.
  const [promptView, setPromptView] = useState<'system' | 'user' | 'messages' | 'options'>('system');
  const selectPromptTab = (t: string) => { setPromptTab(t); setPromptView('system'); };
  const userPrompts: Record<string, { value: string; set: (s: string) => void; reset: () => void; variables: typeof PROMPT_KIND_VARIABLES.choices }> = {
    // Narration's user template applies only with thinking off (GameViewer guard); hide the editor
    // in other modes so a change there can't silently do nothing.
    ...(thinkingMode === 'off' ? { narration: { value: narrationUserPrompt, set: setNarrationUserPrompt, reset: () => setNarrationUserPrompt(defaultNarrationUserPrompt), variables: PROMPT_KIND_USER_VARIABLES.narration ?? [] } } : {}),
    choices: { value: choicesUserPrompt, set: setChoicesUserPrompt, reset: () => setChoicesUserPrompt(defaultChoicesUserPrompt), variables: PROMPT_KIND_USER_VARIABLES.choices ?? [] },
    statupdates: { value: statUpdatesUserPrompt, set: setStatUpdatesUserPrompt, reset: () => setStatUpdatesUserPrompt(defaultStatUpdatesUserPrompt), variables: PROMPT_KIND_USER_VARIABLES.statupdates ?? [] },
    location: { value: locationChangeUserPrompt, set: setLocationChangeUserPrompt, reset: () => setLocationChangeUserPrompt(defaultLocationChangeUserPrompt), variables: PROMPT_KIND_USER_VARIABLES.location ?? [] },
    summary: { value: summaryUserPrompt, set: setSummaryUserPrompt, reset: () => setSummaryUserPrompt(defaultSummaryUserPrompt), variables: PROMPT_KIND_USER_VARIABLES.summary ?? [] },
    timepassed: { value: timePassedUserPrompt, set: setTimePassedUserPrompt, reset: () => setTimePassedUserPrompt(defaultTimePassedUserPrompt), variables: PROMPT_KIND_USER_VARIABLES.timepassed ?? [] },
    timeopening: { value: openingTimeUserPrompt, set: setOpeningTimeUserPrompt, reset: () => setOpeningTimeUserPrompt(defaultOpeningTimeUserPrompt), variables: PROMPT_KIND_USER_VARIABLES.timeopening ?? [] },
    director: { value: directorUserPrompt, set: setDirectorUserPrompt, reset: () => setDirectorUserPrompt(defaultDirectorUserPrompt), variables: PROMPT_KIND_USER_VARIABLES.director ?? [] },
    scenetags: { value: sceneTagsUserPrompt, set: setSceneTagsUserPrompt, reset: () => setSceneTagsUserPrompt(defaultSceneTagsUserPrompt), variables: PROMPT_KIND_USER_VARIABLES.scenetags ?? [] },
  };
  const activeUserPrompt = userPrompts[activePromptTab];
  const showingUser = promptView === 'user' && !!activeUserPrompt;
  // The recap line rides the narration history only while Memory Digests is on; the editor lives on the
  // Narration tab and hides with the feature so an edit can't silently do nothing.
  const recapAvailable = activePromptTab === 'narration' && memoryDigests;
  // The now-line closes the same recap reply, so it lives and hides with the recap itself.
  const nowAvailable = recapAvailable;
  // The recall line rides only while Scene Recall is on — same hide-with-the-feature rule as the recap.
  const recallAvailable = activePromptTab === 'narration' && memoryDigests && semanticMemory && semanticRehydration;
  // The direction rider fires only on [bracket] turns with thinking off (same guard as the User template).
  const directionAvailable = activePromptTab === 'narration' && thinkingMode === 'off';
  // The Messages view stacks whichever of the conditional narration lines are live.
  const messagesAvailable = recapAvailable || nowAvailable || recallAvailable || directionAvailable;
  const showingMessages = promptView === 'messages' && messagesAvailable;
  // The stacked fields the Messages view renders — one per live line, each with its own reset.
  const messageFields = [
    ...(recapAvailable ? [{
      key: 'recap', label: 'Recap Message',
      hint: 'The question the story recap answers — older turns ride the narration history as this one exchange. Only used while Memory Summaries is on.',
      value: recapUserPrompt, set: setRecapUserPrompt, def: defaultRecapUserPrompt,
    }] : []),
    ...(nowAvailable ? [{
      key: 'now', label: 'Now Message',
      hint: 'Closes the recap with where things stand right now. Each chip carries its own clause and disappears when it has nothing to say, so any combination still reads as a sentence.',
      value: nowLinePrompt, set: setNowLinePrompt, def: defaultNowLinePrompt,
      variables: NOW_LINE_VARIABLES,
    }] : []),
    ...(recallAvailable ? [{
      key: 'recall', label: 'Recall Message',
      hint: 'Frames a remembered scene as the past when Scene Recall brings an old turn back word-for-word.',
      value: rehydrateUserPrompt, set: setRehydrateUserPrompt, def: defaultRehydrateUserPrompt,
    }] : []),
    ...(directionAvailable ? [{
      key: 'direction', label: 'Direction Message',
      hint: 'Rides with your action whenever it contains [square brackets] — tells the AI the bracketed text is you directing the scene as the author, not something your character says.',
      value: oocDirectivePrompt, set: setOocDirectivePrompt, def: defaultOocDirectivePrompt,
    }] : []),
  ];
  const showingOptions = promptView === 'options';
  // The Reset button targets whichever template is on screen. `label` is the full noun ("Narration Prompt"
  // or just "Message" for the user-message template), so the button reads "Reset <label>". The Messages
  // view carries its own per-field resets, so the footer button hides there (like Options).
  const resetTarget = showingUser && activeUserPrompt
    ? { label: `${selectedPrompt.label} Message`, reset: activeUserPrompt.reset }
    : { label: `${selectedPrompt.label} Prompt`, reset: selectedPrompt.reset };

  // Verbatim-turns control for the active prompt, shown once in the footer (like Reset).
  const promptVerbatim: Record<string, { value: number; set: (n: number) => void }> = {
    narration: { value: narrationVerbatimTurns, set: setNarrationVerbatimTurns },
    thinking: { value: thinkingVerbatimTurns, set: setThinkingVerbatimTurns },
    choices: { value: choicesVerbatimTurns, set: setChoicesVerbatimTurns },
    statupdates: { value: statUpdatesVerbatimTurns, set: setStatUpdatesVerbatimTurns },
    location: { value: locationChangeVerbatimTurns, set: setLocationChangeVerbatimTurns },
    summary: { value: summaryVerbatimTurns, set: setSummaryVerbatimTurns },
  };
  const activeVerbatimEntry = promptVerbatim[activePromptTab];
  const verbatimApplicable = memoryDigests && !!activeVerbatimEntry;

  // Per-prompt samplers for the active tab. Off shows the kind's default (read-only); on shows the stored
  // custom value (seeded to the default on first enable). A default of `undefined` means the prompt omits the
  // sampler (a non-pinned prompt on a custom endpoint) — the panel then shows "Endpoint default".
  const activeKind = TAB_TO_REQUEST[activePromptTab] ?? 'narration';
  const activeSamplers = promptSamplers[activeKind];
  const samplerControls: SamplerControlProps[] = [
    {
      id: 'customTemp', label: 'Custom Temperature', hint: "override this prompt's sampling temperature",
      min: 0, max: 2, step: 0.05,
      custom: activeSamplers?.temperature?.custom ?? false,
      value: activeSamplers?.temperature?.value ?? defaultPromptSampler(activeKind, 'temperature', genTemperature, localModelActive) ?? genTemperature,
      defaultValue: defaultPromptSampler(activeKind, 'temperature', genTemperature, localModelActive),
      onCustomChange: (c) => setPromptSamplerCustom(activeKind, 'temperature', c),
      onValueChange: (v) => setPromptSamplerValue(activeKind, 'temperature', v),
    },
    {
      id: 'customRepPen', label: 'Custom Repetition Penalty', hint: "override this prompt's repetition penalty",
      min: 1, max: 1.5, step: 0.02,
      custom: activeSamplers?.repetitionPenalty?.custom ?? false,
      value: activeSamplers?.repetitionPenalty?.value ?? defaultPromptSampler(activeKind, 'repetitionPenalty', genRepetitionPenalty, localModelActive) ?? genRepetitionPenalty,
      defaultValue: defaultPromptSampler(activeKind, 'repetitionPenalty', genRepetitionPenalty, localModelActive),
      onCustomChange: (c) => setPromptSamplerCustom(activeKind, 'repetitionPenalty', c),
      onValueChange: (v) => setPromptSamplerValue(activeKind, 'repetitionPenalty', v),
    },
  ];
  // Per-prompt Native Reasoning override — only for the controllable prompts and only under Native mode
  // (guided modes force no reasoning, so an override there is meaningless). Engine-split: the local engine
  // caps the thought segment by a token budget; external endpoints take the coarse effort level. Exactly one
  // shows per engine (the other is inert there).
  // A probed-but-empty support list means the active endpoint rejects every reasoning_effort literal (even
  // `none`) — a conclusively non-reasoning model. `null`/undefined = not yet probed, so keep showing controls.
  const reasoningUnsupported = Array.isArray(supportedReasoningEfforts) && supportedReasoningEfforts.length === 0;
  const reasoningApplicable = thinkingMode === 'off' && REASONING_CONTROL_KINDS.includes(activeKind);
  const reasoningControl = reasoningApplicable && !localModelActive && !reasoningUnsupported
    ? {
        value: promptReasoning[activeKind] ?? defaultPromptReasoning(activeKind),
        options: reasoningPromptTabs(supportedReasoningEfforts),
        set: (v: PromptReasoning) => setPromptReasoning(activeKind, v),
      }
    : null;
  const reasoningBudgetControl = reasoningApplicable && localModelActive
    ? {
        value: promptReasoningBudget[activeKind] ?? defaultReasoningBudgetPct(activeKind),
        set: (v: number) => setPromptReasoningBudget(activeKind, v),
      }
    : null;

  return (
    <>
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] h-[90dvh] flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2"><Settings className="h-4 w-4" /> Settings</DialogTitle>
        </DialogHeader>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex flex-col flex-1 min-h-0">
          {/* The tab labels don't fit a narrow phone, so below sm the tab strip becomes a dropdown of the
              active tab; sm+ keeps the full row. Both drive the same activeTab state. */}
          <Select value={activeTab} onValueChange={setActiveTab}>
            <SelectTrigger className="w-full flex-shrink-0 sm:hidden">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SETTINGS_TABS.map((t) => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <TabsList className="hidden w-full grid-cols-5 flex-shrink-0 sm:grid">
            {SETTINGS_TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="presentation" className="px-2 flex-1 min-h-0 data-[state=active]:flex flex-col">
            <ScrollArea className="flex-1 min-h-0">
            <div className="grid gap-6 py-4">
              <Section title="Appearance">
              <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,3fr)] items-start gap-4">
                <RowLabel top>Theme</RowLabel>
                <div>
                  <ToggleGroup
                    type="single"
                    value={theme}
                    // A single ToggleGroup clears its value when the active item is clicked again; a theme
                    // is always set, so an empty result is ignored rather than stored.
                    onValueChange={(v) => { if (v) setTheme(v as 'light' | 'dark' | 'system'); }}
                    className="grid w-full grid-cols-3"
                  >
                    {THEME_OPTIONS.map((o) => (
                      <ToggleGroupItem key={o.value} value={o.value}>{o.label}</ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                  {/* Help texts stacked in one cell so switching options doesn't reflow the layout. */}
                  <div className="grid mt-2">
                    {THEME_OPTIONS.map((o) => (
                      <p
                        key={o.value}
                        className={`col-start-1 row-start-1 text-xs text-muted-foreground${o.value === theme ? '' : ' invisible'}`}
                      >
                        {o.help}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,3fr)] items-center gap-4">
                <RowLabel htmlFor="themeColor">Theme Color</RowLabel>
                <div className="flex items-center gap-3">
                  <Select value={themeColor} onValueChange={(v) => setThemeColor(v as ThemeColor)}>
                    <SelectTrigger id="themeColor" className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {THEME_COLORS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <ThemePreviewButton />
                  <span className="text-xs text-muted-foreground">Recolors the whole app; applies to both light and dark.</span>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,3fr)] items-center gap-4">
                <RowLabel htmlFor="fontFamily">Font</RowLabel>
                <div className="flex items-center gap-3">
                  <Select value={fontFamily} onValueChange={(v) => setFontFamily(v as FontChoice)}>
                    <SelectTrigger id="fontFamily" className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FONT_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value} style={{ fontFamily: o.stack || undefined }}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="text-xs text-muted-foreground">The typeface for the whole app.</span>
                </div>
              </div>
              </Section>

              <Section title="Scene">
              <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,3fr)] items-center gap-4">
                <RowLabel htmlFor="bgmEnabled">Background Music</RowLabel>
                <div className="flex items-center">
                  <Checkbox
                    id="bgmEnabled"
                    checked={bgmEnabled}
                    onCheckedChange={(c) => setBgmEnabled(c === true)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,3fr)] items-center gap-4">
                <RowLabel htmlFor="locationBackground">Location Background</RowLabel>
                <div className="flex items-center gap-3">
                  <Checkbox
                    id="locationBackground"
                    checked={locationBackground}
                    onCheckedChange={(c) => setLocationBackground(c === true)}
                  />
                  <span className="text-xs text-muted-foreground">Show the location image behind the game. Off uses a blank themed background.</span>
                </div>
              </div>
              {locationBackground && (
                <SubGroup>
                <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,3fr)] items-center gap-4">
                  <RowLabel>Background Fade</RowLabel>
                  <div className="flex items-center gap-3">
                    <Slider
                      value={[backgroundOverlay]}
                      min={0}
                      max={1}
                      step={0.05}
                      onValueChange={(v) => setBackgroundOverlay(v[0])}
                      className="max-w-[220px]"
                    />
                    <span className="text-xs text-muted-foreground tabular-nums w-9 shrink-0">
                      {Math.round(backgroundOverlay * 100)}%
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground sm:col-start-2">
                    Fades the location image toward the background color for readability. 0% shows the full image.
                  </p>
                </div>
                </SubGroup>
              )}
              </Section>

              <Section title="Narration">
              <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,3fr)] items-center gap-4">
                <RowLabel>Narration Reveal</RowLabel>
                <div className="flex items-center gap-2">
                  <RevealAnimationDemoButton />
                  <span className="text-xs text-muted-foreground">How each sentence appears as it streams.</span>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,3fr)] items-start gap-4">
                <RowLabel top info={
                  <HintInfo>{`The language the AI writes narration and choices in.

Pick a suggestion, type your own, or even a **style** — like *formal English* or *pirate speak*.`}</HintInfo>
                }>AI Language</RowLabel>
                <div>
                  <TokenAutocomplete
                    single
                    openOnFocus
                    values={language ? [language] : []}
                    onChange={(vals) => setLanguage(vals[0] ?? '')}
                    options={COMMON_LANGUAGES}
                    placeholder="Language or style…"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,3fr)] items-start gap-4">
                <RowLabel top>Paragraph Limit</RowLabel>
                <div>
                  <ToggleGroup
                    type="single"
                    value={paragraphLimit}
                    // A single ToggleGroup clears its value when the active item is clicked again; the limit
                    // always has a setting, so an empty result is ignored rather than stored.
                    onValueChange={(v) => { if (v) setParagraphLimit(v as ParagraphLimit); }}
                    className="grid w-full grid-cols-3"
                  >
                    {PARAGRAPH_LIMIT_OPTIONS.map((o) => (
                      <ToggleGroupItem key={o.value} value={o.value}>{o.label}</ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                  {/* All option texts stacked in one grid cell so the block is always as tall as the
                      longest — switching options shows the active one without reflowing the layout. */}
                  <div className="grid mt-2">
                    {PARAGRAPH_LIMIT_OPTIONS.map((o) => (
                      <p
                        key={o.value}
                        className={`col-start-1 row-start-1 text-xs text-muted-foreground${o.value === paragraphLimit ? '' : ' invisible'}`}
                      >
                        {o.help}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,3fr)] items-start gap-4">
                <RowLabel htmlFor="markdownOutput" info={
                  <HintInfo>{`Let the AI format narration with **bold/italics**, lists, and tables.

Works best when **Paragraph Limit** isn't set to *Single*.`}</HintInfo>
                }>Markdown Formatting</RowLabel>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="markdownOutput"
                    checked={markdownOutput}
                    onCheckedChange={(c) => setMarkdownOutput(c === true)}
                    className="shrink-0"
                  />
                  <span className="text-xs text-muted-foreground">Let the AI use bold, lists, and tables.</span>
                </div>
              </div>
              </Section>
            </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="generation" className="px-2 flex-1 min-h-0 data-[state=active]:flex flex-col">
            <ScrollArea className="flex-1 min-h-0">
            <div className="grid gap-6 py-4">
              <Section title="Turn Extras" hint="Optional passes that run alongside each turn's narration.">
              {/* Enable/disable the optional per-turn requests. Synced with the System Prompts tab, which
                  shows a prompt's editor tab only while it's enabled here. */}
              <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,3fr)] items-start gap-4">
                <RowLabel>System Prompts</RowLabel>
                <div className="flex flex-wrap gap-x-4 gap-y-2">
                  <label htmlFor="choicesEnabled" className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      id="choicesEnabled"
                      checked={choicesEnabled}
                      onCheckedChange={(c) => setChoicesEnabled(c === true)}
                      className="shrink-0"
                    />
                    Choices
                  </label>
                  <label htmlFor="statUpdatesEnabled" className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      id="statUpdatesEnabled"
                      checked={statUpdatesEnabled}
                      onCheckedChange={(c) => setStatUpdatesEnabled(c === true)}
                      className="shrink-0"
                    />
                    Stat Updates
                  </label>
                  <label htmlFor="locationChangeEnabled" className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      id="locationChangeEnabled"
                      checked={locationChangeEnabled}
                      onCheckedChange={(c) => setLocationChangeEnabled(c === true)}
                      className="shrink-0"
                    />
                    Location Change
                  </label>
                </div>
              </div>
              {/* Scene images — a picture of each turn, drawn after its text is finished. Hidden entirely when
                  image generation is switched off app-wide. */}
              {!imageGenDisabled && (
                <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,3fr)] items-start gap-4">
                  <RowLabel htmlFor="sceneImageAuto" info={
                    <HintInfo>{`Draws a picture of every turn without being asked.

The image renders **after** the turn's text is done and holds your next action until it finishes — one graphics card can't run the artist and the writer at once. Expect each turn to take as long as your image server needs.

You can always draw a single scene by hand from the button above the story instead.`}</HintInfo>
                  }>Scene Images</RowLabel>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="sceneImageAuto"
                      checked={sceneImageAuto}
                      onCheckedChange={(c) => setSceneImageAuto(c === true)}
                      className="shrink-0"
                    />
                    <span className="text-xs text-muted-foreground">Draw every turn automatically (slower turns).</span>
                  </div>
                </div>
              )}
              {/* Auto-apply detected location changes — its own row, only shown while Location Change is on. */}
              {locationChangeEnabled && (
                <SubGroup>
                <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,3fr)] items-start gap-4">
                  <RowLabel htmlFor="locationAutoApply" info={
                    <HintInfo>{`Resolves the move from your action **before** the scene is written, so it's narrated in the new location.

Skips the "Move to…?" confirmation.`}</HintInfo>
                  }>Move Automatically</RowLabel>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="locationAutoApply"
                      checked={locationAutoApply}
                      onCheckedChange={(c) => setLocationAutoApply(c === true)}
                      className="shrink-0"
                    />
                    <span className="text-xs text-muted-foreground">Resolve the move before the scene is written.</span>
                  </div>
                </div>
                </SubGroup>
              )}
              </Section>

              <Section title="Reasoning" hint="How the AI plans a turn before writing it.">
              <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,3fr)] items-start gap-4">
                <RowLabel top>Thinking</RowLabel>
                <div>
                  <OptionSwitcher value={thinkingMode} onChange={(v) => setThinkingMode(v as ThinkingMode)} options={THINKING_OPTIONS} />
                  {/* Stacked like Paragraph Limit so switching thinking modes doesn't reflow the layout. */}
                  <div className="grid mt-2">
                    {THINKING_OPTIONS.map((o) => (
                      <p
                        key={o.value}
                        className={`col-start-1 row-start-1 text-xs text-muted-foreground${o.value === thinkingMode ? '' : ' invisible'}`}
                      >
                        {o.help}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
              {/* Staged only: cap how many characters the director stages per turn (each is its own pass). Off =
                  unbounded. Feeds both the hard cap and the <ACTIVE CHARACTER GUIDANCE> chip in the director prompt. */}
              {thinkingMode === 'staged' && (
                <SubGroup>
                <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,3fr)] items-start gap-4">
                  <RowLabel top info={
                    <HintInfo>{`Caps how many characters the director stages each turn.

- Each staged character adds its **own request**
- Off lets the scene use as many as it calls for`}</HintInfo>
                  }>Limit Active Characters</RowLabel>
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={limitActiveCharacters}
                        onCheckedChange={(v) => setLimitActiveCharacters(v === true)}
                      />
                      <Input
                        type="number"
                        min={1}
                        value={activeCharacterLimit}
                        disabled={!limitActiveCharacters}
                        onChange={(e) => setActiveCharacterLimit(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-20"
                      />
                    </div>
                    <span className="text-xs text-muted-foreground">Cap characters the director stages per turn.</span>
                  </div>
                </div>
                </SubGroup>
              )}
              {/* Native mode passes reasoning_effort straight through; shown only there since the guided modes drive
                  their own thinking. The levels are whichever the active endpoint accepts (detected on connect). */}
              {thinkingMode === 'off' && reasoningUnsupported && (
                <SubGroup>
                <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,3fr)] items-start gap-4">
                  <RowLabel top muted>Native Reasoning</RowLabel>
                  <div className="pt-2">
                    <span className="text-xs text-muted-foreground">This model doesn&apos;t support reasoning, so there&apos;s nothing to configure.</span>
                  </div>
                </div>
                </SubGroup>
              )}
              {thinkingMode === 'off' && !reasoningUnsupported && (() => {
                const reasoningOptions = reasoningTabs(supportedReasoningEfforts);
                return (
                  <SubGroup>
                  <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,3fr)] items-start gap-4">
                    <RowLabel top>Native Reasoning</RowLabel>
                    <div>
                      <OptionSwitcher value={reasoningEffort} onChange={(v) => setReasoningEffort(v as ReasoningEffort)} options={reasoningOptions} />
                      <div className="grid mt-2">
                        {reasoningOptions.map((o) => (
                          <p
                            key={o.value}
                            className={`col-start-1 row-start-1 text-xs text-muted-foreground${o.value === reasoningEffort ? '' : ' invisible'}`}
                          >
                            {REASONING_EFFORT_HELP[o.value]}
                          </p>
                        ))}
                      </div>
                    </div>
                  </div>
                  </SubGroup>
                );
              })()}
              </Section>

              <Section title="Memory" hint="What the AI carries forward from earlier turns.">
              <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,3fr)] items-start gap-4">
                <RowLabel htmlFor="memoryDigests" info={
                  <HintInfo>{`Condenses older turns while keeping recent ones **word-for-word**, so long stories stay coherent without bloating each request.

Runs an extra request per turn; edit its prompt under **Prompts → Summary**.`}</HintInfo>
                }>Memory Summaries</RowLabel>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="memoryDigests"
                    checked={memoryDigests}
                    onCheckedChange={(c) => setMemoryDigests(c === true)}
                    className="shrink-0"
                  />
                  <span className="text-xs text-muted-foreground">Condense older turns so long stories stay coherent.</span>
                </div>
              </div>
              {memoryDigests && (
                <SubGroup>
                <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,3fr)] items-start gap-4">
                  <RowLabel htmlFor="semanticMemory" info={
                    <HintInfo>{`When memories no longer all fit, keeps the ones most **relevant to your current action** instead of just dropping the oldest.

- Runs a small model **on your device**
- One-time **~23 MB** download when enabled
- Nothing about your story leaves your machine`}</HintInfo>
                  }>Semantic Memory</RowLabel>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="semanticMemory"
                      checked={semanticMemory}
                      onCheckedChange={(c) => handleSemanticMemoryToggle(c === true)}
                      className="shrink-0"
                    />
                    <span className="text-xs text-muted-foreground">Experimental. Keep the memories most relevant to your action, not just the newest.</span>
                  </div>
                </div>
                {semanticMemory && (
                  <SubGroup>
                  {/* Always-on top-K cap: derived checkbox (cap > 0), enabling seeds a sensible default. */}
                  <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,3fr)] items-start gap-4">
                    <RowLabel top info={
                      <HintInfo>{`Keeps only this many memories in view each turn — the ones most relevant to your action — even when more would fit.

- Smaller, sharper prompts on long stories
- The story opening and newest memories always stay
- Off carries everything that fits`}</HintInfo>
                    }>Memory Cap</RowLabel>
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={semanticBandCap > 0}
                        onCheckedChange={(v) => setSemanticBandCap(v === true ? 12 : 0)}
                      />
                      <Input
                        type="number"
                        min={3}
                        value={semanticBandCap > 0 ? semanticBandCap : 12}
                        disabled={semanticBandCap === 0}
                        onChange={(e) => setSemanticBandCap(Math.max(3, parseInt(e.target.value) || 3))}
                        className="w-20"
                      />
                    </div>
                    <span className="text-xs text-muted-foreground">Cap how many memories ride along each turn.</span>
                  </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,3fr)] items-start gap-4">
                    <RowLabel htmlFor="semanticRehydration" info={
                      <HintInfo>{`When your action returns to an old moment — going back to someone you made a promise to — the full original scene is recalled for the AI, word for word, clearly marked as the past.

- At most **two scenes** per turn
- Never near-duplicates of each other or of recent turns
- Uses Semantic Memory's model and memories`}</HintInfo>
                    }>Scene Recall</RowLabel>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="semanticRehydration"
                      checked={semanticRehydration}
                      onCheckedChange={(c) => setSemanticRehydration(c === true)}
                      className="shrink-0"
                    />
                    <span className="text-xs text-muted-foreground">Experimental. Recall a full past scene when your action returns to it.</span>
                  </div>
                  </div>
                  </SubGroup>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,3fr)] items-start gap-4">
                  <RowLabel htmlFor="timeContext" info={
                    <HintInfo>{`Each memory carries **when** it happened — *"Day 3, evening — two days ago"* — and the recap states the present moment.

- Without it the AI sees the story as an undated list and guesses at how long ago things were
- Time of day is coarse (*morning*, *evening*), never a clock reading
- Uses the game clock shown in the Log`}</HintInfo>
                  }>Time in Memory</RowLabel>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="timeContext"
                      checked={timeContext}
                      onCheckedChange={(c) => setTimeContext(c === true)}
                      className="shrink-0"
                    />
                    <span className="text-xs text-muted-foreground">Experimental. Tell the AI when each memory happened.</span>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,3fr)] items-start gap-4">
                  <RowLabel htmlFor="aiClock" info={
                    <HintInfo>{`How long each turn takes is measured from what actually happened, instead of the flat **one hour per action** the game charges otherwise.

- A few words spoken cost minutes; a night's rest costs hours; *"three weeks later"* costs three weeks
- Adds one small request per turn, alongside choices and stat updates
- Feeds the Log's clock, stat regeneration, and Time in Memory`}</HintInfo>
                  }>Measured Clock</RowLabel>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="aiClock"
                      checked={aiClock}
                      onCheckedChange={(c) => setAiClock(c === true)}
                      className="shrink-0"
                    />
                    <span className="text-xs text-muted-foreground">Experimental. Measure how long each turn takes instead of assuming an hour.</span>
                  </div>
                </div>
                </SubGroup>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,3fr)] items-start gap-4">
                <RowLabel htmlFor="semanticLore" info={
                  <HintInfo>{`Dictionary entries also activate when your action's **meaning** matches them, even with none of their keywords — "the ruined tower" can wake an *Old Beacon* entry.

- Keyword activation is unchanged; this only **adds** entries
- Uses the same on-device model as Semantic Memory (~23 MB on first enable)`}</HintInfo>
                }>Semantic Lore</RowLabel>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="semanticLore"
                    checked={semanticLore}
                    onCheckedChange={(c) => handleSemanticLoreToggle(c === true)}
                    className="shrink-0"
                  />
                  <span className="text-xs text-muted-foreground">Experimental. Activate dictionary entries by meaning, not just keywords.</span>
                </div>
              </div>
              {embedLoading && (
                <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,3fr)] items-center gap-4">
                  <span />
                  <div className="flex items-center gap-2">
                    <Progress
                      className="h-2 flex-1"
                      value={embedProgress && embedProgress.total > 0 ? (embedProgress.loaded / embedProgress.total) * 100 : 0}
                    />
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {embedProgress && embedProgress.total > 0
                        ? `${Math.round(embedProgress.loaded / 1048576)} / ${Math.round(embedProgress.total / 1048576)} MB`
                        : 'Preparing…'}
                    </span>
                  </div>
                </div>
              )}
              {embedError && !embedLoading && (semanticMemory || semanticLore) && (
                <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,3fr)] items-center gap-4">
                  <span />
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-destructive">Model download failed: {embedError}</span>
                    <Button variant="outline" size="sm" onClick={startEmbeddingDownload}>Retry</Button>
                  </div>
                </div>
              )}
              {/* Descriptions work from the narration alone, so unlike diaries this is offered in every mode. */}
              <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,3fr)] items-start gap-4">
                <RowLabel htmlFor="describeCharacters" info={
                  <HintInfo>{`Characters the story invents already appear in the **Characters** panel on their own. Turn this on and each one also gets a written description, so you can open them like any authored character.

Runs one extra request the first time each new character is named. Remove any you don't want from the **Characters** panel during play.`}</HintInfo>
                }>Describe New Characters</RowLabel>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="describeCharacters"
                    checked={describeCharacters}
                    onCheckedChange={(c) => setDescribeCharacters(c === true)}
                    className="shrink-0"
                  />
                  <span className="text-xs text-muted-foreground">Write a description for each character the story invents.</span>
                </div>
              </div>
              {/* Diaries are only read by the staged character pass, so the option only appears in that mode. */}
              {thinkingMode === 'staged' && (
                <>
                <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,3fr)] items-start gap-4">
                  <RowLabel htmlFor="characterDiaries" info={
                    <HintInfo>{`Each character present in a turn records a **first-person diary entry** as turns age out, and its recent entries feed back into that character's motivation.

Runs an extra request per participant; edit its prompt under **Prompts → Diary**.`}</HintInfo>
                  }>Character Diaries</RowLabel>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="characterDiaries"
                      checked={characterDiaries}
                      onCheckedChange={(c) => setCharacterDiaries(c === true)}
                      className="shrink-0"
                    />
                    <span className="text-xs text-muted-foreground">Characters keep diaries that shape their motivation.</span>
                  </div>
                </div>
                {characterDiaries && semanticMemory && (
                  <SubGroup>
                  <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,3fr)] items-start gap-4">
                    <RowLabel htmlFor="semanticDiaries" info={
                      <HintInfo>{`Instead of only their newest diary entries, characters also recall the older ones most relevant to what you're doing — she remembers the last time you drew a blade.

- Same total entry count, so it costs **nothing extra**
- Uses Semantic Memory's model`}</HintInfo>
                    }>Diary Recall</RowLabel>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="semanticDiaries"
                      checked={semanticDiaries}
                      onCheckedChange={(c) => setSemanticDiaries(c === true)}
                      className="shrink-0"
                    />
                    <span className="text-xs text-muted-foreground">Experimental. Characters also recall older, relevant diary entries.</span>
                  </div>
                  </div>
                  </SubGroup>
                )}
                </>
              )}
              </Section>

              <Section title="Performance">
              <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,3fr)] items-start gap-4">
                <RowLabel htmlFor="concurrentTurnRequests" info={
                  <HintInfo>{`Fetches choices, stat updates, and location changes **at the same time** instead of one after another.

- Faster turns on endpoints that handle parallel requests (e.g. LM Studio's **Parallel** setting)
- Turn off if a memory-tight local model slows down under the load`}</HintInfo>
                }>Concurrent Requests</RowLabel>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="concurrentTurnRequests"
                    checked={concurrentTurnRequests}
                    onCheckedChange={(c) => setConcurrentTurnRequests(c === true)}
                    className="shrink-0"
                  />
                  <span className="text-xs text-muted-foreground">Fetch post-narration requests in parallel.</span>
                </div>
              </div>
              </Section>

              <Section title="Inspection" hint="Surfaces work that normally happens out of sight.">
              <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,3fr)] items-start gap-4">
                <RowLabel htmlFor="showReasoning" info={
                  <HintInfo>{`Shows a reasoning model's (or the Inline mode's) private scratchpad as a collapsible **"Thinking…"** note above each turn's narration.

Captured and saved either way, so turning it on reveals it on past turns too.`}</HintInfo>
                }>Show Reasoning</RowLabel>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="showReasoning"
                    checked={showReasoning}
                    onCheckedChange={(c) => setShowReasoning(c === true)}
                    className="shrink-0"
                  />
                  <span className="text-xs text-muted-foreground">Show the model&apos;s private reasoning above each turn.</span>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,3fr)] items-start gap-4">
                <RowLabel htmlFor="showSilentRequests" info={
                  <HintInfo>{`Surfaces requests that normally run quietly — **memory summaries**, **character diaries**, and new-character notes — in the status bar and the AI context viewer.

An inspection aid for authoring and debugging; off by default.`}</HintInfo>
                }>Show Silent Requests</RowLabel>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="showSilentRequests"
                    checked={showSilentRequests}
                    onCheckedChange={(c) => setShowSilentRequests(c === true)}
                    className="shrink-0"
                  />
                  <span className="text-xs text-muted-foreground">Surface background requests for inspection.</span>
                </div>
              </div>
              </Section>
            </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="endpoints" className="py-4 px-2 flex-1 min-h-0 data-[state=active]:flex flex-col">
            <Tabs value={endpointTab} onValueChange={setEndpointTab} className="flex flex-col flex-1 min-h-0">
              <TabsList className="grid w-full grid-cols-3 flex-shrink-0">
                <TabsTrigger value="text-endpoint">Text</TabsTrigger>
                <TabsTrigger value="img-endpoint">Image</TabsTrigger>
                <TabsTrigger value="img-tagprompt">Tag Prompt</TabsTrigger>
              </TabsList>
              <TabsContent value="text-endpoint" className="flex-1 min-h-0 data-[state=active]:flex flex-col">
            {/* Desktop: a checkbox gates the bundled local engine vs a custom endpoint. Web has no local
                engine, so there's no checkbox — the preset picker's immutable "Default" entry is "our endpoint". */}
            {desktop && (
              <div className="shrink-0 grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,3fr)] sm:items-center gap-4 py-4">
                <RowLabel htmlFor="useCustomEndpoint">Use My Own Endpoint</RowLabel>
                <div className="flex items-center gap-3">
                  <Checkbox
                    id="useCustomEndpoint"
                    checked={useCustomEndpoint}
                    onCheckedChange={(c) => setUseCustomEndpoint(c === true)}
                  />
                  {!useCustomEndpoint && (
                    <span className="text-xs text-muted-foreground">Off: run a model on this PC. On: point at your own API.</span>
                  )}
                </div>
              </div>
            )}

            {/* Desktop + local model: model + runtime settings (with their own pinned footer). Otherwise the
                preset selector + scrollable endpoint fields. */}
            {desktop && !useCustomEndpoint ? (
              <LocalModelPanel />
            ) : (
              <>
              {/* Preset selector: swaps the whole endpoint field set. The immutable "Default" preset (the
                  shared endpoint) is read-only; user presets are freely editable. */}
              <div className="flex items-center gap-2 flex-shrink-0 pt-4">
                <span className="text-sm text-muted-foreground">Preset</span>
                {!activeTextEndpointPresetIsBuiltIn && (
                  <ConfirmDialog
                    title="Delete Preset"
                    description={`Delete the "${activeTextEndpointPresetName}" preset? This can't be undone.`}
                    onConfirm={() => deleteTextEndpointPreset(activeTextEndpointPresetId)}
                  >
                    <Button variant="outline" size="sm">Delete</Button>
                  </ConfirmDialog>
                )}
                {!activeTextEndpointPresetIsBuiltIn && (
                  <ConfirmDialog
                    title="Reset Preset"
                    description={`Reset the "${activeTextEndpointPresetName}" preset to its default values? This can't be undone.`}
                    onConfirm={() => resetTextEndpointPreset(activeTextEndpointPresetId)}
                  >
                    <Button variant="outline" size="sm">Reset</Button>
                  </ConfirmDialog>
                )}
                <Select value={activeTextEndpointPresetId} onValueChange={handleTextPresetSelect}>
                  <SelectTrigger className="flex-1 min-w-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {builtinTextEndpointPresets.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                    {textEndpointPresets.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                    <SelectSeparator />
                    <SelectItem value={TEXT_ADD_PRESET_SENTINEL}>Add New Preset…</SelectItem>
                  </SelectContent>
                </Select>
                {!activeTextEndpointPresetIsBuiltIn && (
                  <Button variant="outline" size="sm" onClick={() => setTextPresetDialog({ mode: 'rename' })}>Rename</Button>
                )}
              </div>
              <ScrollArea className="flex-1 min-h-0">
                <div className="grid gap-4 py-4">
              <Row center label="Endpoint URL" htmlFor="endpointUrl">
                <div className="grid gap-1">
                  <Input
                    id="endpointUrl"
                    value={endpointUrl}
                    onChange={(e) => setEndpointUrl(e.target.value)}
                    readOnly={activeTextEndpointPresetIsBuiltIn}
                    className={activeTextEndpointPresetIsBuiltIn ? 'opacity-60 cursor-not-allowed' : undefined}
                  />
                  {endpointUrlWasCompleted(endpointUrl) && (
                    <p className="text-xs text-muted-foreground">
                      Requests go to <span className="font-mono break-all">{normalizeEndpointUrl(endpointUrl)}</span>
                    </p>
                  )}
                </div>
              </Row>
              <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,3fr)] gap-4">
                <div className="hidden sm:block" />
                <button
                  type="button"
                  className="justify-self-start text-xs text-muted-foreground underline hover:text-foreground"
                  onClick={() => setConnectionGuideOpen(true)}
                >
                  Trouble connecting?
                </button>
              </div>
              <Row center label="API Token" htmlFor="apiToken">
                <Input
                  id="apiToken"
                  type="password"
                  value={apiToken}
                  onChange={(e) => setApiToken(e.target.value)}
                  readOnly={activeTextEndpointPresetIsBuiltIn}
                  className={activeTextEndpointPresetIsBuiltIn ? 'opacity-60 cursor-not-allowed' : undefined}
                />
              </Row>
              <Row center label="Model Name" htmlFor="modelName">
                <Input
                  id="modelName"
                  value={modelName}
                  onChange={(e) => setModelName(e.target.value)}
                  readOnly={activeTextEndpointPresetIsBuiltIn}
                  className={activeTextEndpointPresetIsBuiltIn ? 'opacity-60 cursor-not-allowed' : undefined}
                />
              </Row>
              <Row center label="Context Window (tokens)" htmlFor="contextWindow">
                <div className="flex items-start gap-2">
                  <Input
                    id="contextWindow"
                    type="number"
                    className={activeTextEndpointPresetIsBuiltIn ? 'flex-grow opacity-60 cursor-not-allowed' : 'flex-grow'}
                    value={contextWindow}
                    onChange={(e) => setContextWindowOverride(e.target.value === '' ? null : Number(e.target.value))}
                    readOnly={activeTextEndpointPresetIsBuiltIn}
                  />
                  <Button
                    variant="outline"
                    onClick={() => detectContextWindow(true)}
                    disabled={activeTextEndpointPresetIsBuiltIn || detectStatus === 'detecting'}
                  >
                    Detect
                  </Button>
                </div>
              </Row>
              <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,3fr)] gap-4">
                <div className="hidden sm:block" />
                <div className={contextStatus.red ? 'text-xs text-destructive' : 'text-xs text-muted-foreground'}>
                  {contextStatus.text}
                </div>
              </div>
              <Row center label="Max Output Tokens" htmlFor="maxTokens">
                <Input
                  id="maxTokens"
                  type="number"
                  value={maxTokens}
                  onChange={(e) => setMaxTokens(numInput(e.target.value, 1))}
                  readOnly={activeTextEndpointPresetIsBuiltIn}
                  className={activeTextEndpointPresetIsBuiltIn ? 'opacity-60 cursor-not-allowed' : undefined}
                />
              </Row>
              <div className="flex justify-start">
                <ConfirmDialog
                  title="Reset AI Endpoint"
                  description="Are you sure you want to reset the endpoint URL, model name, API token, and limits to their default values?"
                  onConfirm={handleResetEndpointSettings}
                >
                  <Button variant="outline" className="flex items-center gap-2" disabled={activeTextEndpointPresetIsBuiltIn}>
                    Reset AI Endpoint
                  </Button>
                </ConfirmDialog>
              </div>
                </div>
              </ScrollArea>
              </>
            )}
            <PresetNameDialog
              open={textPresetDialog !== null}
              mode={textPresetDialog?.mode ?? 'add'}
              initialName={textPresetDialog?.mode === 'rename' ? activeTextEndpointPresetName : ''}
              onOpenChange={(o) => { if (!o) setTextPresetDialog(null); }}
              onSubmit={handleTextPresetNameSubmit}
            />
              </TabsContent>
              <TabsContent value="img-endpoint" className="pt-4 flex-1 min-h-0 data-[state=active]:flex flex-col gap-3">
            {/* Preset selector: swaps the whole endpoint field set. Every preset (incl. Default) is editable. */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-sm text-muted-foreground">Preset</span>
              {imageEndpointPresets.length > 1 && (
                <ConfirmDialog
                  title="Delete Preset"
                  description={`Delete the "${activeImageEndpointPresetName}" preset? This can't be undone.`}
                  onConfirm={() => deleteImageEndpointPreset(activeImageEndpointPresetId)}
                >
                  <Button variant="outline" size="sm">Delete</Button>
                </ConfirmDialog>
              )}
              <ConfirmDialog
                title="Reset Preset"
                description={`Reset the "${activeImageEndpointPresetName}" preset to its default values? This can't be undone.`}
                onConfirm={() => resetImageEndpointPreset(activeImageEndpointPresetId)}
              >
                <Button variant="outline" size="sm">Reset</Button>
              </ConfirmDialog>
              <Select value={activeImageEndpointPresetId} onValueChange={handleImagePresetSelect}>
                <SelectTrigger className="flex-1 min-w-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {imageEndpointPresets.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                  <SelectSeparator />
                  <SelectItem value={IMG_ADD_PRESET_SENTINEL}>Add New Preset…</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={() => setImagePresetDialog({ mode: 'rename' })}>Rename</Button>
            </div>
            {/* Global kill switch: hides every "Generate with AI" image button without touching the presets. */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <Checkbox
                id="imageGenDisabled"
                checked={imageGenDisabled}
                onCheckedChange={(c) => setImageGenDisabled(c === true)}
                className="shrink-0"
              />
              <Label htmlFor="imageGenDisabled" className="text-sm font-normal">Disable Image Generation</Label>
              <span className="text-xs text-muted-foreground">Hides the &ldquo;Generate with AI&rdquo; buttons.</span>
            </div>
            <ScrollArea className="flex-1 min-h-0">
            <div className="grid gap-6">
              <Section title="Connection">
              <Row center label="Provider" htmlFor="imageProvider">
                <Select value={imageProvider} onValueChange={(v) => setImageProvider(v as typeof imageProvider)}>
                  <SelectTrigger id="imageProvider">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="comfyui">ComfyUI (local)</SelectItem>
                    <SelectItem value="invokeai">InvokeAI (local)</SelectItem>
                    <SelectItem value="a1111">Automatic1111 / Forge (local)</SelectItem>
                    <SelectItem value="openai" disabled={!desktop}>
                      OpenAI-compatible (cloud){desktop ? '' : ' — desktop app only'}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </Row>
              <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,3fr)] gap-4">
                <div className="hidden sm:block" />
                <div>
                  <Button variant="outline" size="sm" onClick={() => setShowImageSetup(true)}>How to Set Up</Button>
                </div>
              </div>
              <Row center label="Endpoint URL" htmlFor="imageEndpoint">
                <Input
                  id="imageEndpoint"
                  value={imageEndpoint}
                  onChange={(e) => setImageEndpoint(e.target.value)}
                  placeholder={DEFAULT_ENDPOINT_BY_PROVIDER[imageProvider] || 'https://api.openai.com'}
                />
              </Row>
              <Row center label="API Token" htmlFor="imageApiToken">
                <Input id="imageApiToken" type="password" value={imageApiToken} onChange={(e) => setImageApiToken(e.target.value)} />
              </Row>
              <Row center label="Model" htmlFor="imageModel">
                {imageProvider === 'comfyui' ? (
                  <TokenAutocomplete
                    single
                    openOnFocus
                    values={imageModel ? [imageModel] : []}
                    onChange={(v) => setImageModel(v[0] ?? '')}
                    options={comfyMeta?.checkpoints ?? []}
                    placeholder="(server default)"
                  />
                ) : imageProvider === 'invokeai' ? (
                  <div className="grid gap-1.5">
                    <TokenAutocomplete
                      single
                      openOnFocus
                      values={imageModel ? [imageModel] : []}
                      onChange={(v) => setImageModel(v[0] ?? '')}
                      options={(invokeMeta?.models ?? []).map((m) => m.name)}
                      placeholder="Pick an installed model"
                    />
                    {invokeMetaError && (
                      <p className="text-xs text-destructive">{invokeMetaError}</p>
                    )}
                  </div>
                ) : (
                  <Input id="imageModel" value={imageModel} onChange={(e) => setImageModel(e.target.value)} placeholder="(server default)" />
                )}
              </Row>
              </Section>

              <Section title="Image">
              <Row label="Prompt Prefix" htmlFor="imagePositivePrompt" hint="Prepended to every generated prompt (quality/style tags). Leave blank for none.">
                <Textarea id="imagePositivePrompt" rows={3} value={imagePositivePrompt} onChange={(e) => setImagePositivePrompt(e.target.value)} placeholder="e.g. masterpiece, best quality" />
              </Row>
              <Row label="Negative Prompt" htmlFor="imageNegativePrompt">
                <Textarea id="imageNegativePrompt" rows={3} value={imageNegativePrompt} onChange={(e) => setImageNegativePrompt(e.target.value)} />
              </Row>
              <Row center label="Portrait (W × H)">
                <div className="flex items-center gap-2">
                  <Input aria-label="Portrait width" type="number" min={64} step={64} value={imagePortraitWidth} onChange={(e) => setImagePortraitWidth(numInput(e.target.value, 64))} className="w-28" />
                  <span className="text-muted-foreground">×</span>
                  <Input aria-label="Portrait height" type="number" min={64} step={64} value={imagePortraitHeight} onChange={(e) => setImagePortraitHeight(numInput(e.target.value, 64))} className="w-28" />
                  <span className="text-xs text-muted-foreground">entity portraits</span>
                </div>
              </Row>
              <Row center label="Landscape (W × H)">
                <div className="flex items-center gap-2">
                  <Input aria-label="Landscape width" type="number" min={64} step={64} value={imageLandscapeWidth} onChange={(e) => setImageLandscapeWidth(numInput(e.target.value, 64))} className="w-28" />
                  <span className="text-muted-foreground">×</span>
                  <Input aria-label="Landscape height" type="number" min={64} step={64} value={imageLandscapeHeight} onChange={(e) => setImageLandscapeHeight(numInput(e.target.value, 64))} className="w-28" />
                  <span className="text-xs text-muted-foreground">locations &amp; thumbnail</span>
                </div>
              </Row>
              <Row center label="Steps / CFG">
                <div className="flex items-center gap-2">
                  <Input aria-label="Steps" type="number" min={1} value={imageSteps} onChange={(e) => setImageSteps(numInput(e.target.value, 1))} className="w-28" />
                  <Input aria-label="CFG scale" type="number" min={0} step={0.5} value={imageCfg} onChange={(e) => setImageCfg(numInput(e.target.value, 0))} className="w-28" />
                </div>
              </Row>
              <Row center label="Sampler" htmlFor="imageSampler">
                {imageProvider === 'comfyui' ? (
                  <TokenAutocomplete
                    single
                    openOnFocus
                    values={imageSampler ? [imageSampler] : []}
                    onChange={(v) => setImageSampler(v[0] ?? '')}
                    options={comfyMeta?.samplers ?? []}
                    placeholder="euler"
                  />
                ) : (
                  <Input id="imageSampler" value={imageSampler} onChange={(e) => setImageSampler(e.target.value)} placeholder="Euler a" />
                )}
              </Row>
              {(imageProvider === 'a1111' || imageProvider === 'invokeai') && (
                <CheckRow
                  label="Face Fix"
                  htmlFor="imageAdetailer"
                  checked={imageAdetailer}
                  onChange={setImageAdetailer}
                  hint={imageProvider === 'a1111'
                    ? 'Run a second pass to auto-fix faces/hands. Requires the ADetailer extension installed on your A1111/Forge server.'
                    : 'Re-render the face at full resolution in a second pass. Roughly doubles generation time; SDXL and SD1.5 only.'}
                />
              )}
              {imageProvider === 'comfyui' && (
                <Row label="Workflow (API format)" htmlFor="imageWorkflow">
                  <div className="grid gap-1.5">
                    <Textarea
                      id="imageWorkflow"
                      value={imageWorkflow}
                      onChange={(e) => setImageWorkflow(e.target.value)}
                      spellCheck={false}
                      className="min-h-[200px] font-mono text-xs"
                    />
                    <div className="flex gap-2 justify-between">
                      <ConfirmDialog
                        title="Reset Workflow"
                        description="Reset the ComfyUI workflow to the default graph? Your custom workflow will be lost."
                        onConfirm={() => setImageWorkflow(DEFAULT_COMFY_WORKFLOW)}
                      >
                        <Button variant="outline" size="sm" disabled={imageWorkflow === DEFAULT_COMFY_WORKFLOW}>
                          Reset to default
                        </Button>
                      </ConfirmDialog>
                      <Button variant="outline" size="sm" onClick={() => setShowComfyWorkflow(true)}>How to get this</Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Tokens Formamorph fills in:
                      {' '}<code>%prompt%</code> <code>%negative%</code> <code>%ckpt%</code> <code>%width%</code>{' '}
                      <code>%height%</code> <code>%steps%</code> <code>%cfg%</code> <code>%seed%</code> <code>%sampler%</code>.
                    </p>
                  </div>
                </Row>
              )}
              {imageProvider === 'invokeai' && (
                <Row label="Board" htmlFor="imageInvokeBoard" hint="Which InvokeAI gallery board generated images are filed under. Uncategorized is InvokeAI's default.">
                  <Select
                    value={imageInvokeBoard || UNCATEGORIZED_BOARD}
                    onValueChange={(v) => setImageInvokeBoard(v === UNCATEGORIZED_BOARD ? '' : v)}
                  >
                    <SelectTrigger id="imageInvokeBoard"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={UNCATEGORIZED_BOARD}>Uncategorized</SelectItem>
                      {(invokeMeta?.boards ?? []).map((b) => (
                        <SelectItem key={b.board_id} value={b.board_id}>{b.board_name}</SelectItem>
                      ))}
                      {/* A board saved in this preset but missing from the server still needs an item, or
                          Radix would render an empty trigger. Only call it unknown once the list actually
                          arrived — while it's loading or unreachable, the board is probably fine. */}
                      {imageInvokeBoard && !(invokeMeta?.boards ?? []).some((b) => b.board_id === imageInvokeBoard) && (
                        <SelectItem value={imageInvokeBoard}>
                          {invokeMeta ? 'Unknown board (falls back to Uncategorized)' : 'Saved board (list unavailable)'}
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </Row>
              )}
              {/* Z-Image and Anima both load a Qwen3 encoder + VAE alongside the checkpoint; the options
                  are narrowed to the ones that architecture can actually use. */}
              {imageProvider === 'invokeai' && invokeSubmodelBase && (
                <>
                  <Row
                    label="Qwen3 Encoder"
                    htmlFor="imageInvokeEncoder"
                    hint={invokeSubmodelBase === 'anima'
                      ? 'Anima needs a Qwen3 0.6B text encoder. Leave blank to auto-pick.'
                      : 'Z-Image needs a Qwen3 4B text encoder. Leave blank to auto-pick.'}
                  >
                    <TokenAutocomplete
                      single
                      openOnFocus
                      values={imageInvokeEncoder ? [imageInvokeEncoder] : []}
                      onChange={(v) => setImageInvokeEncoder(v[0] ?? '')}
                      options={encodersFor(invokeMeta?.encoders ?? [], invokeSubmodelBase).map((m) => m.name)}
                      placeholder="(auto)"
                    />
                  </Row>
                  <Row
                    label={invokeSubmodelBase === 'anima' ? 'Anima VAE' : 'Z-Image VAE'}
                    htmlFor="imageInvokeVae"
                    hint={invokeSubmodelBase === 'anima'
                      ? 'Anima needs a QwenImage/Wan 2.1 VAE (a FLUX VAE also works). Leave blank to auto-pick.'
                      : 'Z-Image needs a FLUX-type VAE (e.g. FLUX.1-schnell VAE). Leave blank to auto-pick.'}
                  >
                    <TokenAutocomplete
                      single
                      openOnFocus
                      values={imageInvokeVae ? [imageInvokeVae] : []}
                      onChange={(v) => setImageInvokeVae(v[0] ?? '')}
                      options={vaesFor(invokeMeta?.vaes ?? [], invokeSubmodelBase).map((m) => m.name)}
                      placeholder="(auto)"
                    />
                  </Row>
                </>
              )}
              </Section>
            </div>
            </ScrollArea>
              </TabsContent>
              <TabsContent value="img-tagprompt" className="pt-4 flex-1 min-h-0 data-[state=active]:flex flex-col gap-2">
                <p className="text-xs text-muted-foreground flex-shrink-0">
                  The prompt sent to your text model to turn a subject’s description into booru tags. The
                  <span className="mx-1 font-medium">Subject</span>chip expands per kind — character: “{SUBJECT_GUIDANCE.character}”; location: “{SUBJECT_GUIDANCE.location}”; world: “{SUBJECT_GUIDANCE.world}”.
                </p>
                <PromptField value={imageTagPrompt} onChange={setImageTagPrompt} variables={[SUBJECT]} />
                <div className="flex justify-start flex-shrink-0">
                  <ConfirmDialog
                    title="Reset Tag Prompt"
                    description="Reset the image tag prompt to its default? Your edits will be lost."
                    onConfirm={() => setImageTagPrompt(DEFAULT_TAG_PROMPT)}
                  >
                    <Button variant="outline" size="sm" disabled={imageTagPrompt === DEFAULT_TAG_PROMPT}>
                      Reset to default
                    </Button>
                  </ConfirmDialog>
                </div>
              </TabsContent>
            </Tabs>
            <PresetNameDialog
              open={imagePresetDialog !== null}
              mode={imagePresetDialog?.mode ?? 'add'}
              initialName={imagePresetDialog?.mode === 'rename' ? activeImageEndpointPresetName : ''}
              onOpenChange={(o) => { if (!o) setImagePresetDialog(null); }}
              onSubmit={handleImagePresetNameSubmit}
            />
          </TabsContent>

          <TabsContent value="prompts" className="pt-4 px-2 pb-4 flex-1 min-h-0 data-[state=active]:flex flex-col gap-4">
            {/* Preset selector: the whole prompt set switches together. Built-in presets (Default, Simple)
                are read-only and differ only in section-header style. */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-sm text-muted-foreground">Preset</span>
              {!activePresetIsBuiltIn && (
                <ConfirmDialog
                  title="Delete Preset"
                  description={`Delete the "${activePresetName}" preset? This can't be undone.`}
                  onConfirm={() => deletePreset(activePresetId)}
                >
                  <Button variant="outline" size="sm">Delete</Button>
                </ConfirmDialog>
              )}
              {!activePresetIsBuiltIn && (
                <ConfirmDialog
                  title="Reset Preset"
                  description={`Reset every prompt in the "${activePresetName}" preset to its default value? This can't be undone.`}
                  onConfirm={() => resetPreset(activePresetId)}
                >
                  <Button variant="outline" size="sm">Reset</Button>
                </ConfirmDialog>
              )}
              <Select value={activePresetId} onValueChange={handlePresetSelect}>
                <SelectTrigger className="flex-1 min-w-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {builtinPresets.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                  {promptPresets.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                  <SelectSeparator />
                  <SelectItem value={ADD_PRESET_SENTINEL}>Add New Preset…</SelectItem>
                  <SelectItem value={IMPORT_PRESET_SENTINEL}>Import Preset…</SelectItem>
                </SelectContent>
              </Select>
              {!activePresetIsBuiltIn && (
                <Button variant="outline" size="sm" onClick={() => setPresetDialog({ mode: 'rename' })}>Rename</Button>
              )}
              <Button variant="outline" size="sm" onClick={() => setExportShared(exportActivePreset(APP_VERSION))}>Export</Button>
            </div>
            {/* Nested tab bar — one prompt per tab; only the selected prompt shows. */}
            <Tabs value={activePromptTab} onValueChange={selectPromptTab} className="w-full flex flex-col flex-1 min-h-0">
              <TabsList className="flex flex-wrap h-auto justify-center gap-1 flex-shrink-0">
                <TabsTrigger value="narration">Narration</TabsTrigger>
                {thinkingMode === 'precall' && <TabsTrigger value="thinking">Planning</TabsTrigger>}
                {choicesEnabled && <TabsTrigger value="choices">Choices</TabsTrigger>}
                {statUpdatesEnabled && <TabsTrigger value="statupdates">Stat Updates</TabsTrigger>}
                {locationChangeEnabled && <TabsTrigger value="location">Location Change</TabsTrigger>}
                {memoryDigests && <TabsTrigger value="summary">Summary</TabsTrigger>}
                {aiClock && <TabsTrigger value="timepassed">Clock</TabsTrigger>}
                {aiClock && <TabsTrigger value="timeopening">Opening</TabsTrigger>}
                {!imageGenDisabled && <TabsTrigger value="scenetags">Scene Tags</TabsTrigger>}
                {promptAvailable.diary && <TabsTrigger value="diary">Diary</TabsTrigger>}
                {thinkingMode === 'staged' && <TabsTrigger value="director">Director</TabsTrigger>}
                {thinkingMode === 'staged' && <TabsTrigger value="character">Character</TabsTrigger>}
                {thinkingMode === 'staged' && <TabsTrigger value="storyboard">Storyboard</TabsTrigger>}
              </TabsList>

              {/* System prompt · (aux only) user-message template · Options — which part of the selected
                  prompt is on show, kept at text-xs. A second axis over the tab panel above rather than a
                  tab set of its own. User Message shows only when the prompt has a user template. */}
              <div className="flex justify-center mt-3 flex-shrink-0">
                <ToggleGroup
                  type="single"
                  value={promptView}
                  // A single ToggleGroup clears its value when the active item is clicked again; some part of
                  // the prompt is always on show, so an empty result is ignored rather than stored.
                  onValueChange={(v) => { if (v) setPromptView(v as 'system' | 'user' | 'messages' | 'options'); }}
                  className="h-auto"
                >
                  <ToggleGroupItem value="system" className="text-xs">System Prompt</ToggleGroupItem>
                  {activeUserPrompt && <ToggleGroupItem value="user" className="text-xs">User Message</ToggleGroupItem>}
                  {messagesAvailable && <ToggleGroupItem value="messages" className="text-xs">Messages</ToggleGroupItem>}
                  <ToggleGroupItem value="options" className="text-xs">Options</ToggleGroupItem>
                </ToggleGroup>
              </div>

              {showingOptions && (
                <ScrollArea className="mt-4 flex-1 min-h-0">
                  <PromptOptionsPanel
                    verbatim={verbatimApplicable ? activeVerbatimEntry : null}
                    reasoning={reasoningControl}
                    reasoningBudget={reasoningBudgetControl}
                    samplers={samplerControls}
                    disabled={activePresetIsBuiltIn}
                  />
                </ScrollArea>
              )}

              {!showingOptions && (
              <>
              <TabsContent value="narration" className="mt-4 flex-1 min-h-0 data-[state=active]:flex flex-col">
                {showingMessages ? (
                  <ScrollArea className="flex-1 min-h-0">
                    <div className="flex flex-col gap-5 pr-3">
                      {messageFields.map((f) => (
                        <div key={f.key} className="flex flex-col gap-1">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">{f.label}</span>
                            {!activePresetIsBuiltIn && (
                              <ConfirmDialog
                                title={`Reset ${f.label}`}
                                description={`Are you sure you want to reset the ${f.label} to its default value?`}
                                onConfirm={() => f.set(f.def)}
                              >
                                <Button variant="outline" size="sm" disabled={f.value === f.def}>Reset</Button>
                              </ConfirmDialog>
                            )}
                          </div>
                          <PromptField
                            value={f.value}
                            onChange={f.set}
                            variables={f.variables ?? []}
                            previewValues={previewValues}
                            readOnly={activePresetIsBuiltIn}
                          />
                          <p className="text-xs text-muted-foreground">{f.hint}</p>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <PromptField
                    value={showingUser ? narrationUserPrompt : systemPrompt}
                    onChange={showingUser ? setNarrationUserPrompt : setSystemPrompt}
                    variables={showingUser ? (PROMPT_KIND_USER_VARIABLES.narration ?? []) : PROMPT_KIND_VARIABLES.narration}
                    previewValues={previewValues}
                    readOnly={activePresetIsBuiltIn}
                  />
                )}
              </TabsContent>

              {thinkingMode === 'precall' && (
                <TabsContent value="thinking" className="mt-4 flex-1 min-h-0 data-[state=active]:flex flex-col">
                  <PromptField
                    value={thinkingPrompt}
                    onChange={setThinkingPrompt}
                    variables={PROMPT_KIND_VARIABLES.thinking}
                    previewValues={previewValues}
                    readOnly={activePresetIsBuiltIn}
                  />
                </TabsContent>
              )}

              {choicesEnabled && (
                <TabsContent value="choices" className="mt-4 flex-1 min-h-0 data-[state=active]:flex flex-col">
                  <PromptField
                    value={showingUser ? choicesUserPrompt : choicesPrompt}
                    onChange={showingUser ? setChoicesUserPrompt : setChoicesPrompt}
                    variables={showingUser ? (PROMPT_KIND_USER_VARIABLES.choices ?? []) : PROMPT_KIND_VARIABLES.choices}
                    previewValues={previewValues}
                    readOnly={activePresetIsBuiltIn}
                  />
                </TabsContent>
              )}

              {statUpdatesEnabled && (
                <TabsContent value="statupdates" className="mt-4 flex-1 min-h-0 data-[state=active]:flex flex-col">
                  <PromptField
                    value={showingUser ? statUpdatesUserPrompt : statUpdatesPrompt}
                    onChange={showingUser ? setStatUpdatesUserPrompt : setStatUpdatesPrompt}
                    variables={showingUser ? (PROMPT_KIND_USER_VARIABLES.statupdates ?? []) : PROMPT_KIND_VARIABLES.statupdates}
                    previewValues={previewValues}
                    readOnly={activePresetIsBuiltIn}
                  />
                </TabsContent>
              )}

              {locationChangeEnabled && (
                <TabsContent value="location" className="mt-4 flex-1 min-h-0 data-[state=active]:flex flex-col gap-1">
                  <PromptField
                    value={showingUser ? locationChangeUserPrompt : locationChangePromptText}
                    onChange={showingUser ? setLocationChangeUserPrompt : setLocationChangePromptText}
                    variables={showingUser ? (PROMPT_KIND_USER_VARIABLES.location ?? []) : PROMPT_KIND_VARIABLES.location}
                    previewValues={previewValues}
                    readOnly={activePresetIsBuiltIn}
                  />
                  <p className="text-xs text-muted-foreground flex-shrink-0">Lets the AI move the player between locations.</p>
                </TabsContent>
              )}

              {memoryDigests && (
                <TabsContent value="summary" className="mt-4 flex-1 min-h-0 data-[state=active]:flex flex-col gap-1">
                  <PromptField
                    value={showingUser ? summaryUserPrompt : summaryPrompt}
                    onChange={showingUser ? setSummaryUserPrompt : setSummaryPrompt}
                    variables={showingUser ? (PROMPT_KIND_USER_VARIABLES.summary ?? []) : PROMPT_KIND_VARIABLES.summary}
                    previewValues={previewValues}
                    readOnly={activePresetIsBuiltIn}
                  />
                  <p className="text-xs text-muted-foreground flex-shrink-0">Condenses each turn into a short retelling for long-story memory. Only used when Memory Summaries is on.</p>
                </TabsContent>
              )}

              {aiClock && (
                <TabsContent value="timepassed" className="mt-4 flex-1 min-h-0 data-[state=active]:flex flex-col gap-1">
                  <PromptField
                    value={showingUser ? timePassedUserPrompt : timePassedPrompt}
                    onChange={showingUser ? setTimePassedUserPrompt : setTimePassedPrompt}
                    variables={showingUser ? (PROMPT_KIND_USER_VARIABLES.timepassed ?? []) : PROMPT_KIND_VARIABLES.timepassed}
                    previewValues={previewValues}
                    readOnly={activePresetIsBuiltIn}
                  />
                  <p className="text-xs text-muted-foreground flex-shrink-0">Measures how much in-world time each turn takes. Answer with a count and its unit (m, h, d, w). Only used when Measured Clock is on.</p>
                </TabsContent>
              )}

              {aiClock && (
                <TabsContent value="timeopening" className="mt-4 flex-1 min-h-0 data-[state=active]:flex flex-col gap-1">
                  <PromptField
                    value={showingUser ? openingTimeUserPrompt : openingTimePrompt}
                    onChange={showingUser ? setOpeningTimeUserPrompt : setOpeningTimePrompt}
                    variables={showingUser ? (PROMPT_KIND_USER_VARIABLES.timeopening ?? []) : PROMPT_KIND_VARIABLES.timeopening}
                    previewValues={previewValues}
                    readOnly={activePresetIsBuiltIn}
                  />
                  <p className="text-xs text-muted-foreground flex-shrink-0">Reads the opening scene once to work out what time of day the story starts at. Answer with one daypart: night, dawn, morning, midday, afternoon, evening. Only used when Measured Clock is on.</p>
                </TabsContent>
              )}

              {!imageGenDisabled && (
                <TabsContent value="scenetags" className="mt-4 flex-1 min-h-0 data-[state=active]:flex flex-col gap-1">
                  <PromptField
                    value={showingUser ? sceneTagsUserPrompt : sceneTagsPrompt}
                    onChange={showingUser ? setSceneTagsUserPrompt : setSceneTagsPrompt}
                    variables={showingUser ? (PROMPT_KIND_USER_VARIABLES.scenetags ?? []) : PROMPT_KIND_VARIABLES.scenetags}
                    previewValues={previewValues}
                    readOnly={activePresetIsBuiltIn}
                  />
                  <p className="text-xs text-muted-foreground flex-shrink-0">Writes the action tags for a scene image — what the people in frame are doing. Their appearance comes from their own image tags and the background from the location&rsquo;s, so this pass deliberately adds neither.</p>
                </TabsContent>
              )}

              {characterDiaries && (
                <TabsContent value="diary" className="mt-4 flex-1 min-h-0 data-[state=active]:flex flex-col gap-1">
                  <PromptField
                    value={diaryPrompt}
                    onChange={setDiaryPrompt}
                    variables={PROMPT_KIND_VARIABLES.diary}
                    previewValues={previewValues}
                    readOnly={activePresetIsBuiltIn}
                  />
                  <p className="text-xs text-muted-foreground flex-shrink-0">Each participating character records a first-person diary entry per turn. Only used when Character Diaries is on.</p>
                </TabsContent>
              )}

              {thinkingMode === 'staged' && (
                <TabsContent value="director" className="mt-4 flex-1 min-h-0 data-[state=active]:flex flex-col gap-1">
                  <PromptField
                    value={showingUser ? directorUserPrompt : directorPrompt}
                    onChange={showingUser ? setDirectorUserPrompt : setDirectorPrompt}
                    variables={showingUser ? (PROMPT_KIND_USER_VARIABLES.director ?? []) : PROMPT_KIND_VARIABLES.director}
                    previewValues={previewValues}
                    readOnly={activePresetIsBuiltIn}
                  />
                  <p className="text-xs text-muted-foreground flex-shrink-0">Stages each turn: picks the cast and scene. Only used when Thinking is set to Staged.</p>
                </TabsContent>
              )}

              {thinkingMode === 'staged' && (
                <TabsContent value="character" className="mt-4 flex-1 min-h-0 data-[state=active]:flex flex-col gap-1">
                  <PromptField
                    value={characterPrompt}
                    onChange={setCharacterPrompt}
                    variables={PROMPT_KIND_VARIABLES.character}
                    previewValues={previewValues}
                    readOnly={activePresetIsBuiltIn}
                  />
                  <p className="text-xs text-muted-foreground flex-shrink-0">Each cast member states its own motivation in the first person. Only used when Thinking is set to Staged.</p>
                </TabsContent>
              )}

              {thinkingMode === 'staged' && (
                <TabsContent value="storyboard" className="mt-4 flex-1 min-h-0 data-[state=active]:flex flex-col gap-1">
                  <PromptField
                    value={storyboardPrompt}
                    onChange={setStoryboardPrompt}
                    variables={PROMPT_KIND_VARIABLES.storyboard}
                    previewValues={previewValues}
                    readOnly={activePresetIsBuiltIn}
                  />
                  <p className="text-xs text-muted-foreground flex-shrink-0">Reconciles the cast&apos;s intentions into the turn&apos;s beat plan. Only used when Thinking is set to Staged.</p>
                </TabsContent>
              )}
              </>
              )}
            </Tabs>

            {/* Reset targets the on-screen template; hidden on the Options sub-tab (edits no template)
                and the Messages view (per-field resets). */}
            <div className="flex flex-wrap justify-end items-center gap-2 flex-shrink-0">
              {!activePresetIsBuiltIn && !showingOptions && !showingMessages && (
                <ConfirmDialog
                  title={`Reset ${resetTarget.label}`}
                  description={`Are you sure you want to reset the ${resetTarget.label} to its default value?`}
                  onConfirm={resetTarget.reset}
                >
                  <Button variant="outline" className="flex items-center gap-2">
                    Reset {resetTarget.label}
                  </Button>
                </ConfirmDialog>
              )}
            </div>
            <PresetNameDialog
              open={presetDialog !== null}
              mode={presetDialog?.mode ?? 'add'}
              initialName={presetDialog?.mode === 'rename' ? activePresetName : ''}
              onOpenChange={(o) => { if (!o) setPresetDialog(null); }}
              onSubmit={handlePresetNameSubmit}
            />
            <ExportPresetDialog
              open={exportShared !== null}
              onOpenChange={(o) => { if (!o) setExportShared(null); }}
              shared={exportShared}
            />
            <ImportPresetDialog
              open={importOpen}
              onOpenChange={setImportOpen}
              currentAppVersion={APP_VERSION}
              existingUserNames={promptPresets}
              onImport={(imported, opts) => { const id = importPreset(imported, opts); selectPreset(id); }}
            />
          </TabsContent>

          <TabsContent value="accessibility" className="px-2 flex-1 min-h-0 data-[state=active]:flex flex-col">
            <ScrollArea className="flex-1 min-h-0">
            <div className="grid gap-6 py-4">
              <Section title="Reading" hint="Applies to the story text only, not the rest of the app.">
              <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,3fr)] items-start gap-4">
                <RowLabel htmlFor="narrationFont" top info={
                  <HintInfo>{`A separate font for the story text, defaulting to the app font.

Includes faces tuned for **dyslexia**, **low vision**, and reading.`}</HintInfo>
                }>Narration Font</RowLabel>
                <div>
                  <Select value={narrationFont} onValueChange={(v) => setNarrationFont(v as NarrationFont)}>
                    <SelectTrigger id="narrationFont" className="w-56">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {NARRATION_FONT_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value} style={{ fontFamily: o.stack || undefined }}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,3fr)] items-center gap-4">
                <RowLabel>Narration Text Size</RowLabel>
                <div className="flex items-center gap-3">
                  <Slider
                    value={[narrationScale]}
                    min={0.85}
                    max={1.6}
                    step={0.05}
                    onValueChange={(v) => setNarrationScale(v[0])}
                    className="max-w-[220px]"
                  />
                  <span className="text-xs text-muted-foreground tabular-nums w-10 shrink-0">
                    {Math.round(narrationScale * 100)}%
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,3fr)] items-center gap-4">
                <RowLabel>Line Spacing</RowLabel>
                <div className="flex items-center gap-3">
                  <Slider
                    value={[narrationLineHeight]}
                    min={1.2}
                    max={2.2}
                    step={0.05}
                    onValueChange={(v) => setNarrationLineHeight(v[0])}
                    className="max-w-[220px]"
                  />
                  <span className="text-xs text-muted-foreground tabular-nums w-10 shrink-0">
                    {narrationLineHeight.toFixed(2)}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,3fr)] gap-4">
                <div className="hidden sm:block" />
                <div>
                  <ConfirmDialog
                    title="Reset size & spacing"
                    description="Reset the narration text size and line spacing to their defaults?"
                    onConfirm={() => { setNarrationScale(DEFAULT_NARRATION_SCALE); setNarrationLineHeight(DEFAULT_NARRATION_LINE_HEIGHT); }}
                  >
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={narrationScale === DEFAULT_NARRATION_SCALE && narrationLineHeight === DEFAULT_NARRATION_LINE_HEIGHT}
                    >
                      Reset size &amp; spacing
                    </Button>
                  </ConfirmDialog>
                </div>
              </div>
              </Section>

              <Section title="Saves & Worlds">
              <CheckRow
                label="Autosave"
                htmlFor="autosaveEnabled"
                checked={autosaveEnabled}
                onChange={setAutosaveEnabled}
                hint="Automatically saves your game after every turn to a per-world “Autosave” slot, starting once the opening scene finishes. It never touches your manual saves and shows in Load with an “Auto” tag. Turn off to save only manually."
              />
              <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,3fr)] gap-4">
                <div className="hidden sm:block" />
                <div>
                  <ConfirmDialog
                    title="Restore default worlds"
                    description="Bring back the bundled worlds you've deleted (City Rampage, Valentines Survival, Reincarnated Drone)? Worlds you still have are left untouched, and nothing you made or imported is affected."
                    onConfirm={restoreDefaultWorlds}
                  >
                    <Button variant="outline" size="sm" disabled={deletedDefaultCount === 0}>
                      Restore default worlds
                    </Button>
                  </ConfirmDialog>
                  <p className="text-xs text-muted-foreground mt-1">
                    {deletedDefaultCount === 0
                      ? "You haven't deleted any of the bundled worlds."
                      : `Re-creates ${deletedDefaultCount} deleted bundled world${deletedDefaultCount > 1 ? 's' : ''} at their latest version.`}
                  </p>
                </div>
              </div>
              </Section>
            </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
    <ImageSetupGuide provider={imageProvider} open={showImageSetup} onOpenChange={setShowImageSetup} />
    <ComfyWorkflowGuide open={showComfyWorkflow} onOpenChange={setShowComfyWorkflow} />
    <LlmSetupGuide
      open={connectionGuideOpen}
      onOpenChange={setConnectionGuideOpen}
      endpointUrl={useCustomEndpoint ? endpointUrl : DEFAULT_ENDPOINT}
    />
    </>
  );
};
