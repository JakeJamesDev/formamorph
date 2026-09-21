import React, { useRef, useState } from 'react';
import { useGameplay } from '@/contexts/GameplayContext';
import { useGameplayText, setGameplayText } from '@/lib/gameplayTextStore';
import { revealActive, revealAnimName, revealVars } from '@/lib/narrationRevealConfig';
import { usePlaceholderResolver } from '@/lib/usePlaceholderResolver';
import { useSettings } from '@/contexts/SettingsContext';
import { templateChipKeys } from '@/lib/promptTemplate';
import { useSentenceHighlight } from '@/lib/useSentenceHighlight';
import { findEntityNames, resolveEntityByName } from '@/lib/entityMatch';
import { clearTurnDerived } from '@/lib/turnDigest';
import { usePlayerModelUrl } from '@/lib/usePlayerModelUrl';
import { mergeBodyMorphs } from '@/lib/bodyMorphs';
import { useIsMobile } from '@/lib/useIsMobile';
import { traitOrderIndex, inAuthoredOrder, activeStatEnabled, refreshChosenTraits } from '@/lib/traitEffects';
import { listablePlayerTraits } from '@/lib/traitRuntime';
import { MarkdownRenderer } from './MarkdownRenderer';
import { ReasoningBlock } from './ReasoningBlock';
import { ChatNarration, type ChatBubbleTurn, type ChatPlayerTurn } from './ChatNarration';
import { ChatChoices } from './ChatChoices';
import { ChoiceRows } from './ChoiceRows';
import { TurnCard } from './TurnCard';
import { BubbleMenu } from './BubbleMenu';
import { bubbleActions, choicesActions, playerBubbleActions } from '@/lib/bubbleActions';
import { rewriteTurnAction } from '@/lib/turnHistory';
import { toast } from 'react-toastify';
import { useLiveReasoning } from '@/lib/reasoningStreamStore';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TokenAutocomplete } from "@/components/TokenAutocomplete";
import { COMMON_LANGUAGES } from "@/lib/languages";
import { Send, RefreshCw, Pencil, Languages, Loader2, Headphones, Square, ChevronUp, ChevronDown, X, Trash2, MoreHorizontal, User, Users, NotebookPen, Brain, ScrollText, ChartColumn, Sparkles, MapPin, type LucideIcon } from "lucide-react";
import { ActionIcon } from "@/lib/actionIcons";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CONTINUE_CHOICE } from "@/lib/choices";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tip } from "@/components/ui/tooltip";
import { Pager } from "@/components/ui/pagination";
import VRMViewer from '@/views/VRMViewer';
import { EntityVisual, hasEntityVisual } from './EntityVisual';
import { useEntityVisualPreference } from '@/lib/useEntityVisualPreference';
import { useEntityGallery } from '@/lib/useEntityGallery';
import TtsPlaybackBar from './TtsPlaybackBar';
import { MemoryPanel } from './MemoryPanel';
import { SceneImagePanel } from './SceneImagePanel';
import { ScenePlate } from './ScenePlate';
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
import { effectiveDestinations } from '@/lib/locationGraph';
import { TraitsTab } from './TraitsTab';
import { StatRow } from './StatRow';
import { PersonaRow } from './PersonaRow';
import { useNarrationLayout } from '@/lib/useNarrationLayout';
import { useStatsSnap } from '@/lib/useStatsSnap';

import { parseSavedReasoning } from '@/lib/savedReasoning';

/** One side-panel tab: an icon, and the label where the panel is wide enough to hold it. */
const PanelTab = ({ value, icon: Icon, label }: { value: string; icon: LucideIcon; label: string }) => (
  // The label's own text names the tab; the tip shows it where the label is hidden.
  <Tip tip={label} labelsChild={false}>
    <TabsTrigger value={value} className="min-w-0 gap-1.5 px-1">
      <Icon className="h-4 w-4 shrink-0" aria-hidden />
      <span className="sr-only truncate max-md:not-sr-only xl:not-sr-only">{label}</span>
    </TabsTrigger>
  </Tip>
);

export const LeftPanel = ({ entities, onEntityClick, onRegenerateMemory, narrationPrompt }: {
  entities: Entity[];
  onEntityClick: (entityId: string) => void;
  /** Re-run the digest prompt for one turn (Memory Manager's regenerate); owned by GameViewer. */
  onRegenerateMemory?: (turnId: string) => Promise<boolean>;
  /** The narration prompt this world actually sends: the world's own unless declined, else the preset's. */
  narrationPrompt: string;
}) => {
  const placesNotes = templateChipKeys(narrationPrompt).has('<NOTES>');
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
    .map((se) => resolveEntityByName(se.name, entities))
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
    const match = resolveEntityByName(se.name, entities);
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
  <Card className="w-full md:w-1/4 md:shrink-0 md:mr-1 grow md:grow-0 min-h-0 flex flex-col bg-background/60 border-border overflow-hidden">
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
            <Tip tip={showModel ? "Hide Avatar" : "Show Avatar"}>
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-0"
                onClick={() => setShowModel((s) => !s)}
              >
                {showModel ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </Tip>
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
        <TabsList className="grid w-full flex-shrink-0 auto-cols-fr grid-flow-col">
          {isMobile && <PanelTab value="model" icon={User} label="Avatar" />}
          <PanelTab value="entities" icon={Users} label="Entities" />
          <PanelTab value="notes" icon={NotebookPen} label="Notes" />
          <PanelTab value="memory" icon={Brain} label="Memory" />
          <PanelTab value="logs" icon={ScrollText} label={`Logs (${logEntries.reduce((sum, entry) => sum + 1 + (entry.repeat || 0), 0)})`} />
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
                  const entityItem = resolveEntityByName(se.name, entities);
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
                          <Tip tip={`Remove ${label}`}>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-muted-foreground hover:text-destructive"
                              onClick={(e) => { e.stopPropagation(); setPendingRemoval(label); }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </Tip>
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
            {!placesNotes && (
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

// The prompt of Rewind to Here, in both layouts.
const ROLLBACK_CONFIRM = {
  title: "Confirm Rollback",
  description: "Are you sure you want to rollback to the previous state? This action cannot be undone.",
};

export const MiddlePanel = ({
  narrationBadge,
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
  likePrompt,
  locationSuggestion,
  commandPreview,
  onDismissCommandPreview
}: {
  /** A status badge that leads the narration options. */
  narrationBadge?: React.ReactNode;
  parseAssistantMessage: (content: string) => string;
  totalPages: number;
  handlePageChange: (page: number) => void;
  handleSendAction: () => void;
  handleKeyPress: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  /** Rolls back to `page`, or to the viewed page. */
  handleRollback: (page?: number) => void;
  /** Re-generates the turn on `page`, or on the viewed page. */
  handleRegenerate: (page?: number) => void;
  handleRegenerateChoices: () => void;
  handleRegenerateStats: (page?: number) => void;
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
  /** Draws the turn on `page`, or the viewed turn. */
  onSceneImage: (tags?: string, page?: number) => void;
  /** Re-run the tag pass alone, no image. */
  onSceneTags: (page?: number) => void;
  onCancelSceneImage: () => void;
  onDeleteSceneImage: (turnId: string, index: number) => void;
  onTTSClick: () => void;
  onExportStory: () => void;
  /** Synthesizes `text`, or the current text. */
  onRegenerateTTS: (text?: string) => Promise<void> | void;
  ttsLoaded: boolean;
  ttsGenerating: boolean;
  ttsProgress: TTSProgress | null;
  memoryBar: React.ReactNode;
  progressBar: React.ReactNode;
  /** The once-only in-game like prompt, above the pager and in the flow so it covers no narration. */
  likePrompt?: React.ReactNode;
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
    choices: latestChoices,
    fullMessageHistory,
    viewSelectedChoice,
    viewContinueUsed
  } = useGameplay();
  const gameplayText = useGameplayText();
  const { ttsHighlight, choicesEnabled, setChoicesEnabled, continueChoiceMode, statUpdatesEnabled, revealSpec, revealEasing, showReasoning, memoryDigests, setMemoryDigests } = useSettings();
  const chatLayout = useNarrationLayout() === 'chat';
  const liveReasoning = useLiveReasoning();
  // Per-word reveal: any enabled effect ⇒ animate (composed keyframe + CSS vars on the container);
  // nothing enabled ⇒ smooth crawl. The keyframe name feeds Streamdown, the amounts ride as CSS vars.
  const revealOn = revealActive(revealSpec);
  const revealAnim = revealAnimName(revealSpec);
  const revealStyle = revealVars(revealSpec) as React.CSSProperties;
  // Which partial re-generate actions to offer (mirrors the aux-request gates).
  const canRegenChoices = choicesEnabled && fullMessageHistory[fullMessageHistory.length - 1]?.role === 'assistant';
  const canRegenStats = statUpdatesEnabled && playerStats.length > 0;
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
  /** The press handlers of one choice button, shared by Pages and Chat. */
  const choicePress = (choice: string) => ({
    onClick: (e: React.MouseEvent) => {
      if (longPress.current.fired) { longPress.current.fired = false; return; } // swallow the click after a long-press
      if (e.ctrlKey || e.metaKey) appendChoice(choice); else setPlayerInput(choice);
    },
    onPointerDown: () => startLongPress(choice),
    onPointerUp: cancelLongPress,
    onPointerLeave: cancelLongPress,
    onPointerCancel: cancelLongPress,
  });

  // The hard-coded continue pseudo-choice. 'always' keeps it even with the choices request switched off,
  // where it stands alone. Live: shown once nothing is generating, even with zero generated choices (it's
  // the escape hatch for a turn that returned none). Past: shown only when that turn's action actually was
  // it, so history still reads as the record of what was picked.
  const continueSelected = isViewingPast ? viewContinueUsed : playerInput.includes(CONTINUE_CHOICE);
  // Nothing to continue before the opening scene lands, so it waits on a turn existing at all.
  const storyStarted = displayedMessages.some((m) => m.role === 'assistant');
  const continueOffered = continueChoiceMode === 'always' || (continueChoiceMode === 'on' && choicesEnabled);
  const showContinue = continueOffered && (isViewingPast ? viewContinueUsed : storyStarted && !disabled);

  // Chat shows the latest turn's choices wherever the player scrolled, so it reads the live state, never the viewed page.
  const chatShowContinue = continueOffered && fullMessageHistory.some((m) => m.role === 'assistant') && !disabled;
  // Busy from the icon's click until the re-roll ends.
  const [choicesRegenerating, setChoicesRegenerating] = useState(false);
  React.useEffect(() => { if (!isWaitingForAI) setChoicesRegenerating(false); }, [isWaitingForAI]);

  // Whether TTS has produced playable audio for the current text (drives the frozen top row).
  const hasAudio = ttsPlayback.duration > 0;

  // Karaoke highlighter: paint the spoken sentence in the current page's narration as audio plays.
  const narrationRef = useRef<HTMLDivElement>(null);
  useSentenceHighlight(narrationRef, {
    activeSentenceIndex: ttsPlayback.activeSentenceIndex,
    sentenceTexts: ttsPlayback.sentenceTexts,
    enabled: ttsHighlight,
  });

  // The viewed page's narration: the editor's text when no action row opened it.
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

  // A turn's Edit and Rewind to Here target that turn's own page, never the viewed one.
  const [editTarget, setEditTarget] = useState<{ kind: 'narration' | 'action'; page: number; text: string } | null>(null);
  const [rewindPage, setRewindPage] = useState<number | null>(null);
  const copyText = (text: string) => {
    let write: Promise<void>;
    // An insecure page has no clipboard API; that failure gets the same toast.
    try { write = navigator.clipboard.writeText(text); } catch (error) { write = Promise.reject(error); }
    void write.then(
      () => toast.success('Copied'),
      () => toast.error("Couldn't copy the text"),
    );
  };
  const actionsFor = (turn: ChatBubbleTurn) => {
    const page = turn.index + 1;
    return bubbleActions(
      {
        isLatest: turn.isLatest,
        live: turn.live,
        busy: isWaitingForAI,
        hasImage: turn.hasImage,
        canRegenStats,
        sceneImagesAvailable,
        sceneJob: sceneImageJob,
        ttsLoaded,
        ttsGenerating,
      },
      {
        regenerate: () => handleRegenerate(page),
        regenerateStats: () => handleRegenerateStats(page),
        sceneImage: () => onSceneImage(undefined, page),
        sceneTags: () => onSceneTags(page),
        edit: () => { setEditTarget({ kind: 'narration', page, text: turn.text }); setIsEditMode(true); },
        textToSpeech: onTTSClick,
        regenerateAudio: () => { void onRegenerateTTS(turn.text); },
        copy: () => copyText(turn.text),
        rewind: () => setRewindPage(page),
      },
    );
  };
  const playerActionsFor = (turn: ChatPlayerTurn) => playerBubbleActions({ live: turn.live, busy: isWaitingForAI }, {
    edit: () => { setEditTarget({ kind: 'action', page: turn.index + 1, text: turn.text }); setIsEditMode(true); },
    copy: () => copyText(turn.text),
  });

  // Pages shows the viewed turn. The opening's user message is the hidden start proxy, so page 1 has no action line.
  const actionLine = currentPage > 1 ? displayedMessages.find((m) => m.role === 'user')?.content : undefined;
  // The live stream belongs to the latest page only; a past page shows its committed text.
  const pageLive = !isViewingPast && isRevealingNarration && !!currentAssistantMessage;
  const pageNarration = pageLive ? gameplayText : currentAssistantMessage ? parseAssistantMessage(currentAssistantMessage.content) : '';
  const pageReasoningLive = !isViewingPast && !!liveReasoning.text;
  const pageReasoning = pageReasoningLive
    ? liveReasoning
    : currentAssistantMessage ? parseSavedReasoning(currentAssistantMessage.content) : null;
  const pageActions = currentAssistantMessage ? actionsFor({
    index: currentPage - 1, isLatest: !isViewingPast, live: pageLive, hasImage: sceneImages.length > 0, text: pageNarration,
  }) : [];
  // The turn is live from submit, before its narration exists, until the reveal ends.
  const actionLineActions = actionLine === undefined ? [] : playerActionsFor({
    index: currentPage - 1, live: !isViewingPast && (pageLive || (isWaitingForAI && !currentAssistantMessage)), text: actionLine,
  });
  /** The choices block's actions, for a block that shows `hasChoices`. */
  const regenChoicesActions = (hasChoices: boolean) => choicesActions(
    { canRegenerate: canRegenChoices, hasChoices, busy: disabled || isWaitingForAI || isRevealingNarration, regenerating: choicesRegenerating && isWaitingForAI },
    () => { setChoicesRegenerating(true); handleRegenerateChoices(); },
  );
  const pageChoicesActions = isViewingPast ? [] : regenChoicesActions((choices?.length ?? 0) > 0 || showContinue);

  const narrationFrame = `narration-text flex-grow border border-border p-2 bg-muted/80 min-h-0 ${isFlashing ? 'flash-animation' : ''} relative`;
  // The corner holds the whole-story items; the per-turn ones sit on each turn's card. Idle fade: `.narration-tool` in index.css.
  const optionsControl = (
    <div className="absolute top-2 right-2 z-10 flex gap-1">
      {narrationBadge}
      <Popover open={toolMenuOpen} onOpenChange={setToolMenuOpen}>
        <Tip tip="More narration options">
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="narration-tool h-8 w-8"
              data-idle={toolMenuOpen ? undefined : "true"}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
        </Tip>
        <PopoverContent align="end" className="w-52 p-1">
          <div className="flex flex-col">
            <Button
              variant="ghost"
              className="justify-start gap-2 text-meta h-8"
              onClick={() => { setToolMenuOpen(false); onExportStory(); }}
            >
              <ActionIcon.export className="h-4 w-4" />
              Export Story
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
  const commandPreviewBlock = commandPreview && (
      <div className="mb-3 p-2 border border-dashed border-primary/50 rounded relative">
        <div className="flex items-center justify-between mb-1">
          <span className="text-meta text-muted-foreground">Markdown preview (/markdown test)</span>
          <Tip tip="Dismiss preview">
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onDismissCommandPreview}>
              <X className="h-4 w-4" />
            </Button>
          </Tip>
        </div>
        <div style={revealStyle}>
          <MarkdownRenderer text={gameplayText} animate={revealOn} animation={revealAnim} easing={revealEasing} />
        </div>
      </div>
  );

  return (
    <Card className="w-full flex-grow md:mx-0.5 md:min-w-0 md:basis-0 min-h-0 flex flex-col bg-background/60 border-border overflow-hidden">
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
                <Tip tip="Regenerate audio for current text">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onRegenerateTTS()}
                    disabled={ttsGenerating}
                  >
                    {ttsGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  </Button>
                </Tip>
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
          {chatLayout ? (
            <div className={`${narrationFrame} flex flex-col`}>
              {optionsControl}
              {commandPreviewBlock}
              <ChatNarration
                parseAssistantMessage={parseAssistantMessage}
                actionsFor={actionsFor}
                playerActionsFor={playerActionsFor}
                onDeleteSceneImage={onDeleteSceneImage}
                latestFooter={
                  <ChatChoices
                    choices={latestChoices}
                    showContinue={chatShowContinue}
                    disabled={disabled || isWaitingForAI}
                    isSelected={(choice) => playerInput.includes(choice)}
                    choicePress={choicePress}
                    actions={regenChoicesActions(latestChoices.length > 0 || chatShowContinue)}
                  />
                }
              />
            </div>
          ) : (
          <ScrollArea className={narrationFrame}>
            {optionsControl}
            {commandPreviewBlock}
            {(actionLine !== undefined || currentAssistantMessage || (showReasoning && pageReasoning?.text)) && (
              <TurnCard actions={pageActions} turnNumber={currentPage} live={pageLive} style={revealStyle}>
                {sceneTurnId && (
                  <ScenePlate
                    turnId={sceneTurnId}
                    images={sceneImages}
                    onDelete={(index) => onDeleteSceneImage(sceneTurnId, index)}
                    className="mb-3"
                  />
                )}
                {actionLine !== undefined && (
                  // Upright, so the player's own italics and quote styling show.
                  <BubbleMenu actions={actionLineActions}>
                    {/* The line has its own menu: a right-click here never reaches the card's. */}
                    <div
                      data-testid="action-line"
                      className="mb-3 border-l-2 border-primary pl-3 text-label text-muted-foreground"
                      onContextMenu={(event) => event.stopPropagation()}
                    >
                      <MarkdownRenderer text={actionLine} dialogue />
                    </div>
                  </BubbleMenu>
                )}
                {showReasoning && pageReasoning?.text && (
                  <ReasoningBlock text={pageReasoning.text} ms={pageReasoning.ms} active={pageReasoningLive && liveReasoning.active} />
                )}
                {currentAssistantMessage && (
                  <div ref={narrationRef} data-testid="narration">
                    {/* Streamdown memoizes on source position, not text, so committed text keys by its content. */}
                    <MarkdownRenderer
                      key={pageLive ? 'live' : `committed:${pageNarration}`}
                      text={pageNarration}
                      animate={pageLive && revealOn}
                      animation={revealAnim}
                      easing={revealEasing}
                      dialogue
                    />
                  </div>
                )}
              </TurnCard>
            )}
            {sceneImagesAvailable && (
              <SceneImagePanel
                // Keyed by turn: paging to another turn remounts the panel, so the tag draft and open
                // editor can't carry one turn's state onto another.
                key={sceneTurnId}
                hasImage={sceneImages.length > 0}
                tags={sceneTags}
                ready={!!sceneTurnId}
                job={sceneImageJob}
                progress={sceneImageProgress}
                preview={sceneImagePreview}
                onGenerate={onSceneImage}
                onRegenerateTags={() => onSceneTags()}
                onCancel={onCancelSceneImage}
              />
            )}
            <ChoiceRows
              choices={choices ?? []}
              showContinue={showContinue}
              disabled={disabled || isViewingPast}
              // Past: the choice the player took. Live: any choice staged in the input.
              isSelected={(choice, index) => isViewingPast ? viewSelectedChoice.includes(index) : playerInput.includes(choice)}
              continueSelected={continueSelected}
              choicePress={choicePress}
              actions={pageChoicesActions}
            />
          </ScrollArea>
          )}
          <ConfirmDialog
            open={rewindPage !== null}
            onOpenChange={(open) => { if (!open) setRewindPage(null); }}
            {...ROLLBACK_CONFIRM}
            onConfirm={() => { if (rewindPage !== null) handleRollback(rewindPage); }}
          />
          <EditTextModal
            isOpen={isEditMode}
            onOpenChange={(open) => { setIsEditMode(open); if (!open) setEditTarget(null); }}
            text={editTarget?.text ?? currentPageText}
            onSave={(text) => {
              const page = editTarget?.page ?? currentPage;
              if (editTarget?.kind === 'action') {
                // Rewrites only the turn's user message; the turn's memory digest stays as it is.
                setFullMessageHistory(prev => rewriteTurnAction(prev, page, text, 2));
                return;
              }
              // Only the most recent page drives the live gameplay text (used by TTS, etc.).
              if (page === totalPages) setGameplayText(text);
              // Update the message in history for the edited page
              const messageIndex = (page - 1) * 2 + 1; // +1 for assistant message
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
              // Force update of displayed messages, which hold the viewed page only
              if (page === currentPage) setDisplayedMessages(prev => {
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
          <div className="flex flex-col items-center gap-2">
            {likePrompt}
            {locationSuggestion}
            {/* Chat has no Pager: the scroll is the one way through the turns. */}
            {!chatLayout && <Pager page={currentPage} pageCount={totalPages} onPageChange={handlePageChange} className="justify-center" />}
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

export const RightPanel = ({ onLocationClick, onToggleTrait, onRegenerateStats, sceneImageJob, language, setLanguage }: {
  onLocationClick: () => void;
  /** Switch a chosen trait on or off mid-play; owned by GameViewer, which reverses its stat changes. */
  onToggleTrait: (traitId: string, enabled: boolean) => void;
  onRegenerateStats: (page: number) => void;
  sceneImageJob: 'tags' | 'image' | null;
  language: string;
  setLanguage: (value: string) => void;
}) => {
  const { statUpdatesEnabled } = useSettings();
  const {
    // Aliased to the viewed-page values (equal to live on the latest page) so paging back shows that
    // turn's stats/traits/time/deltas read-only. `commitManualStatEdit` writes live and rebaselines the
    // snapshot — the edit control is disabled while viewing the past, so it only runs on the latest page.
    viewGameTime: gameTime,
    calendar,
    viewLocationId,
    isViewingPast,
    isWaitingForAI,
    isRevealingNarration,
    currentPage,
    totalPages,
    activeTab,
    setActiveTab,
    traitsView,
    setTraitsView,
    commitManualStatEdit,
    viewTraits: savedTraits,
    viewDisabledTraitIds,
    viewStatChanges: recentStatChanges,
    recentStatFading,
    heldStatChanges,
    drainingStatChanges
  } = useGameplay();
  const { locations, connections, traits, traitGroups, viewStats: playerStats, currentLocation, resolveTraitText } = useResolvedWorld();
  // In Chat a scroll moves the viewed turn, so the stat rows snap to it.
  const snapStats = useStatsSnap({ page: currentPage, totalPages }, useNarrationLayout() === 'chat');
  const resolvePH = usePlaceholderResolver();
  const [isEditMode, setIsEditMode] = React.useState(false);
  // The traits actually in force on the viewed turn, and the stats they leave live. A switched-off trait
  // keeps its row (so it can be switched back on) but stops contributing anything.
  const disabledTraits = React.useMemo(() => new Set(viewDisabledTraitIds), [viewDisabledTraitIds]);
  // The save froze each chosen trait as the world stood on turn 1, so its authoring is re-read from the
  // world — otherwise a trait made switchable after this playthrough began would never get its control.
  const playerTraits = React.useMemo(() => refreshChosenTraits(savedTraits, traits), [savedTraits, traits]);
  const traitOrder = React.useMemo(() => traitOrderIndex(traits, traitGroups), [traits, traitGroups]);
  const heldTraitIds = React.useMemo(() => new Set(playerTraits.map((t) => t.id)), [playerTraits]);
  const activeTraits = React.useMemo(
    () => inAuthoredOrder(playerTraits.filter((t) => !disabledTraits.has(t.id)), traitOrder),
    [playerTraits, disabledTraits, traitOrder],
  );
  // Every toggleable trait is available at any time, so the list holds the player's traits and the ones they
  // could take, together in authored order — owned and unowned differ only by the checkbox. A past turn shows
  // only what was held then: acquirables can't be acted on there.
  const listedTraits = React.useMemo(
    () => (isViewingPast ? playerTraits : listablePlayerTraits(playerTraits, traits, traitOrder)),
    [isViewingPast, playerTraits, traits, traitOrder],
  );
  const statEnabled = React.useMemo(
    () => activeStatEnabled(playerStats, activeTraits),
    [playerStats, activeTraits],
  );
  // Filtered for display but carrying each stat's index in the full array, which the edit slider writes back to.
  // Hidden stats stay live for the AI, regen and code — they just never render, which also drops their
  // delta chip, bar band and history deltas (all keyed off the row).
  const visibleStats = playerStats
    .map((stat, index) => ({ stat, index }))
    .filter(({ stat }) => statEnabled[stat.id] !== false && stat.hidden !== true);
  // Whether the descriptor line is part of this world's stat list at all. Held across every row so the list
  // keeps its shape as values move in and out of bands; a world that names none of them pays nothing, and a
  // stat the player never sees can't put the line there for the ones they do.
  // A world with no stat the player can see gets no Stats tab; the panel then opens on Traits.
  const hasShownStats = playerStats.some((stat) => stat.hidden !== true);
  const shownTab = !hasShownStats && activeTab === 'stats' ? 'traits' : activeTab;
  const anyDescriptors = visibleStats.some(({ stat }) => (stat.descriptors?.length ?? 0) > 0);
  // On a past page show the viewed turn's location (Location tab); live otherwise.
  const displayLocation = isViewingPast
    ? (locations.find((l) => l.id === viewLocationId) ?? currentLocation)
    : currentLocation;
  // The authored links leading out of here, named. Implicit travel is deliberately absent: this panel has
  // always listed what the author drew, so a world with no Connections shows no section at all.
  const connectedNames = React.useMemo(() => {
    if (!displayLocation) return [];
    const names: string[] = [];
    for (const [id, via] of effectiveDestinations(displayLocation.id, locations, connections)) {
      if (via.via !== 'connection') continue;
      const name = locations.find((l) => l.id === id)?.name;
      if (name) names.push(name);
    }
    return names;
  }, [connections, locations, displayLocation]);

  return (
    <Card className="w-full md:w-1/4 md:shrink-0 md:ml-1 grow md:grow-0 min-h-0 flex flex-col md:h-full bg-background/60 border-border overflow-hidden">
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
        <PersonaRow />
      </div>

      <Tabs value={shownTab} onValueChange={setActiveTab} className="w-full flex-grow flex flex-col overflow-hidden">
        <TabsList className="grid w-full flex-shrink-0 auto-cols-fr grid-flow-col">
          {hasShownStats && <PanelTab value="stats" icon={ChartColumn} label="Stats" />}
          <PanelTab value="traits" icon={Sparkles} label="Traits" />
          <PanelTab value="location" icon={MapPin} label="Location" />
        </TabsList>
        <TabsContent value="stats" className="flex-grow overflow-hidden">
          <ScrollArea className="h-[calc(100%-1rem)] relative">
            {visibleStats.map(({ stat, index }) => {
              const key = stat.name.toLowerCase();
              return (
                <StatRow
                  key={index}
                  stat={stat}
                  change={recentStatChanges[key] || 0}
                  // Live: a held change grows, else a draining change collapses. History: the turn's own
                  // change grows in (never drains).
                  barDelta={isViewingPast
                    ? (recentStatChanges[key] || 0)
                    : (heldStatChanges[key] || drainingStatChanges[key] || 0)}
                  draining={!isViewingPast && !heldStatChanges[key] && !!drainingStatChanges[key]}
                  page={currentPage}
                  isViewingPast={isViewingPast}
                  snap={snapStats}
                  fading={recentStatFading}
                  editable={isEditMode && !isViewingPast}
                  reserveDescriptorLine={anyDescriptors}
                  onCommitValue={(value) => {
                    const newStats = [...playerStats];
                    newStats[index] = { ...stat, value };
                    commitManualStatEdit(newStats);
                  }}
                />
              );
            })}
            <div className="absolute bottom-2 right-2 flex items-center gap-0.5">
              <Tip tip="Edit Stats">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsEditMode(!isEditMode)}
                  disabled={isViewingPast}
                  aria-label="Edit Stats"
                  aria-pressed={isEditMode}
                  className="h-8 w-8"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              </Tip>
              {statUpdatesEnabled && playerStats.length > 0 && (
                <Tip tip="Re-generate Stats">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onRegenerateStats(currentPage)}
                    disabled={isViewingPast || totalPages === 0 || isWaitingForAI || isRevealingNarration || sceneImageJob !== null}
                    aria-label="Re-generate Stats"
                    className="h-8 w-8"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </Tip>
              )}
            </div>
          </ScrollArea>
        </TabsContent>
        <TabsContent value="traits" className="flex-grow overflow-hidden">
          {/* Unticked whether it was switched off or never taken — the panel draws no line between the two,
              because a trait that can be taken at will makes "owned" a distinction without a difference. */}
          <TraitsTab
            traits={listedTraits}
            groups={traitGroups}
            stats={playerStats}
            isOff={(id) => disabledTraits.has(id) || !heldTraitIds.has(id)}
            readOnly={isViewingPast}
            onToggleTrait={onToggleTrait}
            resolveTraitText={resolveTraitText}
            view={traitsView}
            setView={setTraitsView}
          />
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
                  {connectedNames.length > 0 && (
                    <>
                      <p className="font-semibold mt-4">Connected Locations:</p>
                      <ul className="list-disc list-inside text-label">
                        {connectedNames.map((name, index) => (
                          <li key={index}>{name}</li>
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
