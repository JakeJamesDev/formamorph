import React, { useState, useMemo } from 'react';
import { useGameData } from '@/contexts/GameDataContext';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, Upload, Plus, X, ArrowLeft, Save } from "lucide-react";
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { ScrollArea } from "@/components/ui/scroll-area";
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import StatManager from '../managers/StatManager';
import EntityManager from '../managers/EntityManager';
import LocationManager from '../managers/LocationManager';
import TraitManager from '../managers/TraitManager';
import StatUpdatesManager from '../managers/StatUpdatesManager';
import WorldOverviewManager from '../managers/WorldOverviewManager';
import { ConfirmDialog } from "@/components/ConfirmDialog";
import WorldStorageService from '../services/WorldStorageService';

const WorldEditor = ({ onClose }) => {
  const { 
    worldOverview,
    loadWorldData,
    stats, locations, entities, traits, statUpdates,
    addStat, addLocation, addEntity, addTrait, addStatUpdate,
    removeStat, removeLocation, removeEntity, removeTrait, removeStatUpdate,
    setStats, setLocations, setEntities, setTraits, setStatUpdates,
    updateWorldOverview, worldId
  } = useGameData();

  const [activeTab, setActiveTab] = useState("overview");
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItemIndex, setSelectedItemIndex] = useState(null);

  const downloadWorld = () => {
    const worldData = { worldOverview, stats, locations, entities, traits, statUpdates };
    const jsonData = JSON.stringify(worldData, null, 2);
    const blob = new Blob([jsonData], { type: 'application/json' });
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href;
    link.download = 'rpg_world.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(href);
  };

  const saveWorld = async () => {
    console.log("worldId: ", worldId)
    const worldData = { worldOverview, stats, locations, entities, traits, statUpdates };
    try {
      await WorldStorageService.storeWorld({
        id: worldId,
        name: worldOverview.name,
        description: worldOverview.description,
        author: worldOverview.author,
        thumbnail: worldOverview.thumbnail,
        data: worldData
      });
      toast.dark('World saved successfully!');
    } catch (error) {
      console.error('Error saving world:', error);
      toast.dark('Error saving world. Please try again.', { type: 'error' });
    }
  };

  const loadWorld = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const loadedWorld = JSON.parse(e.target.result);
          loadWorldData(loadedWorld, false);
        } catch (error) {
          console.error('Error parsing JSON:', error);
          toast.dark('Error loading world data. Please check the file format.', { type: 'error' });
        }
      };
      reader.readAsText(file);
    }
  };

  const addItem = () => {
    if (searchTerm.trim()) {
      const newId = Date.now().toString();
      const newName = searchTerm.trim();
      
      if (activeTab === "stats") {
        addStat({
          id: newId,
          name: newName,
          type: 'number',
          description: '',
          min: 0,
          max: 100,
          value: 0,
          regen: 0
        });
      } else if (activeTab === "entities") {
        addEntity({
          id: newId,
          name: newName,
          inGameDescription: '',
          detailedDescription: '',
          type: '',
          image: null,
          sound: null,
          model: null
        });
      } else if (activeTab === "locations") {
        addLocation({
          id: newId,
          name: newName,
          inGameDescription: '',
          detailedDescription: '',
          backgroundImage: null,
          ambientSound: null,
          entities: []
        });
      } else if (activeTab === "traits") {
        addTrait({
          id: newId,
          name: newName,
          description: '',
          statChanges: []
        });
      } else if (activeTab === "statUpdates") {
        addStatUpdate({
          id: newId,
          name: newName,
          prompt: '',
          stats: [],
          messageHistory: []
        });
      }
      
      setSearchTerm('');
      setSelectedItemIndex(0);
    }
  };

  const filteredItems = useMemo(() => {
    const itemsToFilter = 
      activeTab === "stats" ? stats : 
      activeTab === "entities" ? entities : 
      activeTab === "locations" ? locations : 
      activeTab === "traits" ? traits :
      activeTab === "statUpdates" ? statUpdates : [];
    
    return itemsToFilter.filter(item => 
      item.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [activeTab, stats, entities, locations, traits, statUpdates, searchTerm]);

  const removeItem = (id) => {
    if (activeTab === "stats") {
      removeStat(id);
    } else if (activeTab === "entities") {
      removeEntity(id);
    } else if (activeTab === "locations") {
      removeLocation(id);
    } else if (activeTab === "traits") {
      removeTrait(id);
    } else if (activeTab === "statUpdates") {
      removeStatUpdate(id);
    }
    setSelectedItemIndex(null);
  };

  const renderItemList = (items) => (
    <div className="flex flex-col space-y-2">
      {items.map((item, index) => (
        <div
          key={item.id}
          className={`p-2 cursor-pointer rounded-md transition-colors flex justify-between items-center
            ${selectedItemIndex === index 
              ? 'bg-primary text-primary-foreground' 
              : 'hover:bg-secondary'
            }`}
        >
          <span
            className="flex-grow"
            onClick={() => setSelectedItemIndex(index)}
          >
            {item.name}
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              removeItem(item.id);
            }}
            className={selectedItemIndex === index ? 'text-primary-foreground' : 'text-muted-foreground'}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}
    </div>
  );

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="dark"
      />
      <div className="flex-grow flex overflow-hidden">
        <PanelGroup direction="horizontal">
          <Panel defaultSize={50} minSize={30}>
            <Card className="h-full flex flex-col m-4">
              <CardHeader className="space-y-0 pb-2">
                <div className="flex items-center space-x-4">
                  <ConfirmDialog
                    title="Return to Main Menu?"
                    description="Any unsaved changes will be lost. Please save your progress using the Save or Download button below before returning to the main menu if you want to keep your changes."
                    onConfirm={onClose}
                  >
                    <Button variant="ghost" size="icon">
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                  </ConfirmDialog>
                  <CardTitle>World Editor</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="flex-grow flex flex-col overflow-hidden pt-6">
                <ScrollArea className="flex-grow">
                {activeTab !== "overview" && (
                  <div className="mb-4 space-y-2">
                    <div className="flex space-x-2">
                      <Button onClick={addItem} size="icon">
                        <Plus className="h-4 w-4" />
                      </Button>
                      <Input
                        placeholder={`Search or add new ${activeTab}`}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </div>
                  </div>
                )}
                
                  <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-grow flex flex-col">
                      <TabsList>
                        <TabsTrigger value="overview">Overview</TabsTrigger>
                        <TabsTrigger value="stats">Stats</TabsTrigger>
                        <TabsTrigger value="entities">Entities</TabsTrigger>
                        <TabsTrigger value="locations">Locations</TabsTrigger>
                        <TabsTrigger value="traits">Traits</TabsTrigger>
                        {/*<TabsTrigger value="statUpdates">Updates</TabsTrigger>*/}
                      </TabsList>
                    <div className="flex-grow overflow-auto mt-4">
                      <ScrollArea className="h-full">
                        <TabsContent value="overview">
                          <WorldOverviewManager />
                        </TabsContent>
                        <TabsContent value="stats">
                          {renderItemList(filteredItems)}
                        </TabsContent>
                        <TabsContent value="entities">
                          {renderItemList(filteredItems)}
                        </TabsContent>
                        <TabsContent value="locations">
                          {renderItemList(filteredItems)}
                        </TabsContent>
                        <TabsContent value="traits">
                          {renderItemList(filteredItems)}
                        </TabsContent>
                        <TabsContent value="statUpdates">
                          {renderItemList(filteredItems)}
                        </TabsContent>
                      </ScrollArea>
                    </div>
                  </Tabs>
                </ScrollArea>
              </CardContent>
              <div className="p-4 border-t flex justify-between">
                <Button variant="outline" size="sm" onClick={downloadWorld}>
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
                <Button size="sm" onClick={saveWorld}>
                  <Save className="h-4 w-4 mr-2" />
                  Save
                </Button>
                {/* Disabled due to new format
                <Button variant="outline" size="sm" onClick={() => document.getElementById('load-world').click()}>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload
                </Button> */}
                <Input
                  type="file"
                  accept=".json"
                  onChange={loadWorld}
                  className="hidden"
                  id="load-world"
                />
              </div>
            </Card>
          </Panel>
          <PanelResizeHandle className="w-1 bg-secondary cursor-col-resize" />
          <Panel minSize={30}>
            <Card className="h-full m-4">
              <CardContent className="h-full p-0">
                <ScrollArea className="h-full">
                  <div className="p-6">
                    {activeTab === "stats" && selectedItemIndex !== null && (
                      <StatManager stat={filteredItems[selectedItemIndex]} />
                    )}
                    {activeTab === "entities" && selectedItemIndex !== null && (
                      <EntityManager entity={filteredItems[selectedItemIndex]} />
                    )}
                    {activeTab === "locations" && selectedItemIndex !== null && (
                      <LocationManager location={filteredItems[selectedItemIndex]} />
                    )}
                    {activeTab === "traits" && selectedItemIndex !== null && (
                      <TraitManager trait={filteredItems[selectedItemIndex]} />
                    )}
                    {activeTab === "statUpdates" && selectedItemIndex !== null && (
                      <StatUpdatesManager statUpdate={filteredItems[selectedItemIndex]} />
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </Panel>
        </PanelGroup>
      </div>
    </div>
  );
};

export default WorldEditor;
