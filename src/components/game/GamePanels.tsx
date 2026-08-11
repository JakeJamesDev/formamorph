import React, { useRef, useState } from 'react';
import { useGameplay } from '@/contexts/GameplayContext';
import { useGameplayText, setGameplayText } from '@/lib/gameplayTextStore';
import { revealActive, revealAnimName, revealVars } from '@/lib/narrationRevealConfig';
import { usePlaceholderResolver } from '@/lib/usePlaceholderResolver';
import { useSettings } from '@/contexts/SettingsContext';
import { useSentenceHighlight } from '@/lib/useSentenceHighlight';
import { findEntityNames } from '@/lib/entityMatch';
import { clearTurnDerived } from '@/lib/turnDigest';
import { usePlayerModelUrl } from '@/lib/usePlayerModelUrl';
import { mergeBodyMorphs } from '@/lib/bodyMorphs';
import { useIsMobile } from '@/lib/useIsMobile';
import { usePrefersReducedMotion } from '@/lib/usePrefersReducedMotion';
import { statBarFrame, bandOrigin, formatStatDelta } from '@/lib/statBar';
import { traitOrderIndex, inAuthoredOrder, activeStatEnabled, refreshChosenTraits } from '@/lib/traitEffects';
import { MarkdownRenderer } from './MarkdownRenderer';
import { ReasoningBlock } from './ReasoningBlock';
import { useLiveReasoning } from '@/lib/reasoningStreamStore';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TokenAutocomplete } from "@/components/TokenAutocomplete";
import { COMMON_LANGUAGES } from "@/lib/languages";
import { Send, RefreshCw, Pencil, Languages, Loader2, Headphones, Square, ChevronUp, ChevronDown, X, Download, Trash2, Image as ImageIcon, Dices, MoreHorizontal } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { CONTINUE_CHOICE } from "@/lib/choices";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Pager } from "@/components/ui/pagination";
import VRMViewer from '@/views/VRMViewer';
import { EntityVisual, hasEntityVisual } from './EntityVisual';
import { useEntityVisualPreference } from '@/lib/useEntityVisualPreference';
import { useEntityGallery } from '@/lib/useEntityGallery';
import TtsPlaybackBar from './TtsPlaybackBar';
import { MemoryPanel } from './MemoryPanel';
import { SceneImagePanel } from './SceneImagePanel';
import { GAME_LEFT_PANEL_TABS } from './leftPanelTabs';
import { useDevRoute } from '@/lib/devRouter';
import type { TTSProgress } from './TTSModal';
import { ConfirmDialog } from '../ConfirmDialog';
import { HelpButton } from '../HelpButton';
import { EditTextModal } from '../modals/EditTextModal';
import type { Entity, SceneEntity } from '@/types';
import { formatAbsolute, formatClock } from '@/lib/gameClock';
import { logKind } from '@/lib/playLog';
import { cn } from "@/lib/utils";
import { useResolvedWorld } from '@/lib/useResolvedWorld';

/** A committed turn's saved reasoning (from its assistant-message JSON), or null. */
function parseSavedReasoning(content: string): { text: string; ms: number } | null {
  try {
    const r = JSON.parse(content)?.reasoning;
    return r && typeof r.text === 'string' ? { text: r.text, ms: typeof r.ms === 'number' ? r.ms : 0 } : null;
  } catch { return null; }
}

export const LeftPanel = ({ entities, onEntityClick, onRegenerateMemory }: {
  entities: Entity[];
  onEntityClick: (entityId: string) => void;
  /** Re-run the digest prompt for one turn (Memory Manager's regenerate); owned by GameViewer. */
  onRegenerateMemory?: (turnId: string) => Promise<boolean>;
}) => {
  // Import systemPrompt from settings context
  const { systemPrompt } = useSettings();
  // The authored cast, separate from the `entities` prop (authored + runtime-discovered).
  // Resolved, not the authored context: a chip-bearing name compared against a resolved scene name would
  // read as a character the world never defined.
  const { entities: authoredEntities } = useResolvedWorld();
  const {
    // Aliased to the viewed-page values so paging back shows that turn's appearance + scene (they equal
    // the live values on the latest page). Body morphs still ride live `bodyMorphValues`, which the
    // GameViewer effect derives from the viewed stats.
    viewCharacterData: characterData,
    bodyMorphValues,
    viewVisibleEntities: visibleEntities,
    logEntries,
    calendar,
    logsEndRef,
    // Page-aware notes: live scratchpad on the current page, that turn's frozen notes on a past page (edit
    // routes to the right place). Notes stay editable on any page.
    viewNotes: playerNotes,
    setViewNotes: setPlayerNotes,
    // Runtime-discovered cast: shown with a badge and removable, since the story invents these and an
    // occasional wrong guess (a place read as a person) needs a way out.
    setDiscoveredEntities,
    setSuppressedCharacterNames,
    setVisibleEntities,
    setIsEditMode,
  } = useGameplay();
  // The discovered character awaiting delete confirmation, or null.
  const [pendingRemoval, setPendingRemoval] = useState<string | null>(null);
  // Authored cast only — the panel receives authored + discovered together, and the two need telling
  // apart to decide what the player may remove.
  const authoredNames = new Set(authoredEntities.map((e) => e.name));
  const removeDiscovered = (name: string) => {
    // Suppression is what makes the deletion stick: without it the next turn naming them promotes
    // them straight back.
    setDiscoveredEntities((prev) => prev.filter((d) => d.entity.name !== name));
    setSuppressedCharacterNames((prev) => (prev.includes(name) ? prev : [...prev, name]));
    // Also drop them from the live scene list, or the row lingers as a dead, unopenable entry that
    // no longer resolves to any entity.
    setVisibleEntities((prev) => prev.filter((se) => se.name !== name));
    setPendingRemoval(null);
  };
  const { url: playerModelUrl, resolving: modelResolving } = usePlayerModelUrl(characterData?.playerModelId);
  // First present entity with something to show — an image, or failing that a 3D model — displayed in the
  // model section's Entities view (the portrait shows whether or not the name is revealed yet).
  const firstShowableEntity = visibleEntities
    .map((se) => entities.find((f) =>
      f.name.toLowerCase().includes(se.name.toLowerCase()) ||
      se.name.toLowerCase().includes(f.name.toLowerCase()),
    ))
    .find((e) => hasEntityVisual(e));
  const isMobile = useIsMobile();
  const [showModel, setShowModel] = React.useState(true);
  // Landscape model viewer view: the player VRM vs. the detected-entity view.
  const [modelTab, setModelTab] = React.useState("avatar");
  // Entity picked from the list; falls back to the first detected showable entity.
  const [selectedEntityName, setSelectedEntityName] = React.useState<string | undefined>(undefined);
  const [leftTab, setLeftTab] = React.useState(isMobile ? "model" : "notes");

  const entityViewEntity =
    entities.find((e) => e.name === selectedEntityName) ?? firstShowableEntity;
  const entityViewPreference = useEntityVisualPreference(entityViewEntity?.id);
  const entityViewGallery = useEntityGallery(entityViewEntity);

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
    const alreadyShown = entitiesViewActive && match === entityViewEntity;
    if (!isMobile && showModel && hasEntityVisual(match) && !alreadyShown) {
      setSelectedEntityName(match.name);
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
    // The Memory Manager opens from inside the Memory tab, so route to the tab first — MemoryPanel opens
    // the modal itself once mounted.
    if (devRoute?.modal === 'memoryManager') {
      setLeftTab('memory');
      return;
    }
    // The narration editor is otherwise only reachable mid-game, behind a played turn.
    if (devRoute?.modal === 'editText') {
      setIsEditMode(true);
      return;
    }
    if (!devRoute?.modal && devRoute?.tab && (GAME_LEFT_PANEL_TABS as readonly string[]).includes(devRoute.tab)) {
      setLeftTab(devRoute.tab);
    }
  }, [devRoute?.modal, devRoute?.tab, setIsEditMode]);

  const modelViewer = characterData ? (
    // Mobile: fill the whole panel. Landscape: a fixed 1.2 aspect box sitting atop the panel.
    <div className={isMobile ? "relative w-full h-full" : "w-full relative"} style={isMobile ? undefined : { paddingTop: '120%' }}>
      <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center">
        {modelResolving ? (
          // Hold a loader while a library model's blob resolves, so we don't transiently mount the bundled
          // default (which would report default capabilities and flash before the real model swaps in).
          <Loader2 className="animate-spin" size={32} />
        ) : (
          <VRMViewer
            key={playerModelUrl ?? 'default'}
            bodyMorphValues={mergeBodyMorphs(characterData.bodyMorphs, bodyMorphValues)}
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
            {/* Only worlds with a player model offer the Avatar/Entities swap. */}
            {characterData && (
              <ToggleGroup
                type="single"
                value={modelTab}
                // A single ToggleGroup clears its value when the active item is clicked again; one of the two
                // is always shown, so an empty result is ignored rather than stored.
                onValueChange={(v) => { if (v) setModelTab(v); }}
              >
                <ToggleGroupItem value="avatar">Avatar</ToggleGroupItem>
                <ToggleGroupItem value="entities">Entities</ToggleGroupItem>
              </ToggleGroup>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-0"
              onClick={() => setShowModel((s) => !s)}
              title={showModel ? "Hide Avatar" : "Show Avatar"}
            >
              {showModel ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
          {showModel && (
            // No model ⇒ always the Entities view (there's no Avatar to swap to).
            characterData && modelTab === "avatar"
              ? modelViewer
              : entityViewEntity && (
                  <div className="w-full relative" style={{ paddingTop: '120%' }}>
                    <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center">
                      <EntityVisual
                        key={entityViewEntity.id}
                        entity={entityViewEntity}
                        preference={entityViewPreference.preference}
                        onPreferenceChange={entityViewPreference.onPreferenceChange}
                        imageIndex={entityViewGallery.imageIndex}
                        onImageStep={entityViewGallery.onImageStep}
                      />
                    </div>
                  </div>
                )
          )}
        </div>
      )}

      <Tabs value={leftTab} onValueChange={setLeftTab} className="w-full flex-grow flex flex-col overflow-hidden">
        <TabsList className="flex-shrink-0">
          {isMobile && <TabsTrigger value="model">Avatar</TabsTrigger>}
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
        {/* `flex` must be state-scoped: a plain `flex` class beats the UA `[hidden]{display:none}` Radix
            uses to hide an inactive panel, so the list would keep its space and shove the live tab down. */}
        <TabsContent value="entities" className="flex-grow overflow-hidden min-h-[100px] flex-col data-[state=active]:flex">
          {/* Shown even when the list is empty — "no entity visible" is itself the state that prompts
              the question, so the `?` has to be reachable then too. */}
          <div className="flex-shrink-0 flex justify-end px-2 pt-1">
            <HelpButton topicId="game.entities" className="h-6 w-6" />
          </div>
          <ScrollArea className="flex-grow min-h-0">
            <div className="p-2">
              {visibleEntities.length > 0 ? (
                visibleEntities.map((se, index) => {
                  const entityItem = entities.find(f =>
                    f.name.toLowerCase().includes(se.name.toLowerCase()) ||
                    se.name.toLowerCase().includes(f.name.toLowerCase())
                  );
                  // Show the real name only once revealed; before that, how the player currently knows them.
                  const label = se.revealed ? (entityItem?.name ?? se.name) : (se.alias ?? 'Unknown');
                  // A name the story invented has no entity behind it until (and unless) a description is
                  // written for it, so it reads as a normal row that simply doesn't open — not as a
                  // broken one. Only an authored entry we failed to resolve is genuinely disabled.
                  const isAuthored = authoredNames.has(label);
                  const isDisabled = !entityItem && isAuthored;
                  // Anything the story invented is removable, whether or not it got a description.
                  // Authored characters belong to the world and are never deletable from play.
                  const isRemovable = !isAuthored;
                  return (
                    <div
                      key={index}
                      className={`mb-1 flex justify-between items-center gap-2 p-2 ${
                        isDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-muted cursor-pointer'
                      }`}
                      onClick={() => handleEntityListClick(se)}
                    >
                      <span className="min-w-0 truncate">{label}</span>
                      {isRemovable && (
                        <span className="flex items-center gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-destructive"
                            aria-label={`Remove ${label}`}
                            title={`Remove ${label}`}
                            onClick={(e) => { e.stopPropagation(); setPendingRemoval(label); }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </span>
                      )}
                    </div>
                  );
                })
              ) : (
                <p>No entity visible.</p>
              )}
            </div>
          </ScrollArea>
          <ConfirmDialog
            open={pendingRemoval !== null}
            onOpenChange={(o) => { if (!o) setPendingRemoval(null); }}
            title={`Remove ${pendingRemoval ?? ''}?`}
            description="This character was invented by the story rather than authored. Removing them takes them out of the scene and stops them being brought back later. Authored characters are unaffected."
            onConfirm={() => { if (pendingRemoval) removeDiscovered(pendingRemoval); }}
            onCancel={() => setPendingRemoval(null)}
          />
        </TabsContent>

        <TabsContent value="notes" className="flex-grow overflow-hidden min-h-[100px]">
          <div className="h-full p-2 flex flex-col">
            {!systemPrompt.includes('<NOTES>') && (
              <div className="mb-2 p-2 bg-warning/20 border border-warning rounded  text-label">
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
          <MemoryPanel onRegenerateMemory={onRegenerateMemory} />
        </TabsContent>
        <TabsContent value="logs" className="flex-grow overflow-hidden min-h-[100px]">
          <ScrollArea className="h-[calc(100%-1rem)]">
            <div className="p-2">
              {/* Story events are timestamped in world time; app events (saves, load failures, aborted
                  requests) are not — a story date on the save dialog would be a claim, not a rounding.
                  Entries from before the split carry no `kind` and read as story events, as they did. */}
              {logEntries.map((entry, index) => (
                <p key={index} className={`mb-1${logKind(entry) === 'system' ? ' text-muted-foreground italic' : ''}`}>
                  {logKind(entry) === 'system' ? null : (
                    <span className="text-muted-foreground">[{formatClock(entry.gameTime, calendar)}] </span>
                  )}
                  {entry.text}
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
  // The wrapper mirrors the grown height so the box is real layout, not an overlay: the row above it moves
  // up instead of being covered, which is what lets it clear the on-screen keyboard.
  const [height, setHeight] = useState(ACTION_INPUT_LINE_H);

  // Size the textarea to its content while focused (bounded, then scroll); reset to the one-line anchor when
  // blurred. Runs on every value/focus change so growth tracks typing.
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!focused) {
      el.style.height = "";
      el.style.overflowY = "hidden";
      setHeight(ACTION_INPUT_LINE_H);
      return;
    }
    el.style.height = "auto";
    const h = Math.min(Math.max(el.scrollHeight, ACTION_INPUT_LINE_H), ACTION_INPUT_MAX_H);
    el.style.height = `${h}px`;
    el.style.overflowY = el.scrollHeight > ACTION_INPUT_MAX_H ? "auto" : "hidden";
    setHeight(h);
  }, [value, focused]);

  return (
    <div className="relative flex-grow mr-2 flex-shrink-0" style={{ height }} data-testid="action-input-wrap">
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
          "absolute inset-x-0 bottom-0 w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-helper leading-normal placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
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
  sceneImages,
  sceneTags,
  sceneTurnId,
  sceneImageJob,
  sceneImageProgress,
  sceneImagePreview,
  sceneImagesAvailable,
  onSceneImage,
  onSceneTags,
  onCancelSceneImage,
  onDeleteSceneImage,
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
  /** The viewed turn's scene images, oldest first. */
  sceneImages: string[];
  /** The tag line those images were drawn from. */
  sceneTags: string;
  /** The viewed page's committed turn id (undefined while none) — there is something to draw or tag,
   *  and the scene panel is remounted per turn so its tag draft can't leak across page navigation. */
  sceneTurnId?: string;
  /** Which half of the scene pipeline is running, or null. */
  sceneImageJob: 'tags' | 'image' | null;
  sceneImageProgress: number | null;
  /** The provider's live in-progress frame, or null. */
  sceneImagePreview: string | null;
  /** False when image generation is switched off app-wide — the affordance disappears with it. */
  sceneImagesAvailable: boolean;
  onSceneImage: (tags?: string) => void;
  /** Re-run the tag pass alone, no image. */
  onSceneTags: () => void;
  onCancelSceneImage: () => void;
  onDeleteSceneImage: (index: number) => void;
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
  // Resolved: narration is matched against these names, and a chip can never appear in AI prose.
  const { entities } = useResolvedWorld();
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
    setMemoryEdits,
    playerStats,
    isViewingPast,
    viewChoices: choices,
    viewSelectedChoice,
    viewContinueUsed
  } = useGameplay();
  const gameplayText = useGameplayText();
  const { ttsHighlight, choicesEnabled, setChoicesEnabled, continueChoiceMode, statUpdatesEnabled, revealSpec, revealEasing, showReasoning, memoryDigests, setMemoryDigests } = useSettings();
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
  const [toolMenuOpen, setToolMenuOpen] = useState(false);

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

  // The hard-coded continue pseudo-choice. 'always' keeps it even with the choices request switched off,
  // where it stands alone. Live: shown once nothing is generating, even with zero generated choices (it's
  // the escape hatch for a turn that returned none). Past: shown only when that turn's action actually was
  // it, so history still reads as the record of what was picked.
  const continueSelected = isViewingPast ? viewContinueUsed : playerInput.includes(CONTINUE_CHOICE);
  // Nothing to continue before the opening scene lands, so it waits on a turn existing at all.
  const storyStarted = displayedMessages.some((m) => m.role === 'assistant');
  const continueOffered = continueChoiceMode === 'always' || (continueChoiceMode === 'on' && choicesEnabled);
  const showContinue = continueOffered && (isViewingPast ? viewContinueUsed : storyStarted && !disabled);

  // Whether TTS has produced playable audio for the current text (drives the frozen top row).
  const hasAudio = ttsPlayback.duration > 0;

  // A job whose progress spinner lives inside the collapsed narration menu; the trigger has to show it
  // (and stay un-faded) or the work becomes invisible while the menu is closed.
  const toolBusy = sceneImageJob !== null || ttsGenerating;

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
            <span className="text-meta text-muted-foreground whitespace-nowrap">
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
            {/* Edit stays inline as the one action about the text itself; everything else folds into the
                overflow menu so this row can't grow back across the narration. Each button fades on its
                own while idle — pointer devices only, see `.narration-tool` in index.css. */}
            <div className="absolute top-2 right-2 z-10 flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="narration-tool h-8 w-8"
                data-idle="true"
                onClick={() => setIsEditMode(true)}
                title="Edit text"
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Popover open={toolMenuOpen} onOpenChange={setToolMenuOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="narration-tool h-8 w-8"
                    data-idle={toolMenuOpen || toolBusy ? undefined : "true"}
                    aria-label="More narration options"
                    title="More narration options"
                  >
                    {toolBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-52 p-1">
                  <div className="flex flex-col">
                    {sceneImagesAvailable && (
                      <>
                        {/* Tags first: it costs one small text request and no render, so it is the cheap way to
                            see what this turn would be drawn as before spending a picture on it. */}
                        <Button
                          variant="ghost"
                          className="justify-start gap-2 text-meta h-8"
                          onClick={() => { setToolMenuOpen(false); onSceneTags(); }}
                          disabled={sceneImageJob !== null || !sceneTurnId}
                        >
                          {sceneImageJob === 'tags' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Dices className="h-4 w-4" />}
                          Write Scene Tags
                        </Button>
                        <Button
                          variant="ghost"
                          className="justify-start gap-2 text-meta h-8"
                          onClick={() => { setToolMenuOpen(false); onSceneImage(); }}
                          disabled={sceneImageJob !== null || !sceneTurnId}
                        >
                          {sceneImageJob === 'image' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
                          Draw This Scene
                        </Button>
                      </>
                    )}
                    {!hasAudio && ttsLoaded && (
                      <Button
                        variant="ghost"
                        className="justify-start gap-2 text-meta h-8"
                        onClick={() => { setToolMenuOpen(false); onRegenerateTTS(); }}
                        disabled={ttsGenerating}
                      >
                        {ttsGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                        Regenerate Audio
                      </Button>
                    )}
                    {!hasAudio && (
                      <Button
                        variant="ghost"
                        className="justify-start gap-2 text-meta h-8"
                        onClick={() => { setToolMenuOpen(false); onTTSClick(); }}
                      >
                        <Headphones className="h-4 w-4" />
                        Text to Speech
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      className="justify-start gap-2 text-meta h-8"
                      onClick={() => { setToolMenuOpen(false); onExportStory(); }}
                    >
                      <Download className="h-4 w-4" />
                      Export Story
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            {commandPreview && (
              <div className="mb-3 p-2 border border-dashed border-primary/50 rounded relative">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-meta text-muted-foreground">Markdown preview (/markdown test)</span>
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
                    // Markdown like the narration it sits among — `remarkBreaks` keeps the typed line breaks
                    // the plain-text render used to hold. Never animated: the player's own text is committed
                    // the moment it appears.
                    <MarkdownRenderer text={message.content} />
                  ) : (
                    <div ref={narrationRef} data-testid="narration" style={revealStyle}>
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
                      {(() => {
                        const narrationText = showLiveReveal ? gameplayText : parseAssistantMessage(message.content);
                        // Streamdown memoizes its element components on the markdown node's source POSITION,
                        // never its text, so swapping in another turn's narration of the same shape reads as
                        // "unchanged" and the old text stays painted. Keying committed text by its content
                        // remounts whenever it actually differs; the live stream keeps one key so it still
                        // animates token by token instead of remounting per chunk.
                        return (
                          <MarkdownRenderer
                            key={showLiveReveal ? 'live' : `committed:${narrationText}`}
                            text={narrationText}
                            animate={showLiveReveal && revealOn}
                            animation={revealAnim}
                            easing={revealEasing}
                          />
                        );
                      })()}
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
            {sceneImagesAvailable && (
              <SceneImagePanel
                // Keyed by turn: paging to another turn remounts the panel, so the tag draft, image
                // index, and open editor can't carry one turn's state onto another.
                key={sceneTurnId}
                images={sceneImages}
                tags={sceneTags}
                ready={!!sceneTurnId}
                job={sceneImageJob}
                progress={sceneImageProgress}
                preview={sceneImagePreview}
                onGenerate={onSceneImage}
                onRegenerateTags={onSceneTags}
                onCancel={onCancelSceneImage}
                onDelete={onDeleteSceneImage}
              />
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
                {showContinue && (
                  <>
                    {choices && choices.length > 0 && <Separator className="my-1" />}
                    <Button
                      // Same click contract as a generated choice: plain tap replaces the input, Ctrl/Cmd+click
                      // (or a long-press) appends. Never submits — the player still presses send.
                      onClick={(e) => {
                        if (longPress.current.fired) { longPress.current.fired = false; return; }
                        if (e.ctrlKey || e.metaKey) appendChoice(CONTINUE_CHOICE); else setPlayerInput(CONTINUE_CHOICE);
                      }}
                      onPointerDown={() => startLongPress(CONTINUE_CHOICE)}
                      onPointerUp={cancelLongPress}
                      onPointerLeave={cancelLongPress}
                      onPointerCancel={cancelLongPress}
                      disabled={disabled || isViewingPast}
                      variant={continueSelected ? "default" : "outline"}
                      className={`w-full transition-all duration-200 h-auto min-h-[3rem] whitespace-normal
                        ${continueSelected
                          ? "bg-primary text-primary-foreground font-bold shadow-lg"
                          : "border-primary hover:bg-accent hover:text-accent-foreground"
                        }`}
                    >
                      {CONTINUE_CHOICE}
                    </Button>
                  </>
                )}
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
                // derive from the old text); drop them so the drainers rebuild from the edit. The player's
                // own rewrite of that memory goes too — it describes prose that no longer exists, and
                // leaving it would mask the rebuilt digest forever.
                if (editedTurnId) {
                  const cleared = editedTurnId;
                  setMemoryEdits((edits) => {
                    if (!edits[cleared]) return edits;
                    const next = { ...edits };
                    delete next[cleared];
                    return next;
                  });
                  return clearTurnDerived(updatedHistory, cleared, { diaries: true }) ?? updatedHistory;
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
                    <Button variant="outline" className="gap-1 w-32" disabled={isWaitingForAI}>
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
                      className={`gap-1 ${canRegenChoices || canRegenStats ? "rounded-r-none md:w-28" : "md:w-32"}`}
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
                            {/* Held while a scene renders: these keep the turn, so the picture being drawn is
                                still the right one for it — and one graphics card can't write and draw at once. */}
                            {canRegenStats && (
                              <Button
                                variant="ghost"
                                className="justify-start text-meta h-8"
                                onClick={() => { setRegenMenuOpen(false); handleRegenerateStats(); }}
                                disabled={sceneImageJob !== null}
                              >
                                Re-generate Stats
                              </Button>
                            )}
                            {canRegenChoices && (
                              <Button
                                variant="ghost"
                                className="justify-start text-meta h-8"
                                onClick={() => { setRegenMenuOpen(false); handleRegenerateChoices(); }}
                                disabled={sceneImageJob !== null}
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
                placeholder="Type your action... [square brackets] direct the story as the author"
                disabled={disabled}
              />
              <HelpButton
                topicId="game.howToPlay"
                className="mr-2"
                tabExtras={{
                  Choices: (
                    <label className="flex items-center gap-3 rounded-md border p-3 text-label flex-shrink-0 cursor-pointer">
                      <Checkbox checked={choicesEnabled} onCheckedChange={(c: boolean | 'indeterminate') => setChoicesEnabled(c === true)} />
                      <span>
                        <span className="font-medium">Choices</span>
                        <span className="ml-2 text-muted-foreground">offer ready-made actions after each turn</span>
                      </span>
                    </label>
                  ),
                  'Memory & Notes': (
                    <label className="flex items-center gap-3 rounded-md border p-3 text-label flex-shrink-0 cursor-pointer">
                      <Checkbox checked={memoryDigests} onCheckedChange={(c: boolean | 'indeterminate') => setMemoryDigests(c === true)} />
                      <span>
                        <span className="font-medium">Memory Summaries</span>
                        <span className="ml-2 text-muted-foreground">carry older turns as memory notes</span>
                      </span>
                    </label>
                  ),
                }}
              />
              {isWaitingForAI ? (
                <Button
                  onClick={abortGeneration}
                  variant="destructive"
                  aria-label="Stop generating"
                  className="border-dashed border-2 w-12 sm:w-32"
                >
                  <Square className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  onClick={handleSendAction}
                  disabled={disabled}
                  aria-label="Send"
                  className="border-dashed border-2 w-12 sm:w-32"
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

export const RightPanel = ({ onLocationClick, onToggleTrait, language, setLanguage }: {
  onLocationClick: () => void;
  /** Switch a chosen trait on or off mid-play; owned by GameViewer, which reverses its stat changes. */
  onToggleTrait: (traitId: string, enabled: boolean) => void;
  language: string;
  setLanguage: (value: string) => void;
}) => {
  const {
    // Aliased to the viewed-page values (equal to live on the latest page) so paging back shows that
    // turn's stats/traits/time/deltas read-only. `commitManualStatEdit` writes live and rebaselines the
    // snapshot — the edit control is disabled while viewing the past, so it only runs on the latest page.
    viewGameTime: gameTime,
    calendar,
    viewLocationId,
    isViewingPast,
    currentPage,
    totalPages,
    activeTab,
    setActiveTab,
    commitManualStatEdit,
    viewTraits: savedTraits,
    viewDisabledTraitIds,
    viewStatChanges: recentStatChanges,
    recentStatFading,
    heldStatChanges,
    drainingStatChanges
  } = useGameplay();
  const { locations, traits, traitGroups, viewStats: playerStats, currentLocation, resolveTraitText } = useResolvedWorld();
  const resolvePH = usePlaceholderResolver();
  const [isEditMode, setIsEditMode] = React.useState(false);
  // The traits actually in force on the viewed turn, and the stats they leave live. A switched-off trait
  // keeps its row (so it can be switched back on) but stops contributing anything.
  const disabledTraits = React.useMemo(() => new Set(viewDisabledTraitIds), [viewDisabledTraitIds]);
  // The save froze each chosen trait as the world stood on turn 1, so its authoring is re-read from the
  // world — otherwise a trait made switchable after this playthrough began would never get its control.
  const playerTraits = React.useMemo(() => refreshChosenTraits(savedTraits, traits), [savedTraits, traits]);
  const activeTraits = React.useMemo(
    () => inAuthoredOrder(playerTraits.filter((t) => !disabledTraits.has(t.id)), traitOrderIndex(traits, traitGroups)),
    [playerTraits, disabledTraits, traits, traitGroups],
  );
  const statEnabled = React.useMemo(
    () => activeStatEnabled(playerStats, activeTraits),
    [playerStats, activeTraits],
  );
  // Filtered for display but carrying each stat's index in the full array, which the edit slider writes back to.
  const visibleStats = playerStats
    .map((stat, index) => ({ stat, index }))
    .filter(({ stat }) => statEnabled[stat.id] !== false);
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
        {/* The story's position, not an hour count: elapsed hours read as a stopwatch, and the daypart is
            what the prose is actually written around. Same wording the memory stamps use. */}
        <p className="text-center">{formatAbsolute(gameTime, calendar)}</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex-grow flex flex-col overflow-hidden">
        <TabsList className="flex-shrink-0">
          <TabsTrigger value="stats">Stats</TabsTrigger>
          <TabsTrigger value="traits">Traits</TabsTrigger>
          <TabsTrigger value="location">Location</TabsTrigger>
        </TabsList>
        <TabsContent value="stats" className="flex-grow overflow-hidden">
          <ScrollArea className="h-[calc(100%-1rem)] relative">
            {visibleStats.map(({ stat, index }) => {
              const statValue = stat.value;
              const isPercentage = stat.type === 'percentage';
              const change = recentStatChanges[stat.name.toLowerCase()] || 0;
              // Regen and stat code scale by the turn's measured hours, so values and deltas are often
              // fractional. The value reads whole; a change keeps a tenth when it has one, so a sub-point
              // gain isn't printed as `+0`. The underlying value keeps its full precision either way.
              const shownValue = Math.round(statValue);
              const shownChange = formatStatDelta(change);
              return (
              <div key={index} className="mb-2">
                <div className="flex justify-between items-center">
                  <span>{stat.name}</span>
                  <div className="flex items-center gap-2">
                    {shownChange && (
                      <span
                        key={`${currentPage}-${change}`}
                        className={`${isViewingPast ? 'stat-delta-text-in' : (recentStatFading ? 'stat-delta-text-out' : 'stat-delta-text')} text-label ${change > 0 ? 'text-success' : 'text-destructive'}`}
                      >
                        {shownChange}
                      </span>
                    )}
                    <span>{isPercentage ? `${shownValue}%` : `${shownValue} / ${Math.round(stat.max)}`}</span>
                  </div>
                </div>
                {isEditMode && !isViewingPast ? (
                  <Slider
                    // Whole-step slider, so it tracks the rounded readout rather than a fractional value.
                    value={[shownValue]}
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
              playerTraits.map((trait) => {
                const off = disabledTraits.has(trait.id);
                // Only traits the author marked switchable get a control; the rest read as before. A
                // switched-off trait stays listed, dimmed, so it can be switched back on.
                const switchable = !!trait.playerToggle && !isViewingPast;
                return (
                  <div key={trait.id} className={`mb-1 flex items-start gap-2 ${off ? 'opacity-50' : ''}`}>
                    {trait.playerToggle && (
                      <Checkbox
                        className="mt-1"
                        checked={!off}
                        disabled={!switchable}
                        aria-label={`${off ? 'Switch on' : 'Switch off'} ${trait.name}`}
                        onCheckedChange={(c) => onToggleTrait(trait.id, c === true)}
                      />
                    )}
                    {/* A trait's own text self-pins (name already did, via the resolved collection), so a
                        pinning trait's row reads its own value whatever else is switched on. */}
                    <span>{trait.name}{trait.playerDescription ? `: ${resolveTraitText(trait, trait.playerDescription)}` : ''}</span>
                  </div>
                );
              })
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
                  <p className="text-label">{resolvePH(displayLocation.playerDescription || displayLocation.description || '')}</p>
                  {displayLocation.connections && displayLocation.connections.length > 0 && (
                    <>
                      <p className="font-semibold mt-4">Connected Locations:</p>
                      <ul className="list-disc list-inside text-label">
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
        <p className="text-center text-meta font-medium text-primary bg-primary/10 rounded py-0.5 mt-2 flex-shrink-0">
          Viewing turn {currentPage} of {totalPages} — history
        </p>
      )}
    </CardContent>
  </Card>
  );
};
