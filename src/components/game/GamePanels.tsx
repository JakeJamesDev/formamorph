import React, { useEffect, useRef } from 'react';
import { useGameplay } from '@/contexts/GameplayContext';
import { useSettings } from '@/contexts/SettingsContext';
import { usePlayerModelUrl } from '@/lib/usePlayerModelUrl';
import { mergeBodyMorphs } from '@/lib/bodyMorphs';
import { useIsMobile } from '@/lib/useIsMobile';
import { GameText } from './GameText';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, RefreshCw, Pencil, Languages, Loader2, Headphones, Square, ChevronUp, ChevronDown, X } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import VRMViewer from '@/views/VRMViewer';
import { ImageZoomViewer } from '@/components/ImageZoomViewer';
import AudioPlayer from './AudioPlayer';
import type { TTSProgress } from './TTSModal';
import { ConfirmDialog } from '../ConfirmDialog';
import { EditTextModal } from '../modals/EditTextModal';
import type { Entity } from '@/types';

export const LeftPanel = ({ entities, onEntityClick }: {
  entities: Entity[];
  onEntityClick: (entityId: string) => void;
}) => {
  // Import systemPrompt from settings context
  const { systemPrompt } = useSettings();
  const {
    characterData,
    bodyMorphValues,
    visibleEntities,
    logEntries,
    logsEndRef,
    playerNotes,
    setPlayerNotes
  } = useGameplay();
  const playerModelUrl = usePlayerModelUrl(characterData?.playerModelId);
  // First detected (visible) entity that has an image — shown in the model section's Entities view.
  const firstEntityImage = visibleEntities
    .map((id) => entities.find((f) =>
      f.name.toLowerCase().includes(id.toLowerCase()) ||
      id.toLowerCase().includes(f.name.toLowerCase()),
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
  // entity popup (collapsed, on mobile, the entity has no image, or it's already the shown entity).
  const handleEntityListClick = (entityId: string) => {
    const match = entities.find((f) =>
      f.name.toLowerCase().includes(entityId.toLowerCase()) ||
      entityId.toLowerCase().includes(f.name.toLowerCase()),
    );
    const entitiesViewActive = !characterData || modelTab === "entities";
    const alreadyShown = entitiesViewActive && !!match?.image && match.image === entityViewImage;
    if (!isMobile && showModel && match?.image && !alreadyShown) {
      setSelectedEntityImage(match.image);
      setModelTab("entities");
    } else {
      onEntityClick(entityId);
    }
  };

  // In landscape the model lives on top, not in a tab; leave the "model" tab.
  React.useEffect(() => {
    if (!isMobile && leftTab === "model") setLeftTab("notes");
  }, [isMobile, leftTab]);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setShowVRMViewer(true);
    }, 5000);
    return () => clearTimeout(timer);
  }, []);

  const modelViewer = characterData ? (
    <div className="w-full relative" style={{ paddingTop: '120%' }}>
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
          <TabsTrigger value="logs">Logs ({logEntries.reduce((sum, entry) => sum + 1 + (entry.repeat || 0), 0)})</TabsTrigger>
        </TabsList>
        {isMobile && (
          <TabsContent value="model" className="flex-grow overflow-auto min-h-[100px]">
            {modelViewer}
          </TabsContent>
        )}
        <TabsContent value="entities" className="flex-grow overflow-hidden min-h-[100px]">
          <ScrollArea className="h-[calc(100%-1rem)]">
            <div className="p-2">
              {visibleEntities.length > 0 ? (
                visibleEntities.map((entityId, index) => {
                  const entityItem = entities.find(f =>
                    f.name.toLowerCase().includes(entityId.toLowerCase()) ||
                    entityId.toLowerCase().includes(f.name.toLowerCase())
                  );
                  const isDisabled = !entityItem;
                  return (
                    <div
                      key={index}
                      className={`mb-1 flex justify-between items-center p-2 ${
                        isDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-muted cursor-pointer'
                      }`}
                      onClick={() => handleEntityListClick(entityId)}
                    >
                      <span>{entityItem ? entityItem.name : entityId}</span>
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
              <div className="mb-2 p-2 bg-yellow-500/20 border border-yellow-500 rounded  text-sm">
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

export const MiddlePanel = ({
  parseAssistantMessage,
  totalPages,
  handlePageChange,
  sendGameAction,
  handleSendAction,
  handleKeyPress,
  handleRollback,
  handleRegenerate,
  abortGeneration,
  disabled,
  onTTSClick,
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
  sendGameAction: (action: string) => void;
  handleSendAction: () => void;
  handleKeyPress: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  handleRollback: () => void;
  handleRegenerate: () => void;
  abortGeneration: () => void;
  disabled: boolean;
  onTTSClick: () => void;
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
  const {
    displayedMessages,
    setDisplayedMessages,
    currentPage,
    isGameStarted,
    choices,
    playerInput,
    setPlayerInput,
    isWaitingForAI,
    isFlashing,
    gameplayText,
    setGameplayText,
    isEditMode,
    setIsEditMode,
    ttsAudio,
    setFullMessageHistory
  } = useGameplay();

  // Game text of the page currently being viewed, so the Edit button is page-aware
  // (rather than always editing the most recent text).
  const currentAssistantMessage = displayedMessages.find(m => m.role === 'assistant');
  let currentPageText = gameplayText;
  if (currentAssistantMessage) {
    try {
      currentPageText = JSON.parse(currentAssistantMessage.content).game_text ?? currentAssistantMessage.content;
    } catch {
      currentPageText = currentAssistantMessage.content;
    }
  }

  const renderPaginationItems = () => {
    const items = [];
    for (let i = 1; i <= totalPages; i++) {
      if (
        i === 1 ||
        i === totalPages ||
        (i >= currentPage - 1 && i <= currentPage + 1)
      ) {
        items.push(
          <PaginationItem key={i}>
            <PaginationLink
              href="#"
              onClick={(e) => {
                e.preventDefault();
                handlePageChange(i);
              }}
              isActive={currentPage === i}
            >
              {i}
            </PaginationLink>
          </PaginationItem>
        );
      } else if (i === currentPage - 2 || i === currentPage + 2) {
        items.push(
          <PaginationItem key={i}>
            <PaginationEllipsis />
          </PaginationItem>
        );
      }
    }
    return items;
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    //TEMP DISABLE AUTO SCROLL
    // if (messagesEndRef.current) {
    //   messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    // }
  }, [displayedMessages, choices]);

  return (
    <Card className="w-full flex-grow md:mx-0.5 md:max-w-[48%] min-h-0 flex flex-col bg-background/60 border-border overflow-hidden">
      <CardContent className="flex-grow flex flex-col overflow-hidden p-4 sm:p-1">
        {memoryBar}
        {/* Determinate TTS progress while narration audio generates (auto or manual regen). */}
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
          <ScrollArea className={`flex-grow border border-border p-2 bg-muted/80 min-h-0 ${isFlashing ? 'flash-animation' : ''} relative`}>
            <div className="absolute top-2 right-2 z-10 flex gap-2">
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
                <GameText text={gameplayText} />
              </div>
            )}
            {displayedMessages.map((message, index) => {
              const isLatestMessage = index === displayedMessages.length - 1;
              if (index === 0 && ttsAudio) {
                return (
                  <React.Fragment key={`audio-${index}`}>
                    <div>
                      {ttsAudio && <AudioPlayer key={ttsAudio.audio.length} audio={ttsAudio} autoPlay />}
                    </div>
                    <div className={`mb-2 ${message.role === 'user' ? 'text-yellow-500' : ''}`}>
                      <strong>{message.role === 'user' ? 'You:' : 'Event:'}</strong>
                      {message.role === 'user' ? (
                        <pre className="whitespace-pre-wrap">{message.content}</pre>
                      ) : (
                        <GameText text={isLatestMessage && isWaitingForAI ? gameplayText : parseAssistantMessage(message.content)} />
                      )}
                    </div>
                  </React.Fragment>
                );
              }
              return (
                <div key={index} className={`mb-2 ${message.role === 'user' ? 'text-yellow-500' : ''}`}>
                  <strong>{message.role === 'user' ? 'You:' : 'Event:'}</strong>
                  {message.role === 'user' ? (
                    <pre className="whitespace-pre-wrap">{message.content}</pre>
                  ) : (
                    <GameText text={isLatestMessage && isWaitingForAI ? gameplayText : parseAssistantMessage(message.content)} />
                  )}
                </div>
              );
            })}
            <div className="mt-4 flex flex-col gap-2">
                {choices && choices.length > 0 && choices.map((choice, index) => {
                  const isSelected = choice === playerInput;
                  return (
                    <Button
                      key={index}
                      onClick={() => setPlayerInput(choice)}
                      disabled={disabled}
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
            <div ref={messagesEndRef} />
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
                if (messageIndex < updatedHistory.length) {
                  const message = updatedHistory[messageIndex];
                  if (message.role === 'assistant') {
                    try {
                      const content = JSON.parse(message.content);
                      updatedHistory[messageIndex] = {
                        role: 'assistant',
                        content: JSON.stringify({
                          ...content,
                          game_text: text
                        })
                      };
                    } catch {
                      // If parsing fails, create new content object
                      updatedHistory[messageIndex] = {
                        role: 'assistant',
                        content: JSON.stringify({
                          game_text: text,
                          choices: choices,
                          stat_changes: []
                        })
                      };
                    }
                  }
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
                        game_text: text
                      })
                    };
                  } catch {
                    updatedMessages[assistantMessageIndex] = {
                      role: 'assistant',
                      content: JSON.stringify({
                        game_text: text,
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
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        if (currentPage > 1) handlePageChange(currentPage - 1);
                      }}
                      className={totalPages === 0 || currentPage === 1 ? "pointer-events-none opacity-50" : ""}
                    />
                  </PaginationItem>
                  {renderPaginationItems()}
                  <PaginationItem>
                    <PaginationNext
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        if (currentPage < totalPages) handlePageChange(currentPage + 1);
                      }}
                      className={totalPages === 0 || currentPage === totalPages ? "pointer-events-none opacity-50" : ""}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
              {/* Right-aligned action: rollback when viewing a past page, re-generate on the current one. */}
              <div className="absolute right-0">
                {currentPage < totalPages ? (
                  <ConfirmDialog
                    title="Confirm Rollback"
                    description="Are you sure you want to rollback to the previous state? This action cannot be undone."
                    onConfirm={handleRollback}
                  >
                    <Button variant="outline" className="text-xs gap-1 w-32">
                      <RefreshCw className="h-3 w-3" />
                      Rollback
                    </Button>
                  </ConfirmDialog>
                ) : totalPages > 0 ? (
                  <Button
                    variant="outline"
                    className="text-xs gap-1 w-32"
                    onClick={handleRegenerate}
                    disabled={disabled}
                  >
                    <RefreshCw className="h-3 w-3" />
                    Re-generate
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
          {!isGameStarted && (
            <div className="flex flex-nowrap">
              <Button onClick={() => sendGameAction("START GAME")} className="flex-1" disabled={disabled}>
                Start Game
              </Button>
            </div>
          )}
          {progressBar}
          <div className="flex flex-col gap-2">
            <div className="flex">
              <Input
                type="text"
                value={playerInput}
                onChange={(e) => setPlayerInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type your action..."
                className="flex-grow mr-2"
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

export const RightPanel = ({ onLocationClick, language, setLanguage }: {
  onLocationClick: () => void;
  language: string;
  setLanguage: (value: string) => void;
}) => {
  const {
    gameTime,
    currentLocation,
    activeTab,
    setActiveTab,
    playerStats,
    setPlayerStats,
    playerTraits,
    recentStatChanges
  } = useGameplay();
  const [isEditMode, setIsEditMode] = React.useState(false);

  return (
    <Card className="w-full md:w-1/4 md:ml-1 grow md:grow-0 min-h-0 flex flex-col md:h-full bg-background/60 border-border overflow-hidden">
      <CardContent className="flex flex-col h-full overflow-hidden p-4 sm:p-1">
      <div className="mb-4 sm:mb-1 flex-shrink-0 flex flex-col gap-2">
        <div className="flex items-center gap-2 pl-2">
          <Languages className="h-6 w-6" />
          <Input
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            placeholder="Language..."
            className="flex-grow"
          />
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
              return (
              <div key={index} className="mb-2">
                <div className="flex justify-between items-center">
                  <span>{stat.name}</span>
                  <div className="flex items-center gap-2">
                    {recentStatChanges[stat.name.toLowerCase()] && (
                      <span className={`text-sm ${recentStatChanges[stat.name.toLowerCase()] > 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {recentStatChanges[stat.name.toLowerCase()] > 0 ? '+' : ''}{recentStatChanges[stat.name.toLowerCase()]}
                      </span>
                    )}
                    <span>{statValue} / {stat.max}</span>
                  </div>
                </div>
                {isEditMode ? (
                  <Slider
                    value={[statValue]}
                    min={stat.min}
                    max={stat.max}
                    step={1}
                    className="mt-2"
                    onValueChange={(value) => {
                      const newStats = [...playerStats];
                      newStats[index] = { ...stat, value: value[0] };
                      setPlayerStats(newStats);
                    }}
                  />
                ) : (
                  <Progress value={(statValue - stat.min) / (stat.max - stat.min) * 100} />
                )}
              </div>
              );
            })}
            <div className="absolute bottom-2 right-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsEditMode(!isEditMode)}
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
                  <span>{trait.name}: {trait.description}</span>
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
              <Button onClick={onLocationClick} className="w-full">
                Current Location: {currentLocation?.name || 'Unknown'}
              </Button>
              {currentLocation && (
                <div className="space-y-2">
                  <p className="font-semibold">Description:</p>
                  <p className="text-sm">{currentLocation.inGameDescription || currentLocation.description}</p>
                  {currentLocation.connections && currentLocation.connections.length > 0 && (
                    <>
                      <p className="font-semibold mt-4">Connected Locations:</p>
                      <ul className="list-disc list-inside text-sm">
                        {currentLocation.connections.map((connection, index) => (
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
    </CardContent>
  </Card>
  );
};
