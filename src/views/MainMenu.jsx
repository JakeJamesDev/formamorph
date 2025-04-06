import React, { useState, useRef, useEffect } from 'react';
import { useGameData } from '../contexts/GameDataContext';
import { toast, ToastContainer  } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {ConfirmDialog} from "@/components/ConfirmDialog";
import { DoorOpen, Pencil, Github } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import CharacterCustomization, { defaultCharacterData } from './CharacterCustomization';
import TraitSelectionModal from './TraitSelectionModal';
import WorldStorageService from '../services/WorldStorageService';

const defaultWorlds = [
  { id: 'slime', defaultName: 'Slime' },
  { id: 'sugarscape', defaultName: 'Sugarscape' },
  { id: 'veilwood', defaultName: 'Veilwood' },
  { id: 'rampage', defaultName: 'Rampage' },
  { id: 'valentines', defaultName: 'Valentines Survival' },
  { id: 'drone', defaultName: 'Reincarnated Drone' }
];

const MainMenu = ({ onStartGame, onOpenWorldEditor }) => {
  const { traits, stats, loadWorldData } = useGameData();
  const [selectedWorld, setSelectedWorld] = useState(null);
  const [showWorldModal, setShowWorldModal] = useState(false);
  const [showMobileWorldEditorWarning, setShowMobileWorldEditorWarning] = useState(false);
  const [worldToDelete, setWorldToDelete] = useState(null);
  const [showCharacterCustomization, setShowCharacterCustomization] = useState(false);
  const [showTraitSelection, setShowTraitSelection] = useState(false);
  const [selectedTraits, setSelectedTraits] = useState([]);
  const fileInputRef = useRef(null);
  const [worlds, setWorlds] = useState([]);
  const [isLoadingWorlds, setIsLoadingWorlds] = useState(true);

  // Initialize default worlds and load metadata
  useEffect(() => {
    const initializeWorlds = async () => {
      try {
        await WorldStorageService.initialize();
        const existingWorlds = await WorldStorageService.getWorldMetadata();
        if (existingWorlds.length === 0) {
          await WorldStorageService.loadDefaultWorlds(defaultWorlds);
          toast.success("Loaded default worlds");
        }
        const worldMetadata = await WorldStorageService.getWorldMetadata();
        
        setWorlds(worldMetadata.map(world => ({
          ...world,
          isLoading: false,
          defaultName: defaultWorlds.find(dw => dw.id === world.id)?.defaultName || world.name
        })));
        
      } catch (error) {
        console.error('Error initializing worlds:', error);
      } finally {
        setIsLoadingWorlds(false);
      }
    };

    initializeWorlds();
  }, []);

  const handleWorldSelection = async (worldId) => {
    try {
      const worldData = await WorldStorageService.getWorldData(worldId);
      const selectedWorld = worlds.find(w => w.id === worldId);
      
      if (worldData && selectedWorld) {
        loadWorldData(worldData, true);
        setSelectedWorld({
          ...selectedWorld,
          data: worldData
        });
        setShowWorldModal(true);
      }
    } catch (error) {
      console.error('Error loading world data:', error);
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const parsedWorldData = JSON.parse(e.target.result);
          const worldId = `uploaded-${Date.now()}`;

          parsedWorldData.id = worldId;
          
          await WorldStorageService.storeWorld({
            id: worldId,
            name: parsedWorldData.worldOverview?.name || 'Uploaded World',
            description: parsedWorldData.worldOverview?.description || 'Custom uploaded world',
            thumbnail: parsedWorldData.worldOverview?.thumbnail,
            data: parsedWorldData
          });

          setWorlds(prev => [...prev, {
            id: worldId,
            name: parsedWorldData.worldOverview?.name || 'Uploaded World',
            description: parsedWorldData.worldOverview?.description || 'Custom uploaded world',
            thumbnail: parsedWorldData.worldOverview?.thumbnail,
            isLoading: false
          }]);

          loadWorldData(parsedWorldData, true);
          setSelectedWorld({
            id: worldId,
            name: parsedWorldData.worldOverview?.name || 'Uploaded World',
            description: parsedWorldData.worldOverview?.description || 'Custom uploaded world',
            thumbnail: parsedWorldData.worldOverview?.thumbnail,
            data: parsedWorldData
          });
          setShowWorldModal(true);
        } catch (error) {
          console.error('Error parsing world file:', error);
        }
      };
      reader.readAsText(file);
    }
  };

  const handleTraitSelection = (traitId) => {
    setSelectedTraits(prev => 
      prev.includes(traitId)
        ? prev.filter(id => id !== traitId)
        : [...prev, traitId]
    );
  };

  if (showCharacterCustomization) {
    return (
      <CharacterCustomization
        onCharacterCustomized={(customizedData) => {
          setShowCharacterCustomization(false);
          onStartGame(selectedTraits, customizedData, true);
        }}
      />
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 relative">
      <h1 className="text-2xl font-bold mb-6 text-center">Choose Your World</h1>
      <ToastContainer theme="dark" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoadingWorlds ? (
          Array(6).fill(0).map((_, index) => (
            <div key={index} className="w-full h-48">
              <Skeleton className="w-full h-full" />
              <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 p-2">
                <Skeleton className="h-6 w-24" />
              </div>
            </div>
          ))
        ) : (
          <>
            {worlds.map((world) => (
              <div
                key={world.id}
                className="relative cursor-pointer rounded-lg overflow-hidden hover:opacity-90 transition-opacity"
                onClick={() => handleWorldSelection(world.id)}
              >
                <img
                  src={world.thumbnail}
                  alt={world.name}
                  className="w-full h-48 object-cover select-none"
                />
                <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 p-2">
                  <h3 className="text-white font-semibold">{world.name}</h3>
                  <button 
                    className="absolute top-2 right-2 p-1 text-red-500 hover:text-red-700"
                    onClick={(e) => {
                      e.stopPropagation();
                      setWorldToDelete(world.id);
                    }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
            <div
              className="relative cursor-pointer rounded-lg overflow-hidden hover:opacity-90 transition-opacity border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center h-48"
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept=".json"
                className="hidden"
              />
              <div className="text-center">
                <svg
                  className="mx-auto h-12 w-12 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Upload World</p>
              </div>
            </div>
          </>
        )}
      </div>

      <Dialog open={showWorldModal} onOpenChange={setShowWorldModal}>
        <DialogContent className="sm:max-w-[500px] h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedWorld?.name}</DialogTitle>
          </DialogHeader>
          
          <div className="mt-4">
            <div className="space-y-4">
              <div className="hidden sm:block relative w-full pt-[56.25%]">
                <img
                  src={selectedWorld?.thumbnail}
                  alt={selectedWorld?.name}
                  className="absolute top-0 left-0 w-full h-full object-cover rounded-lg"
                />
              </div>
              
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {selectedWorld?.description}
              </p>

              <div className="space-y-2">
                <Button
                  className="w-full bg-gradient-to-r from-sky-200 to-cyan-200 hover:from-sky-300 hover:to-cyan-300 text-black font-bold"
                  onClick={() => {
                    setShowWorldModal(false);
                    setShowTraitSelection(true);
                  }}
                >
                  <DoorOpen className="mr-2 h-4 w-4" /> Enter World
                </Button>
                
                <Button
                  className="w-full bg-gradient-to-r from-amber-100 to-yellow-100 hover:from-amber-200 hover:to-yellow-200 text-black font-bold"
                  onClick={() => {
                    // For uploaded worlds, use the worldData from context
                    const currentWorldData = selectedWorld.data || worldData;
                    onStartGame(selectedTraits, currentWorldData.worldOverview?.use3DModel ? defaultCharacterData : null, true);
                  }}
                >
                  <DoorOpen className="mr-2 h-4 w-4" /> Enter World (Skip Customize)
                </Button>
                
                <Button
                  className="w-full bg-gradient-to-r from-orange-100 to-orange-200 hover:from-orange-200 hover:to-orange-300 text-black font-bold"
                  onClick={() => {
                    if (window.innerWidth < 1024) {
                      setShowMobileWorldEditorWarning(true);
                    } else {
                      onOpenWorldEditor();
                    }
                  }}
                >
                  <Pencil className="mr-2 h-4 w-4" /> Edit World
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!worldToDelete}
        onOpenChange={(open) => !open && setWorldToDelete(null)}
        title="Delete World"
        message="Are you sure you want to delete this world? This action cannot be undone."
        onConfirm={async () => {
          try {
            await WorldStorageService.deleteWorld(worldToDelete);
            setWorlds(prev => prev.filter(w => w.id !== worldToDelete));
            setWorldToDelete(null);
          } catch (error) {
            console.error('Error deleting world:', error);
          }
        }}
      />

      <Dialog open={showMobileWorldEditorWarning} onOpenChange={setShowMobileWorldEditorWarning}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mobile Not Supported</DialogTitle>
          </DialogHeader>
          <div className="text-sm mb-4">
            The World Editor is not optimized for mobile devices. Please use a desktop computer for the best experience.
          </div>
          <div className="flex justify-end gap-2">
            <Button 
              variant="outline" 
              onClick={() => setShowMobileWorldEditorWarning(false)}
            >
              Cancel
            </Button>
            <Button 
              onClick={() => {
                setShowMobileWorldEditorWarning(false);
                onOpenWorldEditor();
              }}
            >
              Go Anyway
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {showTraitSelection && (
        <TraitSelectionModal
          traits={traits}
          stats={stats}
          selectedTraits={selectedTraits}
          onTraitSelect={handleTraitSelection}
          onClose={() => {
            setShowTraitSelection(false);
            setSelectedTraits([]);
          }}
          onConfirm={() => {
            setShowTraitSelection(false);
            // For uploaded worlds, use the worldData from context
            const currentWorldData = selectedWorld.data || worldData;
            if (currentWorldData.worldOverview?.use3DModel) {
              setShowCharacterCustomization(true);
            } else {
              onStartGame(selectedTraits, null, true);
            }
          }}
        />
      )}
      
      {/* GitHub floating button */}
      <a 
        href="https://github.com/FieryLionite/formamorph" 
        target="_blank" 
        rel="noopener noreferrer"
        className="fixed bottom-4 right-4 p-3 bg-gray-800 text-white rounded-full shadow-lg hover:bg-gray-700 transition-colors"
        aria-label="GitHub Repository"
      >
        <Github className="h-6 w-6" />
      </a>
    </div>
  );
};

export default MainMenu;
