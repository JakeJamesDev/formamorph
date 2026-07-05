import { useState, useEffect } from 'react';
import { useSettings, type ThinkingMode, type ParagraphLimit } from '@/contexts/SettingsContext';
import { DEFAULT_ENDPOINT, DEFAULT_API_TOKEN, DEFAULT_MODEL_NAME, DEFAULT_MAX_TOKENS, DEFAULT_ACCENT_COLOR } from '@/contexts/settingsDefaults';
import { useTheme } from '../theme-provider';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem, SelectSeparator } from "@/components/ui/select";
import PromptField from '../prompt/PromptField';
import { PROMPT_KIND_VARIABLES, PROMPT_KIND_USER_VARIABLES, SUBJECT } from '@/lib/promptVariables';
import { ConfirmDialog } from '../ConfirmDialog';
import { PresetNameDialog } from './PresetNameDialog';
import { defaultSystemPrompt, defaultChoicesPrompt, defaultStatUpdatesPrompt, defaultLocationChangePrompt, defaultThinkingPrompt, defaultSummaryPrompt, defaultChoicesUserPrompt, defaultStatUpdatesUserPrompt, defaultLocationChangeUserPrompt, defaultSummaryUserPrompt, defaultDiaryPrompt, defaultDirectorPrompt, defaultDirectorUserPrompt, defaultCharacterPrompt, defaultStoryboardPrompt } from '../game/GamePrompts';
import VramReadout from '../game/VramReadout';
import { useVramStats } from '@/lib/useVramStats';
import { isDesktop } from '@/lib/imageGen/desktop';
import { fetchComfyMeta, DEFAULT_COMFY_WORKFLOW, type ComfyMeta } from '@/lib/imageGen/comfyui';
import { DEFAULT_ENDPOINT_BY_PROVIDER, resolveImageEndpoint } from '@/lib/imageGen';
import { TokenAutocomplete } from '@/components/TokenAutocomplete';
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
function VerbatimTurnsField({ id, value, onChange }: { id: string; value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center gap-2 flex-shrink-0">
      <label htmlFor={id} className="text-sm">Verbatim turns</label>
      <Input
        id={id}
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(Math.max(0, Math.floor(Number(e.target.value)) || 0))}
        className="w-20"
      />
      <span className="hidden sm:inline text-xs text-muted-foreground">recent turns kept in full before older ones are summarized</span>
    </div>
  );
}

export const SettingsModal = ({ isOpen, onOpenChange, previewValues }: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  /** Live variable values for the prompt-editor Preview tab. Supplied only in-game; absent → no Preview. */
  previewValues?: Record<string, string>;
}) => {
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
    showSilentRequests,
    setShowSilentRequests,
    paragraphLimit,
    setParagraphLimit,
    autoscroll,
    setAutoscroll,
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
    vramHelperUrl,
    setVramHelperUrl,
    accentColor,
    setAccentColor
  } = useSettings();
  const { theme, setTheme } = useTheme();
  const desktop = isDesktop();
  // The Hardware tab needs a VRAM source: the standalone helper (dev) or the desktop app's native readout.
  // Hide it in the production web build, where neither is available.
  const showHardwareTab = import.meta.env.DEV || desktop;
  const vramStats = useVramStats(vramHelperUrl, { enabled: isOpen && showHardwareTab });
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
  const [promptTab, setPromptTab] = useState('narration');
  const promptResets: Record<string, { label: string; reset: () => void }> = {
    narration: { label: 'Narration', reset: () => setSystemPrompt(defaultSystemPrompt) },
    thinking: { label: 'Thinking', reset: () => setThinkingPrompt(defaultThinkingPrompt) },
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

  // The four aux prompts also have an editable user-message template. A System | User toggle swaps the
  // editor between the two; only these tabs offer it. `promptView` resets to System on every tab change.
  const [promptView, setPromptView] = useState<'system' | 'user'>('system');
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
  const activeVerbatim = promptVerbatim[activePromptTab] ?? promptVerbatim.narration;

  return (
    <>
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="presentation" className="w-full flex flex-col flex-1 min-h-0">
          <TabsList className={`grid w-full ${showHardwareTab ? 'grid-cols-6' : 'grid-cols-5'} flex-shrink-0`}>
            <TabsTrigger value="presentation">Presentation</TabsTrigger>
            <TabsTrigger value="generation">Generation</TabsTrigger>
            <TabsTrigger value="endpoint">Endpoint</TabsTrigger>
            <TabsTrigger value="image">Image Gen</TabsTrigger>
            <TabsTrigger value="prompts">System Prompts</TabsTrigger>
            {showHardwareTab && <TabsTrigger value="hardware">Hardware</TabsTrigger>}
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
                <label htmlFor="accentColor" className="text-left sm:text-right leading-4">
                  Accent Color
                </label>
                <div className="col-span-3 flex items-center gap-3">
                  <input
                    id="accentColor"
                    type="color"
                    value={accentColor}
                    onChange={(e) => setAccentColor(e.target.value)}
                    className="h-9 w-14 shrink-0 cursor-pointer rounded border bg-transparent p-0.5"
                    aria-label="Accent color"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setAccentColor(DEFAULT_ACCENT_COLOR)}
                    disabled={accentColor.toLowerCase() === DEFAULT_ACCENT_COLOR.toLowerCase()}
                  >
                    Reset
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    Tints buttons and highlights, in both light and dark.
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-4">
                <label htmlFor="language" className="text-left sm:text-right leading-4">
                  Language
                </label>
                <Input
                  id="language"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="col-span-3"
                  placeholder="Enter language"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-4">
                <label htmlFor="autoscroll" className="text-left sm:text-right leading-4">
                  Auto-scroll Messages
                </label>
                <div className="col-span-3 flex items-center">
                  <Checkbox
                    id="autoscroll"
                    checked={autoscroll}
                    onCheckedChange={(c) => setAutoscroll(c === true)}
                  />
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
                  <label htmlFor="locationAutoApply" className="text-left sm:text-right leading-4 pt-0.5">Location Moves</label>
                  <div className="col-span-3">
                    <label htmlFor="locationAutoApply" className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox
                        id="locationAutoApply"
                        checked={locationAutoApply}
                        onCheckedChange={(c) => setLocationAutoApply(c === true)}
                        className="shrink-0"
                      />
                      Apply location changes automatically
                    </label>
                    <p className="text-xs text-muted-foreground mt-1">
                      Move the player as soon as the AI detects a change, skipping the “Move to…?” confirmation.
                    </p>
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
                    Keeps long stories coherent without bloating each request: older turns are retold in condensed form — the same back-and-forth, just shorter — while recent ones stay word-for-word. Runs an extra request per turn. Edit the prompt under System Prompts → Summary.
                  </span>
                </div>
              </div>
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
                    Each character present in a turn quietly records a first-person diary entry about it, as turns age out. Its own recent entries feed back into that character&apos;s motivation during Staged thinking. Runs an extra request per participant. View them via Show Silent Requests in the AI context viewer, and edit the prompt under System Prompts → Diary.
                  </span>
                </div>
              </div>
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
                    Reveal silent requests that normally run quietly (memory summaries, character diaries, and new-character notes) — they appear in the status bar while running and as a request entry in the AI context viewer. Off by default; an inspection aid for authoring and debugging.
                  </span>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="endpoint" className="py-4 px-2 flex-1 min-h-0 overflow-y-auto">
            <div className="grid gap-4">
              <div className="grid grid-cols-[1fr_3fr] items-center gap-4">
                <label htmlFor="useCustomEndpoint" className="text-right">
                  Use Custom Endpoint
                </label>
                <div className="flex items-center">
                  <Checkbox
                    id="useCustomEndpoint"
                    checked={useCustomEndpoint}
                    onCheckedChange={(c) => setUseCustomEndpoint(c === true)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-[1fr_3fr] items-center gap-4">
                <label htmlFor="endpointUrl" className="text-right">
                  Endpoint URL
                </label>
                <Input
                  id="endpointUrl"
                  value={useCustomEndpoint ? endpointUrl : DEFAULT_ENDPOINT}
                  onChange={(e) => setEndpointUrl(e.target.value)}
                  readOnly={!useCustomEndpoint}
                  className={useCustomEndpoint ? undefined : 'opacity-60 cursor-not-allowed'}
                />
              </div>
              <div className="grid grid-cols-[1fr_3fr] items-center gap-4">
                <label htmlFor="apiToken" className="text-right">
                  API Token
                </label>
                <Input
                  id="apiToken"
                  type="password"
                  value={useCustomEndpoint ? apiToken : DEFAULT_API_TOKEN}
                  onChange={(e) => setApiToken(e.target.value)}
                  readOnly={!useCustomEndpoint}
                  className={useCustomEndpoint ? undefined : 'opacity-60 cursor-not-allowed'}
                />
              </div>
              <div className="grid grid-cols-[1fr_3fr] items-center gap-4">
                <label htmlFor="modelName" className="text-right">
                  Model Name
                </label>
                <Input
                  id="modelName"
                  value={useCustomEndpoint ? modelName : DEFAULT_MODEL_NAME}
                  onChange={(e) => setModelName(e.target.value)}
                  readOnly={!useCustomEndpoint}
                  className={useCustomEndpoint ? undefined : 'opacity-60 cursor-not-allowed'}
                />
              </div>
              <div className="grid grid-cols-[1fr_3fr] items-center gap-4">
                <label htmlFor="contextWindow" className="text-right">
                  Context Window (tokens)
                </label>
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
              </div>
              <div className="grid grid-cols-[1fr_3fr] gap-4">
                <div />
                <div className={contextStatus.red ? 'text-xs text-red-500' : 'text-xs text-muted-foreground'}>
                  {contextStatus.text}
                </div>
              </div>
              <div className="grid grid-cols-[1fr_3fr] items-center gap-4">
                <label htmlFor="maxTokens" className="text-right">
                  Max Output Tokens
                </label>
                <Input
                  id="maxTokens"
                  type="number"
                  value={useCustomEndpoint ? maxTokens : DEFAULT_MAX_TOKENS}
                  onChange={(e) => setMaxTokens(Number(e.target.value))}
                  readOnly={!useCustomEndpoint}
                  className={useCustomEndpoint ? undefined : 'opacity-60 cursor-not-allowed'}
                />
              </div>
              <div className="flex justify-end">
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
              <ConfirmDialog
                title="Reset Preset"
                description={`Reset the "${activeImageEndpointPresetName}" preset to its default values? This can't be undone.`}
                onConfirm={() => resetImageEndpointPreset(activeImageEndpointPresetId)}
              >
                <Button variant="outline" size="sm">Reset</Button>
              </ConfirmDialog>
              {imageEndpointPresets.length > 1 && (
                <ConfirmDialog
                  title="Delete Preset"
                  description={`Delete the "${activeImageEndpointPresetName}" preset? This can't be undone.`}
                  onConfirm={() => deleteImageEndpointPreset(activeImageEndpointPresetId)}
                >
                  <Button variant="outline" size="sm">Delete</Button>
                </ConfirmDialog>
              )}
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto">
            <div className="grid gap-4">
              <div className="grid grid-cols-[1fr_3fr] items-center gap-4">
                <label htmlFor="imageProvider" className="text-right">Provider</label>
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
              </div>
              <div className="grid grid-cols-[1fr_3fr] gap-4">
                <div />
                <div>
                  <Button variant="outline" size="sm" onClick={() => setShowImageSetup(true)}>How to Set Up</Button>
                </div>
              </div>
              <div className="grid grid-cols-[1fr_3fr] items-center gap-4">
                <label htmlFor="imageEndpoint" className="text-right">Endpoint URL</label>
                <Input
                  id="imageEndpoint"
                  value={imageEndpoint}
                  onChange={(e) => setImageEndpoint(e.target.value)}
                  placeholder={DEFAULT_ENDPOINT_BY_PROVIDER[imageProvider] || 'https://api.openai.com'}
                />
              </div>
              <div className="grid grid-cols-[1fr_3fr] items-center gap-4">
                <label htmlFor="imageApiToken" className="text-right">API Token</label>
                <Input id="imageApiToken" type="password" value={imageApiToken} onChange={(e) => setImageApiToken(e.target.value)} />
              </div>
              <div className="grid grid-cols-[1fr_3fr] items-center gap-4">
                <label htmlFor="imageModel" className="text-right">Model</label>
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
              </div>
              <div className="grid grid-cols-[1fr_3fr] items-start gap-4">
                <label htmlFor="imagePositivePrompt" className="text-right pt-2">Prompt Prefix</label>
                <div className="grid gap-1.5">
                  <Input id="imagePositivePrompt" value={imagePositivePrompt} onChange={(e) => setImagePositivePrompt(e.target.value)} placeholder="e.g. masterpiece, best quality" />
                  <p className="text-xs text-muted-foreground">Prepended to every generated prompt (quality/style tags). Leave blank for none.</p>
                </div>
              </div>
              <div className="grid grid-cols-[1fr_3fr] items-start gap-4">
                <label htmlFor="imageNegativePrompt" className="text-right pt-2">Negative Prompt</label>
                <Input id="imageNegativePrompt" value={imageNegativePrompt} onChange={(e) => setImageNegativePrompt(e.target.value)} />
              </div>
              <div className="grid grid-cols-[1fr_3fr] items-center gap-4">
                <label className="text-right">Portrait (W × H)</label>
                <div className="flex items-center gap-2">
                  <Input aria-label="Portrait width" type="number" min={64} step={64} value={imagePortraitWidth} onChange={(e) => setImagePortraitWidth(Number(e.target.value))} className="w-28" />
                  <span className="text-muted-foreground">×</span>
                  <Input aria-label="Portrait height" type="number" min={64} step={64} value={imagePortraitHeight} onChange={(e) => setImagePortraitHeight(Number(e.target.value))} className="w-28" />
                  <span className="text-xs text-muted-foreground">entity portraits</span>
                </div>
              </div>
              <div className="grid grid-cols-[1fr_3fr] items-center gap-4">
                <label className="text-right">Landscape (W × H)</label>
                <div className="flex items-center gap-2">
                  <Input aria-label="Landscape width" type="number" min={64} step={64} value={imageLandscapeWidth} onChange={(e) => setImageLandscapeWidth(Number(e.target.value))} className="w-28" />
                  <span className="text-muted-foreground">×</span>
                  <Input aria-label="Landscape height" type="number" min={64} step={64} value={imageLandscapeHeight} onChange={(e) => setImageLandscapeHeight(Number(e.target.value))} className="w-28" />
                  <span className="text-xs text-muted-foreground">locations &amp; thumbnail</span>
                </div>
              </div>
              <div className="grid grid-cols-[1fr_3fr] items-center gap-4">
                <label className="text-right">Steps / CFG</label>
                <div className="flex items-center gap-2">
                  <Input aria-label="Steps" type="number" min={1} value={imageSteps} onChange={(e) => setImageSteps(Number(e.target.value))} className="w-28" />
                  <Input aria-label="CFG scale" type="number" min={0} step={0.5} value={imageCfg} onChange={(e) => setImageCfg(Number(e.target.value))} className="w-28" />
                </div>
              </div>
              <div className="grid grid-cols-[1fr_3fr] items-center gap-4">
                <label htmlFor="imageSampler" className="text-right">Sampler</label>
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
              </div>
              {imageProvider === 'a1111' && (
                <div className="grid grid-cols-[1fr_3fr] items-start gap-4">
                  <label htmlFor="imageAdetailer" className="text-right pt-0.5">ADetailer</label>
                  <div className="flex items-start gap-2">
                    <Checkbox
                      id="imageAdetailer"
                      checked={imageAdetailer}
                      onCheckedChange={(c) => setImageAdetailer(c === true)}
                      className="shrink-0 mt-0.5"
                    />
                    <span className="text-xs text-muted-foreground">
                      Run a second pass to auto-fix faces/hands. Requires the ADetailer extension installed on your A1111/Forge server.
                    </span>
                  </div>
                </div>
              )}
              {imageProvider === 'comfyui' && (
                <div className="grid grid-cols-[1fr_3fr] items-start gap-4">
                  <label htmlFor="imageWorkflow" className="text-right pt-2">Workflow (API format)</label>
                  <div className="grid gap-1.5">
                    <Textarea
                      id="imageWorkflow"
                      value={imageWorkflow}
                      onChange={(e) => setImageWorkflow(e.target.value)}
                      spellCheck={false}
                      className="min-h-[200px] font-mono text-xs"
                    />
                    <div className="flex gap-2 justify-between">
                      <Button variant="outline" size="sm" onClick={() => setShowComfyWorkflow(true)}>How to get this</Button>
                      <ConfirmDialog
                        title="Reset Workflow"
                        description="Reset the ComfyUI workflow to the default graph? Your custom workflow will be lost."
                        onConfirm={() => setImageWorkflow(DEFAULT_COMFY_WORKFLOW)}
                      >
                        <Button variant="outline" size="sm" disabled={imageWorkflow === DEFAULT_COMFY_WORKFLOW}>
                          Reset to default
                        </Button>
                      </ConfirmDialog>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Tokens Formamorph fills in:
                      {' '}<code>%prompt%</code> <code>%negative%</code> <code>%ckpt%</code> <code>%width%</code>{' '}
                      <code>%height%</code> <code>%steps%</code> <code>%cfg%</code> <code>%seed%</code> <code>%sampler%</code>.
                    </p>
                  </div>
                </div>
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
                <div className="flex justify-end flex-shrink-0">
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
              {!activePresetIsBuiltIn && (
                <ConfirmDialog
                  title="Reset Preset"
                  description={`Reset every prompt in the "${activePresetName}" preset to its default value? This can't be undone.`}
                  onConfirm={() => resetPreset(activePresetId)}
                >
                  <Button variant="outline" size="sm">Reset</Button>
                </ConfirmDialog>
              )}
            </div>
            {/* Nested tab bar — one prompt per tab; only the selected prompt shows. */}
            <Tabs value={activePromptTab} onValueChange={selectPromptTab} className="w-full flex flex-col flex-1 min-h-0">
              <TabsList className="flex flex-wrap h-auto justify-center gap-1 flex-shrink-0">
                <TabsTrigger value="narration">Narration</TabsTrigger>
                {thinkingMode === 'precall' && <TabsTrigger value="thinking">Thinking</TabsTrigger>}
                {choicesEnabled && <TabsTrigger value="choices">Choices</TabsTrigger>}
                {statUpdatesEnabled && <TabsTrigger value="statupdates">Stat Updates</TabsTrigger>}
                {locationChangeEnabled && <TabsTrigger value="location">Location Change</TabsTrigger>}
                {memoryDigests && <TabsTrigger value="summary">Summary</TabsTrigger>}
                {characterDiaries && <TabsTrigger value="diary">Diary</TabsTrigger>}
                {thinkingMode === 'staged' && <TabsTrigger value="director">Director</TabsTrigger>}
                {thinkingMode === 'staged' && <TabsTrigger value="character">Character</TabsTrigger>}
                {thinkingMode === 'staged' && <TabsTrigger value="storyboard">Storyboard</TabsTrigger>}
              </TabsList>

              {/* System prompt vs. user-message template — a tab bar like the row above (kept at text-xs).
                  Only the aux prompts have a user template. */}
              {activeUserPrompt && (
                <Tabs
                  value={promptView}
                  onValueChange={(v) => setPromptView(v as 'system' | 'user')}
                  className="flex justify-center mt-3 flex-shrink-0"
                >
                  <TabsList className="h-auto">
                    <TabsTrigger value="system" className="text-xs">System Prompt</TabsTrigger>
                    <TabsTrigger value="user" className="text-xs">User Message</TabsTrigger>
                  </TabsList>
                </Tabs>
              )}

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
            </Tabs>

            <div className="flex flex-wrap justify-between items-center gap-2 flex-shrink-0">
              {memoryDigests && !['diary', 'director', 'character', 'storyboard'].includes(activePromptTab) ? (
                <VerbatimTurnsField id="promptVerbatim" value={activeVerbatim.value} onChange={activeVerbatim.set} />
              ) : (
                <span />
              )}
              {!activePresetIsBuiltIn ? (
                <ConfirmDialog
                  title={`Reset ${resetTarget.label}`}
                  description={`Are you sure you want to reset the ${resetTarget.label} to its default value?`}
                  onConfirm={resetTarget.reset}
                >
                  <Button variant="outline" className="flex items-center gap-2">
                    Reset {resetTarget.label}
                  </Button>
                </ConfirmDialog>
              ) : (
                <span />
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

          {showHardwareTab && (
          <TabsContent value="hardware" className="py-4 px-2 flex-1 min-h-0 overflow-y-auto">
            <div className="grid gap-4">
              {desktop ? (
                <p className="text-xs text-muted-foreground">
                  The VRAM readout is built into the desktop app — no helper to run. Powers a live readout and
                  a low-VRAM warning before loading text-to-speech. Requires an NVIDIA GPU with
                  <code> nvidia-smi</code> available.
                </p>
              ) : (
                <>
                  <div className="grid grid-cols-[1fr_3fr] items-center gap-4">
                    <label htmlFor="vramHelperUrl" className="text-right">
                      VRAM Helper URL
                    </label>
                    <Input
                      id="vramHelperUrl"
                      value={vramHelperUrl}
                      onChange={(e) => setVramHelperUrl(e.target.value)}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Run <code>npm run vram-helper</code> alongside the app for a live VRAM readout
                    and a low-VRAM warning before loading text-to-speech. Requires an NVIDIA GPU with
                    <code> nvidia-smi</code> on your PATH.
                  </p>
                </>
              )}
              <VramReadout stats={vramStats} />
            </div>
          </TabsContent>
          )}
        </Tabs>
      </DialogContent>
    </Dialog>
    <ImageSetupGuide provider={imageProvider} open={showImageSetup} onOpenChange={setShowImageSetup} />
    <ComfyWorkflowGuide open={showComfyWorkflow} onOpenChange={setShowComfyWorkflow} />
    </>
  );
};
