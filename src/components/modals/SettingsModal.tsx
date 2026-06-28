import { useState } from 'react';
import { useSettings, type ThinkingMode, type ParagraphLimit } from '@/contexts/SettingsContext';
import { DEFAULT_ENDPOINT, DEFAULT_API_TOKEN, DEFAULT_MODEL_NAME, DEFAULT_MAX_TOKENS } from '@/contexts/settingsDefaults';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConfirmDialog } from '../ConfirmDialog';
import { defaultSystemPrompt, defaultChoicesPrompt, defaultStatUpdatesPrompt, defaultLocationChangePrompt, defaultThinkingPrompt, defaultSummaryPrompt } from '../game/GamePrompts';
import VramReadout from '../game/VramReadout';
import { useVramStats } from '@/lib/useVramStats';

export const SettingsModal = ({ isOpen, onOpenChange }: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
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
    useDigestsInContext,
    setUseDigestsInContext,
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
  const selectedPrompt = promptResets[promptTab] ?? promptResets.gametext;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="gameplay" className="w-full flex flex-col flex-1 min-h-0">
          <TabsList className="grid w-full grid-cols-4 flex-shrink-0">
            <TabsTrigger value="gameplay">Gameplay</TabsTrigger>
            <TabsTrigger value="endpoint">Endpoint</TabsTrigger>
            <TabsTrigger value="prompts">System Prompts</TabsTrigger>
            <TabsTrigger value="hardware">Hardware</TabsTrigger>
          </TabsList>

          <TabsContent value="gameplay" className="py-4 px-2 flex-1 min-h-0 overflow-y-auto">
            <div className="grid gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-4">
                <label htmlFor="language" className="text-left sm:text-right">
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
                <label htmlFor="bgmEnabled" className="text-left sm:text-right">
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
                <label className="text-left sm:text-right pt-1">Output Length</label>
                <RadioGroup
                  value={paragraphLimit}
                  onValueChange={(v) => setParagraphLimit(v as ParagraphLimit)}
                  className="col-span-3 gap-3"
                >
                  <div className="flex items-start gap-2">
                    <RadioGroupItem value="none" id="length-none" className="mt-1" />
                    <label htmlFor="length-none" className="cursor-pointer">
                      <div className="text-sm font-medium">None</div>
                      <div className="text-xs text-muted-foreground">No paragraph limit. The model writes until it finishes or hits the token cap.</div>
                    </label>
                  </div>
                  <div className="flex items-start gap-2">
                    <RadioGroupItem value="single" id="length-single" className="mt-1" />
                    <label htmlFor="length-single" className="cursor-pointer">
                      <div className="text-sm font-medium">Single paragraph</div>
                      <div className="text-xs text-muted-foreground">One paragraph per turn (stops at the first line break).</div>
                    </label>
                  </div>
                  <div className="flex items-start gap-2">
                    <RadioGroupItem value="auto" id="length-auto" className="mt-1" />
                    <label htmlFor="length-auto" className="cursor-pointer">
                      <div className="text-sm font-medium">Auto (recommended)</div>
                      <div className="text-xs text-muted-foreground">Scales the paragraph count to your Max Output Tokens so responses fit the budget and end cleanly.</div>
                    </label>
                  </div>
                </RadioGroup>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-4">
                <label htmlFor="autoscroll" className="text-left sm:text-right">
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
              <div className="grid grid-cols-1 sm:grid-cols-4 items-start gap-4">
                <label htmlFor="hideStatNumbers" className="text-left sm:text-right pt-1">
                  Hide Stat Numbers
                </label>
                <div className="col-span-3 flex items-start gap-2">
                  <Checkbox
                    id="hideStatNumbers"
                    checked={hideStatNumbers}
                    onCheckedChange={(c) => setHideStatNumbers(c === true)}
                    className="mt-0.5"
                  />
                  <span className="text-xs text-muted-foreground">
                    The narrator, planner, and choices see stat descriptors (e.g. &quot;severely injured&quot;) instead of raw numbers, for immersion. Falls back to the number when a stat has no descriptor.
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 items-start gap-4">
                <label htmlFor="markdownOutput" className="text-left sm:text-right pt-1">
                  Markdown Formatting
                </label>
                <div className="col-span-3 flex items-start gap-2">
                  <Checkbox
                    id="markdownOutput"
                    checked={markdownOutput}
                    onCheckedChange={(c) => setMarkdownOutput(c === true)}
                    className="mt-0.5"
                  />
                  <span className="text-xs text-muted-foreground">
                    Let the AI format narration with bold/italics, lists, and tables. Works best with Output Length not set to a single paragraph.
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 items-start gap-4">
                <label htmlFor="streamNarrationAudio" className="text-left sm:text-right pt-1">
                  Stream Narration Audio
                </label>
                <div className="col-span-3 flex items-start gap-2">
                  <Checkbox
                    id="streamNarrationAudio"
                    checked={streamNarrationAudio}
                    onCheckedChange={(c) => setStreamNarrationAudio(c === true)}
                    className="mt-0.5"
                  />
                  <span className="text-xs text-muted-foreground">
                    Start text-to-speech as soon as each sentence finishes streaming, instead of after the whole story. Lower audio latency, but TTS runs alongside the model — may compete for the GPU if your LLM runs on the same machine. Requires a loaded TTS model.
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 items-start gap-4">
                <label htmlFor="memoryDigests" className="text-left sm:text-right pt-1">
                  Memory Digests
                </label>
                <div className="col-span-3 flex items-start gap-2">
                  <Checkbox
                    id="memoryDigests"
                    checked={memoryDigests}
                    onCheckedChange={(c) => setMemoryDigests(c === true)}
                    className="mt-0.5"
                  />
                  <span className="text-xs text-muted-foreground">
                    Summarize older turns into short fact lines as they age out of recent history, so long stories stay coherent without bloating each request. Runs an extra request per turn — may compete for the GPU if your LLM runs on the same machine. Edit the digest prompt under System Prompts → Summary.
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 items-start gap-4">
                <label htmlFor="showSilentRequests" className="text-left sm:text-right pt-1">
                  Show Silent Requests
                </label>
                <div className="col-span-3 flex items-start gap-2">
                  <Checkbox
                    id="showSilentRequests"
                    checked={showSilentRequests}
                    onCheckedChange={(c) => setShowSilentRequests(c === true)}
                    className="mt-0.5"
                  />
                  <span className="text-xs text-muted-foreground">
                    Reveal silent requests that normally run quietly (currently the memory digest) — they appear in the status bar while running and as a request entry in the AI context viewer. Off by default; an inspection aid for authoring and debugging.
                  </span>
                </div>
              </div>
              {memoryDigests && (
                <div className="grid grid-cols-1 sm:grid-cols-4 items-start gap-4">
                  <label htmlFor="useDigestsInContext" className="text-left sm:text-right pt-1">
                    Use Digests in Context
                  </label>
                  <div className="col-span-3 flex items-start gap-2">
                    <Checkbox
                      id="useDigestsInContext"
                      checked={useDigestsInContext}
                      onCheckedChange={(c) => setUseDigestsInContext(c === true)}
                      className="mt-0.5"
                    />
                    <span className="text-xs text-muted-foreground">
                      Actually feed digests to the model: keep recent turns verbatim, fold older turns into a &ldquo;story so far&rdquo; recap, and pull a relevant past turn back to full detail when your action references it. Off by default — it changes what each request sends. Without this, Memory Digests only generates and shows summaries.
                    </span>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-4 items-start gap-4">
                <label className="text-left sm:text-right pt-1">Thinking</label>
                <RadioGroup
                  value={thinkingMode}
                  onValueChange={(v) => setThinkingMode(v as ThinkingMode)}
                  className="col-span-3 gap-3"
                >
                  <div className="flex items-start gap-2">
                    <RadioGroupItem value="off" id="thinking-off" className="mt-1" />
                    <label htmlFor="thinking-off" className="cursor-pointer">
                      <div className="text-sm font-medium">Off</div>
                      <div className="text-xs text-muted-foreground">Fastest. The model responds immediately, with no planning step.</div>
                    </label>
                  </div>
                  <div className="flex items-start gap-2">
                    <RadioGroupItem value="precall" id="thinking-precall" className="mt-1" />
                    <label htmlFor="thinking-precall" className="cursor-pointer">
                      <div className="text-sm font-medium">Separate planning pass (recommended)</div>
                      <div className="text-xs text-muted-foreground">A separate request is sent to plan narration before writing it. Most reliable for small models.</div>
                    </label>
                  </div>
                  <div className="flex items-start gap-2">
                    <RadioGroupItem value="inline" id="thinking-inline" className="mt-1" />
                    <label htmlFor="thinking-inline" className="cursor-pointer">
                      <div className="text-sm font-medium">Inline</div>
                      <div className="text-xs text-muted-foreground">The model reasons privately before narrating, in the same request. One fewer round-trip.</div>
                    </label>
                  </div>
                </RadioGroup>
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
                <div className="flex items-center gap-2">
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
            {/* Nested, frozen tab bar — one prompt per tab; only the selected prompt shows. */}
            <Tabs value={promptTab} onValueChange={setPromptTab} className="w-full flex flex-col flex-1 min-h-0">
              <TabsList className="flex flex-wrap h-auto justify-center gap-1 flex-shrink-0">
                <TabsTrigger value="gametext">Game Text</TabsTrigger>
                {thinkingMode === 'precall' && <TabsTrigger value="thinking">Thinking</TabsTrigger>}
                <TabsTrigger value="choices">Choices</TabsTrigger>
                <TabsTrigger value="statupdates">Stat Updates</TabsTrigger>
                <TabsTrigger value="location">Location Change</TabsTrigger>
                {memoryDigests && <TabsTrigger value="summary">Summary</TabsTrigger>}
              </TabsList>

              <TabsContent value="gametext" className="mt-4 flex-1 min-h-0 data-[state=active]:flex flex-col">
                <Textarea
                  id="systemPrompt"
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  className="w-full flex-1 min-h-0 resize-none"
                />
              </TabsContent>

              {thinkingMode === 'precall' && (
                <TabsContent value="thinking" className="mt-4 flex-1 min-h-0 data-[state=active]:flex flex-col">
                  <Textarea
                    id="thinkingPrompt"
                    value={thinkingPrompt}
                    onChange={(e) => setThinkingPrompt(e.target.value)}
                    className="w-full flex-1 min-h-0 resize-none"
                  />
                </TabsContent>
              )}

              <TabsContent value="choices" className="mt-4 flex-1 min-h-0 data-[state=active]:flex flex-col gap-1">
                <Textarea
                  id="choicesPrompt"
                  value={choicesPrompt}
                  onChange={(e) => setChoicesPrompt(e.target.value)}
                  className="w-full flex-1 min-h-0 resize-none"
                />
                <p className="text-xs text-gray-500 flex-shrink-0">Write &apos;DISABLED&apos; to disable</p>
              </TabsContent>

              <TabsContent value="statupdates" className="mt-4 flex-1 min-h-0 data-[state=active]:flex flex-col gap-1">
                <Textarea
                  id="statUpdatesPrompt"
                  value={statUpdatesPrompt}
                  onChange={(e) => setStatUpdatesPrompt(e.target.value)}
                  className="w-full flex-1 min-h-0 resize-none"
                />
                <p className="text-xs text-gray-500 flex-shrink-0">Write &apos;DISABLED&apos; to disable</p>
              </TabsContent>

              <TabsContent value="location" className="mt-4 flex-1 min-h-0 data-[state=active]:flex flex-col gap-1">
                <Textarea
                  id="locationChangePrompt"
                  value={locationChangePromptText}
                  onChange={(e) => setLocationChangePromptText(e.target.value)}
                  className="w-full flex-1 min-h-0 resize-none"
                />
                <p className="text-xs text-gray-500 flex-shrink-0">Lets the AI move the player between locations. Write DISABLED to turn off.</p>
              </TabsContent>

              {memoryDigests && (
                <TabsContent value="summary" className="mt-4 flex-1 min-h-0 data-[state=active]:flex flex-col gap-1">
                  <Textarea
                    id="summaryPrompt"
                    value={summaryPrompt}
                    onChange={(e) => setSummaryPrompt(e.target.value)}
                    className="w-full flex-1 min-h-0 resize-none"
                  />
                  <p className="text-xs text-gray-500 flex-shrink-0">Compresses each turn into fact lines for long-story memory. Only used when Memory Digests is on.</p>
                </TabsContent>
              )}
            </Tabs>

            <div className="flex justify-end flex-shrink-0">
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
