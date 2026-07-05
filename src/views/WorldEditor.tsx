import { useState, useMemo, type ChangeEvent } from 'react';
import { useGameData } from '@/contexts/GameDataContext';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Download, Plus, X, ArrowLeft, Save, GripVertical, FolderPlus, FilePlus, Copy, ImageDown, BookPlus, UserPlus } from "lucide-react";
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import StatManager from '../managers/StatManager';
import EntityManager from '../managers/EntityManager';
import LocationManager from '../managers/LocationManager';
import TraitManager from '../managers/TraitManager';
import GroupManager from '../managers/GroupManager';
import TraitTree from '../managers/TraitTree';
import LocationTree from '../managers/LocationTree';
import { removeLocationPromotingChildren } from '@/lib/locationTree';
import { duplicateTraitNode } from '@/lib/traitTree';
import StatUpdatesManager from '../managers/StatUpdatesManager';
import WorldOverviewManager from '../managers/WorldOverviewManager';
import WorldDetailsManager from '../managers/WorldDetailsManager';
import DictionaryManager from '../managers/DictionaryManager';
import DictionaryTree from '../managers/DictionaryTree';
import DictionaryBookManager from '../managers/DictionaryBookManager';
import { buildDictionaryFile } from '@/lib/dictionaryFile';
import AddDictionaryModal from '@/components/modals/AddDictionaryModal';
import AddEntityModal from '@/components/modals/AddEntityModal';
import { exportEntityCard } from '@/lib/entityFile';
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
import { APP_VERSION, WORLD_FILE_KIND } from '@/lib/version';
import type { Stat, Entity, GameLocation, StatUpdate, Dictionary, World } from '@/types';
import { useDownscalePrompt } from '@/lib/useDownscalePrompt';

/** The fields a reorderable list row needs (every editor item has these). */
interface ListItem {
  id: string;
  name: string;
}

// A single reorderable entry row. The grip is the drag handle (handle-only drag),
// so clicking the row body still selects it.
function SortableRow({ item, selected, onSelect, onRemove, onDuplicate, enabled, onToggleEnabled }: {
  item: ListItem;
  selected: boolean;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  onDuplicate: (id: string) => void;
  enabled?: boolean;
  onToggleEnabled?: (id: string, enabled: boolean) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id });
  const faded = !!onToggleEnabled && enabled === false;
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging || faded ? 0.5 : 1,
    zIndex: isDragging ? 1 : undefined,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={(e) => { e.stopPropagation(); onSelect(item.id); }}
      className={`p-2 cursor-pointer rounded-md transition-colors flex justify-between items-center
        ${selected ? 'bg-primary text-primary-foreground' : 'hover:bg-secondary'}`}
    >
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
      {onToggleEnabled && (
        <Checkbox
          checked={enabled !== false}
          onCheckedChange={(v) => onToggleEnabled(item.id, v === true)}
          onClick={(e) => e.stopPropagation()}
          className="mx-1 shrink-0"
          title={enabled === false ? 'Disabled — click to enable' : 'Enabled — click to disable'}
        />
      )}
      <span className="flex-grow">{item.name}</span>
      <Button
        variant="ghost"
        size="icon"
        onClick={(e) => {
          e.stopPropagation();
          onDuplicate(item.id);
        }}
        className={selected ? 'text-primary-foreground' : 'text-muted-foreground'}
        title="Duplicate"
      >
        <Copy className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={(e) => {
          e.stopPropagation();
          onRemove(item.id);
        }}
        className={selected ? 'text-primary-foreground' : 'text-muted-foreground'}
        title="Delete"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

const WorldEditor = ({ onClose, embedded = false }: {
  onClose: () => void;
  embedded?: boolean;
}) => {
  const {
    worldOverview, updateWorldOverview, worldId,
    loadWorldData,
    stats, locations, entities, traits, traitGroups, statUpdates, dictionaries,
    addStat, addLocation, addEntity, addTrait, addStatUpdate, addDictionary,
    addTraitGroup,
    removeStat, removeEntity, removeTrait, removeStatUpdate,
    setStats, setLocations, setEntities, setTraits, setTraitGroups, setStatUpdates,
    isWorldDirty, saveWorld: saveWorldCtx
  } = useGameData();
  const { promptWorld, dialog: downscaleDialog } = useDownscalePrompt();

  // Assemble the editor's live world for an image scan/downscale (id/version unused by the scan).
  const buildCurrentWorld = (): World => ({
    id: worldId ?? '', version: APP_VERSION,
    worldOverview, stats, locations, entities, traits, traitGroups, statUpdates, dictionaries,
  });
  // Apply a downscaled world back to the editor's state (marks dirty for the user to Save).
  const applyDownscaled = (w: World) => {
    updateWorldOverview({ thumbnail: w.worldOverview.thumbnail });
    setEntities(w.entities);
    setLocations(w.locations);
  };
  const optimizeImages = async () => {
    const w = await promptWorld(buildCurrentWorld());
    if (w) applyDownscaled(w);
  };

  const [activeTab, setActiveTab] = useState("overview");
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [showExitPrompt, setShowExitPrompt] = useState(false);
  const [showAddDictionary, setShowAddDictionary] = useState(false);
  const [showAddEntity, setShowAddEntity] = useState(false);

  const downloadWorld = async () => {
    // Offer to downscale oversized images BEFORE writing the file so the download itself is the smaller size.
    // This affects only the exported file — the editor state and the stored world are left untouched.
    const current = buildCurrentWorld();
    const downscaled = await promptWorld(current);
    const w = downscaled ?? current;
    const worldData = {
      formamorphKind: WORLD_FILE_KIND,
      version: APP_VERSION,
      worldOverview: w.worldOverview, stats: w.stats, locations: w.locations, entities: w.entities,
      traits: w.traits, traitGroups: w.traitGroups, statUpdates: w.statUpdates, dictionaries: w.dictionaries,
    };
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

  // Export one book to its own standalone `.json` (no image downscale — dictionaries are text only).
  const downloadDictionary = (book: Dictionary) => {
    const jsonData = JSON.stringify(buildDictionaryFile(book), null, 2);
    const blob = new Blob([jsonData], { type: 'application/json' });
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href;
    link.download = `${book.name || 'Dictionary'}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(href);
  };

  // Export one entity as a shareable WebP character card (its portrait carrying the text fields).
  const downloadEntity = async (entity: Entity) => {
    try {
      const blob = await exportEntityCard(entity);
      const href = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = href;
      link.download = `${entity.name || 'Character'}.webp`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(href);
    } catch (error) {
      toast.dark((error as Error).message, { type: 'error' });
    }
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
          playerDescription: '',
          aiDescription: '',
          aiSummary: '',
          type: '',
        });
      } else if (activeTab === "locations") {
        addLocation({
          id: newId,
          name: newName,
          playerDescription: '',
          aiDescription: '',
          aiSummary: '',
          entities: []
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
      setSelectedItemId(newId);
    }
  };

  // The Dictionary tab's + adds a whole book (name from the search box); entries are added per-book in the tree.
  const handleAddBook = () => {
    const id = crypto.randomUUID();
    addDictionary({ id, name: searchTerm.trim() || 'New Dictionary', enabled: true, entries: [] });
    setSearchTerm('');
    setSelectedItemId(id);
  };

  // New traits/groups append at the root; the author drags them into folders. Order = root sibling count.
  const rootSiblingCount = () =>
    traits.filter(t => (t.groupId ?? null) === null).length +
    traitGroups.filter(g => (g.parentId ?? null) === null).length;

  const handleAddTrait = () => {
    const id = crypto.randomUUID();
    addTrait({
      id,
      name: searchTerm.trim() || 'New Trait',
      playerDescription: '',
      aiDescription: '',
      statChanges: [],
      groupId: null,
      isDefault: false,
      order: rootSiblingCount(),
    });
    setSearchTerm('');
    setSelectedItemId(id);
  };

  const handleAddGroup = () => {
    const id = crypto.randomUUID();
    addTraitGroup({
      id,
      name: searchTerm.trim() || 'New Group',
      playerDescription: '',
      aiDescription: '',
      parentId: null,
      order: rootSiblingCount(),
    });
    setSearchTerm('');
    setSelectedItemId(id);
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

  const selectedItem = filteredItems.find(item => item.id === selectedItemId);
  // Traits tab can select either a trait or a group (the right panel branches on which).
  const selectedTrait = traits.find(t => t.id === selectedItemId);
  const selectedGroup = traitGroups.find(g => g.id === selectedItemId);
  // Dictionary tab: selection is either a book or one of its entries (the right panel branches on which).
  const selectedBook = dictionaries.find(b => b.id === selectedItemId);
  const selectedEntry = dictionaries.flatMap(b => b.entries).find(e => e.id === selectedItemId);

  // Contextual footer actions. Download shows on Overview/Entities/Dictionary; only "Download World"
  // is wired up (entity/dictionary export is a stub). Import shows on Entities (when one is selected)
  // and Dictionary, and does nothing yet.
  const downloadContext =
    activeTab === 'overview' ? { label: 'Download World', disabled: false, onClick: () => { downloadWorld(); } }
    : activeTab === 'entities' ? { label: `Download ${selectedItem?.name ?? 'Entity'}`, disabled: !selectedItem, onClick: () => { if (selectedItem) downloadEntity(selectedItem as Entity); } }
    : activeTab === 'dictionary'
      ? { label: `Download ${selectedBook?.name ?? 'Dictionary'}`, disabled: !selectedBook, onClick: () => { if (selectedBook) downloadDictionary(selectedBook); } }
    : null;
  // "Add" opens the add-from-library picker (characters on Entities, books on Dictionary).
  const showImport = activeTab === 'entities' || activeTab === 'dictionary';
  const importDisabled = false;
  const importLabel = activeTab === 'entities' ? 'Add Entity' : 'Add Dictionary';

  // Per-tab data + setter so list behavior (selection, drag-reorder) is uniform across tabs.
  const tabConfig = {
    stats: { items: stats, setItems: setStats },
    entities: { items: entities, setItems: setEntities },
    locations: { items: locations, setItems: setLocations },
    traits: { items: traits, setItems: setTraits },
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

  // Deep-copy an item and place the copy right after the original. Traits/groups keep their exact
  // group/nesting (handled by duplicateTraitNode); the other tabs are flat arrays.
  const duplicateItem = (id: string) => {
    if (activeTab === "traits") {
      const res = duplicateTraitNode(traitGroups, traits, id);
      setTraitGroups(res.groups);
      setTraits(res.traits);
      setSelectedItemId(res.newId);
      return;
    }
    const config = tabConfig[activeTab as keyof typeof tabConfig];
    if (!config) return;
    const items = config.items as { id: string; name: string }[];
    const index = items.findIndex((it) => it.id === id);
    if (index === -1) return;
    const copy = { ...structuredClone(items[index]), id: crypto.randomUUID() };
    copy.name = `${copy.name} (Copy)`;
    const next = [...items.slice(0, index + 1), copy, ...items.slice(index + 1)];
    (config.setItems as (next: { id: string }[]) => void)(next);
    setSelectedItemId(copy.id);
  };

  const removeItem = (id: string) => {
    if (activeTab === "stats") {
      removeStat(id);
    } else if (activeTab === "entities") {
      removeEntity(id);
    } else if (activeTab === "locations") {
      // Deleting a location promotes its sub-locations up to the deleted node's parent (nothing lost).
      setLocations(removeLocationPromotingChildren(locations, id));
    } else if (activeTab === "traits") {
      removeTrait(id);
    } else if (activeTab === "statUpdates") {
      removeStatUpdate(id);
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
              onDuplicate={duplicateItem}
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
            <div className="h-full p-4">
            <Card className="h-full flex flex-col">
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
                    {activeTab !== "overview" && (
                      <div className="flex space-x-2 flex-shrink-0 mt-4">
                        {activeTab === "traits" ? (
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button size="icon">
                                <Plus className="h-4 w-4" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent side="bottom" align="start" className="w-44 p-1">
                              <button
                                type="button"
                                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                                onClick={handleAddGroup}
                              >
                                <FolderPlus className="h-4 w-4" /> Add Group
                              </button>
                              <button
                                type="button"
                                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                                onClick={handleAddTrait}
                              >
                                <FilePlus className="h-4 w-4" /> Add Trait
                              </button>
                            </PopoverContent>
                          </Popover>
                        ) : (
                          <Button onClick={activeTab === "dictionary" ? handleAddBook : addItem} size="icon">
                            <Plus className="h-4 w-4" />
                          </Button>
                        )}
                        <Input
                          placeholder={activeTab === "dictionary" ? "Name a new dictionary" : `Search or add new ${activeTab}`}
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                        />
                      </div>
                    )}
                    <div className="flex-grow min-h-0 mt-4" onClick={() => setSelectedItemId(null)}>
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
                          {searchTerm.trim()
                            ? renderItemList(filteredItems)
                            : <LocationTree selectedId={selectedItemId} onSelect={setSelectedItemId} />}
                        </TabsContent>
                        <TabsContent value="traits">
                          {searchTerm.trim()
                            ? renderItemList(filteredItems)
                            : <TraitTree selectedId={selectedItemId} onSelect={setSelectedItemId} />}
                        </TabsContent>
                        <TabsContent value="dictionary">
                          <DictionaryTree selectedId={selectedItemId} onSelect={setSelectedItemId} />
                        </TabsContent>
                        <TabsContent value="statUpdates">
                          {renderItemList(filteredItems)}
                        </TabsContent>
                      </ScrollArea>
                    </div>
                  </Tabs>
              </CardContent>
              <div className="p-4 border-t flex justify-between">
                {downscaleDialog}
                <div className="flex gap-2">
                  {downloadContext && (
                    <Button variant="outline" size="sm" onClick={downloadContext.onClick} disabled={downloadContext.disabled}>
                      <Download className="h-4 w-4 mr-2 shrink-0" />
                      <span className="truncate max-w-[14rem]">{downloadContext.label}</span>
                    </Button>
                  )}
                  {showImport && (
                    <Button variant="outline" size="sm" onClick={() => { if (activeTab === "dictionary") setShowAddDictionary(true); else if (activeTab === "entities") setShowAddEntity(true); }} disabled={importDisabled}>
                      {activeTab === "dictionary"
                        ? <BookPlus className="h-4 w-4 mr-2 shrink-0" />
                        : <UserPlus className="h-4 w-4 mr-2 shrink-0" />}
                      <span className="truncate max-w-[14rem]">{importLabel}</span>
                    </Button>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={optimizeImages} title="Downscale oversized images to conserve file size">
                    <ImageDown className="h-4 w-4 mr-2" />
                    Optimize Images
                  </Button>
                  <Button size="sm" onClick={saveWorld} disabled={!isWorldDirty}>
                    <Save className="h-4 w-4 mr-2" />
                    Save
                  </Button>
                </div>
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
            </div>
          </Panel>
          <PanelResizeHandle className="w-1 bg-secondary cursor-col-resize" />
          <Panel minSize={30}>
            <div className="h-full p-4">
            <Card className="h-full">
              <CardContent className="h-full p-0">
                <ScrollArea className="h-full">
                  <div className="p-6">
                    {activeTab === "overview" && (
                      <WorldDetailsManager />
                    )}
                    {activeTab === "stats" && selectedItem && (
                      <StatManager key={selectedItem.id} stat={selectedItem as Stat} />
                    )}
                    {activeTab === "entities" && selectedItem && (
                      <EntityManager key={selectedItem.id} entity={selectedItem as Entity} />
                    )}
                    {activeTab === "locations" && selectedItem && (
                      <LocationManager key={selectedItem.id} location={selectedItem as GameLocation} />
                    )}
                    {activeTab === "traits" && selectedGroup && (
                      <GroupManager key={selectedGroup.id} group={selectedGroup} />
                    )}
                    {activeTab === "traits" && !selectedGroup && selectedTrait && (
                      <TraitManager key={selectedTrait.id} trait={selectedTrait} />
                    )}
                    {activeTab === "dictionary" && selectedBook && (
                      <DictionaryBookManager key={selectedBook.id} book={selectedBook} />
                    )}
                    {activeTab === "dictionary" && !selectedBook && selectedEntry && (
                      <DictionaryManager key={selectedEntry.id} entry={selectedEntry} />
                    )}
                    {activeTab === "statUpdates" && selectedItem && (
                      <StatUpdatesManager key={selectedItem.id} statUpdate={selectedItem as StatUpdate} />
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
            </div>
          </Panel>
        </PanelGroup>
      </div>
      <UnsavedChangesDialog
        open={showExitPrompt}
        onOpenChange={setShowExitPrompt}
        onSave={async () => { await saveWorld(); onClose(); }}
        onExit={onClose}
      />
      <AddDictionaryModal
        open={showAddDictionary}
        onOpenChange={setShowAddDictionary}
        onAdd={(book) => { addDictionary(book); setSelectedItemId(book.id); }}
      />
      <AddEntityModal
        open={showAddEntity}
        onOpenChange={setShowAddEntity}
        onAdd={(entity) => { addEntity(entity); setSelectedItemId(entity.id); }}
      />
    </div>
  );
};

export default WorldEditor;
