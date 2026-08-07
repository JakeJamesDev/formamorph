import { randomUUID } from "@/lib/uuid";
import { useState, useEffect, useMemo, useRef, type ChangeEvent, type ReactNode } from 'react';
import { useGameData } from '@/contexts/GameDataContext';
import { useDevRoute } from '@/lib/devRouter';
import { WORLD_EDITOR_TABS } from './worldEditorTabs';
import { EmptyListHint } from '@/components/EmptyListHint';
import { HelpButton } from '@/components/HelpButton';
import { worldEditorTopicId } from '@/lib/helpTopics';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Download, Plus, ArrowLeft, Save, FolderPlus, FilePlus, ImageDown, BookPlus, UserPlus, Loader2 } from "lucide-react";
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { ScrollArea } from "@/components/ui/scroll-area";
import { ListDetail } from "@/components/ui/list-detail";
import { useIsMobile } from "@/lib/useIsMobile";
import { toast } from 'react-toastify';
import { ThemedToastContainer } from '@/components/ThemedToastContainer';
import 'react-toastify/dist/ReactToastify.css';
import StatManager from '../managers/StatManager';
import EntityManager from '../managers/EntityManager';
import LocationManager from '../managers/LocationManager';
import TraitManager from '../managers/TraitManager';
import GroupManager from '../managers/GroupManager';
import EntityGroupManager from '../managers/EntityGroupManager';
import TraitTree from '../managers/TraitTree';
import LocationTree from '../managers/LocationTree';
import EntityTree from '../managers/EntityTree';
import { removeLocationPromotingChildren } from '@/lib/locationTree';
import { duplicateTraitNode } from '@/lib/traitTree';
import StatUpdatesManager from '../managers/StatUpdatesManager';
import WorldOverviewManager from '../managers/WorldOverviewManager';
import WorldDetailsManager from '../managers/WorldDetailsManager';
import DictionaryManager from '../managers/DictionaryManager';
import PlaceholderPaletteBar from '@/components/prompt/PlaceholderPaletteBar';
import { ChipInsertTargetProvider } from '@/components/prompt/ChipInsertTarget';
import PlaceholderManager from '../managers/PlaceholderManager';
import PlaceholderList from '../managers/PlaceholderList';
import DictionaryTree from '../managers/DictionaryTree';
import DictionaryBookManager from '../managers/DictionaryBookManager';
import { buildDictionaryFile } from '@/lib/dictionaryFile';
import { downloadBlob } from '@/lib/downloadBlob';
import { useWorldExport } from '@/lib/useWorldExport';
import { parseJsonText, terminateWorker as terminateJsonWorker } from '@/lib/jsonFileWorkerUtils';
import AddDictionaryModal from '@/components/modals/AddDictionaryModal';
import AddEntityModal from '@/components/modals/AddEntityModal';
import { exportEntityCard } from '@/lib/entityFile';
import { absorbPlaceholders, remapPlaceholderIds, labelPlaceholders, describePlaceholders } from '@/lib/placeholders';
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
  arrayMove,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import {
  restrictToVerticalAxis,
  restrictToFirstScrollableAncestor,
} from '@dnd-kit/modifiers';
import { CONTAINED_AUTO_SCROLL } from '@/lib/dndAutoScroll';
import { UnsavedChangesDialog } from "@/components/UnsavedChangesDialog";
import { APP_VERSION } from '@/lib/version';
import type { Stat, Entity, GameLocation, StatUpdate, Dictionary, World } from '@/types';
import { useDownscalePrompt } from '@/lib/useDownscalePrompt';
import { SortableRow, type SortableListItem } from '@/components/SortableList';

/** The fields a reorderable list row needs (every editor item has these). */
type ListItem = SortableListItem;

const WorldEditor = ({ onClose, embedded = false, backButton }: {
  onClose: () => void;
  embedded?: boolean;
  /** Force the header back arrow on/off independent of `embedded`. Defaults to `!embedded`: a full-screen
   *  host (MainMenu modal) wants the back arrow without the toast/chrome; GameViewer's popup uses the X. */
  backButton?: boolean;
}) => {
  const showBackButton = backButton ?? !embedded;
  const {
    updateWorldOverview, worldId,
    loadWorldData, getWorldData,
    stats, locations, entities, entityGroups, traits, traitGroups, statUpdates, dictionaries, placeholders,
    addStat, addLocation, addEntity, addTrait, addStatUpdate, addDictionary,
    addTraitGroup, addEntityGroup, addPlaceholder,
    removeStat, removeEntity, removeTrait, removeStatUpdate,
    setStats, setLocations, setEntities, setTraits, setTraitGroups, setStatUpdates,
    isWorldDirty, saveWorld: saveWorldCtx, discardChanges
  } = useGameData();
  const { promptWorld, dialog: downscaleDialog } = useDownscalePrompt();

  // Assemble the editor's live world for an image scan/downscale (id/version unused by the scan).
  const buildCurrentWorld = (): World => ({
    id: worldId ?? '', version: APP_VERSION, ...getWorldData(),
  });
  // Apply a downscaled world back to the editor's state (marks dirty for the user to Save).
  const applyDownscaled = (w: World) => {
    updateWorldOverview({ thumbnail: w.worldOverview.thumbnail });
    setEntities(w.entities);
    setLocations(w.locations);
  };
  // null = idle; 'scanning' = measuring before the choice dialog; then the live per-image encode progress.
  const [optimizeProgress, setOptimizeProgress] = useState<{ done: number; total: number } | 'scanning' | null>(null);
  const { exportWorld, dialog: worldExportDialog } = useWorldExport(promptWorld);
  // Cancels an in-flight optimize when the editor closes: without it the orphaned run keeps the shared encode
  // worker busy for the whole world and then writes its stale click-time snapshot back into GameDataContext,
  // clobbering any edits made after re-entering.
  const optimizeAbortRef = useRef<AbortController | null>(null);
  useEffect(() => () => optimizeAbortRef.current?.abort(), []);
  // Drop the import/export JSON worker when the editor unmounts — it's idle outside those two actions.
  useEffect(() => () => terminateJsonWorker(), []);
  const optimizeImages = async () => {
    const controller = new AbortController();
    optimizeAbortRef.current = controller;
    setOptimizeProgress('scanning');
    try {
      const w = await promptWorld(
        buildCurrentWorld(),
        (done, total) => setOptimizeProgress({ done, total }),
        controller.signal,
      );
      // Never apply after an abort — the editor is gone or the run is stale.
      if (w && !controller.signal.aborted) applyDownscaled(w);
    } finally {
      optimizeAbortRef.current = null;
      setOptimizeProgress(null);
    }
  };

  const [activeTab, setActiveTab] = useState("overview");
  // DEV dev-router: jump to a specific editor tab via `#dev?modal=worldEditor&tab=…`. Tree-shaken in prod.
  const devRoute = useDevRoute();
  useEffect(() => {
    if (import.meta.env.DEV && devRoute?.tab) setActiveTab(devRoute.tab);
  }, [devRoute?.tab]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const isMobile = useIsMobile();
  const [showExitPrompt, setShowExitPrompt] = useState(false);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [showAddDictionary, setShowAddDictionary] = useState(false);
  const [showAddEntity, setShowAddEntity] = useState(false);

  const exportCurrentWorld = () => exportWorld(buildCurrentWorld());

  // Export one book to its own standalone `.json` (no image downscale — dictionaries are text only).
  const exportDictionary = (book: Dictionary) => {
    // Bundle the world placeholders this book's entries use, so its chips resolve after import elsewhere.
    const jsonData = JSON.stringify(buildDictionaryFile(book, placeholders), null, 2);
    downloadBlob(new Blob([jsonData], { type: 'application/json' }), `${book.name || 'Dictionary'}.json`);
  };

  // Export one entity as a shareable WebP character card (its portrait carrying the text fields).
  const exportEntity = async (entity: Entity) => {
    try {
      // The card's own data keeps the chips; only the filename is flattened, since a placement id is not a name.
      downloadBlob(await exportEntityCard(entity, placeholders), `${describePlaceholders(entity.name, placeholders) || 'Character'}.webp`);
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  // Absorb an imported item's carried placeholders into the world: add any that aren't a perfect (name+values)
  // match, remap the item's chip tokens to the resolved world ids, and drop the item's own section (now global).
  const absorbEntityPlaceholders = (entity: Entity): Entity => {
    if (!entity.placeholders?.length) return entity;
    const { toAdd, idMap } = absorbPlaceholders(entity.placeholders, placeholders);
    toAdd.forEach(addPlaceholder);
    const remap = (t?: string) => (t ? remapPlaceholderIds(t, idMap) : t);
    return {
      ...entity,
      name: remap(entity.name) ?? entity.name,
      aliases: entity.aliases?.map((a) => remapPlaceholderIds(a, idMap)),
      playerDescription: remap(entity.playerDescription),
      aiDescription: remap(entity.aiDescription),
      aiSummary: remap(entity.aiSummary),
      placeholders: undefined,
    };
  };
  const absorbDictionaryPlaceholders = (book: Dictionary): Dictionary => {
    if (!book.placeholders?.length) return book;
    const { toAdd, idMap } = absorbPlaceholders(book.placeholders, placeholders);
    toAdd.forEach(addPlaceholder);
    return {
      ...book,
      entries: book.entries.map((e) => ({
        ...e,
        name: e.name ? remapPlaceholderIds(e.name, idMap) : e.name,
        key: e.key?.map((k) => remapPlaceholderIds(k, idMap)) ?? e.key,
        secondaryKeys: e.secondaryKeys?.map((k) => remapPlaceholderIds(k, idMap)),
        value: e.value ? remapPlaceholderIds(e.value, idMap) : e.value,
      })),
      placeholders: undefined,
    };
  };

  const saveWorld = async () => {
    const ok = await saveWorldCtx();
    if (ok) {
      toast.success('World saved successfully!');
    } else {
      toast.error('Error saving world. Please try again.');
    }
    return ok;
  };

  const loadWorld = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      // Parsed off-thread — an image-heavy world file is multi-MB and JSON.parse can't be chunked.
      const loadedWorld = await parseJsonText(await file.text());
      loadWorldData(loadedWorld as World, false);
    } catch (error) {
      console.error('Error parsing JSON:', error);
      toast.error('Error loading world data. Please check the file format.');
    }
  };

  // Add a new item to the active flat-list tab. Like the other handlers, an empty search box falls
  // back to a default name so the + button always creates something.
  const addItem = () => {
    const newId = randomUUID();
    const typed = searchTerm.trim();

    if (activeTab === "stats") {
      addStat({
        id: newId,
        name: typed || 'New Stat',
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
        name: typed || 'New Entity',
        playerDescription: '',
        aiDescription: '',
        aiSummary: '',
        type: '',
        groupId: null,
        order: entityRootSiblingCount(),
      });
    } else if (activeTab === "locations") {
      addLocation({
        id: newId,
        name: typed || 'New Location',
        playerDescription: '',
        aiDescription: '',
        aiSummary: '',
        entities: []
      });
    } else if (activeTab === "statUpdates") {
      addStatUpdate({
        id: newId,
        name: typed || 'New Stat Update',
        prompt: '',
        stats: [],
        messageHistory: []
      });
    } else {
      return;
    }

    setSearchTerm('');
    setSelectedItemId(newId);
  };

  // The Dictionary tab's + adds a whole book (name from the search box); entries are added per-book in the tree.
  const handleAddBook = () => {
    const id = randomUUID();
    addDictionary({ id, name: searchTerm.trim() || 'New Dictionary', enabled: true, entries: [] });
    setSearchTerm('');
    setSelectedItemId(id);
  };

  const handleAddPlaceholder = () => {
    const id = randomUUID();
    addPlaceholder({ id, name: searchTerm.trim() || 'New Placeholder', values: [] });
    setSearchTerm('');
    setSelectedItemId(id);
  };

  // New traits/groups append at the root; the author drags them into folders. Order = root sibling count.
  const rootSiblingCount = () =>
    traits.filter(t => (t.groupId ?? null) === null).length +
    traitGroups.filter(g => (g.parentId ?? null) === null).length;

  const handleAddTrait = () => {
    const id = randomUUID();
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
    const id = randomUUID();
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

  // New entity groups append at the root; the author drags entities into them. Order = root sibling count.
  const entityRootSiblingCount = () =>
    entities.filter(e => (e.groupId ?? null) === null).length +
    entityGroups.filter(g => (g.parentId ?? null) === null).length;

  const handleAddEntityGroup = () => {
    const id = randomUUID();
    addEntityGroup({ id, name: searchTerm.trim() || 'New Group', parentId: null, order: entityRootSiblingCount() });
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

    // Search what the author reads. A name holding a chip is stored as a token, so matching the raw value
    // would mean typing a UUID to find it.
    return itemsToFilter.filter(item =>
      labelPlaceholders(item.name, placeholders).toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [activeTab, stats, entities, locations, traits, statUpdates, searchTerm, placeholders]);

  const selectedItem = filteredItems.find(item => item.id === selectedItemId);
  // Traits tab can select either a trait or a group (the right panel branches on which).
  const selectedTrait = traits.find(t => t.id === selectedItemId);
  const selectedGroup = traitGroups.find(g => g.id === selectedItemId);
  const selectedEntity = entities.find(e => e.id === selectedItemId);
  const selectedEntityGroup = entityGroups.find(g => g.id === selectedItemId);
  // Dictionary tab: selection is either a book or one of its entries (the right panel branches on which).
  const selectedBook = dictionaries.find(b => b.id === selectedItemId);
  const selectedEntry = dictionaries.flatMap(b => b.entries).find(e => e.id === selectedItemId);
  const selectedPlaceholder = placeholders.find(p => p.id === selectedItemId);

  // Contextual footer actions. Export shows on Overview/Entities/Dictionary; only "Export World"
  // is wired up (entity/dictionary export is a stub). Import shows on Entities (when one is selected)
  // and Dictionary, and does nothing yet.
  const exportContext =
    activeTab === 'overview' ? { label: 'Export World', disabled: false, onClick: () => { exportCurrentWorld(); } }
    : activeTab === 'entities' ? { label: `Export ${selectedItem?.name ?? 'Entity'}`, disabled: !selectedItem, onClick: () => { if (selectedItem) exportEntity(selectedItem as Entity); } }
    : activeTab === 'dictionary'
      ? { label: `Export ${selectedBook?.name ?? 'Dictionary'}`, disabled: !selectedBook, onClick: () => { if (selectedBook) exportDictionary(selectedBook); } }
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
    const copy = { ...structuredClone(items[index]), id: randomUUID() };
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

  const renderItemList = (items: ListItem[]) => {
    if (items.length === 0) {
      const q = searchTerm.trim();
      // Same empty-state hint the trees show (unified), or a "no matches" note when filtering.
      return q
        ? <p className="text-sm text-muted-foreground p-2">No {activeTab} match &ldquo;{q}&rdquo;.</p>
        : <EmptyListHint noun={activeTab} />;
    }
    return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleRowDragEnd}
      // Vertical-only movement, clamped to the scroll viewport's bounds so dragging can't
      // extend the scrollable area infinitely.
      modifiers={[restrictToVerticalAxis, restrictToFirstScrollableAncestor]}
      autoScroll={CONTAINED_AUTO_SCROLL}
    >
      <SortableContext
        items={items.map((i) => i.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex flex-col gap-2">
          {items.map((item) => (
            <SortableRow
              key={item.id}
              item={{ ...item, name: labelPlaceholders(item.name, placeholders) }}
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
  };

  // The per-tab list (master) and detail, extracted so both the desktop resizable split and the mobile
  // single-panel push render from one source. `overview` isn't master-detail — it shows a form in each slot.
  const listContent = (
    <>
      {activeTab === "overview" && <WorldOverviewManager />}
      {activeTab === "stats" && renderItemList(filteredItems)}
      {activeTab === "entities" && (searchTerm.trim() ? renderItemList(filteredItems) : <EntityTree selectedId={selectedItemId} onSelect={setSelectedItemId} />)}
      {activeTab === "locations" && (searchTerm.trim() ? renderItemList(filteredItems) : <LocationTree selectedId={selectedItemId} onSelect={setSelectedItemId} />)}
      {activeTab === "traits" && (searchTerm.trim() ? renderItemList(filteredItems) : <TraitTree selectedId={selectedItemId} onSelect={setSelectedItemId} />)}
      {activeTab === "dictionary" && <DictionaryTree selectedId={selectedItemId} onSelect={setSelectedItemId} />}
      {activeTab === "statUpdates" && renderItemList(filteredItems)}
      {activeTab === "placeholders" && <PlaceholderList selectedId={selectedItemId} onSelect={setSelectedItemId} />}
    </>
  );
  const detailContent = (
    <ChipInsertTargetProvider>
    <div className="p-6">
      {/* One palette for the whole panel. Not on the Placeholders tab itself: a placeholder's own values
          are plain text, since a chip inside one would never be expanded (resolution is single-pass). */}
      {activeTab !== "placeholders" && (
        <PlaceholderPaletteBar placeholders={placeholders} className="-mx-6 -mt-6 mb-4 px-6" />
      )}
      {activeTab === "overview" && (
        <WorldDetailsManager />
      )}
      {activeTab === "stats" && selectedItem && (
        <StatManager key={selectedItem.id} stat={selectedItem as Stat} />
      )}
      {activeTab === "entities" && selectedEntityGroup && (
        <EntityGroupManager key={selectedEntityGroup.id} group={selectedEntityGroup} />
      )}
      {activeTab === "entities" && !selectedEntityGroup && selectedEntity && (
        <EntityManager key={selectedEntity.id} entity={selectedEntity} />
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
        <DictionaryManager key={selectedEntry.id} entry={selectedEntry} placeholders={placeholders} />
      )}
      {activeTab === "statUpdates" && selectedItem && (
        <StatUpdatesManager key={selectedItem.id} statUpdate={selectedItem as StatUpdate} />
      )}
      {activeTab === "placeholders" && selectedPlaceholder && (
        <PlaceholderManager key={selectedPlaceholder.id} placeholder={selectedPlaceholder} />
      )}
    </div>
    </ChipInsertTargetProvider>
  );

  // Shared chrome — reused by the desktop resizable split and the mobile single-panel layout.
  const headerBar = (
    <div className="flex items-center space-x-4">
      {showBackButton && (
        <Button variant="ghost" size="icon" onClick={() => (isWorldDirty ? setShowExitPrompt(true) : onClose())}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
      )}
      <CardTitle>World Editor</CardTitle>
    </div>
  );
  const tabsList = (
    <TabsList className="flex-shrink-0">
      {WORLD_EDITOR_TABS.map((t) => (
        <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>
      ))}
    </TabsList>
  );
  // One panel per tab so every trigger's `aria-controls` resolves. Only the active tab has a body, so the
  // rest render empty; `contents` keeps that body a direct flex child of the tab root, as it was unwrapped.
  const tabPanels = (body: ReactNode) => WORLD_EDITOR_TABS.map((t) => (
    <TabsContent key={t.value} value={t.value} className="contents">
      {t.value === activeTab ? body : null}
    </TabsContent>
  ));
  // The active tab's help topic, when it has copy yet — drives the `?` beside the search box.
  const helpTopicId = worldEditorTopicId(activeTab);
  const addSearchBar = activeTab !== "overview" && (
    <div className="flex space-x-2 flex-shrink-0 mt-4">
      {activeTab === "traits" || activeTab === "entities" ? (
        <Popover open={addMenuOpen} onOpenChange={setAddMenuOpen}>
          <PopoverTrigger asChild>
            <Button size="icon">
              <Plus className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent side="bottom" align="start" className="w-44 p-1">
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
              onClick={() => { (activeTab === "entities" ? handleAddEntityGroup : handleAddGroup)(); setAddMenuOpen(false); }}
            >
              <FolderPlus className="h-4 w-4" /> Add Group
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
              onClick={() => { (activeTab === "entities" ? addItem : handleAddTrait)(); setAddMenuOpen(false); }}
            >
              <FilePlus className="h-4 w-4" /> {activeTab === "entities" ? "Add Entity" : "Add Trait"}
            </button>
          </PopoverContent>
        </Popover>
      ) : (
        <Button onClick={activeTab === "dictionary" ? handleAddBook : activeTab === "placeholders" ? handleAddPlaceholder : addItem} size="icon">
          <Plus className="h-4 w-4" />
        </Button>
      )}
      <Input
        placeholder={activeTab === "dictionary" ? "Name a new dictionary" : `Search or add new ${activeTab}`}
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />
      {/* key: remount per topic so each tab's nudge reads its own seen-state (HelpButton reads it on mount). */}
      {helpTopicId && <HelpButton key={helpTopicId} topicId={helpTopicId} />}
    </div>
  );
  const footerBar = (
    <div className="p-4 border-t flex flex-wrap gap-2 justify-between">
      {downscaleDialog}
      <div className="flex gap-2">
        {exportContext && (
          <Button variant="outline" size="sm" onClick={exportContext.onClick} disabled={exportContext.disabled}>
            <Download className="h-4 w-4 mr-2 shrink-0" />
            <span className="truncate max-w-[14rem]">{exportContext.label}</span>
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
        <Button variant="outline" size="sm" onClick={optimizeImages} disabled={optimizeProgress !== null} title="Downscale oversized images to conserve file size">
          {optimizeProgress !== null ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              {optimizeProgress === 'scanning' ? 'Scanning…' : `Optimizing ${optimizeProgress.done}/${optimizeProgress.total}…`}
            </>
          ) : (
            <>
              <ImageDown className="h-4 w-4 mr-2" />
              Optimize Images
            </>
          )}
        </Button>
        <Button size="sm" onClick={saveWorld} disabled={!isWorldDirty}>
          <Save className="h-4 w-4 mr-2" />
          Save
        </Button>
      </div>
      <Input type="file" accept=".json" onChange={loadWorld} className="hidden" id="load-world" />
    </div>
  );

  return (
    <div className={`${embedded ? "h-full" : "h-[100dvh]"} flex flex-col overflow-hidden`}>
      {!embedded && (
        <ThemedToastContainer
          position="top-right"
          autoClose={3000}
          hideProgressBar={false}
          newestOnTop
          closeOnClick
          rtl={false}
          pauseOnFocusLoss
          draggable
          pauseOnHover
        />
      )}
      <div className="flex-grow flex overflow-hidden">
        {isMobile ? (
          <div className="h-full w-full">
            <Card className="h-full flex flex-col rounded-none border-x-0">
              <CardHeader className="space-y-0 pb-2 px-2">{headerBar}</CardHeader>
              <CardContent className="flex-grow flex flex-col overflow-hidden px-2 pt-2">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-grow flex flex-col min-h-0">
                  {/* The tab strip doesn't fit a phone, so it scrolls horizontally. */}
                  <div className="overflow-x-auto flex-shrink-0">{tabsList}</div>
                  {addSearchBar}
                  {tabPanels(activeTab === "overview" ? (
                    // Overview isn't master-detail — stack its two forms.
                    <ScrollArea className="flex-grow min-h-0 mt-4">
                      {listContent}
                      {detailContent}
                    </ScrollArea>
                  ) : (
                    <ListDetail
                      className="mt-4"
                      showDetail={!!selectedItemId}
                      onBack={() => setSelectedItemId(null)}
                      backLabel="Back"
                      list={<div className="h-full" onClick={() => setSelectedItemId(null)}>{listContent}</div>}
                      detail={detailContent}
                    />
                  ))}
                </Tabs>
              </CardContent>
              {footerBar}
            </Card>
          </div>
        ) : (
          <PanelGroup direction="horizontal">
            <Panel defaultSize={50} minSize={30}>
              <div className="h-full p-4">
                <Card className="h-full flex flex-col">
                  <CardHeader className="space-y-0 pb-2">{headerBar}</CardHeader>
                  <CardContent className="flex-grow flex flex-col overflow-hidden pt-6">
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-grow flex flex-col min-h-0">
                      {tabsList}
                      {addSearchBar}
                      {/* The detail pane is the other half of a master-detail split, in its own resizable
                          panel outside the tab root — the tab's own content is this list. */}
                      {tabPanels(
                        <div className="flex-grow min-h-0 mt-4" onClick={() => setSelectedItemId(null)}>
                          <ScrollArea className="h-full">{listContent}</ScrollArea>
                        </div>
                      )}
                    </Tabs>
                  </CardContent>
                  {footerBar}
                </Card>
              </div>
            </Panel>
            <PanelResizeHandle className="w-1 bg-secondary cursor-col-resize" />
            <Panel minSize={30}>
              <div className="h-full p-4">
                <Card className="h-full">
                  <CardContent className="h-full p-0">
                    <ScrollArea className="h-full">{detailContent}</ScrollArea>
                  </CardContent>
                </Card>
              </div>
            </Panel>
          </PanelGroup>
        )}
      </div>
      <UnsavedChangesDialog
        open={showExitPrompt}
        onOpenChange={setShowExitPrompt}
        onSave={async () => { if (await saveWorld()) onClose(); }}
        // The managers write edits straight into the store as you type, so leaving has to actively roll them
        // back — closing alone would keep them live for the next time this world is opened.
        onExit={() => { discardChanges(); onClose(); }}
      />
      {worldExportDialog}
      <AddDictionaryModal
        open={showAddDictionary}
        onOpenChange={setShowAddDictionary}
        onAdd={(book) => { const b = absorbDictionaryPlaceholders(book); addDictionary(b); setSelectedItemId(b.id); }}
      />
      <AddEntityModal
        open={showAddEntity}
        onOpenChange={setShowAddEntity}
        // Imported/card entities land ungrouped at the root (a card carries no group; a stale groupId would
        // otherwise hide the entity under a folder that doesn't exist here).
        onAdd={(entity) => {
          const placed = { ...absorbEntityPlaceholders(entity), groupId: null, order: entityRootSiblingCount() };
          addEntity(placed);
          setSelectedItemId(placed.id);
        }}
      />
    </div>
  );
};

export default WorldEditor;
