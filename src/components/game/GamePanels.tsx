import React, { useRef, useState } from 'react';
import { useGameplay } from '@/contexts/GameplayContext';
import { useGameplayText, setGameplayText } from '@/lib/gameplayTextStore';
import { revealActive, revealAnimName, revealVars } from '@/lib/narrationRevealConfig';
import { useGameData } from '@/contexts/GameDataContext';
import { usePlaceholderResolver } from '@/lib/usePlaceholderResolver';
import { useSettings } from '@/contexts/SettingsContext';
import { useSentenceHighlight } from '@/lib/useSentenceHighlight';
import { findEntityNames } from '@/lib/entityMatch';
import { clearTurnDerived } from '@/lib/turnDigest';
import { usePlayerModelUrl } from '@/lib/usePlayerModelUrl';
import { mergeBodyMorphs } from '@/lib/bodyMorphs';
import { useIsMobile } from '@/lib/useIsMobile';
import { usePrefersReducedMotion } from '@/lib/usePrefersReducedMotion';
import { statBarFrame, bandOrigin } from '@/lib/statBar';
import { MarkdownRenderer } from './MarkdownRenderer';
import { ReasoningBlock } from './ReasoningBlock';
import { useLiveReasoning } from '@/lib/reasoningStreamStore';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TokenAutocomplete } from "@/components/TokenAutocomplete";
import { COMMON_LANGUAGES } from "@/lib/languages";
import { Send, RefreshCw, Pencil, Languages, Loader2, Headphones, Square, ChevronUp, ChevronDown, X, Download } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Pager } from "@/components/ui/pagination";
import VRMViewer from '@/views/VRMViewer';
import { ImageZoomViewer } from '@/components/ImageZoomViewer';
import TtsPlaybackBar from './TtsPlaybackBar';
import { MemoryPanel } from './MemoryPanel';
import { GAME_LEFT_PANEL_TABS } from './leftPanelTabs';
import { useDevRoute } from '@/lib/devRouter';
import type { TTSProgress } from './TTSModal';
import { ConfirmDialog } from '../ConfirmDialog';
import { EditTextModal } from '../modals/EditTextModal';
import type { Entity, SceneEntity } from '@/types';
import { cn } from "@/lib/utils";

/** A committed turn's saved reasoning (from its assistant-message JSON), or null. */
function parseSavedReasoning(content: string): { text: string; ms: number } | null {
  try {
    const r = JSON.parse(content)?.reasoning;
    return r && typeof r.text === 'string' ? { text: r.text, ms: typeof r.ms === 'number' ? r.ms : 0 } : null;
  } catch { return null; }
}

export const LeftPanel = ({ entities, onEntityClick }: {
  entities: Entity[];
  onEntityClick: (entityId: string) => void;
}) => {
  // Import systemPrompt from settings context
  const { systemPrompt } = useSettings();
  const {
    // Aliased to the viewed-page values so paging back shows that turn's appearance + scene (they equal
    // the live values on the latest page). Body morphs still ride live `bodyMorphValues`, which the
    // GameViewer effect derives from the viewed stats.
    viewCharacterData: characterData,
    bodyMorphValues,
    viewVisibleEntities: visibleEntities,
    logEntries,
    logsEndRef,
    // Page-aware notes: live scratchpad on the current page, that turn's frozen notes on a past page (edit
    // routes to the right place). Notes stay editable on any page.
    viewNotes: playerNotes,
    setViewNotes: setPlayerNotes
  } = useGameplay();
  const playerModelUrl = usePlayerModelUrl(characterData?.playerModelId);
  // First present entity that has an image — shown in the model section's Entities view (the portrait shows
  // whether or not the name is revealed yet).
  const firstEntityImage = visibleEntities
    .map((se) => entities.find((f) =>
      f.name.toLowerCase().includes(se.name.toLowerCase()) ||
      se.name.toLowerCase().includes(f.name.toLowerCase()),
    ))
    .find((e) => e?.image)?.image;
  const isMobile = useIsMobile();
  const [showModel, setShowModel] = React.useState(true);
  // Landscape model viewer view: the player VRM vs. the detected-entity image view.
  const [modelTab, setModelTab] = React.useState("player");
  const [entityZoomOpen, setEntityZoomOpen] = React.useState(false);
  // Entity image picked from the list; falls back to the first detected entity's image.
  const [selectedEntityImage, setSelectedEntityImage] = React.useState<string | undefined>(undefined);
  const [leftTab, setLeftTab] = React.useState(isMobile ? "model" : "notes");
  const [showVRMViewer, setShowVRMViewer] = React.useState(false);

  const entityViewImage = selectedEntityImage ?? firstEntityImage;

  // Clicking an entity swaps the in-section image when the viewer is open; otherwise it opens the
  // entity popup (collapsed, on mobile, the entity has no image, or it's already the shown entity). A
  // not-yet-revealed character can show its portrait but never opens the detail popup — that would spoil
  // the name the scene is deliberately withholding.
  const handleEntityListClick = (se: SceneEntity) => {
    const match = entities.find((f) =>
      f.name.toLowerCase().includes(se.name.toLowerCase()) ||
      se.name.toLowerCase().includes(f.name.toLowerCase()),
    );
    if (!match) return; // un-named (ad-hoc) participant — nothing to show

    const entitiesViewActive = !characterData || modelTab === "entities";
    const alreadyShown = entitiesViewActive && !!match?.image && match.image === entityViewImage;
    if (!isMobile && showModel && match?.image && !alreadyShown) {
      setSelectedEntityImage(match.image);
      setModelTab("entities");
    } else if (se.revealed) {
      onEntityClick(match.name);
    }
  };

  // In landscape the model lives on top, not in a tab; leave the "model" tab.
  React.useEffect(() => {
    if (!isMobile && leftTab === "model") setLeftTab("notes");
  }, [isMobile, leftTab]);

  // DEV-only: land on a side-panel tab in one goto (`#dev?view=gameViewer&tab=memory`).
  const devRoute = useDevRoute();
  React.useEffect(() => {
    if (!import.meta.env.DEV) return;
    if (!devRoute?.modal && devRoute?.tab && (GAME_LEFT_PANEL_TABS as readonly string[]).includes(devRoute.tab)) {
      setLeftTab(devRoute.tab);
    }
  }, [devRoute?.modal, devRoute?.tab]);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setShowVRMViewer(true);
    }, 5000);
    return () => clearTimeout(timer);
  }, []);

  const modelViewer = characterData ? (
    // Mobile: fill the whole panel. Landscape: a fixed 1.2 aspect box sitting atop the panel.
    <div className={isMobile ? "relative w-full h-full" : "w-full relative"} style={isMobile ? undefined : { paddingTop: '120%' }}>
      <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center">
        {!showVRMViewer ? (
          <Loader2 className="animate-spin" size={32} />
        ) : (
          <VRMViewer
            key={playerModelUrl ?? 'default'}
            bodyMorphValues={mergeBodyMorphs(
              {
                Belly: characterData.bellySize + (characterData.bellySize || 0),
                Fat: characterData.bodyWeight + (characterData.bodyWeight || 0),
                Breasts: characterData.breastsSize + (characterData.breastsSize || 0),
                B_Pear: characterData.bodyShape.pear,
                B_HourGlass: characterData.bodyShape.hourglass,
                B_Apple: characterData.bodyShape.apple,
              },
              bodyMorphValues,
            )}
            hairColor={characterData.hairColor}
            eyeColor={characterData.eyeColor}
            skinColor={characterData.skinColor}
            hairTypes={characterData.hairTypes}
            currentHairStyle={characterData.currentHairStyle}
            hairLength={characterData.hairLength}
            modelUrl={playerModelUrl}
            extraColors={characterData.extraColors}
          />
        )}
      </div>
    </div>
  ) : null;

  return (
  <Card className="w-full md:w-1/4 md:mr-1 grow md:grow-0 min-h-0 flex flex-col bg-background/60 border-border overflow-hidden">
    <CardContent className="flex-grow flex flex-col overflow-hidden p-4 sm:p-1">
      {/* Landscape: model on top with a show/hide toggle in the upper right */}
      {!isMobile && (
        <div className="mb-2">
          <div className="relative flex items-center justify-center min-h-10">
            {/* Only worlds with a player model offer the Player/Entities swap. */}
            {characterData && (
              <Tabs value={modelTab} onValueChange={setModelTab}>
                <TabsList className="flex justify-center">
                  <TabsTrigger value="player">Player</TabsTrigger>
                  <TabsTrigger value="entities">Entities</TabsTrigger>
                </TabsList>
              </Tabs>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-0"
              onClick={() => setShowModel((s) => !s)}
              title={showModel ? "Hide model" : "Show model"}
            >
              {showModel ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
          {showModel && (
            // No model ⇒ always the Entities view (there's no Player to swap to).
            characterData && modelTab === "player"
              ? modelViewer
              : entityViewImage && (
                  <div className="w-full relative" style={{ paddingTop: '120%' }}>
                    <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center">
                      <img
                        src={entityViewImage}
                        alt=""
                        className="max-w-full max-h-full object-contain cursor-zoom-in"
                        title="Click to enlarge"
                        onClick={() => setEntityZoomOpen(true)}
                      />
                      <ImageZoomViewer
                        src={entityViewImage}
                        alt=""
                        open={entityZoomOpen}
                        onOpenChange={setEntityZoomOpen}
                      />
                    </div>
                  </div>
                )
          )}
        </div>
      )}

      <Tabs value={leftTab} onValueChange={setLeftTab} className="w-full flex-grow flex flex-col overflow-hidden">
        <TabsList className="flex-shrink-0">
          {isMobile && <TabsTrigger value="model">Model</TabsTrigger>}
          <TabsTrigger value="entities">Entities</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
          <TabsTrigger value="memory">Memory</TabsTrigger>
          <TabsTrigger value="logs">Logs ({logEntries.reduce((sum, entry) => sum + 1 + (entry.repeat || 0), 0)})</TabsTrigger>
        </TabsList>
        {isMobile && (
          <TabsContent value="model" className="flex-grow overflow-hidden min-h-[100px]">
            {modelViewer}
          </TabsContent>
        )}
        <TabsContent value="entities" className="flex-grow overflow-hidden min-h-[100px]">
          <ScrollArea className="h-[calc(100%-1rem)]">
            <div className="p-2">
              {visibleEntities.length > 0 ? (
                visibleEntities.map((se, index) => {
                  const entityItem = entities.find(f =>
                    f.name.toLowerCase().includes(se.name.toLowerCase()) ||
                    se.name.toLowerCase().includes(f.name.toLowerCase())
                  );
                  // Show the real name only once revealed; before that, how the player currently knows them.
                  const label = se.revealed ? (entityItem?.name ?? se.name) : (se.alias ?? 'Unknown');
                  const isDisabled = !entityItem;
                  return (
                    <div
                      key={index}
                      className={`mb-1 flex justify-between items-center p-2 ${
                        isDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-muted cursor-pointer'
                      }`}
                      onClick={() => handleEntityListClick(se)}
                    >
                      <span>{label}</span>
                    </div>
                  );
                })
              ) : (
                <p>No entity visible.</p>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="notes" className="flex-grow overflow-hidden min-h-[100px]">
          <div className="h-full p-2 flex flex-col">
            {!systemPrompt.includes('<NOTES>') && (
              <div className="mb-2 p-2 bg-warning/20 border border-warning rounded  text-sm">
                Warning: The current system prompt does not include the &lt;NOTES&gt; placeholder!
              </div>
            )}
            <textarea
              className="w-full flex-grow p-2 bg-background/80 border border-border rounded resize-none"
              value={playerNotes}
              onChange={(e) => setPlayerNotes(e.target.value)}
              placeholder="Add notes here... These will be sent to the AI along with your actions."
              style={{ height: "calc(100% - 8px)" }}
            />
          </div>
        </TabsContent>
        <TabsContent value="memory" className="flex-grow overflow-hidden min-h-[100px]">
          <MemoryPanel />
        </TabsContent>
        <TabsContent value="logs" className="flex-grow overflow-hidden min-h-[100px]">
          <ScrollArea className="h-[calc(100%-1rem)]">
            <div className="p-2">
              {logEntries.map((entry, index) => (
                <p key={index} className="mb-1">
                  [{Math.floor(entry.gameTime / 24)}d {entry.gameTime % 24}h] {entry.text}
                  {entry.repeat > 0 ? ` (${entry.repeat + 1})` : ''}
                </p>
              ))}
              <div ref={logsEndRef} />
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </CardContent>
  </Card>
  );
};

// One-line anchor height (matches the Send button) and the cap the popover grows to before it scrolls.
const ACTION_INPUT_LINE_H = 40;
const ACTION_INPUT_MAX_H = 240;

/**
 * The action box: a one-line field that, while focused, grows upward into an overlay popover as the text
 * needs more room — without reflowing the layout, since the grown textarea is absolutely positioned and the
 * anchor keeps its one-line footprint. Caps at ACTION_INPUT_MAX_H then scrolls; collapses back to one line on
 * blur (text preserved, clipped) and whenever the content fits. Enter submits (handled by the caller's
 * onKeyDown); Shift+Enter inserts a newline.
 */
const ActionInput = ({
  value,
  onChange,
  onKeyDown,
  placeholder,
  disabled,
}: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  placeholder: string;
  disabled: boolean;
}) => {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [focused, setFocused] = useState(false);

  // Size the textarea to its content while focused (bounded, then scroll); reset to the one-line anchor when
  // blurred. Runs on every value/focus change so growth tracks typing.
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!focused) {
      el.style.height = "";
      el.style.overflowY = "hidden";
      return;
    }
    el.style.height = "auto";
    const h = Math.min(Math.max(el.scrollHeight, ACTION_INPUT_LINE_H), ACTION_INPUT_MAX_H);
    el.style.height = `${h}px`;
    el.style.overflowY = el.scrollHeight > ACTION_INPUT_MAX_H ? "auto" : "hidden";
  }, [value, focused]);

  return (
    <div className="relative flex-grow mr-2" style={{ height: ACTION_INPUT_LINE_H }}>
      <textarea
        ref={ref}
        rows={1}
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        disabled={disabled}
        className={cn(
          // ring-inset (no ring-offset): the focus glow draws inside the box so the overflow-hidden panel
          // walls can't clip it (the box sits flush against them).
          "absolute inset-x-0 bottom-0 w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm leading-normal placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
          focused
            ? "z-20 shadow-lg whitespace-pre-wrap"
            : "h-10 overflow-hidden whitespace-nowrap",
        )}
      />
    </div>
  );
};

export const MiddlePanel = ({
  parseAssistantMessage,
  totalPages,
  handlePageChange,
  handleSendAction,
  handleKeyPress,
  handleRollback,
  handleRegenerate,
  handleRegenerateChoices,
  handleRegenerateStats,
  abortGeneration,
  disabled,
  onTTSClick,
  onExportStory,
  onRegenerateTTS,
  ttsLoaded,
  ttsGenerating,
  ttsProgress,
  memoryBar,
  progressBar,
  locationSuggestion,
  commandPreview,
  onDismissCommandPreview
}: {
  parseAssistantMessage: (content: string) => string;
  totalPages: number;
  handlePageChange: (page: number) => void;
  handleSendAction: () => void;
  handleKeyPress: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  handleRollback: () => void;
  handleRegenerate: () => void;
  handleRegenerateChoices: () => void;
  handleRegenerateStats: () => void;
  abortGeneration: () => void;
  disabled: boolean;
  onTTSClick: () => void;
  onExportStory: () => void;
  onRegenerateTTS: () => Promise<void> | void;
  ttsLoaded: boolean;
  ttsGenerating: boolean;
  ttsProgress: TTSProgress | null;
  memoryBar: React.ReactNode;
  progressBar: React.ReactNode;
  locationSuggestion: React.ReactNode;
  commandPreview: boolean;
  onDismissCommandPreview: () => void;
}) => {
  const { entities } = useGameData();
  const {
    displayedMessages,
    setDisplayedMessages,
    currentPage,
    playerInput,
    setPlayerInput,
    isWaitingForAI,
    isRevealingNarration,
    isFlashing,
    isEditMode,
    setIsEditMode,
    ttsPlayback,
    setFullMessageHistory,
    playerStats,
    isViewingPast,
    viewChoices: choices,
    viewSelectedChoice
  } = useGameplay();
  const gameplayText = useGameplayText();
  const { ttsHighlight, choicesEnabled, statUpdatesEnabled, revealSpec, revealEasing, showReasoning } = useSettings();
  const liveReasoning = useLiveReasoning();
  // Per-word reveal: any enabled effect ⇒ animate (composed keyframe + CSS vars on the container);
  // nothing enabled ⇒ smooth crawl. The keyframe name feeds Streamdown, the amounts ride as CSS vars.
  const revealOn = revealActive(revealSpec);
  const revealAnim = revealAnimName(revealSpec);
  const revealStyle = revealVars(revealSpec) as React.CSSProperties;
  // Which partial re-generate options the flyout should offer (mirrors the aux-request gates).
  const canRegenChoices = choicesEnabled;
  const canRegenStats = statUpdatesEnabled && playerStats.length > 0;
  const [regenMenuOpen, setRegenMenuOpen] = useState(false);

  // Ctrl/Cmd+click or a touch long-press appends a choice as a new sentence; a plain tap replaces it.
  const appendChoice = (choice: string) =>
    setPlayerInput((prev) => (prev.trim() ? `${prev.replace(/[.\s]+$/, '')}. ${choice}` : choice));
  // Long-press tracking (touch): a fired press appends and marks the following click to be swallowed.
  const longPress = useRef<{ timer: ReturnType<typeof setTimeout> | null; fired: boolean }>({ timer: null, fired: false });
  const startLongPress = (choice: string) => {
    longPress.current.fired = false;
    longPress.current.timer = setTimeout(() => {
      longPress.current.fired = true;
      appendChoice(choice);
    }, 500);
  };
  const cancelLongPress = () => {
    if (longPress.current.timer) clearTimeout(longPress.current.timer);
    longPress.current.timer = null;
  };

  // Whether TTS has produced playable audio for the current text (drives the frozen top row).
  const hasAudio = ttsPlayback.duration > 0;

  // Karaoke highlighter: paint the spoken sentence in the current page's narration as audio plays.
  const narrationRef = useRef<HTMLDivElement>(null);
  useSentenceHighlight(narrationRef, {
    activeSentenceIndex: ttsPlayback.activeSentenceIndex,
    sentenceTexts: ttsPlayback.sentenceTexts,
    enabled: ttsHighlight,
  });

  // Game text of the page currently being viewed, so the Edit button is page-aware
  // (rather than always editing the most recent text).
  const currentAssistantMessage = displayedMessages.find(m => m.role === 'assistant');
  let currentPageText = gameplayText;
  if (currentAssistantMessage) {
    try {
      // Read the current `narration` field, falling back to legacy `game_text` (pre-rename saves).
      const parsed = JSON.parse(currentAssistantMessage.content);
      currentPageText = parsed.narration ?? parsed.game_text ?? currentAssistantMessage.content;
    } catch {
      currentPageText = currentAssistantMessage.content;
    }
  }

  return (
    <Card className="w-full flex-grow md:mx-0.5 md:max-w-[48%] min-h-0 flex flex-col bg-background/60 border-border overflow-hidden">
      <CardContent className="flex-grow flex flex-col overflow-hidden p-4 sm:p-1">
        {memoryBar}
        {/* Determinate generation progress (sentence X of N) while narration synthesizes; playback
            itself is driven by the TtsPlaybackBar below. */}
        {ttsGenerating && ttsProgress && (
          <div className="flex items-center gap-2 px-1 pb-1">
            <Progress value={(ttsProgress.done / ttsProgress.total) * 100} className="h-1.5 flex-1" />
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              Narrating {Math.min(ttsProgress.done + 1, ttsProgress.total)}/{ttsProgress.total}
            </span>
          </div>
        )}
        {/* gap-2 gives every row below (message area, pager, Start Game, input) consistent spacing. */}
        <div className="flex flex-col flex-grow overflow-hidden gap-2">
          {/* Once audio exists, the seek bar is frozen above the scroll area (rather than scrolling with the
              narration) and carries the audio-specific buttons on its row. */}
          {hasAudio && (
            <div className="flex items-center gap-2 shrink-0">
              <TtsPlaybackBar className="w-auto flex-grow" />
              {ttsLoaded && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onRegenerateTTS()}
                  disabled={ttsGenerating}
                  title="Regenerate audio for current text"
                >
                  {ttsGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={onTTSClick}
              >
                <Headphones className="h-4 w-4" />
              </Button>
            </div>
          )}
          <ScrollArea className={`narration-text flex-grow border border-border p-2 bg-muted/80 min-h-0 ${isFlashing ? 'flash-animation' : ''} relative`}>
            <div className="absolute top-2 right-2 z-10 flex gap-2">
              {!hasAudio && ttsLoaded && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onRegenerateTTS()}
                  disabled={ttsGenerating}
                  title="Regenerate audio for current text"
                >
                  {ttsGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                </Button>
              )}
              {!hasAudio && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onTTSClick}
                >
                  <Headphones className="h-4 w-4" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={onExportStory}
                title="Export story"
              >
                <Download className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsEditMode(true)}
              >
                <Pencil className="h-4 w-4" />
              </Button>
            </div>
            {commandPreview && (
              <div className="mb-3 p-2 border border-dashed border-primary/50 rounded relative">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-muted-foreground">Markdown preview (/markdown test)</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onDismissCommandPreview} title="Dismiss preview">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div style={revealStyle}>
                  <MarkdownRenderer text={gameplayText} animate={revealOn} animation={revealAnim} easing={revealEasing} />
                </div>
              </div>
            )}
            {displayedMessages.map((message, index) => {
              const isLatestMessage = index === displayedMessages.length - 1;
              // The live stream (narration + reasoning) belongs only to the current turn on the latest page.
              // While viewing history, generation keeps running in the background but this page shows the
              // paged turn's committed text — the stream must not bleed onto it (`isLatestMessage` alone is
              // page-local, so a past page's last message would otherwise pick up the live reveal).
              const showLiveReveal = !isViewingPast && isLatestMessage && isRevealingNarration;
              return (
                <div key={index} className={`mb-2 ${message.role === 'user' ? 'text-warning' : ''}`}>
                  <strong>{message.role === 'user' ? 'You:' : 'Event:'}</strong>
                  {message.role === 'user' ? (
                    <div className="whitespace-pre-wrap">{message.content}</div>
                  ) : (
                    <div ref={narrationRef} style={revealStyle}>
                      {/* The turn's reasoning aside, above the narration: live for the streaming latest turn
                          on the current page, otherwise this turn's saved scratchpad. */}
                      {showReasoning && (() => {
                        const useLive = !isViewingPast && isLatestMessage && !!liveReasoning.text;
                        const r = useLive ? liveReasoning : parseSavedReasoning(message.content);
                        return r?.text ? <ReasoningBlock text={r.text} ms={r.ms} active={useLive && liveReasoning.active} /> : null;
                      })()}
                      {/* Show the live reveal only while THIS turn's narration is actually streaming and we're
                          on the current page; during setup/thinking (or after), or while viewing history, show
                          the committed text so stale/other-turn text can't animate all at once. */}
                      <MarkdownRenderer text={showLiveReveal ? gameplayText : parseAssistantMessage(message.content)} animate={showLiveReveal && revealOn} animation={revealAnim} easing={revealEasing} />
                    </div>
                  )}
                </div>
              );
            })}
            {/* Thinking phase: the narration's assistant message isn't in history yet, so show the live
                reasoning block on its own (below the just-submitted action) until narration commits it. */}
            {showReasoning && liveReasoning.text && displayedMessages[displayedMessages.length - 1]?.role === 'user' && (
              <div className="mb-2">
                <ReasoningBlock text={liveReasoning.text} ms={liveReasoning.ms} active={liveReasoning.active} />
              </div>
            )}
            <div className="mt-4 flex flex-col gap-2">
                {choices && choices.length > 0 && choices.map((choice, index) => {
                  // On a past page, highlight the inferred choice(s) the player acted on; on the live page,
                  // any choice whose text is staged in the input box (plain-click replaces, shift-click appends).
                  const isSelected = isViewingPast ? viewSelectedChoice.includes(index) : playerInput.includes(choice);
                  return (
                    <Button
                      key={index}
                      // Ctrl/Cmd+click (or a touch long-press) appends the choice as a new sentence; a plain tap replaces.
                      onClick={(e) => {
                        if (longPress.current.fired) { longPress.current.fired = false; return; } // swallow the click after a long-press
                        if (e.ctrlKey || e.metaKey) appendChoice(choice); else setPlayerInput(choice);
                      }}
                      onPointerDown={() => startLongPress(choice)}
                      onPointerUp={cancelLongPress}
                      onPointerLeave={cancelLongPress}
                      onPointerCancel={cancelLongPress}
                      disabled={disabled || isViewingPast}
                      variant={isSelected ? "default" : "outline"}
                      className={`w-full transition-all duration-200 h-auto min-h-[3rem] whitespace-normal
                        ${isSelected
                          ? "bg-primary text-primary-foreground font-bold shadow-lg"
                          : "border-primary hover:bg-accent hover:text-accent-foreground"
                        }`}
                    >
                      {choice.split('**').map((part, i) =>
                        i % 2 === 0 ?
                          <span key={i}>{part}</span> :
                          <strong key={i}>{part}</strong>
                      )}
                    </Button>
                  );
                })}
            </div>
          </ScrollArea>
          <EditTextModal
            isOpen={isEditMode}
            onOpenChange={setIsEditMode}
            text={currentPageText}
            onSave={(text) => {
              // Only the most recent page drives the live gameplay text (used by TTS, etc.).
              if (currentPage === totalPages) setGameplayText(text);
              // Update the message in history for the current page
              const messageIndex = (currentPage - 1) * 2 + 1; // +1 for assistant message
              setFullMessageHistory(prev => {
                const updatedHistory = [...prev];
                let editedTurnId: string | undefined;
                if (messageIndex < updatedHistory.length) {
                  const message = updatedHistory[messageIndex];
                  if (message.role === 'assistant') {
                    try {
                      const content = JSON.parse(message.content);
                      editedTurnId = content.turnId;
                      updatedHistory[messageIndex] = {
                        role: 'assistant',
                        content: JSON.stringify({
                          ...content,
                          narration: text,
                          // Re-derive participants from the edited text so they don't go stale.
                          entities: findEntityNames(text, entities)
                        })
                      };
                    } catch {
                      // If parsing fails, create new content object
                      updatedHistory[messageIndex] = {
                        role: 'assistant',
                        content: JSON.stringify({
                          narration: text,
                          choices: choices,
                          stat_changes: [],
                          entities: findEntityNames(text, entities)
                        })
                      };
                    }
                  }
                }
                // Editing the narration invalidates this turn's memory digest + character diaries (both
                // derive from the old text); drop them so the drainers rebuild from the edit.
                if (editedTurnId) {
                  return clearTurnDerived(updatedHistory, editedTurnId, { diaries: true }) ?? updatedHistory;
                }
                return updatedHistory;
              });
              // Force update of displayed messages
              setDisplayedMessages(prev => {
                const updatedMessages = [...prev];
                const assistantMessageIndex = updatedMessages.findIndex(m => m.role === 'assistant');
                if (assistantMessageIndex !== -1) {
                  try {
                    const content = JSON.parse(updatedMessages[assistantMessageIndex].content);
                    updatedMessages[assistantMessageIndex] = {
                      role: 'assistant',
                      content: JSON.stringify({
                        ...content,
                        narration: text
                      })
                    };
                  } catch {
                    updatedMessages[assistantMessageIndex] = {
                      role: 'assistant',
                      content: JSON.stringify({
                        narration: text,
                        choices: choices,
                        stat_changes: []
                      })
                    };
                  }
                }
                return updatedMessages;
              });
            }}
          />
          <div className="relative flex flex-col items-center gap-2">
            {locationSuggestion}
            <div className="relative flex w-full items-center justify-center">
              <Pager page={currentPage} pageCount={totalPages} onPageChange={handlePageChange} className="justify-start md:justify-center" />
              {/* Right-aligned action: rollback when viewing a past page, re-generate on the current one. */}
              <div className="absolute right-0">
                {currentPage < totalPages ? (
                  <ConfirmDialog
                    title="Confirm Rollback"
                    description="Are you sure you want to rollback to the previous state? This action cannot be undone."
                    onConfirm={handleRollback}
                  >
                    <Button variant="outline" className="text-xs gap-1 w-32" disabled={isWaitingForAI}>
                      <RefreshCw className="h-3 w-3" />
                      Rollback
                    </Button>
                  </ConfirmDialog>
                ) : totalPages > 0 ? (
                  <div className="flex">
                    {/* Left half: full re-generate, unchanged. Right caret opens the partial-regenerate flyout. */}
                    <Button
                      variant="outline"
                      aria-label="Re-generate"
                      className={`text-xs gap-1 ${canRegenChoices || canRegenStats ? "rounded-r-none md:w-28" : "md:w-32"}`}
                      onClick={handleRegenerate}
                      disabled={isWaitingForAI}
                    >
                      <RefreshCw className="h-3 w-3" />
                      <span className="hidden md:inline">Re-generate</span>
                    </Button>
                    {(canRegenChoices || canRegenStats) && (
                      <Popover open={regenMenuOpen} onOpenChange={setRegenMenuOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className="rounded-l-none border-l-0 px-2"
                            disabled={isWaitingForAI}
                            aria-label="More re-generate options"
                          >
                            <ChevronUp className="h-3 w-3" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent side="top" align="end" className="w-48 p-1">
                          <div className="flex flex-col">
                            {canRegenStats && (
                              <Button
                                variant="ghost"
                                className="justify-start text-xs h-8"
                                onClick={() => { setRegenMenuOpen(false); handleRegenerateStats(); }}
                              >
                                Re-generate Stats
                              </Button>
                            )}
                            {canRegenChoices && (
                              <Button
                                variant="ghost"
                                className="justify-start text-xs h-8"
                                onClick={() => { setRegenMenuOpen(false); handleRegenerateChoices(); }}
                              >
                                Re-generate Choices
                              </Button>
                            )}
                          </div>
                        </PopoverContent>
                      </Popover>
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
          {progressBar}
          <div className="flex flex-col gap-2">
            <div className="flex items-end">
              <ActionInput
                value={playerInput}
                onChange={(e) => setPlayerInput(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="Type your action..."
                disabled={disabled}
              />
              {isWaitingForAI ? (
                <Button
                  onClick={abortGeneration}
                  variant="destructive"
                  className="border-dashed border-2 w-32"
                >
                  <Square className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  onClick={handleSendAction}
                  disabled={disabled}
                  className="border-dashed border-2 w-32"
                >
                  <Send className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

/**
 * A stat bar with an animated +/- change band. One shared mechanism covers every case (an AI-computed
 * change, paging between turns, and a band draining on submit): the accent fill slides from the turn's
 * previous value to its current value, and a colored band (`bg-success` gain / `bg-destructive` loss) is
 * painted over the [prev, cur] region on top. `delta` is the signed change the band represents (`cur − prev`);
 * `draining` collapses last turn's band back toward the current value on submit (accent unmoved), leaving a
 * clean bar before the next turn grows. Geometry is the pure `statBarFrame`; under reduced-motion everything
 * snaps to its final state (no slide/grow, no drain band). `animKey` re-triggers the animation when the
 * value+delta coincide between turns (e.g. scrolling between two past turns) — pass the page number.
 */
const StatBar = ({ value, min, max, delta, draining, animKey }: {
  value: number; min: number; max: number; delta: number; draining: boolean;
  animKey?: string | number;
}) => {
  const reduce = usePrefersReducedMotion();
  // The band always spans the turn's previous value (`value − delta`) to its current value, whether it's
  // growing in or draining away; only the animation and the accent's motion differ.
  const frame = statBarFrame(value - delta, value, min, max);
  const key = `${value}-${delta}-${animKey ?? ''}`;
  return (
    <div className="relative h-4 w-full overflow-hidden rounded-full bg-secondary">
      <div
        // Accent slides prev→cur on a grow; on a drain the value is unchanged so it holds at its width.
        key={`fill-${key}`}
        className={`absolute inset-y-0 left-0 bg-primary ${!reduce && !draining ? 'stat-fill-slide' : ''}`}
        style={{
          width: `${frame.curPct}%`,
          ['--fill-from']: `${frame.prevPct}%`,
          ['--fill-to']: `${frame.curPct}%`,
        } as React.CSSProperties}
      />
      {frame.hasBand && !(reduce && draining) && (
        <div
          key={`${draining ? 'drain' : 'grow'}-${key}`}
          className={`${reduce ? '' : draining ? 'stat-delta-drain' : 'stat-delta-grow'} absolute inset-y-0 ${frame.gain ? 'bg-success' : 'bg-destructive'}`}
          style={{
            left: `${frame.bandLeftPct}%`,
            width: `${frame.bandWidthPct}%`,
            transformOrigin: bandOrigin(frame.gain, draining),
          }}
        />
      )}
    </div>
  );
};

export const RightPanel = ({ onLocationClick, language, setLanguage }: {
  onLocationClick: () => void;
  language: string;
  setLanguage: (value: string) => void;
}) => {
  const {
    // Aliased to the viewed-page values (equal to live on the latest page) so paging back shows that
    // turn's stats/traits/time/deltas read-only. `commitManualStatEdit` writes live and rebaselines the
    // snapshot — the edit control is disabled while viewing the past, so it only runs on the latest page.
    viewGameTime: gameTime,
    currentLocation,
    viewLocationId,
    isViewingPast,
    currentPage,
    totalPages,
    activeTab,
    setActiveTab,
    viewStats: playerStats,
    commitManualStatEdit,
    viewTraits: playerTraits,
    viewStatChanges: recentStatChanges,
    recentStatFading,
    heldStatChanges,
    drainingStatChanges
  } = useGameplay();
  const { locations } = useGameData();
  const resolvePH = usePlaceholderResolver();
  const [isEditMode, setIsEditMode] = React.useState(false);
  // On a past page show the viewed turn's location (Location tab); live otherwise.
  const displayLocation = isViewingPast
    ? (locations.find((l) => l.id === viewLocationId) ?? currentLocation)
    : currentLocation;

  return (
    <Card className="w-full md:w-1/4 md:ml-1 grow md:grow-0 min-h-0 flex flex-col md:h-full bg-background/60 border-border overflow-hidden">
      <CardContent className="flex flex-col h-full overflow-hidden p-4 sm:p-1">
      <div className="mb-4 sm:mb-1 flex-shrink-0 flex flex-col gap-2">
        <div className="flex items-center gap-2 pl-2">
          <Languages className="h-6 w-6 shrink-0" />
          <div className="flex-grow">
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
        <p className="text-center">{Math.floor(gameTime / 24)} days, {gameTime % 24} hours</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex-grow flex flex-col overflow-hidden">
        <TabsList className="flex-shrink-0">
          <TabsTrigger value="stats">Stats</TabsTrigger>
          <TabsTrigger value="traits">Traits</TabsTrigger>
          <TabsTrigger value="location">Location</TabsTrigger>
        </TabsList>
        <TabsContent value="stats" className="flex-grow overflow-hidden">
          <ScrollArea className="h-[calc(100%-1rem)] relative">
            {playerStats.map((stat, index) => {
              const statValue = stat.value as number;
              const isPercentage = stat.type === 'percentage';
              const change = recentStatChanges[stat.name.toLowerCase()] || 0;
              return (
              <div key={index} className="mb-2">
                <div className="flex justify-between items-center">
                  <span>{stat.name}</span>
                  <div className="flex items-center gap-2">
                    {change !== 0 && (
                      <span
                        key={`${currentPage}-${change}`}
                        className={`${isViewingPast ? 'stat-delta-text-in' : (recentStatFading ? 'stat-delta-text-out' : 'stat-delta-text')} text-sm ${change > 0 ? 'text-success' : 'text-destructive'}`}
                      >
                        {change > 0 ? '+' : ''}{change}
                      </span>
                    )}
                    <span>{isPercentage ? `${statValue}%` : `${statValue} / ${stat.max}`}</span>
                  </div>
                </div>
                {isEditMode && !isViewingPast ? (
                  <Slider
                    value={[statValue]}
                    min={stat.min}
                    max={stat.max}
                    step={1}
                    className="mt-2"
                    onValueChange={(value) => {
                      const newStats = [...playerStats];
                      newStats[index] = { ...stat, value: value[0] };
                      commitManualStatEdit(newStats);
                    }}
                  />
                ) : (
                  <StatBar
                    value={statValue}
                    min={stat.min}
                    max={stat.max}
                    // While reviewing a past turn, show that turn's change as a persistent, animate-in band
                    // (green/red grow); live, use the transient held/draining deltas.
                    // Live: a held change grows, else a draining change collapses. History: the turn's change
                    // grows in (never drains). Both feed the same (value − delta → value) geometry.
                    delta={isViewingPast
                      ? change
                      : (heldStatChanges[stat.name.toLowerCase()] || drainingStatChanges[stat.name.toLowerCase()] || 0)}
                    draining={!isViewingPast
                      && !heldStatChanges[stat.name.toLowerCase()]
                      && !!drainingStatChanges[stat.name.toLowerCase()]}
                    animKey={isViewingPast ? currentPage : undefined}
                  />
                )}
              </div>
              );
            })}
            <div className="absolute bottom-2 right-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsEditMode(!isEditMode)}
                disabled={isViewingPast}
                className="h-8 w-8"
              >
                <Pencil className="h-4 w-4" />
              </Button>
            </div>
          </ScrollArea>
        </TabsContent>
        <TabsContent value="traits" className="flex-grow overflow-hidden">
          <ScrollArea className="h-[calc(100%-1rem)]">
            {playerTraits.length > 0 ? (
              playerTraits.map((trait, index) => (
                <div key={index} className="mb-1">
                  <span>{trait.name}{trait.playerDescription ? `: ${resolvePH(trait.playerDescription)}` : ''}</span>
                </div>
              ))
            ) : (
              <p>No traits acquired.</p>
            )}
          </ScrollArea>
        </TabsContent>
        <TabsContent value="location" className="flex-grow overflow-hidden">
          <ScrollArea className="h-[calc(100%-1rem)]">
            <div className="p-2 flex flex-col gap-4">
              <Button onClick={onLocationClick} disabled={isViewingPast} className="w-full">
                {isViewingPast ? 'Location' : 'Current Location'}: {displayLocation?.name || 'Unknown'}
              </Button>
              {displayLocation && (
                <div className="space-y-2">
                  <p className="font-semibold">Description:</p>
                  <p className="text-sm">{resolvePH(displayLocation.playerDescription || displayLocation.description || '')}</p>
                  {displayLocation.connections && displayLocation.connections.length > 0 && (
                    <>
                      <p className="font-semibold mt-4">Connected Locations:</p>
                      <ul className="list-disc list-inside text-sm">
                        {displayLocation.connections.map((connection, index) => (
                          <li key={index}>{connection}</li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              )}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
      {isViewingPast && (
        <p className="text-center text-xs font-medium text-primary bg-primary/10 rounded py-0.5 mt-2 flex-shrink-0">
          Viewing turn {currentPage} of {totalPages} — history
        </p>
      )}
    </CardContent>
  </Card>
  );
};
