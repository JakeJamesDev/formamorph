import { useState, useMemo, type ChangeEvent } from 'react';
import { useGameData } from '@/contexts/GameDataContext';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, Plus, X, ArrowLeft, Save, GripVertical } from "lucide-react";
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
import DictionaryManager from '../managers/DictionaryManager';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  arrayMove,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  restrictToVerticalAxis,
  restrictToFirstScrollableAncestor,
} from '@dnd-kit/modifiers';
import { UnsavedChangesDialog } from "@/components/UnsavedChangesDialog";
import type { Stat, Entity, GameLocation, Trait, StatUpdate, DictionaryEntry } from '@/types';

/** The fields a reorderable list row needs (every editor item has these). */
interface ListItem {
  id: string;
  name: string;
}

// A single reorderable entry row. The grip is the drag handle (handle-only drag),
// so clicking the row body still selects it.
function SortableRow({ item, selected, onSelect, onRemove }: {
  item: ListItem;
  selected: boolean;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1 : undefined,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={() => onSelect(item.id)}
      className={`p-2 cursor-pointer rounded-md transition-colors flex justify-between items-center
        ${selected ? 'bg-primary text-primary-foreground' : 'hover:bg-secondary'}`}
    >
      <span className="flex-grow">{item.name}</span>
      <Button
        variant="ghost"
        size="icon"
        onClick={(e) => {
          e.stopPropagation();
          onRemove(item.id);
        }}
        className={selected ? 'text-primary-foreground' : 'text-muted-foreground'}
      >
        <X className="h-4 w-4" />
      </Button>
      <span
        {...attributes}
        {...listeners}
        onClick={(e) => e.stopPropagation()}
        className={`cursor-grab touch-none px-1 ${
          selected ? 'text-primary-foreground' : 'text-muted-foreground'
        }`}
        title="Drag to reorder"
      >
        <GripVertical className="h-4 w-4" />
      </span>
    </div>
  );
}

const WorldEditor = ({ onClose, embedded = false }: {
  onClose: () => void;
  embedded?: boolean;
}) => {
  const {
    worldOverview,
    loadWorldData,
    stats, locations, entities, traits, statUpdates, dictionary,
    addStat, addLocation, addEntity, addTrait, addStatUpdate, addDictionaryEntry,
    removeStat, removeLocation, removeEntity, removeTrait, removeStatUpdate, removeDictionaryEntry,
    setStats, setLocations, setEntities, setTraits, setStatUpdates, setDictionary,
    isWorldDirty, saveWorld: saveWorldCtx
  } = useGameData();

  const [activeTab, setActiveTab] = useState("overview");
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [showExitPrompt, setShowExitPrompt] = useState(false);

  const downloadWorld = () => {
    const worldData = { worldOverview, stats, locations, entities, traits, statUpdates, dictionary };
    const jsonData = JSON.stringify(worldData, null, 2);
    const blob = new Blob([jsonData], { type: 'application/json' });
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = href;
    link.download = worldOverview.name || 'rpg_world.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(href);
  };

  const saveWorld = async () => {
    const ok = await saveWorldCtx();
    if (ok) {
      toast.dark('World saved successfully!');
    } else {
      toast.dark('Error saving world. Please try again.', { type: 'error' });
    }
    return ok;
  };

  const loadWorld = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const loadedWorld = JSON.parse(e.target?.result as string);
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
        });
      } else if (activeTab === "locations") {
        addLocation({
          id: newId,
          name: newName,
          inGameDescription: '',
          detailedDescription: '',
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
      } else if (activeTab === "dictionary") {
        // v1.2 format: name mirrors key; value is the injected content.
        addDictionaryEntry({
          id: newId,
          name: newName,
          key: newName,
          value: ''
        });
      }

      setSearchTerm('');
      setSelectedItemId(newId);
    }
  };

  const filteredItems = useMemo(() => {
    const itemsToFilter =
      activeTab === "stats" ? stats :
      activeTab === "entities" ? entities :
      activeTab === "locations" ? locations :
      activeTab === "traits" ? traits :
      activeTab === "statUpdates" ? statUpdates :
      activeTab === "dictionary" ? dictionary : [];

    return itemsToFilter.filter(item =>
      item.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [activeTab, stats, entities, locations, traits, statUpdates, dictionary, searchTerm]);

  const selectedItem = filteredItems.find(item => item.id === selectedItemId);

  // Per-tab data + setter so list behavior (selection, drag-reorder) is uniform across tabs.
  const tabConfig = {
    stats: { items: stats, setItems: setStats },
    entities: { items: entities, setItems: setEntities },
    locations: { items: locations, setItems: setLocations },
    traits: { items: traits, setItems: setTraits },
    dictionary: { items: dictionary, setItems: setDictionary },
    statUpdates: { items: statUpdates, setItems: setStatUpdates },
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Reorder the active tab's full array (filter-safe: located by id).
  const handleRowDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const config = tabConfig[activeTab as keyof typeof tabConfig];
    if (!config) return;
    // The per-tab item/setter types correlate but TS can't track that across the union; all items
    // share `id` and each setter accepts its own reordered array, so treat them uniformly here.
    const items = config.items as { id: string }[];
    const oldIndex = items.findIndex((it) => it.id === active.id);
    const newIndex = items.findIndex((it) => it.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    (config.setItems as (next: { id: string }[]) => void)(arrayMove(items, oldIndex, newIndex));
  };

  const removeItem = (id: string) => {
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
    } else if (activeTab === "dictionary") {
      removeDictionaryEntry(id);
    }
    setSelectedItemId(null);
  };

  const renderItemList = (items: ListItem[]) => (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleRowDragEnd}
      // Vertical-only movement, clamped to the scroll viewport's bounds so dragging can't
      // extend the scrollable area infinitely.
      modifiers={[restrictToVerticalAxis, restrictToFirstScrollableAncestor]}
      autoScroll={{
        // Only auto-scroll a real inner scroll viewport (the list), never the page/window.
        canScroll: (el) =>
          el !== document.scrollingElement &&
          el !== document.body &&
          el !== document.documentElement,
      }}
    >
      <SortableContext
        items={items.map((i) => i.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex flex-col gap-2">
          {items.map((item) => (
            <SortableRow
              key={item.id}
              item={item}
              selected={selectedItemId === item.id}
              onSelect={setSelectedItemId}
              onRemove={removeItem}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );

  return (
    <div className={`${embedded ? "h-full" : "h-screen"} flex flex-col overflow-hidden`}>
      {!embedded && (
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
      )}
      <div className="flex-grow flex overflow-hidden">
        <PanelGroup direction="horizontal">
          <Panel defaultSize={50} minSize={30}>
            <Card className="h-full flex flex-col m-4">
              <CardHeader className="space-y-0 pb-2">
                <div className="flex items-center space-x-4">
                  {!embedded && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => (isWorldDirty ? setShowExitPrompt(true) : onClose())}
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                  )}
                  <CardTitle>World Editor</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="flex-grow flex flex-col overflow-hidden pt-6">
                {activeTab !== "overview" && (
                  <div className="mb-4 space-y-2 flex-shrink-0">
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

                  <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-grow flex flex-col min-h-0">
                      <TabsList className="flex-shrink-0">
                        <TabsTrigger value="overview">Overview</TabsTrigger>
                        <TabsTrigger value="stats">Stats</TabsTrigger>
                        <TabsTrigger value="entities">Entities</TabsTrigger>
                        <TabsTrigger value="locations">Locations</TabsTrigger>
                        <TabsTrigger value="traits">Traits</TabsTrigger>
                        <TabsTrigger value="dictionary">Dictionary</TabsTrigger>
                        {/*<TabsTrigger value="statUpdates">Updates</TabsTrigger>*/}
                      </TabsList>
                    <div className="flex-grow min-h-0 mt-4">
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
                        <TabsContent value="dictionary">
                          {renderItemList(filteredItems)}
                        </TabsContent>
                        <TabsContent value="statUpdates">
                          {renderItemList(filteredItems)}
                        </TabsContent>
                      </ScrollArea>
                    </div>
                  </Tabs>
              </CardContent>
              <div className="p-4 border-t flex justify-between">
                <Button variant="outline" size="sm" onClick={downloadWorld}>
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
                <Button size="sm" onClick={saveWorld} disabled={!isWorldDirty}>
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
                    {activeTab === "stats" && selectedItem && (
                      <StatManager key={selectedItem.id} stat={selectedItem as Stat} />
                    )}
                    {activeTab === "entities" && selectedItem && (
                      <EntityManager key={selectedItem.id} entity={selectedItem as Entity} />
                    )}
                    {activeTab === "locations" && selectedItem && (
                      <LocationManager key={selectedItem.id} location={selectedItem as GameLocation} />
                    )}
                    {activeTab === "traits" && selectedItem && (
                      <TraitManager key={selectedItem.id} trait={selectedItem as Trait} />
                    )}
                    {activeTab === "dictionary" && selectedItem && (
                      <DictionaryManager key={selectedItem.id} entry={selectedItem as DictionaryEntry} />
                    )}
                    {activeTab === "statUpdates" && selectedItem && (
                      <StatUpdatesManager key={selectedItem.id} statUpdate={selectedItem as StatUpdate} />
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </Panel>
        </PanelGroup>
      </div>
      <UnsavedChangesDialog
        open={showExitPrompt}
        onOpenChange={setShowExitPrompt}
        onSave={async () => { await saveWorld(); onClose(); }}
        onExit={onClose}
      />
    </div>
  );
};

export default WorldEditor;
