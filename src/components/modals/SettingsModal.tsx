import { useSettings, type ThinkingMode, type ParagraphLimit } from '@/contexts/SettingsContext';
import { DEFAULT_ENDPOINT, DEFAULT_API_TOKEN, DEFAULT_MODEL_NAME, DEFAULT_MAX_TOKENS } from '@/contexts/settingsDefaults';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConfirmDialog } from '../ConfirmDialog';
import { defaultSystemPrompt, defaultChoicesPrompt, defaultStatUpdatesPrompt, defaultLocationChangePrompt, defaultThinkingPrompt } from '../game/GamePrompts';
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
    paragraphLimit,
    setParagraphLimit,
    autoscroll,
    setAutoscroll,
    hideStatNumbers,
    setHideStatNumbers,
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

  const handleResetPrompts = () => {
    setSystemPrompt(defaultSystemPrompt);
    setChoicesPrompt(defaultChoicesPrompt);
    setStatUpdatesPrompt(defaultStatUpdatesPrompt);
    setLocationChangePromptText(defaultLocationChangePrompt);
    setThinkingPrompt(defaultThinkingPrompt);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] top-16 translate-y-0 max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="gameplay" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="gameplay">Gameplay</TabsTrigger>
            <TabsTrigger value="endpoint">Endpoint</TabsTrigger>
            <TabsTrigger value="prompts">System Prompts</TabsTrigger>
            <TabsTrigger value="hardware">Hardware</TabsTrigger>
          </TabsList>

          <TabsContent value="gameplay" className="py-4 px-2">
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
                <input
                  id="bgmEnabled"
                  type="checkbox"
                  checked={bgmEnabled}
                  onChange={(e) => setBgmEnabled(e.target.checked)}
                  className="col-span-3"
                />
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
                <input
                  id="autoscroll"
                  type="checkbox"
                  checked={autoscroll}
                  onChange={(e) => setAutoscroll(e.target.checked)}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 items-start gap-4">
                <label htmlFor="hideStatNumbers" className="text-left sm:text-right pt-1">
                  Hide Stat Numbers
                </label>
                <div className="col-span-3 flex items-start gap-2">
                  <input
                    id="hideStatNumbers"
                    type="checkbox"
                    checked={hideStatNumbers}
                    onChange={(e) => setHideStatNumbers(e.target.checked)}
                    className="mt-1"
                  />
                  <span className="text-xs text-muted-foreground">
                    The narrator, planner, and choices see stat descriptors (e.g. &quot;severely injured&quot;) instead of raw numbers, for immersion. Falls back to the number when a stat has no descriptor.
                  </span>
                </div>
              </div>
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

          <TabsContent value="endpoint" className="py-4 px-2">
            <div className="grid gap-4">
              <div className="grid grid-cols-[1fr_3fr] items-center gap-4">
                <label htmlFor="useCustomEndpoint" className="text-right">
                  Use Custom Endpoint
                </label>
                <input
                  id="useCustomEndpoint"
                  type="checkbox"
                  checked={useCustomEndpoint}
                  onChange={(e) => setUseCustomEndpoint(e.target.checked)}
                />
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

          <TabsContent value="prompts" className="py-4 px-2">
            <div className="grid gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-4">
                <label htmlFor="systemPrompt" className="text-left sm:text-right">
                  Game Text Prompt
                </label>
                <Textarea
                  id="systemPrompt"
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  className="col-span-3"
                  rows={6}
                />
              </div>
              {thinkingMode === 'precall' && (
                <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-4">
                  <label htmlFor="thinkingPrompt" className="text-left sm:text-right">
                    Thinking Prompt
                  </label>
                  <Textarea
                    id="thinkingPrompt"
                    value={thinkingPrompt}
                    onChange={(e) => setThinkingPrompt(e.target.value)}
                    className="col-span-3"
                    rows={6}
                  />
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-4">
                <label htmlFor="choicesPrompt" className="text-left sm:text-right">
                  Choices Prompt
                </label>
                <div className="col-span-3">
                  <Textarea
                    id="choicesPrompt"
                    value={choicesPrompt}
                    onChange={(e) => setChoicesPrompt(e.target.value)}
                    className="w-full"
                    rows={4}
                  />
                  <p className="text-xs text-gray-500 mt-1">Write &apos;DISABLED&apos; to disable</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-4">
              <label htmlFor="statUpdatesPrompt" className="text-left sm:text-right">
                Stat Updates Prompt
              </label>
              <div className="col-span-3">
                <Textarea
                  id="statUpdatesPrompt"
                  value={statUpdatesPrompt}
                  onChange={(e) => setStatUpdatesPrompt(e.target.value)}
                  className="w-full"
                  rows={6}
                />
                <p className="text-xs text-gray-500 mt-1">Write &apos;DISABLED&apos; to disable</p>
              </div>
            </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-4">
                <label htmlFor="locationChangePrompt" className="text-left sm:text-right">
                  Location Change Prompt
                </label>
                <div className="col-span-3">
                  <Textarea
                    id="locationChangePrompt"
                    value={locationChangePromptText}
                    onChange={(e) => setLocationChangePromptText(e.target.value)}
                    className="w-full"
                    rows={6}
                  />
                  <p className="text-xs text-gray-500 mt-1">Lets the AI move the player between locations. Write DISABLED to turn off.</p>
                </div>
              </div>
              <div className="flex justify-end">
                <ConfirmDialog
                  title="Reset AI Prompts"
                  description="Are you sure you want to reset all AI prompts to their default values?"
                  onConfirm={handleResetPrompts}
                >
                  <Button variant="outline" className="flex items-center gap-2">
                    Reset AI Prompts
                  </Button>
                </ConfirmDialog>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="hardware" className="py-4 px-2">
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
