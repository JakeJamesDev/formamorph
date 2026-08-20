import { randomUUID } from "@/lib/uuid";
import { useState, useEffect, useMemo, useCallback, useRef, type ChangeEvent, type ReactNode } from 'react';
import { useGameData } from '@/contexts/GameDataContext';
import { useDevRoute } from '@/lib/devRouter';
import { editorTabsFor } from './worldEditorTabs';
import { useEditorMode, type EditorMode } from '@/lib/editorMode';
import { EditorModeProvider } from '@/components/EditorModeProvider';
import { TutorialPopover } from '@/components/TutorialPopover';
import { useTutorial } from '@/lib/tutorials';
import { worldUsesAdvancedFeatures } from '@/lib/editorAdvancedData';
import { withEntityLocations } from '@/lib/entityPresence';
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { EmptyListHint } from '@/components/EmptyListHint';
import { HelpButton } from '@/components/HelpButton';
import { worldEditorTopicId } from '@/lib/helpTopics';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Plus, ArrowLeft, Save, FolderPlus, FilePlus, ImageDown, BookPlus, UserPlus, Loader2, Search, List, Map } from "lucide-react";
import { ActionIcon } from '@/lib/actionIcons';
import { cn } from "@/lib/utils";
import EditorFindBar from '@/components/editor/EditorFindBar';
import { TestBench, TestBenchButton } from '@/components/editor/TestBench';
import { BenchPopover } from '@/components/editor/BenchPopover';
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer';
import type { FindingSection } from '@/lib/testBench/rules';
import { useTestBench } from '@/lib/testBench/useTestBench';
import { collectSearchTargets, type SearchMatch } from '@/lib/worldSearch';
import { revealEditorMatch, clearEditorMatch, revealSelectedRow } from '@/lib/editorFieldFocus';
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
import LocationCanvas from '../managers/LocationCanvas';
import { LOCATION_VIEWS, type LocationView } from './locationViews';
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
import { absorbPlaceholders, remapPlaceholderIds, describePlaceholders } from '@/lib/placeholders';
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
import { EditorRowList } from '@/components/EditorRow';
import PlaceholderText from '@/components/prompt/PlaceholderText';

/** The fields a reorderable list row needs (every editor item has these). */
type ListItem = SortableListItem;

const WorldEditorInner = ({ onClose, embedded = false, backButton }: {
  onClose: () => void;
  embedded?: boolean;
  /** Force the header back arrow on/off independent of `embedded`. Defaults to `!embedded`: a full-screen
   *  host (MainMenu modal) wants the back arrow without the toast/chrome; GameViewer's popup uses the X. */
  backButton?: boolean;
}) => {
  const showBackButton = backButton ?? !embedded;
  const {
    updateWorldOverview, worldId, worldOverview,
    loadWorldData, getWorldData,
    stats, locations, entities, entityGroups, traits, traitGroups, statUpdates, dictionaries, placeholders,
    addStat, addLocation, addEntity, addTrait, addStatUpdate, addDictionary,
    addTraitGroup, addEntityGroup, addPlaceholder,
    updateStat, updateEntity, updateEntityGroup, updateLocation, updateTrait, updateTraitGroup,
    updateDictionary, updateDictionaryEntry, updatePlaceholder,
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

  const { mode, advanced, setMode } = useEditorMode();
  const { active: tutorial, nav: tutorialNav, dismiss } = useTutorial('worldEditor');
  const dismissTutorial = useCallback(() => { if (tutorial) dismiss(tutorial.id); }, [tutorial, dismiss]);
  const visibleTabs = useMemo(() => editorTabsFor(advanced), [advanced]);
  const [activeTab, setActiveTab] = useState("overview");
  // Switching to Simple while standing on a hidden tab would blank the panel with no way back to it.
  useEffect(() => {
    if (!visibleTabs.some((t) => t.value === activeTab)) setActiveTab('overview');
  }, [visibleTabs, activeTab]);
  // Which of the Locations tab's two views is showing — the tree, or the canvas of the same locations.
  const [locationView, setLocationView] = useState<LocationView>('list');
  // DEV dev-router: jump to a specific editor tab via `#dev?modal=worldEditor&tab=…`. Tree-shaken in prod.
  const devRoute = useDevRoute();
  useEffect(() => {
    if (import.meta.env.DEV && devRoute?.tab) setActiveTab(devRoute.tab);
  }, [devRoute?.tab]);
  const devSubtab = devRoute?.subtab;
  useEffect(() => {
    if (import.meta.env.DEV && LOCATION_VIEWS.some((v) => v.value === devSubtab)) {
      setLocationView(devSubtab as LocationView);
    }
  }, [devSubtab]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  // ── Find & replace ────────────────────────────────────────────────────────
  const [findOpen, setFindOpen] = useState(false);
  const [findWithReplace, setFindWithReplace] = useState(false);
  // Overview's fields sit in the list pane and every other tab's in the detail pane, so the hit lookup
  // spans the whole editor and skips the two boxes that aren't world text (the find bar, the list filter).
  const editorRootRef = useRef<HTMLDivElement>(null);
  const openFind = useCallback((withReplace: boolean) => {
    setFindWithReplace(withReplace);
    setFindOpen(true);
  }, []);
  const closeFind = useCallback(() => {
    setFindOpen(false);
    clearEditorMatch();
  }, []);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      const key = event.key.toLowerCase();
      if (key !== 'f' && key !== 'h') return;
      event.preventDefault();
      openFind(key === 'h');
    };
    // Capture: a Lexical field stops keydown from bubbling, so a listener waiting on the way up never runs
    // and the browser's own find opens alongside this one.
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [openFind]);
  // A hit on a tab this mode hides has nowhere to navigate to, so it isn't a hit.
  const searchTargets = useMemo(() => {
    if (!findOpen) return [];
    const reachable = new Set<string>(visibleTabs.map((t) => t.value));
    return collectSearchTargets({
      worldOverview, stats, entities, entityGroups, locations, traits, traitGroups, dictionaries, placeholders,
      updateWorldOverview, updateStat, updateEntity, updateEntityGroup, updateLocation, updateTrait,
      updateTraitGroup, updateDictionary, updateDictionaryEntry, updatePlaceholder,
    }).filter((t) => reachable.has(t.tab));
  }, [findOpen, visibleTabs, worldOverview, stats, entities, entityGroups, locations, traits, traitGroups,
      dictionaries, placeholders, updateWorldOverview, updateStat, updateEntity, updateEntityGroup,
      updateLocation, updateTrait, updateTraitGroup, updateDictionary, updateDictionaryEntry, updatePlaceholder]);
  // A fresh object per navigation, not the bare key: a panel with its own tabs has to re-open the right one
  // even when two consecutive hits sit in the same field and the author flipped tabs between them.
  const [findField, setFindField] = useState<{ fieldKey: string } | null>(null);
  const navigateToMatch = useCallback((match: SearchMatch | null) => {
    if (!match) { setFindField(null); clearEditorMatch(); return; }
    setActiveTab(match.target.tab);
    // Same reason as a Bench finding's Open: the list filter would hide the row the hit lives on.
    setSearchTerm('');
    setSelectedItemId(match.target.itemId);
    // A panel that hides some of its fields behind its own tabs (the Readme pair) needs telling which one
    // was asked for; text alone can't reach a field that isn't rendered.
    setFindField({ fieldKey: match.target.fieldKey });
    const hit = {
      value: match.target.value,
      matchText: match.target.value.slice(match.start, match.end),
      start: match.start,
      fieldLabel: match.target.fieldLabel,
      inChipList: match.target.inChipList,
    };
    setTimeout(() => {
      revealEditorMatch(editorRootRef.current, hit);
      // The list is the other half of "go to this hit": without it the detail pane jumps and the tree
      // stays wherever it was, with the selected row off screen.
      revealSelectedRow(editorRootRef.current);
    }, 0);
  }, []);
  useEffect(() => clearEditorMatch, []);
  const isMobile = useIsMobile();
  const [showExitPrompt, setShowExitPrompt] = useState(false);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [showAddDictionary, setShowAddDictionary] = useState(false);
  const [showAddEntity, setShowAddEntity] = useState(false);

  // ── Test Bench ────────────────────────────────────────────────────────────
  // A finding's item is a place in the editor: land on its tab with it selected, and scroll the list to it
  // the same way a search hit does. A filter left in the list box would hide the very row being navigated to.
  const navigateToBenchItem = useCallback((section: FindingSection, itemId: string) => {
    setActiveTab(section);
    setSearchTerm('');
    setSelectedItemId(itemId);
    setTimeout(() => revealSelectedRow(editorRootRef.current), 0);
  }, []);
  const bench = useTestBench({
    // Read at the moment of opening for the lens seed; other tabs' selections are not locations.
    selectedLocationId: activeTab === 'locations' ? selectedItemId : null,
    isMobile,
    advanced,
    routedTab: devRoute?.bench,
    navigateToItem: navigateToBenchItem,
  });
  const benchPanel = <TestBench {...bench.panelProps} />;

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
      describePlaceholders(item.name, placeholders).toLowerCase().includes(searchTerm.toLowerCase())
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

  // Contextual footer actions. Simple authoring is bringing a character or lorebook in from your library;
  // handing one out is an Advanced move, so Entities/Dictionary offer Add in both modes, Export in Advanced.
  const exportContext =
    activeTab === 'overview' ? { label: 'Export World', disabled: false, onClick: () => { exportCurrentWorld(); } }
    : activeTab === 'entities' && advanced ? { label: `Export ${selectedItem ? describePlaceholders(selectedItem.name, placeholders) : 'Entity'}`, disabled: !selectedItem, onClick: () => { if (selectedItem) exportEntity(selectedItem as Entity); } }
    : activeTab === 'dictionary' && advanced
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
        ? <p className="text-helper text-muted-foreground p-2">No {activeTab} match &ldquo;{q}&rdquo;.</p>
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
        <EditorRowList>
          {items.map((item) => (
            <SortableRow
              key={item.id}
              item={item}
              label={<PlaceholderText text={item.name} placeholders={placeholders} />}
              selected={selectedItemId === item.id}
              onSelect={setSelectedItemId}
              onRemove={removeItem}
              onDuplicate={duplicateItem}
            />
          ))}
        </EditorRowList>
      </SortableContext>
    </DndContext>
    );
  };

  // The canvas fills its pane and owns its own clicks, so it opts out of the list pane's scroller and of
  // the click-to-deselect that empties the detail panel.
  const canvasView = activeTab === "locations" && locationView === "canvas";
  const deselectOnListClick = canvasView ? undefined : () => setSelectedItemId(null);

  // The per-tab list (master) and detail, extracted so both the desktop resizable split and the mobile
  // single-panel push render from one source. `overview` isn't master-detail — it shows a form in each slot.
  const listContent = (
    <>
      {activeTab === "overview" && <WorldOverviewManager />}
      {activeTab === "stats" && renderItemList(filteredItems)}
      {activeTab === "entities" && (searchTerm.trim() ? renderItemList(filteredItems) : <EntityTree selectedId={selectedItemId} onSelect={setSelectedItemId} />)}
      {activeTab === "locations" && (canvasView
        ? <LocationCanvas selectedId={selectedItemId} onSelect={setSelectedItemId} />
        : searchTerm.trim() ? renderItemList(filteredItems) : <LocationTree selectedId={selectedItemId} onSelect={setSelectedItemId} />)}
      {activeTab === "traits" && (searchTerm.trim() ? renderItemList(filteredItems) : <TraitTree selectedId={selectedItemId} onSelect={setSelectedItemId} />)}
      {activeTab === "dictionary" && <DictionaryTree selectedId={selectedItemId} onSelect={setSelectedItemId} />}
      {activeTab === "statUpdates" && renderItemList(filteredItems)}
      {activeTab === "placeholders" && <PlaceholderList selectedId={selectedItemId} onSelect={setSelectedItemId} />}
    </>
  );
  const detailContent = (
    <ChipInsertTargetProvider>
    <div className="p-3">
      {/* One palette for the whole panel. Not on the Placeholders tab itself: a placeholder's own values
          are plain text, since a chip inside one would never be expanded (resolution is single-pass). */}
      {advanced && activeTab !== "placeholders" && (
        <PlaceholderPaletteBar placeholders={placeholders} className="-mx-3 -mt-3 mb-3 px-3" />
      )}
      {activeTab === "overview" && (
        <WorldDetailsManager focusField={findField} />
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
        <TraitManager
          key={selectedTrait.id}
          trait={selectedTrait}
          // A conflict note names a rival trait; clicking the name lands on it like a Bench finding does.
          onOpenTrait={(id) => navigateToBenchItem('traits', id)}
        />
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
  // Only meaningful in Simple mode, where something in this world is out of sight.
  const hasHiddenData = !advanced && worldUsesAdvancedFeatures({
    worldOverview: getWorldData().worldOverview, stats, entities, locations, traits, dictionaries, placeholders,
  });
  const headerBar = (
    <div className="flex items-center gap-4">
      {showBackButton && (
        <Button variant="ghost" size="icon" onClick={() => (isWorldDirty ? setShowExitPrompt(true) : onClose())}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
      )}
      {/* On mobile you have just come from tapping this world open, and the row needs every pixel for the controls
          that do something — so the heading is read out but not drawn there. */}
      <CardTitle className={isMobile ? 'sr-only' : undefined}>World Editor</CardTitle>
      <Button
        variant="ghost"
        size="icon"
        className="ml-auto"
        onClick={() => openFind(false)}
        aria-label="Find and replace"
        title="Find and replace (Ctrl+F)"
      >
        <Search className="h-4 w-4" />
      </Button>
      {/* The flask's first stop is quick triage; the full panel is one button inside it. */}
      <BenchPopover {...bench.popoverProps}>
        <TestBenchButton
          count={bench.count}
          newCount={bench.newCount}
          open={bench.active}
          onClick={bench.toggleFlask}
        />
      </BenchPopover>
      <TutorialPopover entry={tutorial} nav={tutorialNav}>
        <ToggleGroup
          type="single"
          value={mode}
          // Using the switch is itself the lesson, so it retires the tutorial as surely as the button does.
          onValueChange={(v) => { if (v) { dismissTutorial(); setMode(v as EditorMode); } }}
          aria-label="Editor mode"
          className={isMobile ? "h-8" : undefined}
        >
          <ToggleGroupItem value="simple" className={isMobile ? "px-2 py-1" : undefined}>Simple</ToggleGroupItem>
          <ToggleGroupItem
            value="advanced"
            className={cn('relative', isMobile && 'px-2 py-1')}
            // The marker rides the switch that acts on it rather than sitting beside it as its own icon:
            // it says "there is more through here", which is exactly what this control does, and a row on a
            // mobile has no room for a second thing saying so.
            title={hasHiddenData ? 'This world uses advanced features. Switch to Advanced to see them.' : undefined}
          >
            Advanced
            {hasHiddenData && (
              <span
                aria-label="This world uses advanced features"
                className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-primary"
              />
            )}
          </ToggleGroupItem>
        </ToggleGroup>
      </TutorialPopover>
    </div>
  );
  const tabsList = (
    <TabsList className="flex-shrink-0">
      {visibleTabs.map((t) => (
        <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>
      ))}
    </TabsList>
  );
  // One panel per tab so every trigger's `aria-controls` resolves. Only the active tab has a body, so the
  // rest render empty; `contents` keeps that body a direct flex child of the tab root, as it was unwrapped.
  const tabPanels = (body: ReactNode) => visibleTabs.map((t) => (
    <TabsContent key={t.value} value={t.value} className="contents">
      {t.value === activeTab ? body : null}
    </TabsContent>
  ));
  // The active tab's help topic, when it has copy yet — drives the `?` beside the search box.
  const helpTopicId = worldEditorTopicId(activeTab);
  const addSearchBar = activeTab !== "overview" && (
    <div className="flex items-center space-x-2 flex-shrink-0 mt-4">
      {advanced && (activeTab === "traits" || activeTab === "entities") ? (
        <Popover open={addMenuOpen} onOpenChange={setAddMenuOpen}>
          <PopoverTrigger asChild>
            <Button size="icon" className="h-9 w-9 shrink-0">
              <Plus className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent side="bottom" align="start" className="w-44 p-1">
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-label hover:bg-accent"
              onClick={() => { (activeTab === "entities" ? handleAddEntityGroup : handleAddGroup)(); setAddMenuOpen(false); }}
            >
              <FolderPlus className="h-4 w-4" /> Add Group
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-label hover:bg-accent"
              onClick={() => { (activeTab === "entities" ? addItem : handleAddTrait)(); setAddMenuOpen(false); }}
            >
              <FilePlus className="h-4 w-4" /> {activeTab === "entities" ? "Add Entity" : "Add Trait"}
            </button>
          </PopoverContent>
        </Popover>
      ) : (
        <Button onClick={activeTab === "dictionary" ? handleAddBook : activeTab === "placeholders" ? handleAddPlaceholder : activeTab === "traits" ? handleAddTrait : addItem} size="icon" className="h-9 w-9 shrink-0">
          <Plus className="h-4 w-4" />
        </Button>
      )}
      {activeTab === "locations" ? (
        <ToggleGroup
          type="single"
          value={locationView}
          onValueChange={(v) => { if (v) setLocationView(v as LocationView); }}
          aria-label="Locations view"
          className="flex-shrink-0"
        >
          {LOCATION_VIEWS.map((v) => (
            isMobile
              ? (
                <ToggleGroupItem key={v.value} value={v.value} aria-label={v.label} title={v.label} className="px-2">
                  {v.value === 'canvas' ? <Map className="h-4 w-4" /> : <List className="h-4 w-4" />}
                </ToggleGroupItem>
              )
              : <ToggleGroupItem key={v.value} value={v.value}>{v.label}</ToggleGroupItem>
          ))}
        </ToggleGroup>
      ) : null}
      <Input
        data-editor-find-skip
        placeholder={activeTab === "dictionary" ? "Name a new dictionary" : `Search or add new ${activeTab}`}
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />
      {/* key: remount per topic so each tab's nudge reads its own seen-state (HelpButton reads it on mount). */}
      {helpTopicId && <HelpButton key={helpTopicId} topicId={helpTopicId} />}
    </div>
  );
  const footerBar = (
    <div className="p-3 border-t flex flex-wrap gap-2 justify-between">
      {downscaleDialog}
      <div className="flex gap-2">
        {exportContext && (
          <Button variant="outline" size="sm" onClick={exportContext.onClick} disabled={exportContext.disabled}>
            <ActionIcon.export className="h-4 w-4 mr-2 shrink-0" />
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
        {/* Advanced-only: an oversized upload is already offered Optimize/Downscale as it lands, so what
            this adds is the bulk pass over a world that is already large. */}
        {advanced && (
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
        )}
        <Button size="sm" onClick={saveWorld} disabled={!isWorldDirty}>
          <Save className="h-4 w-4 mr-2" />
          Save
        </Button>
      </div>
      <Input type="file" accept=".json" onChange={loadWorld} className="hidden" id="load-world" />
    </div>
  );

  return (
    <div className={`${embedded ? "h-full" : "app-viewport"} flex flex-col overflow-hidden`}>
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
      <div className="relative flex-grow flex overflow-hidden" ref={editorRootRef}>
        {findOpen && (
          <EditorFindBar
            targets={searchTargets}
            placeholders={placeholders}
            // Follows the Placeholders tab, which Simple mode hides.
            allowPlaceholderReplace={advanced}
            startWithReplace={findWithReplace}
            onNavigate={navigateToMatch}
            onAddPlaceholder={addPlaceholder}
            onClose={closeFind}
          />
        )}
        {isMobile ? (
          <div className="h-full w-full">
            <Card className="h-full flex flex-col rounded-none border-x-0">
              <CardHeader className="space-y-0 p-2">{headerBar}</CardHeader>
              <CardContent className="flex-grow flex flex-col overflow-hidden p-2">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-grow flex flex-col min-h-0">
                  {/* The tab strip doesn't fit mobile, so it scrolls horizontally. */}
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
                      scrollList={!canvasView}
                      list={<div className="h-full" onClick={deselectOnListClick}>{listContent}</div>}
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
            {/* The Bench comes and goes, so every panel carries an id+order for the group to track it. */}
            <Panel id="editor-list" order={1} defaultSize={50} minSize={30}>
              <div className="h-full p-3">
                <Card className="h-full flex flex-col">
                  <CardHeader className="space-y-0 p-3 pb-2">{headerBar}</CardHeader>
                  <CardContent className="flex-grow flex flex-col overflow-hidden p-3">
                    {/* The embedded Bench takes the tab strip, the add/search bar and the list; the detail
                        panel beside it stays live, so a finding's item opens visibly next to the list being
                        triaged. The editor's own tab and selection state is untouched behind it. */}
                    {bench.embedded ? (
                      <div className="flex-grow min-h-0">{benchPanel}</div>
                    ) : (
                      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-grow flex flex-col min-h-0">
                        {tabsList}
                        {addSearchBar}
                        {/* The detail pane is the other half of a master-detail split, in its own resizable
                            panel outside the tab root — the tab's own content is this list. */}
                        {tabPanels(
                          <div className="flex-grow min-h-0 mt-4" onClick={deselectOnListClick}>
                            {canvasView ? listContent : <ScrollArea className="h-full">{listContent}</ScrollArea>}
                          </div>
                        )}
                      </Tabs>
                    )}
                  </CardContent>
                  {footerBar}
                </Card>
              </div>
            </Panel>
            <PanelResizeHandle className="w-1 bg-secondary cursor-col-resize" />
            <Panel id="editor-detail" order={2} minSize={30}>
              <div className="h-full p-3">
                <Card className="h-full">
                  <CardContent className="h-full p-0">
                    <ScrollArea className="h-full">{detailContent}</ScrollArea>
                  </CardContent>
                </Card>
              </div>
            </Panel>
            {bench.docked && (
              <>
                <PanelResizeHandle className="w-1 bg-secondary cursor-col-resize" />
                <Panel id="editor-bench" order={3} defaultSize={28} minSize={20}>
                  <div className="h-full p-3">
                    <Card className="h-full overflow-hidden">{benchPanel}</Card>
                  </div>
                </Panel>
              </>
            )}
          </PanelGroup>
        )}
      </div>
      {/* Mobile has no room for a third pane, so the Bench arrives as a full-height sheet over the editor. */}
      {isMobile && (
        <Drawer open={bench.open} onOpenChange={(open) => { if (!open) bench.closeBench(); }}>
          <DrawerContent className="h-[92dvh]">
            <DrawerTitle className="sr-only">Test Bench</DrawerTitle>
            <div className="min-h-0 flex-grow">{benchPanel}</div>
          </DrawerContent>
        </Drawer>
      )}
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
        // Imported/card entities land ungrouped at the root and in no location — ids carried over from the
        // world they were exported from name a folder and places that don't exist here.
        onAdd={(entity) => {
          const placed = {
            ...withEntityLocations(absorbEntityPlaceholders(entity), []),
            groupId: null,
            order: entityRootSiblingCount(),
          };
          addEntity(placed);
          setSelectedItemId(placed.id);
        }}
      />
    </div>
  );
};

/** Wraps the editor in its Simple/Advanced mode preference. The DEV dev-router's `mode` param seeds it,
 *  so verification can land in either mode without touching localStorage first. */
const WorldEditor = (props: Parameters<typeof WorldEditorInner>[0]) => {
  const devRoute = useDevRoute();
  const forcedMode = import.meta.env.DEV && (devRoute?.mode === 'simple' || devRoute?.mode === 'advanced')
    ? devRoute.mode
    : undefined;
  // Each parsed route is a fresh object, so this counts navigations — a `goto` with the same mode still
  // re-applies it, which a mount-time seed alone would miss once the switch had been clicked.
  const nonce = useRef(0);
  const lastRoute = useRef(devRoute);
  if (lastRoute.current !== devRoute) {
    lastRoute.current = devRoute;
    nonce.current += 1;
  }
  return (
    <EditorModeProvider forcedMode={forcedMode} forcedNonce={nonce.current}>
      <WorldEditorInner {...props} />
    </EditorModeProvider>
  );
};

export default WorldEditor;
