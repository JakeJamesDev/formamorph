import { useState, useEffect } from 'react';
import { useSettings, type ThinkingMode, type ParagraphLimit } from '@/contexts/SettingsContext';
import { DEFAULT_ENDPOINT, DEFAULT_API_TOKEN, DEFAULT_MODEL_NAME, DEFAULT_MAX_TOKENS, THEME_COLORS, FONT_OPTIONS, NARRATION_FONT_OPTIONS, DEFAULT_NARRATION_SCALE, DEFAULT_NARRATION_LINE_HEIGHT, type ThemeColor, type FontChoice, type NarrationFont } from '@/contexts/settingsDefaults';
import { useTheme } from '../theme-provider';
import { ThemePreviewButton } from '@/components/ThemePreviewDialog';
import { LocalModelPanel } from '@/components/modals/LocalModelPanel';
import { SETTINGS_TABS } from '@/components/modals/settingsTabs';
import { Row, CheckRow } from '@/components/SettingsRows';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RevealAnimationDemoButton } from "@/components/RevealAnimationDemo";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem, SelectSeparator } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import PromptField from '../prompt/PromptField';
import { PROMPT_KIND_VARIABLES, PROMPT_KIND_USER_VARIABLES, SUBJECT } from '@/lib/promptVariables';
import { defaultPromptSampler } from '@/lib/promptSamplers';
import type { AIRequestType } from '@/types';
import { ConfirmDialog } from '../ConfirmDialog';
import { PresetNameDialog } from './PresetNameDialog';
import { defaultSystemPrompt, defaultChoicesPrompt, defaultStatUpdatesPrompt, defaultLocationChangePrompt, defaultThinkingPrompt, defaultSummaryPrompt, defaultChoicesUserPrompt, defaultStatUpdatesUserPrompt, defaultLocationChangeUserPrompt, defaultSummaryUserPrompt, defaultDiaryPrompt, defaultDirectorPrompt, defaultDirectorUserPrompt, defaultCharacterPrompt, defaultStoryboardPrompt } from '../game/GamePrompts';
import { isDesktop } from '@/lib/imageGen/desktop';
import { fetchComfyMeta, DEFAULT_COMFY_WORKFLOW, type ComfyMeta } from '@/lib/imageGen/comfyui';
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
  { value: 'off', label: 'Off', help: 'Fastest. The model responds immediately, with no planning step.' },
  { value: 'inline', label: 'Inline', help: 'The model reasons privately before narrating, in the same request. One fewer round-trip.' },
  { value: 'precall', label: 'Planning', help: 'Recommended. A separate request is sent to plan narration before writing it. Most reliable for small models.' },
  { value: 'staged', label: 'Staged', help: 'Highest quality, slowest. A director picks the cast, each character plans its motivation, and a storyboarder writes the plan — several extra requests per turn.' },
];

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
  character: 'character', storyboard: 'storyboard',
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

/** The per-prompt Options sub-tab: the verbatim-turns control (only when digests are on and the prompt uses
 *  them) plus one override row per tunable sampler (temperature, repetition penalty). `disabled` locks every
 *  control when the active prompt preset is built-in (Default/Simple), matching the read-only prompt editor. */
function PromptOptionsPanel({ verbatim, samplers, disabled }: {
  verbatim: { value: number; set: (n: number) => void } | null;
  samplers: SamplerControlProps[];
  disabled: boolean;
}) {
  return (
    // px-3 keeps the slider thumb off the scroll frame's edges (the thumb overflows the track ends at 0/max).
    <div className="space-y-5 px-3 py-3">
      {verbatim && <VerbatimTurnsField id="promptVerbatim" value={verbatim.value} onChange={verbatim.set} disabled={disabled} />}
      {samplers.map((s) => <SamplerControl key={s.id} {...s} disabled={disabled} />)}
    </div>
  );
}

export const SettingsModal = ({ isOpen, onOpenChange, previewValues, initialTab, initialPromptTab }: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  /** Live variable values for the prompt-editor Preview tab. Supplied only in-game; absent → no Preview. */
  previewValues?: Record<string, string>;
  /** DEV dev-router: open on this top-level tab instead of the default (see `devRouter.ts`). */
  initialTab?: string;
  /** DEV dev-router: which prompt under the Prompts tab to open (e.g. 'narration', 'thinking'). */
  initialPromptTab?: string;
}) => {
  const [activeTab, setActiveTab] = useState<string>(initialTab ?? SETTINGS_TABS[0].value);
  // Honor a later dev-router tab change while the modal stays open (a fresh __fmDev.goto).
  useEffect(() => { if (initialTab) setActiveTab(initialTab); }, [initialTab]);
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
    choicesUserPrompt,
    setChoicesUserPrompt,
    statUpdatesUserPrompt,
    setStatUpdatesUserPrompt,
    locationChangeUserPrompt,
    setLocationChangeUserPrompt,
    summaryUserPrompt,
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
    memoryDigests,
    setMemoryDigests,
    characterDiaries,
    setCharacterDiaries,
    genTemperature,
    genRepetitionPenalty,
    localModelActive,
    promptSamplers,
    setPromptSamplerCustom,
    setPromptSamplerValue,
    showSilentRequests,
    setShowSilentRequests,
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
  const contextStatus = !useCustomEndpoint
    ? { red: false, text: 'Using the default endpoint — enable Use Custom Endpoint to set or detect the context window.' }
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
  const activePresetName = [...builtinPresets, ...promptPresets].find((p) => p.id === activePresetId)?.name ?? '';
  const handlePresetSelect = (v: string) => {
    if (v === ADD_PRESET_SENTINEL) setPresetDialog({ mode: 'add' });
    else selectPreset(v);
  };
  const handlePresetNameSubmit = (name: string) => {
    if (presetDialog?.mode === 'add') addPreset(name);
    else if (presetDialog?.mode === 'rename') renamePreset(activePresetId, name);
  };

  // Image Gen → Endpoint preset name dialog (mirrors the prompt preset one; all presets editable).
  const [imagePresetDialog, setImagePresetDialog] = useState<{ mode: 'add' | 'rename' } | null>(null);
  const IMG_ADD_PRESET_SENTINEL = '__add_image_preset__';

  // ComfyUI checkpoint/sampler lists that back the Model/Sampler autocompletes. Auto-fetched from
  // /object_info whenever ComfyUI is the active provider (debounced on endpoint edits); fails silently
  // when the server isn't up (it's fast and optional — free text still works).
  const [comfyMeta, setComfyMeta] = useState<ComfyMeta | null>(null);
  const [showImageSetup, setShowImageSetup] = useState(false);
  const [showComfyWorkflow, setShowComfyWorkflow] = useState(false);
  useEffect(() => {
    if (imageProvider !== 'comfyui') return;
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
  }, [imageProvider, imageEndpoint, imageApiToken]);
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
    diary: { label: 'Diary', reset: () => setDiaryPrompt(defaultDiaryPrompt) },
    director: { label: 'Director', reset: () => setDirectorPrompt(defaultDirectorPrompt) },
    character: { label: 'Character', reset: () => setCharacterPrompt(defaultCharacterPrompt) },
    storyboard: { label: 'Storyboard', reset: () => setStoryboardPrompt(defaultStoryboardPrompt) },
  };
  // Each prompt tab only exists while its prompt is enabled (toggled in Generation → System Prompts, or
  // its governing setting for Thinking/Summary). If the open tab is no longer available (disabled since,
  // or on reopen), fall back to Narration so the panel isn't blank.
  const promptAvailable: Record<string, boolean> = {
    narration: true,
    thinking: thinkingMode === 'precall',
    choices: choicesEnabled,
    statupdates: statUpdatesEnabled,
    location: locationChangeEnabled,
    summary: memoryDigests,
    diary: characterDiaries,
    director: thinkingMode === 'staged',
    character: thinkingMode === 'staged',
    storyboard: thinkingMode === 'staged',
  };
  const activePromptTab = promptAvailable[promptTab] ? promptTab : 'narration';
  const selectedPrompt = promptResets[activePromptTab] ?? promptResets.narration;

  // Each prompt has a System editor, an Options sub-tab, and — for the aux prompts — a User-message editor.
  // A System | User | Options toggle swaps between them (User only where a user template exists). `promptView`
  // resets to System on every tab change.
  const [promptView, setPromptView] = useState<'system' | 'user' | 'options'>('system');
  const selectPromptTab = (t: string) => { setPromptTab(t); setPromptView('system'); };
  const userPrompts: Record<string, { value: string; set: (s: string) => void; reset: () => void; variables: typeof PROMPT_KIND_VARIABLES.choices }> = {
    choices: { value: choicesUserPrompt, set: setChoicesUserPrompt, reset: () => setChoicesUserPrompt(defaultChoicesUserPrompt), variables: PROMPT_KIND_USER_VARIABLES.choices ?? [] },
    statupdates: { value: statUpdatesUserPrompt, set: setStatUpdatesUserPrompt, reset: () => setStatUpdatesUserPrompt(defaultStatUpdatesUserPrompt), variables: PROMPT_KIND_USER_VARIABLES.statupdates ?? [] },
    location: { value: locationChangeUserPrompt, set: setLocationChangeUserPrompt, reset: () => setLocationChangeUserPrompt(defaultLocationChangeUserPrompt), variables: PROMPT_KIND_USER_VARIABLES.location ?? [] },
    summary: { value: summaryUserPrompt, set: setSummaryUserPrompt, reset: () => setSummaryUserPrompt(defaultSummaryUserPrompt), variables: PROMPT_KIND_USER_VARIABLES.summary ?? [] },
    director: { value: directorUserPrompt, set: setDirectorUserPrompt, reset: () => setDirectorUserPrompt(defaultDirectorUserPrompt), variables: PROMPT_KIND_USER_VARIABLES.director ?? [] },
  };
  const activeUserPrompt = userPrompts[activePromptTab];
  const showingUser = promptView === 'user' && !!activeUserPrompt;
  const showingOptions = promptView === 'options';
  // The Reset button targets whichever template is on screen. `label` is the full noun ("Narration Prompt"
  // or just "Message" for the user-message template), so the button reads "Reset <label>".
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

  return (
    <>
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex flex-col flex-1 min-h-0">
          <TabsList className="grid w-full grid-cols-6 flex-shrink-0">
            {SETTINGS_TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="presentation" className="py-4 px-2 flex-1 min-h-0 overflow-y-auto">
            <div className="grid gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-4 items-start gap-4">
                <label className="text-left sm:text-right pt-2">Theme</label>
                <div className="col-span-3">
                  <Tabs value={theme} onValueChange={(v) => setTheme(v as 'light' | 'dark' | 'system')}>
                    <TabsList className="grid w-full grid-cols-3">
                      {THEME_OPTIONS.map((o) => (
                        <TabsTrigger key={o.value} value={o.value}>{o.label}</TabsTrigger>
                      ))}
                    </TabsList>
                  </Tabs>
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
              <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-4">
                <label htmlFor="themeColor" className="text-left sm:text-right leading-4">
                  Theme Color
                </label>
                <div className="col-span-3 flex items-center gap-3">
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
                  <span className="text-xs text-muted-foreground">
                    Recolors the whole app; applies to both light and dark.
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-4">
                <label htmlFor="fontFamily" className="text-left sm:text-right leading-4">
                  Font
                </label>
                <div className="col-span-3 flex items-center gap-3">
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
                  <span className="text-xs text-muted-foreground">
                    The typeface for the whole app.
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-4">
                <span className="text-left sm:text-right leading-4">Narration Reveal</span>
                <div className="col-span-3 flex items-center gap-2">
                  <RevealAnimationDemoButton />
                  <span className="text-xs text-muted-foreground">How each sentence appears as it streams.</span>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 items-start gap-4">
                <label className="text-left sm:text-right pt-2">
                  AI Language
                </label>
                <div className="col-span-3">
                  <TokenAutocomplete
                    single
                    openOnFocus
                    values={language ? [language] : []}
                    onChange={(vals) => setLanguage(vals[0] ?? '')}
                    options={COMMON_LANGUAGES}
                    placeholder="Language or style…"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    The language the AI writes narration and choices in. Pick a suggestion or type your own — even a style, like formal English or pirate speak.
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-4">
                <label htmlFor="bgmEnabled" className="text-left sm:text-right leading-4">
                  Background Music
                </label>
                <div className="col-span-3 flex items-center">
                  <Checkbox
                    id="bgmEnabled"
                    checked={bgmEnabled}
                    onCheckedChange={(c) => setBgmEnabled(c === true)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-4">
                <label htmlFor="locationBackground" className="text-left sm:text-right leading-4">
                  Location Background
                </label>
                <div className="col-span-3 flex items-center gap-3">
                  <Checkbox
                    id="locationBackground"
                    checked={locationBackground}
                    onCheckedChange={(c) => setLocationBackground(c === true)}
                  />
                  <span className="text-xs text-muted-foreground">
                    Show the location image behind the game. Off uses a blank themed background.
                  </span>
                </div>
              </div>
              {locationBackground && (
                <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-4">
                  <label className="text-left sm:text-right leading-4">Background Fade</label>
                  <div className="col-span-3 flex items-center gap-3">
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
                  <p className="text-xs text-muted-foreground sm:col-start-2 sm:col-span-3">
                    Fades the location image toward the background color for readability. 0% shows the full image.
                  </p>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-4 items-start gap-4">
                <label className="text-left sm:text-right pt-2">Paragraph Limit</label>
                <div className="col-span-3">
                  <Tabs value={paragraphLimit} onValueChange={(v) => setParagraphLimit(v as ParagraphLimit)}>
                    <TabsList className="grid w-full grid-cols-3">
                      {PARAGRAPH_LIMIT_OPTIONS.map((o) => (
                        <TabsTrigger key={o.value} value={o.value}>{o.label}</TabsTrigger>
                      ))}
                    </TabsList>
                  </Tabs>
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
              <div className="grid grid-cols-1 sm:grid-cols-4 items-start gap-4">
                <label htmlFor="markdownOutput" className="text-left sm:text-right leading-4">
                  Markdown Formatting
                </label>
                <div className="col-span-3 flex items-start gap-2">
                  <Checkbox
                    id="markdownOutput"
                    checked={markdownOutput}
                    onCheckedChange={(c) => setMarkdownOutput(c === true)}
                    className="shrink-0"
                  />
                  <span className="text-xs text-muted-foreground">
                    Let the AI format narration with bold/italics, lists, and tables. Works best with Paragraph Limit not set to Single.
                  </span>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="generation" className="py-4 px-2 flex-1 min-h-0 overflow-y-auto">
            <div className="grid gap-4">
              {/* Enable/disable the optional per-turn requests. Synced with the System Prompts tab, which
                  shows a prompt's editor tab only while it's enabled here. */}
              <div className="grid grid-cols-1 sm:grid-cols-4 items-start gap-4">
                <label className="text-left sm:text-right leading-4">System Prompts</label>
                <div className="col-span-3 flex flex-wrap gap-x-4 gap-y-2">
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
              {/* Auto-apply detected location changes — its own row, only shown while Location Change is on. */}
              {locationChangeEnabled && (
                <div className="grid grid-cols-1 sm:grid-cols-4 items-start gap-4">
                  <label htmlFor="locationAutoApply" className="text-left sm:text-right leading-4">Move Automatically</label>
                  <div className="col-span-3 flex items-start gap-2">
                    <Checkbox
                      id="locationAutoApply"
                      checked={locationAutoApply}
                      onCheckedChange={(c) => setLocationAutoApply(c === true)}
                      className="shrink-0"
                    />
                    <span className="text-xs text-muted-foreground">
                      Decides the move from your action before the scene is written, so it’s narrated in the new location — skipping the “Move to…?” confirmation.
                    </span>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-4 items-start gap-4">
                <label className="text-left sm:text-right pt-2">Thinking</label>
                <div className="col-span-3">
                  <Tabs value={thinkingMode} onValueChange={(v) => setThinkingMode(v as ThinkingMode)}>
                    <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
                      {THINKING_OPTIONS.map((o) => (
                        <TabsTrigger key={o.value} value={o.value}>{o.label}</TabsTrigger>
                      ))}
                    </TabsList>
                  </Tabs>
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
              <div className="grid grid-cols-1 sm:grid-cols-4 items-start gap-4">
                <label htmlFor="memoryDigests" className="text-left sm:text-right leading-4">
                  Memory Summaries
                </label>
                <div className="col-span-3 flex items-start gap-2">
                  <Checkbox
                    id="memoryDigests"
                    checked={memoryDigests}
                    onCheckedChange={(c) => setMemoryDigests(c === true)}
                    className="shrink-0"
                  />
                  <span className="text-xs text-muted-foreground">
                    Condenses older turns while keeping recent ones word-for-word, so long stories stay coherent without bloating each request. Runs an extra request per turn; edit its prompt under Prompts → Summary.
                  </span>
                </div>
              </div>
              {/* Diaries are only read by the staged character pass, so the option only appears in that mode. */}
              {thinkingMode === 'staged' && (
                <div className="grid grid-cols-1 sm:grid-cols-4 items-start gap-4">
                  <label htmlFor="characterDiaries" className="text-left sm:text-right leading-4">
                    Character Diaries
                  </label>
                  <div className="col-span-3 flex items-start gap-2">
                    <Checkbox
                      id="characterDiaries"
                      checked={characterDiaries}
                      onCheckedChange={(c) => setCharacterDiaries(c === true)}
                      className="shrink-0"
                    />
                    <span className="text-xs text-muted-foreground">
                      Each character present in a turn records a first-person diary entry as turns age out, and its recent entries feed back into that character&apos;s motivation. Runs an extra request per participant; edit its prompt under Prompts → Diary.
                    </span>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-4 items-start gap-4">
                <label htmlFor="showSilentRequests" className="text-left sm:text-right leading-4">
                  Show Silent Requests
                </label>
                <div className="col-span-3 flex items-start gap-2">
                  <Checkbox
                    id="showSilentRequests"
                    checked={showSilentRequests}
                    onCheckedChange={(c) => setShowSilentRequests(c === true)}
                    className="shrink-0"
                  />
                  <span className="text-xs text-muted-foreground">
                    Surfaces requests that normally run quietly — memory summaries, character diaries, and new-character notes — in the status bar and the AI context viewer. An inspection aid for authoring and debugging; off by default.
                  </span>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="endpoint" className="px-2 flex-1 min-h-0 data-[state=active]:flex flex-col">
            {/* Toggle — a fixed header above the scrolling settings. */}
            <div className="shrink-0 grid grid-cols-[1fr_3fr] items-center gap-4 py-4">
              <label htmlFor="useCustomEndpoint" className="text-right">
                {desktop ? 'Use My Own Endpoint' : 'Use Custom Endpoint'}
              </label>
              <div className="flex items-center gap-3">
                <Checkbox
                  id="useCustomEndpoint"
                  checked={useCustomEndpoint}
                  onCheckedChange={(c) => setUseCustomEndpoint(c === true)}
                />
                {desktop && !useCustomEndpoint && (
                  <span className="text-xs text-muted-foreground">Off: run a model on this PC. On: point at your own API.</span>
                )}
              </div>
            </div>

            {/* Desktop + local model: model + runtime settings (with their own pinned footer). Otherwise the
                scrollable endpoint fields. */}
            {desktop && !useCustomEndpoint ? (
              <LocalModelPanel />
            ) : (
              <div className="flex-1 min-h-0 overflow-y-auto pb-4">
                <div className="grid gap-4">
              <Row center label="Endpoint URL" htmlFor="endpointUrl">
                <Input
                  id="endpointUrl"
                  value={useCustomEndpoint ? endpointUrl : DEFAULT_ENDPOINT}
                  onChange={(e) => setEndpointUrl(e.target.value)}
                  readOnly={!useCustomEndpoint}
                  className={useCustomEndpoint ? undefined : 'opacity-60 cursor-not-allowed'}
                />
              </Row>
              <Row center label="API Token" htmlFor="apiToken">
                <Input
                  id="apiToken"
                  type="password"
                  value={useCustomEndpoint ? apiToken : DEFAULT_API_TOKEN}
                  onChange={(e) => setApiToken(e.target.value)}
                  readOnly={!useCustomEndpoint}
                  className={useCustomEndpoint ? undefined : 'opacity-60 cursor-not-allowed'}
                />
              </Row>
              <Row center label="Model Name" htmlFor="modelName">
                <Input
                  id="modelName"
                  value={useCustomEndpoint ? modelName : DEFAULT_MODEL_NAME}
                  onChange={(e) => setModelName(e.target.value)}
                  readOnly={!useCustomEndpoint}
                  className={useCustomEndpoint ? undefined : 'opacity-60 cursor-not-allowed'}
                />
              </Row>
              <Row center label="Context Window (tokens)" htmlFor="contextWindow">
                <div className="flex items-start gap-2">
                  <Input
                    id="contextWindow"
                    type="number"
                    className={useCustomEndpoint ? 'flex-grow' : 'flex-grow opacity-60 cursor-not-allowed'}
                    value={contextWindow}
                    onChange={(e) => setContextWindowOverride(e.target.value === '' ? null : Number(e.target.value))}
                    readOnly={!useCustomEndpoint}
                  />
                  <Button
                    variant="outline"
                    onClick={() => detectContextWindow(true)}
                    disabled={!useCustomEndpoint || detectStatus === 'detecting'}
                  >
                    Detect
                  </Button>
                </div>
              </Row>
              <div className="grid grid-cols-[1fr_3fr] gap-4">
                <div />
                <div className={contextStatus.red ? 'text-xs text-destructive' : 'text-xs text-muted-foreground'}>
                  {contextStatus.text}
                </div>
              </div>
              <Row center label="Max Output Tokens" htmlFor="maxTokens">
                <Input
                  id="maxTokens"
                  type="number"
                  value={useCustomEndpoint ? maxTokens : DEFAULT_MAX_TOKENS}
                  onChange={(e) => setMaxTokens(Number(e.target.value))}
                  readOnly={!useCustomEndpoint}
                  className={useCustomEndpoint ? undefined : 'opacity-60 cursor-not-allowed'}
                />
              </Row>
              <div className="flex justify-start">
                <ConfirmDialog
                  title="Reset AI Endpoint"
                  description="Are you sure you want to reset the endpoint URL, model name, API token, and limits to their default values?"
                  onConfirm={handleResetEndpointSettings}
                >
                  <Button variant="outline" className="flex items-center gap-2" disabled={!useCustomEndpoint}>
                    Reset AI Endpoint
                  </Button>
                </ConfirmDialog>
              </div>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="image" className="py-4 px-2 flex-1 min-h-0 data-[state=active]:flex flex-col">
            <Tabs defaultValue="img-endpoint" className="flex flex-col flex-1 min-h-0">
              <TabsList className="grid w-full grid-cols-2 flex-shrink-0">
                <TabsTrigger value="img-endpoint">Endpoint</TabsTrigger>
                <TabsTrigger value="img-tagprompt">Tag Prompt</TabsTrigger>
              </TabsList>
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
            <div className="flex-1 min-h-0 overflow-y-auto">
            <div className="grid gap-4">
              <Row center label="Provider" htmlFor="imageProvider">
                <Select value={imageProvider} onValueChange={(v) => setImageProvider(v as typeof imageProvider)}>
                  <SelectTrigger id="imageProvider">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="a1111">Automatic1111 / Forge (local)</SelectItem>
                    <SelectItem value="comfyui">ComfyUI (local)</SelectItem>
                    <SelectItem value="openai" disabled={!desktop}>
                      OpenAI-compatible (cloud){desktop ? '' : ' — desktop app only'}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </Row>
              <div className="grid grid-cols-[1fr_3fr] gap-4">
                <div />
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
                ) : (
                  <Input id="imageModel" value={imageModel} onChange={(e) => setImageModel(e.target.value)} placeholder="(server default)" />
                )}
              </Row>
              <Row label="Prompt Prefix" htmlFor="imagePositivePrompt" hint="Prepended to every generated prompt (quality/style tags). Leave blank for none.">
                <Input id="imagePositivePrompt" value={imagePositivePrompt} onChange={(e) => setImagePositivePrompt(e.target.value)} placeholder="e.g. masterpiece, best quality" />
              </Row>
              <Row label="Negative Prompt" htmlFor="imageNegativePrompt">
                <Input id="imageNegativePrompt" value={imageNegativePrompt} onChange={(e) => setImageNegativePrompt(e.target.value)} />
              </Row>
              <Row center label="Portrait (W × H)">
                <div className="flex items-center gap-2">
                  <Input aria-label="Portrait width" type="number" min={64} step={64} value={imagePortraitWidth} onChange={(e) => setImagePortraitWidth(Number(e.target.value))} className="w-28" />
                  <span className="text-muted-foreground">×</span>
                  <Input aria-label="Portrait height" type="number" min={64} step={64} value={imagePortraitHeight} onChange={(e) => setImagePortraitHeight(Number(e.target.value))} className="w-28" />
                  <span className="text-xs text-muted-foreground">entity portraits</span>
                </div>
              </Row>
              <Row center label="Landscape (W × H)">
                <div className="flex items-center gap-2">
                  <Input aria-label="Landscape width" type="number" min={64} step={64} value={imageLandscapeWidth} onChange={(e) => setImageLandscapeWidth(Number(e.target.value))} className="w-28" />
                  <span className="text-muted-foreground">×</span>
                  <Input aria-label="Landscape height" type="number" min={64} step={64} value={imageLandscapeHeight} onChange={(e) => setImageLandscapeHeight(Number(e.target.value))} className="w-28" />
                  <span className="text-xs text-muted-foreground">locations &amp; thumbnail</span>
                </div>
              </Row>
              <Row center label="Steps / CFG">
                <div className="flex items-center gap-2">
                  <Input aria-label="Steps" type="number" min={1} value={imageSteps} onChange={(e) => setImageSteps(Number(e.target.value))} className="w-28" />
                  <Input aria-label="CFG scale" type="number" min={0} step={0.5} value={imageCfg} onChange={(e) => setImageCfg(Number(e.target.value))} className="w-28" />
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
              {imageProvider === 'a1111' && (
                <CheckRow
                  label="ADetailer"
                  htmlFor="imageAdetailer"
                  checked={imageAdetailer}
                  onChange={setImageAdetailer}
                  hint="Run a second pass to auto-fix faces/hands. Requires the ADetailer extension installed on your A1111/Forge server."
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
            </div>
            </div>
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
                </SelectContent>
              </Select>
              {!activePresetIsBuiltIn && (
                <Button variant="outline" size="sm" onClick={() => setPresetDialog({ mode: 'rename' })}>Rename</Button>
              )}
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
                {characterDiaries && <TabsTrigger value="diary">Diary</TabsTrigger>}
                {thinkingMode === 'staged' && <TabsTrigger value="director">Director</TabsTrigger>}
                {thinkingMode === 'staged' && <TabsTrigger value="character">Character</TabsTrigger>}
                {thinkingMode === 'staged' && <TabsTrigger value="storyboard">Storyboard</TabsTrigger>}
              </TabsList>

              {/* System prompt · (aux only) user-message template · Options — a tab bar like the row above,
                  kept at text-xs. User Message shows only when the prompt has a user template. */}
              <Tabs
                value={promptView}
                onValueChange={(v) => setPromptView(v as 'system' | 'user' | 'options')}
                className="flex justify-center mt-3 flex-shrink-0"
              >
                <TabsList className="h-auto">
                  <TabsTrigger value="system" className="text-xs">System Prompt</TabsTrigger>
                  {activeUserPrompt && <TabsTrigger value="user" className="text-xs">User Message</TabsTrigger>}
                  <TabsTrigger value="options" className="text-xs">Options</TabsTrigger>
                </TabsList>
              </Tabs>

              {showingOptions && (
                <div className="mt-4 flex-1 min-h-0 overflow-y-auto">
                  <PromptOptionsPanel
                    verbatim={verbatimApplicable ? activeVerbatimEntry : null}
                    samplers={samplerControls}
                    disabled={activePresetIsBuiltIn}
                  />
                </div>
              )}

              {!showingOptions && (
              <>
              <TabsContent value="narration" className="mt-4 flex-1 min-h-0 data-[state=active]:flex flex-col">
                <PromptField
                  value={systemPrompt}
                  onChange={setSystemPrompt}
                  variables={PROMPT_KIND_VARIABLES.narration}
                  previewValues={previewValues}
                  readOnly={activePresetIsBuiltIn}
                />
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

            {/* Reset targets the on-screen template; hidden on the Options sub-tab, which edits no template. */}
            <div className="flex flex-wrap justify-end items-center gap-2 flex-shrink-0">
              {!activePresetIsBuiltIn && !showingOptions && (
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
          </TabsContent>

          <TabsContent value="accessibility" className="py-4 px-2 flex-1 min-h-0 overflow-y-auto">
            <div className="grid gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-4 items-start gap-4">
                <label htmlFor="narrationFont" className="text-left sm:text-right pt-2">
                  Narration Font
                </label>
                <div className="col-span-3">
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
                  <p className="text-xs text-muted-foreground mt-1">
                    A separate font for the story text. Includes fonts tuned for dyslexia, low vision, and reading. Defaults to the app font.
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-4">
                <label className="text-left sm:text-right leading-4">Narration Text Size</label>
                <div className="col-span-3 flex items-center gap-3">
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
              <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-4">
                <label className="text-left sm:text-right leading-4">Line Spacing</label>
                <div className="col-span-3 flex items-center gap-3">
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
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="hidden sm:block" />
                <div className="col-span-3">
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
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
    <ImageSetupGuide provider={imageProvider} open={showImageSetup} onOpenChange={setShowImageSetup} />
    <ComfyWorkflowGuide open={showComfyWorkflow} onOpenChange={setShowComfyWorkflow} />
    </>
  );
};
