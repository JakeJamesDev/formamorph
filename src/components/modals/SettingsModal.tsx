import { useState } from 'react';
import { useSettings, type ThinkingMode, type ParagraphLimit } from '@/contexts/SettingsContext';
import { DEFAULT_ENDPOINT, DEFAULT_API_TOKEN, DEFAULT_MODEL_NAME, DEFAULT_MAX_TOKENS } from '@/contexts/settingsDefaults';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PromptField from '../prompt/PromptField';
import { PROMPT_KIND_VARIABLES } from '@/lib/promptVariables';
import { ConfirmDialog } from '../ConfirmDialog';
import { defaultSystemPrompt, defaultChoicesPrompt, defaultStatUpdatesPrompt, defaultLocationChangePrompt, defaultThinkingPrompt, defaultSummaryPrompt } from '../game/GamePrompts';
import VramReadout from '../game/VramReadout';
import { useVramStats } from '@/lib/useVramStats';

// Segmented-control options: a short tab label plus the helper text shown below the selected one.
const OUTPUT_LENGTH_OPTIONS: { value: ParagraphLimit; label: string; help: string }[] = [
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
    gametextVerbatimTurns,
    setGametextVerbatimTurns,
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
    memoryDigests,
    setMemoryDigests,
    showSilentRequests,
    setShowSilentRequests,
    paragraphLimit,
    setParagraphLimit,
    autoscroll,
    setAutoscroll,
    hideStatNumbers,
    setHideStatNumbers,
    markdownOutput,
    setMarkdownOutput,
    streamNarrationAudio,
    setStreamNarrationAudio,
    vramHelperUrl,
    setVramHelperUrl
  } = useSettings();
  const vramStats = useVramStats(vramHelperUrl, { enabled: isOpen });
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

  // The selected prompt sub-tab, so the Reset button can target just that prompt.
  const [promptTab, setPromptTab] = useState('gametext');
  const promptResets: Record<string, { label: string; reset: () => void }> = {
    gametext: { label: 'Game Text', reset: () => setSystemPrompt(defaultSystemPrompt) },
    thinking: { label: 'Thinking', reset: () => setThinkingPrompt(defaultThinkingPrompt) },
    choices: { label: 'Choices', reset: () => setChoicesPrompt(defaultChoicesPrompt) },
    statupdates: { label: 'Stat Updates', reset: () => setStatUpdatesPrompt(defaultStatUpdatesPrompt) },
    location: { label: 'Location Change', reset: () => setLocationChangePromptText(defaultLocationChangePrompt) },
    summary: { label: 'Summary', reset: () => setSummaryPrompt(defaultSummaryPrompt) },
  };
  // Each prompt tab only exists while its prompt is enabled (toggled in Generation → System Prompts, or
  // its governing setting for Thinking/Summary). If the open tab is no longer available (disabled since,
  // or on reopen), fall back to Game Text so the panel isn't blank.
  const promptAvailable: Record<string, boolean> = {
    gametext: true,
    thinking: thinkingMode === 'precall',
    choices: choicesEnabled,
    statupdates: statUpdatesEnabled,
    location: locationChangeEnabled,
    summary: memoryDigests,
  };
  const activePromptTab = promptAvailable[promptTab] ? promptTab : 'gametext';
  const selectedPrompt = promptResets[activePromptTab] ?? promptResets.gametext;

  // Verbatim-turns control for the active prompt, shown once in the footer (like Reset).
  const promptVerbatim: Record<string, { value: number; set: (n: number) => void }> = {
    gametext: { value: gametextVerbatimTurns, set: setGametextVerbatimTurns },
    thinking: { value: thinkingVerbatimTurns, set: setThinkingVerbatimTurns },
    choices: { value: choicesVerbatimTurns, set: setChoicesVerbatimTurns },
    statupdates: { value: statUpdatesVerbatimTurns, set: setStatUpdatesVerbatimTurns },
    location: { value: locationChangeVerbatimTurns, set: setLocationChangeVerbatimTurns },
    summary: { value: summaryVerbatimTurns, set: setSummaryVerbatimTurns },
  };
  const activeVerbatim = promptVerbatim[activePromptTab] ?? promptVerbatim.gametext;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="presentation" className="w-full flex flex-col flex-1 min-h-0">
          <TabsList className="grid w-full grid-cols-5 flex-shrink-0">
            <TabsTrigger value="presentation">Presentation</TabsTrigger>
            <TabsTrigger value="generation">Generation</TabsTrigger>
            <TabsTrigger value="endpoint">Endpoint</TabsTrigger>
            <TabsTrigger value="prompts">System Prompts</TabsTrigger>
            <TabsTrigger value="hardware">Hardware</TabsTrigger>
          </TabsList>

          <TabsContent value="presentation" className="py-4 px-2 flex-1 min-h-0 overflow-y-auto">
            <div className="grid gap-4">
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
                <label htmlFor="streamNarrationAudio" className="text-left sm:text-right leading-4">
                  Stream Narration Audio
                </label>
                <div className="col-span-3 flex items-start gap-2">
                  <Checkbox
                    id="streamNarrationAudio"
                    checked={streamNarrationAudio}
                    onCheckedChange={(c) => setStreamNarrationAudio(c === true)}
                    className="shrink-0"
                  />
                  <span className="text-xs text-muted-foreground">
                    Start text-to-speech as soon as each sentence finishes streaming, instead of after the whole story. Lower audio latency, but TTS runs alongside the model — may compete for the GPU if your LLM runs on the same machine. Requires a loaded TTS model.
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 items-start gap-4">
                <label className="text-left sm:text-right pt-2">Output Length</label>
                <div className="col-span-3">
                  <Tabs value={paragraphLimit} onValueChange={(v) => setParagraphLimit(v as ParagraphLimit)}>
                    <TabsList className="grid w-full grid-cols-3">
                      {OUTPUT_LENGTH_OPTIONS.map((o) => (
                        <TabsTrigger key={o.value} value={o.value}>{o.label}</TabsTrigger>
                      ))}
                    </TabsList>
                  </Tabs>
                  {/* All option texts stacked in one grid cell so the block is always as tall as the
                      longest — switching options shows the active one without reflowing the layout. */}
                  <div className="grid mt-2">
                    {OUTPUT_LENGTH_OPTIONS.map((o) => (
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
                    Let the AI format narration with bold/italics, lists, and tables. Works best with Output Length not set to a single paragraph.
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
              <div className="grid grid-cols-1 sm:grid-cols-4 items-start gap-4">
                <label htmlFor="hideStatNumbers" className="text-left sm:text-right leading-4">
                  Hide Stat Numbers
                </label>
                <div className="col-span-3 flex items-start gap-2">
                  <Checkbox
                    id="hideStatNumbers"
                    checked={hideStatNumbers}
                    onCheckedChange={(c) => setHideStatNumbers(c === true)}
                    className="shrink-0"
                  />
                  <span className="text-xs text-muted-foreground">
                    The narrator, planner, and choices see stat descriptors (e.g. &quot;severely injured&quot;) instead of raw numbers, for immersion. Falls back to the number when a stat has no descriptor.
                  </span>
                </div>
              </div>
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
                  {/* Stacked like Output Length so switching thinking modes doesn't reflow the layout. */}
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
                    Reveal silent requests that normally run quietly (currently the memory summary) — they appear in the status bar while running and as a request entry in the AI context viewer. Off by default; an inspection aid for authoring and debugging.
                  </span>
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
                    Summarize older turns into short fact lines as they age out of recent history, then feed them to the model: recent turns stay verbatim, older turns fold into a &ldquo;story so far&rdquo; recap, and a relevant past turn is pulled back to full detail when your action references it. Keeps long stories coherent without bloating each request. Runs an extra request per turn — may compete for the GPU if your LLM runs on the same machine. Edit the summary prompt under System Prompts → Summary.
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

          <TabsContent value="prompts" className="pt-4 px-2 pb-4 flex-1 min-h-0 data-[state=active]:flex flex-col gap-4">
            {/* Nested tab bar — one prompt per tab; only the selected prompt shows. */}
            <Tabs value={activePromptTab} onValueChange={setPromptTab} className="w-full flex flex-col flex-1 min-h-0">
              <TabsList className="flex flex-wrap h-auto justify-center gap-1 flex-shrink-0">
                <TabsTrigger value="gametext">Game Text</TabsTrigger>
                {thinkingMode === 'precall' && <TabsTrigger value="thinking">Thinking</TabsTrigger>}
                {choicesEnabled && <TabsTrigger value="choices">Choices</TabsTrigger>}
                {statUpdatesEnabled && <TabsTrigger value="statupdates">Stat Updates</TabsTrigger>}
                {locationChangeEnabled && <TabsTrigger value="location">Location Change</TabsTrigger>}
                {memoryDigests && <TabsTrigger value="summary">Summary</TabsTrigger>}
              </TabsList>

              <TabsContent value="gametext" className="mt-4 flex-1 min-h-0 data-[state=active]:flex flex-col">
                <PromptField
                  value={systemPrompt}
                  onChange={setSystemPrompt}
                  variables={PROMPT_KIND_VARIABLES.gametext}
                  previewValues={previewValues}
                />
              </TabsContent>

              {thinkingMode === 'precall' && (
                <TabsContent value="thinking" className="mt-4 flex-1 min-h-0 data-[state=active]:flex flex-col">
                  <PromptField
                    value={thinkingPrompt}
                    onChange={setThinkingPrompt}
                    variables={PROMPT_KIND_VARIABLES.thinking}
                    previewValues={previewValues}
                  />
                </TabsContent>
              )}

              {choicesEnabled && (
                <TabsContent value="choices" className="mt-4 flex-1 min-h-0 data-[state=active]:flex flex-col">
                  <PromptField
                    value={choicesPrompt}
                    onChange={setChoicesPrompt}
                    variables={PROMPT_KIND_VARIABLES.choices}
                    previewValues={previewValues}
                  />
                </TabsContent>
              )}

              {statUpdatesEnabled && (
                <TabsContent value="statupdates" className="mt-4 flex-1 min-h-0 data-[state=active]:flex flex-col">
                  <PromptField
                    value={statUpdatesPrompt}
                    onChange={setStatUpdatesPrompt}
                    variables={PROMPT_KIND_VARIABLES.statupdates}
                    previewValues={previewValues}
                  />
                </TabsContent>
              )}

              {locationChangeEnabled && (
                <TabsContent value="location" className="mt-4 flex-1 min-h-0 data-[state=active]:flex flex-col gap-1">
                  <PromptField
                    value={locationChangePromptText}
                    onChange={setLocationChangePromptText}
                    variables={PROMPT_KIND_VARIABLES.location}
                    previewValues={previewValues}
                  />
                  <p className="text-xs text-gray-500 flex-shrink-0">Lets the AI move the player between locations.</p>
                </TabsContent>
              )}

              {memoryDigests && (
                <TabsContent value="summary" className="mt-4 flex-1 min-h-0 data-[state=active]:flex flex-col gap-1">
                  <PromptField
                    value={summaryPrompt}
                    onChange={setSummaryPrompt}
                    variables={PROMPT_KIND_VARIABLES.summary}
                    previewValues={previewValues}
                  />
                  <p className="text-xs text-gray-500 flex-shrink-0">Compresses each turn into fact lines for long-story memory. Only used when Memory Summaries is on.</p>
                </TabsContent>
              )}
            </Tabs>

            <div className="flex flex-wrap justify-between items-center gap-2 flex-shrink-0">
              {memoryDigests ? (
                <VerbatimTurnsField id="promptVerbatim" value={activeVerbatim.value} onChange={activeVerbatim.set} />
              ) : (
                <span />
              )}
              <ConfirmDialog
                title={`Reset ${selectedPrompt.label} Prompt`}
                description={`Are you sure you want to reset the ${selectedPrompt.label} prompt to its default value?`}
                onConfirm={selectedPrompt.reset}
              >
                <Button variant="outline" className="flex items-center gap-2">
                  Reset {selectedPrompt.label} Prompt
                </Button>
              </ConfirmDialog>
            </div>
          </TabsContent>

          <TabsContent value="hardware" className="py-4 px-2 flex-1 min-h-0 overflow-y-auto">
            <div className="grid gap-4">
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
              <p className="text-xs text-gray-500">
                Run <code>npm run vram-helper</code> alongside the app for a live VRAM readout
                and a low-VRAM warning before loading text-to-speech. Requires an NVIDIA GPU with
                <code> nvidia-smi</code> on your PATH.
              </p>
              <VramReadout stats={vramStats} />
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
