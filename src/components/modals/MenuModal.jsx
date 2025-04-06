import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Save, Download, Upload, Trash2 } from "lucide-react";
import { ConfirmDialog } from '../ConfirmDialog';
import { saveToDB, getAllSaves, deleteFromDB, loadFromDB } from './dbUtils';

export const MenuModal = ({ isOpen, onOpenChange, onSettingsClick, onSave, onLoad, worldOverview, onExitToMenu }) => {
  const [showSaveDialog, setShowSaveDialog] = React.useState(false);
  const [showLoadDialog, setShowLoadDialog] = React.useState(false);
  const [saveName, setSaveName] = React.useState('');
  const [saveList, setSaveList] = React.useState([]);

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

          const saves = await getAllSaves();
          setSaveList(saves.map(save => ({
            name: save.name,
            timestamp: new Date(save.timestamp).toLocaleString(),
            gameTime: save.gameTime,
            worldName: save.worldName
          })).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)));
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

  const handleDelete = async (saveName) => {
    try {
      await deleteFromDB(saveName);
      setSaveList(prevList => prevList.filter(save => save.name !== saveName));
    } catch (error) {
      console.error('Error deleting save:', error);
    }
  };

  const formatGameTime = (time) => {
    const hours = Math.floor(time);
    const minutes = Math.floor((time - hours) * 60);
    return `${hours}h ${minutes}m`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Menu</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto py-4">
          {!showSaveDialog && !showLoadDialog && (
            <div className="space-y-4 px-4">
              <Button 
                variant="outline" 
                onClick={() => setShowSaveDialog(true)}
                className="w-full"
              >
                Save Game
              </Button>
              <Button 
                variant="outline"
                onClick={() => setShowLoadDialog(true)}
                className="w-full"
              >
                Load Game
              </Button>
              <Button 
                variant="outline"
                onClick={onSettingsClick}
                className="w-full"
              >
                Settings
              </Button>
              <ConfirmDialog
                title="Exit to Main Menu"
                description="Are you sure you want to exit to the main menu? Any unsaved progress will be lost."
                onConfirm={() => {
                  onExitToMenu();
                  onOpenChange(false);
                }}
              >
                <Button variant="outline" className="w-full">
                  Exit to Main Menu
                </Button>
              </ConfirmDialog>
            </div>
          )}

          {showSaveDialog && (
            <div className="space-y-4 px-4">
              <h3 className="font-semibold">Save Game</h3>
              <div className="flex gap-2">
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
              <Button 
                variant="outline"
                onClick={() => {
                  setShowSaveDialog(false);
                  setSaveName('');
                }}
              >
                Back
              </Button>
            </div>
          )}

          {showLoadDialog && (
            <div className="flex flex-col h-full">
              <h3 className="font-semibold mb-4 flex-shrink-0">Load Game</h3>
              <div className="flex-shrink-0 mb-4">
                <div className="grid grid-cols-2 gap-2">
                  <Button 
                    variant="outline"
                    onClick={() => setShowLoadDialog(false)}
                  >
                    Back
                  </Button>
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
                      
                      const saves = await getAllSaves();
                      setSaveList(saves.map(save => ({
                        name: save.name,
                        timestamp: new Date(save.timestamp).toLocaleString(),
                        gameTime: save.gameTime,
                        worldName: save.worldName
                      })).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)));
                      
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
                    <Upload className="h-4 w-4" />
                    <span>Upload</span>
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
                      onClick={() => {
                        onLoad(save.name);
                        setShowLoadDialog(false);
                        onOpenChange(false);
                      }}
                    >
                      <div className="flex items-start w-full">
                        <div className="flex mr-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={async (e) => {
                              e.stopPropagation();
                              try {
                                const fullSaveData = await loadFromDB(save.name);
                                const element = document.createElement('a');
                                const file = new Blob([JSON.stringify(fullSaveData, null, 2)], {type: 'application/json'});
                                element.href = URL.createObjectURL(file);
                                element.download = `${save.name}.json`;
                                document.body.appendChild(element);
                                element.click();
                                document.body.removeChild(element);
                              } catch (error) {
                                console.error('Error downloading save:', error);
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
                  {saveList.length === 0 && (
                    <div className="text-center py-4 opacity-70">
                      No saved games found
                    </div>
                  )}
                  </div>
                </ScrollArea>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
