import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Menu, Save, Download, Import, Trash2, Loader2 } from "lucide-react";
import { ConfirmDialog } from '../ConfirmDialog';
import { saveToDB, getAllSaves, deleteFromDB, loadFromDB } from './dbUtils';
import { downloadSaveFile, terminateWorker as terminateDownloadWorker } from '../../lib/saveDownloadWorkerUtils';
import type { WorldOverview, GameState } from "@/types";

/** A stored save record as read back from IndexedDB (v2 envelope or a legacy flat state). */
interface RawSave {
  name: string;
  version?: number;
  currentState?: GameState;
  timestamp?: string;
  gameTime?: number;
  worldName?: string | null;
}

/** A row shown in the load list. */
interface SaveListItem {
  name: string;
  timestamp: string;
  gameTime: number;
  worldName: string | null;
}

export const MenuModal = ({ onSettingsClick, onSave, onLoad, worldOverview, onExitToMenu }: {
  onSettingsClick: () => void;
  onSave: (saveName: string) => Promise<unknown> | void;
  onLoad: (saveName: string) => Promise<unknown> | void;
  worldOverview?: WorldOverview;
  onExitToMenu: () => void;
}) => {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [showSaveDialog, setShowSaveDialog] = React.useState(false);
  const [showLoadDialog, setShowLoadDialog] = React.useState(false);
  const [showExitConfirm, setShowExitConfirm] = React.useState(false);
  const [saveName, setSaveName] = React.useState('');
  const [saveList, setSaveList] = React.useState<SaveListItem[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [loadingMessage, setLoadingMessage] = React.useState('');
  const [isDownloading, setIsDownloading] = React.useState(false);
  const [downloadingSaveName, setDownloadingSaveName] = React.useState('');

  // Clean up web worker when component unmounts
  React.useEffect(() => {
    return () => {
      terminateDownloadWorker();
    };
  }, []);

  React.useEffect(() => {
    if (showLoadDialog) {
      const loadSaves = async () => {
        try {
          const localStorageSaves = [];
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith('FORMAMORPH_save_')) {
              try {
                const data = JSON.parse(localStorage.getItem(key));
                const saveName = key.replace('FORMAMORPH_save_', '');
                await saveToDB(saveName, data);
                localStorageSaves.push(key);
              } catch (error) {
                console.error('Error migrating save:', error);
              }
            }
          }

          localStorageSaves.forEach(key => localStorage.removeItem(key));

          const saves = await getAllSaves() as RawSave[];
          setSaveList(saves.map(save => {
            // Handle both old and new save formats
            const isNewFormat = save.version === 2 && save.currentState;
            const state = isNewFormat ? save.currentState : save;

            return {
              name: save.name,
              timestamp: new Date(state.timestamp).toLocaleString(),
              gameTime: state.gameTime,
              worldName: state.worldName
            };
          }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
        } catch (error) {
          console.error('Error loading saves:', error);
          setSaveList([]);
        }
      };

      loadSaves();
    }
  }, [showLoadDialog]);

  const handleSave = async () => {
    if (!saveName.trim()) return;
    try {
      await onSave(saveName);
      setSaveName('');
      setShowSaveDialog(false);
    } catch (error) {
      console.error('Error saving game:', error);
    }
  };

  const handleDelete = async (saveName: string) => {
    try {
      await deleteFromDB(saveName);
      setSaveList(prevList => prevList.filter(save => save.name !== saveName));
    } catch (error) {
      console.error('Error deleting save:', error);
    }
  };

  const formatGameTime = (time: number) => {
    const hours = Math.floor(time);
    const minutes = Math.floor((time - hours) * 60);
    return `${hours}h ${minutes}m`;
  };

  return (
    <>
      <Popover open={menuOpen} onOpenChange={setMenuOpen}>
        <PopoverTrigger asChild>
          <Button
            className="flex items-center justify-center rounded-full w-10 h-10 p-0"
            title="Menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-48 p-1">
          <div className="flex flex-col">
            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={() => { setMenuOpen(false); setShowSaveDialog(true); }}
            >
              Save Game
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={() => { setMenuOpen(false); setShowLoadDialog(true); }}
            >
              Load Game
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={() => { setMenuOpen(false); onSettingsClick(); }}
            >
              Settings
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={() => { setMenuOpen(false); setShowExitConfirm(true); }}
            >
              Exit to Main Menu
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      <ConfirmDialog
        open={showExitConfirm}
        onOpenChange={setShowExitConfirm}
        title="Exit to Main Menu"
        description="Are you sure you want to exit to the main menu? Any unsaved progress will be lost."
        onConfirm={onExitToMenu}
      />

      {/* Save Game popup */}
      <Dialog open={showSaveDialog} onOpenChange={(open) => { setShowSaveDialog(open); if (!open) setSaveName(''); }}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Save Game</DialogTitle>
          </DialogHeader>
          <div className="flex gap-2 py-4">
            <Input
              placeholder="Enter save name"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSave();
              }}
            />
            <Button
              onClick={handleSave}
              className="flex items-center justify-center gap-2"
            >
              <Save className="h-4 w-4" />
              <span>Save</span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Load Game popup */}
      <Dialog open={showLoadDialog} onOpenChange={setShowLoadDialog}>
        <DialogContent className="sm:max-w-[425px] max-h-[90vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>Load Game</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col min-h-0 flex-1 py-4">
              <div className="flex-shrink-0 mb-4">
                <div className="grid grid-cols-1 gap-2">
                  <input
                    type="file"
                    id="save-upload"
                    className="hidden"
                    accept=".json"
                    onChange={async (e) => {
                    try {
                      const file = e.target.files[0];
                      if (!file) return;

                      const text = await file.text();
                      const save = JSON.parse(text);

                      await saveToDB(save.name, save);

                      const saves = await getAllSaves() as RawSave[];
                      setSaveList(saves.map(save => {
                        // Handle both old and new save formats
                        const isNewFormat = save.version === 2 && save.currentState;
                        const state = isNewFormat ? save.currentState : save;

                        return {
                          name: save.name,
                          timestamp: new Date(state.timestamp).toLocaleString(),
                          gameTime: state.gameTime,
                          worldName: state.worldName
                        };
                      }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));

                      e.target.value = '';
                    } catch (error) {
                      console.error('Error uploading save:', error);
                    }
                  }}
                />
                  <Button
                    variant="outline"
                    className="w-full flex items-center justify-center gap-2"
                    onClick={() => document.getElementById('save-upload').click()}
                  >
                    <Import className="h-4 w-4" />
                    <span>Import</span>
                  </Button>
                </div>
              </div>
              <div className="flex-1 min-h-0">
                <ScrollArea className="h-full">
                  <div className="space-y-2 p-4">
                  {saveList.map((save) => (
                      <Button
                        key={save.name}
                        variant="outline"
                        className="w-full text-left"
                        disabled={isLoading}
                        onClick={async () => {
                          try {
                            setIsLoading(true);
                            setLoadingMessage('Loading save file. Please wait...');

                            // Add a small delay to ensure the loading state is visible
                            await new Promise(resolve => setTimeout(resolve, 100));

                            await onLoad(save.name);
                            setShowLoadDialog(false);
                          } catch (error) {
                            console.error('Error loading game:', error);
                          } finally {
                            setIsLoading(false);
                            setLoadingMessage('');
                          }
                        }}
                      >
                      <div className="flex items-start w-full">
                        <div className="flex mr-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            disabled={isDownloading || isLoading}
                            onClick={async (e) => {
                              e.stopPropagation();
                              try {
                                // Set downloading state
                                setIsDownloading(true);
                                setDownloadingSaveName(save.name);
                                setLoadingMessage(`Preparing ${save.name} for download...`);

                                // Load the save data
                                const fullSaveData = await loadFromDB(save.name);

                                // Use web worker to process the save data
                                const { dataUrl, fileName } = await downloadSaveFile(fullSaveData) as { dataUrl: string; fileName: string };

                                // Create a download link
                                const element = document.createElement('a');
                                element.href = dataUrl;
                                element.download = `${fileName}.json`;
                                document.body.appendChild(element);
                                element.click();
                                document.body.removeChild(element);
                              } catch (error) {
                                console.error('Error downloading save:', error);
                              } finally {
                                setIsDownloading(false);
                                setDownloadingSaveName('');
                                setLoadingMessage('');
                              }
                            }}
                          >
                            <Download className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(save.name);
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                        <div className="flex-1">
                          <div>{save.name}</div>
                          <div className="text-xs opacity-70">
                            {save.timestamp} - Game Time: {formatGameTime(save.gameTime)}
                          </div>
                          {save.worldName && save.worldName !== worldOverview?.name && (
                            <div className="text-xs text-yellow-500">
                              Warning: Different world ({save.worldName})
                            </div>
                          )}
                        </div>
                      </div>
                    </Button>
                  ))}
                  {(isLoading || isDownloading) && (
                    <div className="text-center py-4 flex flex-col items-center space-y-2">
                      <Loader2 className="h-6 w-6 animate-spin" />
                      <div className="text-sm">
                        {loadingMessage || 'Processing...'}
                      </div>
                      <div className="text-xs text-amber-500 max-w-xs">
                        {isDownloading
                          ? `Please wait while the save file "${downloadingSaveName}" is being prepared for download. For large save files, this may take a moment.`
                          : 'Please wait while the save file is being processed. For large save files, this may take a moment. Do not attempt to load another save until this process completes.'
                        }
                      </div>
                    </div>
                  )}

                  {!isLoading && saveList.length === 0 && (
                    <div className="text-center py-4 opacity-70">
                      No saved games found
                    </div>
                  )}
                  </div>
                </ScrollArea>
              </div>
            </div>
          </DialogContent>
        </Dialog>
    </>
  );
};
