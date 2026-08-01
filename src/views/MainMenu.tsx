import { randomUUID } from "@/lib/uuid";
import { DEFAULT_WORLDS, isDefaultWorldId } from "@/lib/defaultWorlds";
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useGameData } from '../contexts/GameDataContext';
import { useDevRoute } from '../lib/devRouter';
import { MAIN_MENU_CARD_TABS, type MainMenuCardTab } from './mainMenuTabs';
import { findSavesUsingModel } from '@/lib/modelUsage';
import { DEFAULT_MODEL_URL } from '@/lib/defaultModel';
import { toast } from 'react-toastify';
import { ThemedToastContainer } from '@/components/ThemedToastContainer';
import 'react-toastify/dist/ReactToastify.css';
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {ConfirmDialog} from "@/components/ConfirmDialog";
import {FilePlus2, DoorOpen, Pencil, Github, AlertTriangle, Code, User, Shield, Import, Globe, LayoutGrid, GalleryThumbnails, Columns2, RectangleVertical, Menu, Earth, BookOpen, Upload, ChevronLast, MoreHorizontal, PersonStanding, MessageSquarePlus, FolderOpen, Archive, Settings, type LucideIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ImageZoomViewer } from "@/components/ImageZoomViewer";
import { cn } from "@/lib/utils";
import { usePersistentState, boolCodec } from "@/lib/usePersistentState";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import CharacterCustomization, { defaultCharacterData } from './CharacterCustomization';
import { SettingsModal } from '../components/modals/SettingsModal';
import { useSettingsOpenRequest } from '@/lib/useSettingsOpenRequest';
import { AiSetupGate, type GateReason } from '../components/AiSetupGate';
import { useAiReachable } from '@/lib/useAiReachable';
import { LoadGameDialog } from '../components/modals/LoadGameDialog';
import WorldEditor from './WorldEditor';
import {
  DndContext,
  closestCenter,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { restrictToFirstScrollableAncestor } from '@dnd-kit/modifiers';
import { CONTAINED_AUTO_SCROLL } from '@/lib/dndAutoScroll';
import TraitSelectionModal from './TraitSelectionModal';
import StartingLocationModal from './StartingLocationModal';
import DictionarySelectionModal from './DictionarySelectionModal';
import CharacterSelectionModal from './CharacterSelectionModal';
import { startingLocations } from '@/lib/startingLocation';
import { shouldShowDictionaryStep } from '@/lib/dictionarySelection';
import { shouldShowCharacterStep } from '@/lib/characterSelection';
import WorldStorageService from '../services/WorldStorageService';
import DictionaryStorageService from '../services/DictionaryStorageService';
import EntityStorageService from '../services/EntityStorageService';
import ModelStorageService from '../services/ModelStorageService';
import AuthService from '../services/AuthService';
import type { World, Stat, CharacterData, Dictionary, DictionaryMetadata, Entity, EntityMetadata, ModelMetadata } from '@/types';
import { migrateWorld } from '@/lib/version';
import { isDesktop } from '@/lib/imageGen/desktop';
import { useIsMobile } from '@/lib/useIsMobile';
import { UpdateVersionControl } from '@/components/menu/UpdateVersionControl';
import { WebVersionChangelog } from '@/components/menu/WebVersionChangelog';
import { parseDictionaryImport } from '@/lib/dictionaryFile';
import { importCharacterFile } from '@/lib/entityFile';
import { useDownscalePrompt } from '@/lib/useDownscalePrompt';
import { IMAGE_CAPS, applyWorldOptimize, applyImageOptimize } from '@/lib/imageOptim';
import { filesFrom, importSummaryToast } from '@/lib/importFiles';
import CommunityCreationsBrowser from './CommunityCreationsBrowser';
import { WorldDetailsColumn, DateTimeText, type WorldRecord } from "@/components/WorldDetails";
import SortableWorldCard from "@/components/SortableWorldCard";
import DictionaryEditorModal from "@/components/modals/DictionaryEditorModal";
import EntityEditorModal from "@/components/modals/EntityEditorModal";
import { ModelDetailsModal } from "@/components/modals/ModelDetailsModal";
import { AdminPanelDialog } from "@/components/menu/AdminPanelDialog";
import { type ProfileTab } from "@/components/menu/profileTabs";
import { UserAvatar } from "@/components/UserAvatar";
import { UserName } from "@/components/UserName";
import { badgeKind, UNREAD_MARK_STYLES } from "@/lib/unreadSeverity";
import UserService from "@/services/UserService";
import { type MyFeedbackTabKey } from "@/components/menu/myFeedbackTabs";
import { type AdminPanelTab } from "@/components/menu/adminPanelTabs";
import { type PoliciesTab as PoliciesSubTab } from "@/components/menu/policiesTabs";
import { type FeedbackTab as FeedbackSubTab } from "@/components/menu/feedbackTabs";
import MessageService from "@/services/MessageService";
import FeedbackService from "@/services/FeedbackService";
import { FeedbackHubDialog } from "@/components/menu/FeedbackHubDialog";
import { AuthModals } from "@/components/menu/AuthModals";
import { PublishModal } from "@/components/menu/PublishModal";
import { worldPublishPayload, entityPublishPayload, dictionaryPublishPayload, type PublishPayload } from "@/lib/publishPayload";
import { type CatalogKind } from "@/lib/catalogKinds";
import { BackupRestoreDialog } from "@/components/menu/BackupRestoreDialog";
import { COMMUNITY_ENABLED } from "@/lib/featureFlags";
import { Checkbox } from "@/components/ui/checkbox";
import { useReadmeVisibility } from "@/lib/useReadmeVisibility";
import PatreonIcon from "@/components/PatreonIcon";

interface MainMenuProps {
  onStartGame: (traits: string[], characterData: CharacterData | null, isNewGame?: boolean, startingLocationId?: string | null, dictionaries?: Dictionary[] | null, characters?: Entity[] | null) => void;
  /** Cold-load a save from the menu: its world is loaded into GameData here, then App enters the game. */
  onLoadSaveGame: (saveId: string) => void;
  /** Easter-egg: replay the first-run welcome intro (snappy). Wired to the footer version click. */
  onReplayIntro?: () => void;
  /** True while the welcome intro is playing, so the AI setup gate waits its turn instead of racing it. */
  introActive?: boolean;
}

/** Set once the first-run AI setup prompt has been offered, so it never nags again. The play gate still fires. */
const AI_SETUP_SEEN_KEY = 'FORMAMORPH_aiSetupSeen';


// User-defined world/dictionary ordering is a UI preference, persisted as an ordered list of ids.
const WORLD_ORDER_KEY = 'FORMAMORPH_worldOrder';
const DICTIONARY_ORDER_KEY = 'FORMAMORPH_dictionaryOrder';
const ENTITY_ORDER_KEY = 'FORMAMORPH_entityOrder';
const MODEL_ORDER_KEY = 'FORMAMORPH_modelOrder';

/** The library's card-type tabs, with their icon + label, so the top switcher and the mobile bottom bar
 *  render from one source and can't drift. */
const CARD_TABS: { value: MainMenuCardTab; label: string; Icon: LucideIcon }[] = [
  { value: 'worlds', label: 'Worlds', Icon: Earth },
  { value: 'entities', label: 'Entities', Icon: User },
  { value: 'dictionaries', label: 'Dictionaries', Icon: BookOpen },
  { value: 'models', label: 'Models', Icon: PersonStanding },
];

/** Name the affected saves in a prompt, capping the list so a big library doesn't produce a wall of text. */
const listSaves = (names: string[]): string => {
  const shown = names.slice(0, 3).map((name) => `"${name}"`);
  const rest = names.length - shown.length;
  if (rest > 0) return `${shown.join(', ')} and ${rest} more`;
  if (shown.length === 1) return shown[0];
  return `${shown.slice(0, -1).join(', ')} and ${shown[shown.length - 1]}`;
};


// Responsive column counts for the card grids. Tailwind only emits classes it sees literally, so map each
// count to its class string; the counts themselves are the single source of truth (the entity grid derives
// from the world grid by math, not a hard-coded number).
const GRID_COL_CLASS: Record<'base' | 'sm' | 'lg', Record<number, string>> = {
  base: { 1: 'grid-cols-1', 2: 'grid-cols-2' },
  sm: { 2: 'sm:grid-cols-2', 4: 'sm:grid-cols-4' },
  lg: { 3: 'lg:grid-cols-3', 4: 'lg:grid-cols-4', 6: 'lg:grid-cols-6' },
};
const gridColsClass = (base: number, sm: number, lg: number) =>
  `${GRID_COL_CLASS.base[base]} ${GRID_COL_CLASS.sm[sm]} ${GRID_COL_CLASS.lg[lg]}`;
// The landscape world grid's columns per breakpoint. Portrait character cards are ~half the width, so the
// Entities grid fits twice as many (`× 2`).
const WORLD_GRID_COLS = { base: 1, sm: 2, lg: 3 };
const ENTITY_GRID_CLASS = gridColsClass(WORLD_GRID_COLS.base * 2, WORLD_GRID_COLS.sm * 2, WORLD_GRID_COLS.lg * 2);
const LAYOUT_MODE_KEY = 'FORMAMORPH_layoutMode';
// Persisted preference to force the local world modal's single-column (portrait) layout at any width.
const WORLD_MODAL_COLLAPSED_KEY = 'FORMAMORPH_worldModalCollapsed';

const loadOrder = (key: string): string[] => {
  try { return JSON.parse(localStorage.getItem(key) || '[]'); }
  catch { return []; }
};
const loadWorldOrder = (): string[] => loadOrder(WORLD_ORDER_KEY);
// Sort by saved order; ids not in the saved order keep their relative order at the end.
const applyWorldOrder = <T extends { id: string }>(list: T[], order: string[]): T[] => {
  const rank = (id: string) => { const i = order.indexOf(id); return i === -1 ? Infinity : i; };
  return [...list].sort((a, b) => rank(a.id) - rank(b.id));
};


const MainMenu = ({ onStartGame, onLoadSaveGame, onReplayIntro, introActive = false }: MainMenuProps) => {
  const {
    traits, traitGroups, stats, locations, loadWorldData,
    dictionaries: worldBooks,
  } = useGameData();
  const { showReadme, setShowReadme } = useReadmeVisibility();
  const { promptWorldsBatch, promptImagesBatch, promptImage, dialog: downscaleDialog } = useDownscalePrompt();
  const [selectedWorld, setSelectedWorld] = useState<WorldRecord | null>(null);
  // Local-world grid layout: "grid" (default compact cards) or "detailed" (community-browser-style card + info
  // beneath). Persisted across sessions in localStorage.
  const [layoutMode, setLayoutMode] = usePersistentState<'grid' | 'detailed'>(
    LAYOUT_MODE_KEY, 'grid',
    { parse: (r) => (r === 'detailed' ? 'detailed' : 'grid'), serialize: (v) => v },
  );
  // Per-modal "collapse to single column" preference, persisted across sessions.
  const [worldModalCollapsed, setWorldModalCollapsed] = usePersistentState(
    WORLD_MODAL_COLLAPSED_KEY, false, boolCodec,
  );
  // Which content library the menu shows. Only "worlds" is populated for now; the rest swap to an empty view.
  const [cardType, setCardType] = useState<MainMenuCardTab>('worlds');
  const toggleWorldModalCollapsed = () => setWorldModalCollapsed((prev) => !prev);
  const [showWorldModal, setShowWorldModal] = useState(false);
  // World Editor as an in-place modal (keeps MainMenu mounted so it animates and only the world grid
  // refreshes on close). The editor's own back arrow + unsaved-changes prompt handle the dirty guard.
  const [showWorldEditor, setShowWorldEditor] = useState(false);
  const [worldToDelete, setWorldToDelete] = useState<string | null>(null);
  const [showCharacterCustomization, setShowCharacterCustomization] = useState(false);
  const [showTraitSelection, setShowTraitSelection] = useState(false);
  const [showLocationSelection, setShowLocationSelection] = useState(false);
  const [showDictionarySelection, setShowDictionarySelection] = useState(false);
  const [showCharacterSelection, setShowCharacterSelection] = useState(false);
  const [selectedTraits, setSelectedTraits] = useState<string[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  // The dictionary set chosen at the entry step; null = step skipped (GameViewer falls back to authored books).
  const [selectedDictionaries, setSelectedDictionaries] = useState<Dictionary[] | null>(null);
  // The library characters chosen at the entry step to place in the starting location; null = none/skipped.
  const [selectedCharacters, setSelectedCharacters] = useState<Entity[] | null>(null);
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  // Forces Settings to a specific tab when something deep-links into it (the AI setup gate → Endpoint).
  // Cleared on close so the next deep-link re-triggers the modal's initialTab effect.
  const [settingsTab, setSettingsTab] = useState<string | undefined>(undefined);
  const [settingsEndpointTab, setSettingsEndpointTab] = useState<string | undefined>(undefined);
  const [showLoadDialog, setShowLoadDialog] = useState(false);
  useSettingsOpenRequest((tab, endpointTab) => {
    setSettingsTab(tab);
    setSettingsEndpointTab(endpointTab);
    setShowSettings(true);
  });
  // DEV dev-router: open Settings (or the Load menu) when the hash asks. Tree-shaken in prod.
  const devRoute = useDevRoute();
  const isMobile = useIsMobile();
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    if (devRoute?.modal === 'settings') setShowSettings(true);
    if (devRoute?.modal === 'menu') setShowLoadDialog(true);
    if (devRoute?.modal === 'backup') setShowBackup(true);
    if (devRoute?.modal === 'community') setShowCommunityBrowser(true);
    if (devRoute?.modal === 'profile') setShowProfileDialog(true);
    if (devRoute?.modal === 'feedbackHub') setShowFeedback(true);
    if (devRoute?.modal === 'adminPanel') setShowAdminPanel(true);
    if (devRoute?.modal === 'worldEditor') setShowWorldEditor(true);
    if (devRoute?.modal === 'avatar') setShowCharacterCustomization(true);
    if (devRoute?.modal === 'aiSetup') setGate({ reason: 'firstRun' });
    // Library editors open on a blank draft — nothing is stored, so these are reachable on a fresh profile.
    if (devRoute?.modal === 'entityEditor') setDraftEntity({ id: randomUUID(), name: 'New Character' });
    if (devRoute?.modal === 'dictionaryEditor') setDraftDictionary({ id: randomUUID(), name: 'New Dictionary', enabled: true, entries: [] });
    // Unlike the editors above, a model preview needs a real model — open the first one, if the library has any.
    if (devRoute?.modal === 'modelDetails') {
      setCardType('models');
      ModelStorageService.getModelMetadata().then(([first]) => first && setPreviewModelId(first.id));
    }
    // With no modal named, `tab` selects the library's card type — set here rather than by clicking the
    // switcher, so landing on a grid doesn't depend on that control's markup.
    if (!devRoute?.modal && devRoute?.tab && (MAIN_MENU_CARD_TABS as readonly string[]).includes(devRoute.tab)) {
      setCardType(devRoute.tab as typeof cardType);
    }
  }, [devRoute?.modal, devRoute?.tab]);

  // --- AI setup gate -------------------------------------------------------------------------------
  // Only the first-run nudge lives here. Launching is never blocked: the unreachable-AI warning is raised in
  // the game view instead, so a broken endpoint doesn't strand the player on the menu.
  const { reachable, mode, blocker, recheck } = useAiReachable();
  const [gate, setGate] = useState<{ reason: GateReason } | null>(null);

  // Close the first-run nudge the moment the engine comes up — nothing is queued behind it any more.
  const handleGateReady = useCallback(() => setGate(null), []);

  // First-run nudge: once the intro is done and we know the bundled engine has nothing to run, offer the
  // download up front rather than letting them discover it by hitting a dead turn. Skippable, and only
  // ever shown once — the in-game gate is what catches it later.
  useEffect(() => {
    if (introActive || gate || reachable !== false || mode !== 'local') return;
    if (localStorage.getItem(AI_SETUP_SEEN_KEY)) return;
    localStorage.setItem(AI_SETUP_SEEN_KEY, '1');
    setGate({ reason: 'firstRun' });
  }, [introActive, gate, reachable, mode]);

  // Cold-load: fetch the save's world into GameData, then hand the save id to App to enter the game.
  // Orphaned saves are blocked inside the dialog, so `worldId` is always an installed world here.
  const handleColdLoad = async (saveId: string, worldId?: string) => {
    if (!worldId) return;
    try {
      const world = await WorldStorageService.getWorldData(worldId) as World;
      loadWorldData(world);
      setShowLoadDialog(false);
      onLoadSaveGame(saveId);
    } catch (error) {
      console.error('Cold-load failed:', error);
      toast.error("Couldn't load that save's world.");
    }
  };
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const dictionaryImportRef = useRef<HTMLInputElement | null>(null);
  const entityImportRef = useRef<HTMLInputElement | null>(null);
  const modelImportRef = useRef<HTMLInputElement | null>(null);
  const [worlds, setWorlds] = useState<WorldRecord[]>([]);
  const [isLoadingWorlds, setIsLoadingWorlds] = useState(true);
  // Local dictionary library (metadata only) shown on the Dictionaries tab.
  const [dictionaries, setDictionaries] = useState<DictionaryMetadata[]>([]);
  const [isLoadingDictionaries, setIsLoadingDictionaries] = useState(true);
  const [dictionaryToDelete, setDictionaryToDelete] = useState<string | null>(null);
  const [editingDictionaryId, setEditingDictionaryId] = useState<string | null>(null);
  // A blank dictionary being authored but not yet saved (New Dictionary → editor, persisted only on Save).
  const [draftDictionary, setDraftDictionary] = useState<Dictionary | null>(null);
  // Local character library (metadata only) shown on the Entities tab.
  const [entities, setEntities] = useState<EntityMetadata[]>([]);
  const [isLoadingEntities, setIsLoadingEntities] = useState(true);
  const [entityToDelete, setEntityToDelete] = useState<string | null>(null);
  // Local VRM library (metadata only) shown on the Models tab.
  const [models, setModels] = useState<ModelMetadata[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(true);
  const [modelToDelete, setModelToDelete] = useState<string | null>(null);
  const [previewModelId, setPreviewModelId] = useState<string | null>(null);
  // Saves whose character wears the model queued for deletion; null while the scan is still running.
  const [modelUsage, setModelUsage] = useState<string[] | null>(null);
  const [editingEntityId, setEditingEntityId] = useState<string | null>(null);
  // A blank character being authored but not yet saved (New Entity → editor, persisted only on Save).
  const [draftEntity, setDraftEntity] = useState<Entity | null>(null);

  // Shared auth identity (header, publish gating, community browser). The login/profile forms live in AuthModals.
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<WorldRecord | null>(null);
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const [showProfileDialog, setShowProfileDialog] = useState(false);

  // Publish modal open state; the publish form/handlers live in the PublishModal component.
  const [showPublishModal, setShowPublishModal] = useState(false);
  // What the publish modal is publishing. Deliberately not cleared on close: the modal names itself from
  // the payload's kind, so dropping it would flash the title back to "World" during the fade-out.
  const [publishPayload, setPublishPayload] = useState<PublishPayload | null>(null);
  const openPublish = (payload: PublishPayload) => {
    setPublishPayload(payload);
    setShowPublishModal(true);
  };

  /**
   * Publish a character, offering to shrink an oversized portrait first.
   *
   * Without this the upload reaches the server and is rejected with "Thumbnail exceeds maximum size of
   * 5MB" — a dead end in a dialog that never mentions thumbnails, and no way to act on it. The download
   * side already offers this choice; the publish side is where the big image actually comes from.
   */
  const publishEntity = async (entity: Entity) => {
    const image = entity.image ? await promptImage(entity.image, IMAGE_CAPS.entity) : entity.image;
    openPublish(entityPublishPayload(image === entity.image ? entity : { ...entity, image }));
  };
  const [showBackup, setShowBackup] = useState(false);

  // A listing the reader asked for from somewhere else — a notification feed row. Held here because the
  // jump crosses two dialogs: the profile closes, the browser opens, and the browser opens the details.
  const [pendingListing, setPendingListing] = useState<{ id: string; kind: string } | null>(null);

  // Community Creations browser open state (the browser itself lives in <CommunityCreationsBrowser>).
  const [showCommunityBrowser, setShowCommunityBrowser] = useState(false);

  // Shared pan/zoom image viewer, opened by the local world modal and the community details modal.
  const [imageViewerOpen, setImageViewerOpen] = useState(false);
  // Source for the shared pan/zoom viewer, set by whichever modal's thumbnail was clicked.
  const [viewerImage, setViewerImage] = useState<{ src: string; alt: string }>({ src: '', alt: '' });
  const handleListingOpened = useCallback(() => setPendingListing(null), []);
  // Stable identities: each of these is handed to a tab that fetches, and an inline arrow would give a
  // new one on every render. The tabs guard themselves too, but a caller should not be the hazard.
  const handleNotificationsRead = useCallback(() => setFollowCountNonce((n) => n + 1), []);
  const handleBugsChange = useCallback(() => setBugCountNonce((n) => n + 1), []);
  const handleOpenListing = useCallback((listing: { id: string; kind: string }) => {
    setShowProfileDialog(false);
    setPendingListing(listing);
    setShowCommunityBrowser(true);
  }, []);

  const openImageViewer = (src: string | undefined, alt: string | undefined) => {
    if (!src) return;
    setViewerImage({ src, alt: alt || 'World image' });
    setImageViewerOpen(true);
  };

  // Admin "Manage Users" dialog: open state here; its list/paging/fetch live in the dialog component.
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);
  // The loudest unread message, which is what colors the badge. Null when the inbox holds nothing new.
  const [messageSeverity, setMessageSeverity] = useState<string | null>(null);
  // Feedback threads — bugs and suggestions both — with a reply the user hasn't seen. Badged on the
  // Feedback button rather than the profile circle: that is where the threads are now, and a count is
  // easiest to act on sitting on the thing it is about.
  const [unreadBugs, setUnreadBugs] = useState(0);
  // Bumped to re-read the bug count after a thread is opened or replied to.
  const [bugCountNonce, setBugCountNonce] = useState(0);
  const [showFeedback, setShowFeedback] = useState(false);
  // New work from the accounts this reader follows. Re-read on demand like the feedback half, since
  // opening the feed is what clears it.
  const [unreadFollows, setUnreadFollows] = useState(0);
  const [followCountNonce, setFollowCountNonce] = useState(0);
  // What the profile circle counts: the two channels that live behind it. Feedback replies are not in
  // it — they are behind their own button, wearing their own count.
  const unreadWaiting = unreadMessages + unreadFollows;
  // ...and it takes the color of the loudest thing in it, so a suspension notice does not arrive looking
  // like a bug reply. Only channels with something waiting are offered; the rest are simply absent.
  const unreadKind = badgeKind({
    messages: unreadMessages,
    messageSeverity,
    follows: unreadFollows,
  });
  // One announcement per session: the count is refetched whenever auth changes, and re-toasting the
  // same backlog on every refresh would be noise.
  const announcedUnreadRef = useRef(false);

  // Check authentication status on component mount (skipped when community features are disabled — the
  // hosted build never contacts the auth server).
  useEffect(() => {
    if (!COMMUNITY_ENABLED) return;
    const checkAuth = async () => {
      const isLoggedIn = AuthService.isAuthenticated();
      setIsAuthenticated(isLoggedIn);

      if (isLoggedIn) {
        const user = AuthService.getCurrentUser();
        setCurrentUser(user);

        // Refresh user profile
        try {
          const refreshedUser = await AuthService.fetchUserProfile();

          if (refreshedUser) {
            // Ensure we have a username
            if (!refreshedUser.username && user && user.username) {
              refreshedUser.username = user.username;
            }

            setCurrentUser(refreshedUser);
          } else {
            // Token expired or invalid
            setIsAuthenticated(false);
            setCurrentUser(null);
          }
        } catch (error) {
          console.error('Error refreshing user profile:', error);

          // If we failed to refresh but have a user with username, keep using it (no action needed).
        }
      }
    };

    checkAuth();
  }, []);

  // Reload the world grid from storage. Reused on mount and after the World Editor modal closes so the
  // grid reflects renames/edits/deletes without remounting MainMenu (mirrors refreshDictionaries/Entities).
  const refreshWorlds = useCallback(async () => {
    try {
      await WorldStorageService.initialize();
      const worldMetadata = await WorldStorageService.getWorldMetadata();
      const mapped = worldMetadata.map(world => ({
        ...world,
        isLoading: false,
        defaultName: DEFAULT_WORLDS.find(dw => dw.id === world.id)?.defaultName || world.name
      }));
      setWorlds(applyWorldOrder(mapped, loadWorldOrder()));
    } catch (error) {
      console.error('Error loading worlds:', error);
    } finally {
      setIsLoadingWorlds(false);
    }
  }, []);

  // Seed missing default worlds and auto-update unedited ones to the newest bundled version. Runs every
  // launch (cheap when nothing changed); only a first-run seed toasts success/failure, while an in-place
  // update of an unedited default is announced so a shifted in-progress save isn't a surprise.
  useEffect(() => {
    const initializeWorlds = async () => {
      try {
        await WorldStorageService.initialize();
        const existingWorlds = await WorldStorageService.getWorldMetadata();
        const firstRun = existingWorlds.length === 0;
        const { failed, updated } = await WorldStorageService.loadDefaultWorlds(DEFAULT_WORLDS);
        if (firstRun) {
          if (failed.length === 0) toast.success("Loaded default worlds");
          else if (failed.length < DEFAULT_WORLDS.length) toast.error(`Some default worlds failed to load: ${failed.join(", ")}`);
          else toast.error("Failed to load default worlds");
        }
        if (updated.length > 0) {
          toast.info(`Updated ${updated.length} default world${updated.length > 1 ? "s" : ""}: ${updated.join(", ")}`);
        }
      } catch (error) {
        console.error('Error seeding default worlds:', error);
      }
      await refreshWorlds();
    };

    initializeWorlds();
  }, [refreshWorlds]);

  // Load the local dictionary library metadata (no defaults to seed). Reused on mount and after the editor
  // modal closes so the grid reflects renames/edits.
  const refreshDictionaries = useCallback(async () => {
    try {
      await DictionaryStorageService.initialize();
      const metadata = await DictionaryStorageService.getDictionaryMetadata();
      setDictionaries(applyWorldOrder(metadata, loadOrder(DICTIONARY_ORDER_KEY)));
    } catch (error) {
      console.error('Error loading dictionaries:', error);
    } finally {
      setIsLoadingDictionaries(false);
    }
  }, []);

  useEffect(() => { refreshDictionaries(); }, [refreshDictionaries]);

  // Load the local model library metadata, seeding the bundled model on the very first run. Seeding is a
  // no-op after that (a localStorage flag short-circuits it before the model is fetched).
  const refreshModels = useCallback(async () => {
    try {
      await ModelStorageService.initialize();
      await ModelStorageService.seedDefaultModel(DEFAULT_MODEL_URL);
      const metadata = await ModelStorageService.getModelMetadata();
      setModels(applyWorldOrder(metadata, loadOrder(MODEL_ORDER_KEY)));
    } catch (error) {
      console.error('Error loading models:', error);
    } finally {
      setIsLoadingModels(false);
    }
  }, []);

  useEffect(() => { refreshModels(); }, [refreshModels]);

  // Work out what a pending model deletion would affect, so the prompt can name the saves rather than warn
  // in the abstract. Runs when the dialog opens; the scan reads every save, so it isn't done up front.
  useEffect(() => {
    if (!modelToDelete) { setModelUsage(null); return; }
    let cancelled = false;
    findSavesUsingModel(modelToDelete).then((names) => { if (!cancelled) setModelUsage(names); });
    return () => { cancelled = true; };
  }, [modelToDelete]);

  // Fill in thumbnails for models that don't have one yet, one at a time so a grid of un-thumbnailed models
  // doesn't try to hold several WebGL contexts at once. Each card updates in place as its picture arrives;
  // models whose render fails are marked in storage, so this settles rather than retrying every visit.
  useEffect(() => {
    if (cardType !== 'models') return;
    const pending = models.filter((model) => !model.thumbnail);
    if (!pending.length) return;
    let cancelled = false;
    (async () => {
      for (const model of pending) {
        if (cancelled) return;
        const thumbnail = await ModelStorageService.ensureThumbnail(model.id);
        if (cancelled || !thumbnail) continue;
        setModels((prev) => prev.map((m) => (m.id === model.id ? { ...m, thumbnail } : m)));
      }
    })();
    return () => { cancelled = true; };
    // Keyed on the id set, not on thumbnail state: one run processes every pending model in sequence, and
    // a landing thumbnail (which changes `models` but not the id list) doesn't tear the loop down and restart
    // it. It re-runs only when a model is added or removed.
  }, [cardType, models.map((m) => m.id).join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load the local character library metadata. Reused on mount and after the editor modal closes.
  const refreshEntities = useCallback(async () => {
    try {
      await EntityStorageService.initialize();
      const metadata = await EntityStorageService.getEntityMetadata();
      setEntities(applyWorldOrder(metadata, loadOrder(ENTITY_ORDER_KEY)));
    } catch (error) {
      console.error('Error loading characters:', error);
    } finally {
      setIsLoadingEntities(false);
    }
  }, []);

  useEffect(() => { refreshEntities(); }, [refreshEntities]);

  // Check if any stat has code
  const hasStatWithCode = (statsArray: Stat[]) => {
    return statsArray.some(stat => stat.code && stat.code.trim() !== '');
  };

  // Get all stats with code
  const getStatsWithCode = (statsArray: Stat[]) => {
    return statsArray.filter(stat => stat.code && stat.code.trim() !== '');
  };

  // Generate concatenated code from all stats with code
  const generateConcatenatedCode = (statsArray: Stat[]) => {
    const statsWithCode = getStatsWithCode(statsArray);

    return statsWithCode.map(stat => (
      `# ${stat.name || 'Unnamed Stat'}\n${stat.code}`
    )).join('\n\n----\n\n');
  };

  const handleWorldSelection = async (worldId: string) => {
    try {
      const worldData = await WorldStorageService.getWorldData(worldId);
      const selectedWorld = worlds.find(w => w.id === worldId);

      if (worldData && selectedWorld) {
        // Cache the migrated world (not the raw one) so downstream reuse — duplicate, use3DModel checks —
        // sees the current shape instead of the legacy input.
        const { world: migrated } = loadWorldData(worldData as World, true);
        setSelectedWorld({
          ...selectedWorld,
          data: migrated
        });
        setShowWorldModal(true);
      }
    } catch (error) {
      console.error('Error loading world data:', error);
    }
  };

  // Persist a dictionary and show its card — shared by the dictionary import and the lorebooks that ride
  // along inside imported character cards.
  const addDictionaryToLibrary = async (book: Dictionary) => {
    const now = new Date().toISOString();
    await DictionaryStorageService.storeDictionary({ id: book.id, name: book.name, createdAt: now, lastAccessed: now, data: book });
    setDictionaries(prev => [...prev, { id: book.id, name: book.name, entryCount: book.entries.length, createdAt: now, lastAccessed: now }]);
  };

  // Import one or more world `.json` files into the library. Bad files are skipped; a single combined
  // Optimize/Downscale prompt covers all of them. A single-file import still opens the world's details.
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = filesFrom(event);
    if (!files.length) return;

    const parsed: { world: World; id: string }[] = [];
    let skipped = 0;
    let stored = 0;
    for (const file of files) {
      try {
        // Sanitize at the import boundary: migrate any legacy/v1.2 shape to the current version.
        const world = migrateWorld(JSON.parse(await file.text())) as World;
        const id = `uploaded-${randomUUID()}`;
        world.id = id;
        parsed.push({ world, id });
      } catch (error) {
        console.error('Error parsing world file:', file.name, error);
        skipped++;
      }
    }

    if (parsed.length) {
      const mode = await promptWorldsBatch(parsed.map((p) => p.world));
      const now = new Date().toISOString();
      let last: { id: string; data: World } | null = null;
      for (const { world, id } of parsed) {
        // Storing is guarded per world: `storeWorld` rejects a shape `migrateWorld` can't complete (no
        // `statUpdates`, say), and one such file must not abort the rest of the batch.
        try {
          const data = mode === 'off' ? world : await applyWorldOptimize(world, mode);
          data.id = id;
          const name = data.worldOverview?.name || 'Uploaded World';
          const description = data.worldOverview?.description || 'Custom uploaded world';
          await WorldStorageService.storeWorld({ id, name, description, thumbnail: data.worldOverview?.thumbnail ?? undefined, data });
          setWorlds(prev => [...prev, { id, name, description, thumbnail: data.worldOverview?.thumbnail, tags: data.worldOverview?.tags || [], createdAt: now, lastAccessed: now, isLoading: false }]);
          stored++;
          last = { id, data };
        } catch (error) {
          console.error('Error storing world:', world.worldOverview?.name, error);
          skipped++;
        }
      }
      // A lone import opens the world's details; a batch just lands the cards.
      if (files.length === 1 && last) {
        const d = last.data;
        loadWorldData(d, true);
        setSelectedWorld({ id: last.id, name: d.worldOverview?.name || 'Uploaded World', description: d.worldOverview?.description || 'Custom uploaded world', thumbnail: d.worldOverview?.thumbnail, createdAt: now, lastAccessed: now, data: d });
        setShowWorldModal(true);
      }
    }
    // A lone success needs no toast — the details modal above already shows what landed.
    if (files.length > 1 || skipped) importSummaryToast(stored, skipped, { one: 'world', many: 'worlds' });
  };

  // Import one or more standalone dictionary `.json` files. Bad files are skipped. `parseDictionaryImport`
  // regenerates the book + entry ids, so re-imports never collide.
  const importDictionaryFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = filesFrom(event);
    if (!files.length) return;
    let ok = 0, skipped = 0;
    for (const file of files) {
      try {
        // Foreign lorebooks (ST / character cards) carry no internal name — fall back to the filename.
        const fallbackName = file.name.replace(/\.[^.]+$/, '');
        await addDictionaryToLibrary(parseDictionaryImport(JSON.parse(await file.text()), fallbackName));
        ok++;
      } catch (err) {
        console.error('Error importing dictionary:', file.name, err);
        skipped++;
      }
    }
    if (ok || skipped) importSummaryToast(ok, skipped, { one: 'dictionary', many: 'dictionaries' });
  };

  // Import one or more character images (our WebP cards or SillyTavern PNGs) into the library. One combined
  // Optimize/Downscale prompt covers every portrait; any lorebooks embedded in the cards are added too.
  const importEntityFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = filesFrom(event);
    if (!files.length) return;

    const parsed: { entity: Entity; book: Dictionary | null }[] = [];
    let skipped = 0;
    for (const file of files) {
      try { parsed.push(await importCharacterFile(file)); }
      catch (err) { console.error('Error importing character:', file.name, err); skipped++; }
    }

    if (parsed.length) {
      const mode = await promptImagesBatch(parsed.map((p) => p.entity.image).filter(Boolean) as string[], IMAGE_CAPS.entity);
      const now = new Date().toISOString();
      let lorebooks = 0;
      let stored = 0;
      for (const { entity, book } of parsed) {
        // Guarded per card: a portrait can blow the storage quota mid-batch, and that must not drop the rest.
        try {
          if (mode !== 'off' && entity.image) entity.image = (await applyImageOptimize(entity.image, mode, IMAGE_CAPS.entity)) ?? entity.image;
          await EntityStorageService.storeEntity({ id: entity.id, name: entity.name, createdAt: now, lastAccessed: now, data: entity });
          setEntities(prev => [...prev, { id: entity.id, name: entity.name, image: entity.image, createdAt: now, lastAccessed: now }]);
          stored++;
        } catch (err) {
          console.error('Error storing character:', entity.name, err);
          skipped++;
          continue; // the card never landed, so its lorebook has nothing to attach to
        }
        if (book) {
          try { await addDictionaryToLibrary(book); lorebooks++; }
          catch (err) { console.error('Error adding lorebook for:', entity.name, err); } // the card still landed
        }
      }
      importSummaryToast(stored, skipped, { one: 'character', many: 'characters' },
        lorebooks ? `, ${lorebooks} lorebook${lorebooks === 1 ? '' : 's'}` : '');
    } else if (skipped) {
      toast.error(`Couldn't import ${skipped} character${skipped === 1 ? '' : 's'}.`);
    }
  };

  // Import one or more .vrm/.glb files into the model library. A file whose bytes are already stored asks
  // before adding a second copy — these run to tens of megabytes, so a silent duplicate is expensive.
  const importModelFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = filesFrom(event);
    if (!files.length) return;

    let stored = 0;
    let skipped = 0;
    for (const file of files) {
      try {
        const duplicate = await ModelStorageService.findDuplicate(file);
        if (duplicate && !window.confirm(`"${duplicate.name}" is already in your library, and this file is identical.\n\nAdd it again anyway?`)) {
          skipped++;
          continue;
        }
        await ModelStorageService.addModel(file);
        stored++;
      } catch (error) {
        console.error('Error importing model:', file.name, error);
        skipped++;
      }
    }
    await refreshModels();
    importSummaryToast(stored, skipped, { one: 'model', many: 'models' });
  };

  // Open the editor on a blank character DRAFT — nothing is stored until the user hits Save in the editor.
  const handleCreateNewEntity = () => {
    setDraftEntity({ id: randomUUID(), name: 'New Character' });
  };

  // Open the editor on a blank dictionary DRAFT — nothing is stored until the user hits Save in the editor.
  const handleCreateNewDictionary = () => {
    setDraftDictionary({ id: randomUUID(), name: 'New Dictionary', enabled: true, entries: [] });
  };

  const handleTraitSelection = (traitId: string) => {
    setSelectedTraits(prev =>
      prev.includes(traitId)
        ? prev.filter(id => id !== traitId)
        : [...prev, traitId]
    );
  };

  // Start the world: the custom-character step first for 3D worlds, otherwise straight into the game. The
  // chosen characters + dictionary set are stashed for the 3D path and passed directly otherwise.
  const enterWorld = (traitIds: string[], locationId: string | null, chars: Entity[] | null, dicts: Dictionary[] | null) => {
    setSelectedCharacters(chars);
    setSelectedDictionaries(dicts);
    if (selectedWorld!.data.worldOverview?.use3DModel) {
      setShowCharacterCustomization(true);
    } else {
      onStartGame(traitIds, null, true, locationId, dicts, chars);
    }
  };

  // Whether each entry step is worth showing for the selected world + current library.
  const dictStepVisible = shouldShowDictionaryStep(worldBooks, dictionaries);
  const charStepVisible = shouldShowCharacterStep(entities);

  // After location + characters, offer the dictionary step when there's a real choice; otherwise enter.
  const proceedToDictOrEnter = (traitIds: string[], locationId: string | null, chars: Entity[] | null) => {
    setSelectedCharacters(chars); // committed for the 3D path + proceedFromDictionaries
    if (dictStepVisible) {
      setShowDictionarySelection(true);
    } else {
      enterWorld(traitIds, locationId, chars, null);
    }
  };

  // After location, offer the character step when the library has characters; otherwise go to dictionaries.
  const proceedToCharsOrDict = (traitIds: string[], locationId: string | null) => {
    if (charStepVisible) {
      setShowCharacterSelection(true);
    } else {
      proceedToDictOrEnter(traitIds, locationId, null);
    }
  };

  // Leave the trait step. Offer a location choice when the world has more than one starting location;
  // otherwise fall through to the character/dictionary steps (or straight into the world).
  const proceedFromTraits = (traitIds: string[]) => {
    setShowTraitSelection(false);
    setSelectedLocationId(null);
    setSelectedDictionaries(null);
    setSelectedCharacters(null);
    if (startingLocations(locations).length > 1) {
      setShowLocationSelection(true);
    } else {
      proceedToCharsOrDict(traitIds, null);
    }
  };

  // Leave the location step with the player's choice (null = Random) and continue the flow.
  const proceedFromLocation = (locationId: string | null) => {
    setShowLocationSelection(false);
    setSelectedLocationId(locationId);
    proceedToCharsOrDict(selectedTraits, locationId);
  };

  // Leave the character step: carry the chosen characters forward into the dictionary step (or the world).
  const proceedFromCharacters = (chars: Entity[]) => {
    setShowCharacterSelection(false);
    proceedToDictOrEnter(selectedTraits, selectedLocationId, chars);
  };

  // Leave the dictionary step: carry the chosen sets into the session (via enterWorld → onStartGame), then enter.
  const proceedFromDictionaries = (finalDicts: Dictionary[]) => {
    setShowDictionarySelection(false);
    enterWorld(selectedTraits, selectedLocationId, selectedCharacters, finalDicts);
  };

  // The enter-world steps actually shown for this world + library, in flow order — drives the Back button.
  type EnterStep = 'traits' | 'location' | 'characters' | 'dictionaries' | 'avatar';
  const enterFlowSteps = (): EnterStep[] => {
    const steps: EnterStep[] = [];
    if (traits.length > 0) steps.push('traits');
    if (startingLocations(locations).length > 1) steps.push('location');
    if (charStepVisible) steps.push('characters');
    if (dictStepVisible) steps.push('dictionaries');
    if (selectedWorld?.data.worldOverview?.use3DModel) steps.push('avatar');
    return steps;
  };
  const showEnterStep = (step: EnterStep) => {
    setShowTraitSelection(step === 'traits');
    setShowLocationSelection(step === 'location');
    setShowCharacterSelection(step === 'characters');
    setShowDictionarySelection(step === 'dictionaries');
    setShowCharacterCustomization(step === 'avatar');
  };
  // Back handler for a given step: goes to the previous shown step, or undefined on the first (button fades).
  const backFrom = (step: EnterStep): (() => void) | undefined => {
    const steps = enterFlowSteps();
    const idx = steps.indexOf(step);
    return idx > 0 ? () => showEnterStep(steps[idx - 1]) : undefined;
  };

  const handleDuplicateWorld = async () => {
    try {
      if (!selectedWorld) {
        toast.error('No world selected to duplicate');
        return;
      }

      // Get the current world data
      const worldToDuplicate = selectedWorld!.data;

      // Generate a unique ID for the duplicated world
      const worldId = `duplicate-${randomUUID()}`;

      // Create a copy of the world with a new ID and modified name
      const duplicatedWorld = {
        ...worldToDuplicate,
        id: worldId,
        worldOverview: {
          ...worldToDuplicate.worldOverview,
          name: `${worldToDuplicate.worldOverview.name || 'World'} (Copy)`,
        }
      };

      // Store the duplicated world
      await WorldStorageService.storeWorld({
        id: worldId,
        name: duplicatedWorld.worldOverview.name,
        description: duplicatedWorld.worldOverview.description || 'Duplicated world',
        thumbnail: duplicatedWorld.worldOverview.thumbnail,
        data: duplicatedWorld
      });

      // Add the duplicated world to the local list
      setWorlds(prev => [...prev, {
        id: worldId,
        name: duplicatedWorld.worldOverview.name,
        description: duplicatedWorld.worldOverview.description || 'Duplicated world',
        thumbnail: duplicatedWorld.worldOverview.thumbnail,
        tags: duplicatedWorld.worldOverview.tags || [],
        isLoading: false
      }]);

      // Close the world modal
      setShowWorldModal(false);

      toast.success('World duplicated successfully!');
    } catch (error) {
      console.error('Error duplicating world:', error);
      toast.error('Failed to duplicate world');
    }
  };

  const handleCreateNewWorld = async () => {
    try {
      // Generate a unique ID for the new world
      const worldId = `new-${randomUUID()}`;

      // Create a basic blank world structure
      const blankWorld: World = {
        id: worldId,
        worldOverview: {
          name: 'New World',
          description: 'A blank world ready for editing',
          thumbnail: null,
          use3DModel: false,
          bgm: null,
          systemPrompt: '',
          author: '',
          tags: []
        },
        stats: [],
        traits: [],
        // Seed the two default trait groups so authors start with World/Player folders.
        traitGroups: [
          { id: randomUUID(), name: 'World', parentId: null, order: 0 },
          { id: randomUUID(), name: 'Player', parentId: null, order: 1 },
        ],
        locations: [],
        entities: [],
        statUpdates: [], // This field is required by WorldStorageService
        // Seed one "Default" book so new worlds start with a dictionary (Foreground by default).
        dictionaries: [{ id: randomUUID(), name: 'Default', enabled: true, entries: [] }],
      };

      // Load the blank world into context for editing; it is NOT persisted until the user hits Save World
      // (so backing out without saving leaves no stray blank world behind).
      loadWorldData(blankWorld, true);

      // Open the world editor
      setShowWorldEditor(true);
    } catch (error) {
      console.error('Error creating new world:', error);
      toast.error('Failed to create new world');
    }
  };

  // Pull the admin-message badge whenever the session changes: on mount for an already-signed-in user,
  // and again right after a login. The first count of a session also raises a toast, so a message sent
  // while the player was away is noticed without opening the profile dialog.
  useEffect(() => {
    if (!COMMUNITY_ENABLED || !isAuthenticated) {
      setUnreadMessages(0);
      setMessageSeverity(null);
      announcedUnreadRef.current = false;
      return;
    }

    let current = true;

    MessageService.fetchUnreadCount()
      .then(({ unread, topSeverity }) => {
        if (!current) return;
        setUnreadMessages(unread);
        setMessageSeverity(topSeverity);

        if (unread > 0 && !announcedUnreadRef.current) {
          announcedUnreadRef.current = true;
          toast.info(unread === 1 ? 'You have a new message' : `You have ${unread} unread messages`);
        }
      })
      // The badge is not worth a toast of its own when the community server is unreachable.
      .catch((error) => console.error('Failed to load unread message count:', error));

    return () => { current = false; };
  }, [isAuthenticated]);

  // The feedback half of the badge. Separate from messages because reading a thread changes it, so it is
  // re-read on demand rather than only when auth changes.
  useEffect(() => {
    if (!COMMUNITY_ENABLED || !isAuthenticated) {
      setUnreadBugs(0);
      return;
    }

    let current = true;

    FeedbackService.fetchUnreadCount()
      .then((unread) => { if (current) setUnreadBugs(unread); })
      .catch((error) => console.error('Failed to load unread feedback count:', error));

    return () => { current = false; };
  }, [isAuthenticated, bugCountNonce]);

  // The follow half of the badge. Same shape as the feedback one: reading the feed changes it.
  useEffect(() => {
    if (!COMMUNITY_ENABLED || !isAuthenticated) {
      setUnreadFollows(0);
      return;
    }

    let current = true;

    UserService.fetchNotificationCount()
      .then((unread) => { if (current) setUnreadFollows(unread); })
      .catch((error) => console.error('Failed to load unread notification count:', error));

    return () => { current = false; };
  }, [isAuthenticated, followCountNonce]);

  // Handle logout
  const handleLogout = () => {
    AuthService.logout();
    setIsAuthenticated(false);
    setCurrentUser(null);
    setShowProfileDialog(false);
    setUnreadMessages(0);
    toast.success('Logged out successfully');
  };

  // Mouse drags immediately (8px); touch requires a short press-and-hold so a swipe scrolls the grid instead
  // of grabbing a card (no scroll wheel on mobile). Shared by the worlds, dictionary, and entity grids.
  const worldSensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  );

  // Reorder one library grid and persist the new id order — shared by the worlds, dictionary, and
  // character grids, which differ only in their state setter and storage key. The loose `id` constraint
  // is for WorldRecord (the sanctioned Record<string, any>), which can't satisfy `{ id: string }`.
  const makeDragEndHandler = <T extends { id?: unknown }>(
    setItems: React.Dispatch<React.SetStateAction<T[]>>,
    orderKey: string,
  ) => (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setItems((prev) => {
      const oldIndex = prev.findIndex((item) => item.id === active.id);
      const newIndex = prev.findIndex((item) => item.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return prev;
      const next = arrayMove(prev, oldIndex, newIndex);
      localStorage.setItem(orderKey, JSON.stringify(next.map((item) => item.id)));
      return next;
    });
  };
  const handleWorldDragEnd = makeDragEndHandler(setWorlds, WORLD_ORDER_KEY);
  const handleDictionaryDragEnd = makeDragEndHandler(setDictionaries, DICTIONARY_ORDER_KEY);
  const handleEntityDragEnd = makeDragEndHandler(setEntities, ENTITY_ORDER_KEY);
  const handleModelDragEnd = makeDragEndHandler(setModels, MODEL_ORDER_KEY);

  // The singular noun for the selected card type — drives the contextual New/Import button labels.
  const cardNoun = cardType === 'worlds' ? 'World'
    : cardType === 'entities' ? 'Entity'
    : cardType === 'models' ? 'Model'
    : 'Dictionary';

  // The menu's action buttons, shared between the full landscape row and the portrait hamburger popover.
  // New/Import are contextual to the selected card type.
  const actionButtons = (
    <>
      {COMMUNITY_ENABLED && (
        <Button
          className="bg-gradient-to-r from-indigo-200 to-blue-200 hover:from-indigo-300 hover:to-blue-300 text-black font-bold"
          onClick={() => setShowCommunityBrowser(true)}
        >
          <Globe className="mr-2 h-4 w-4" /> Community Creations
        </Button>
      )}

      {/* Models are import-only: a VRM is authored in modelling software, so there's nothing to create here. */}
      {cardType !== 'models' && (
        <Button
          className="bg-gradient-to-r from-amber-200 to-yellow-200 hover:from-amber-300 hover:to-yellow-300 text-black font-bold"
          onClick={() => {
            if (cardType === 'worlds') handleCreateNewWorld();
            else if (cardType === 'entities') handleCreateNewEntity();
            else if (cardType === 'dictionaries') handleCreateNewDictionary();
          }}
        >
          <FilePlus2 className="mr-2 h-4 w-4" /> New {cardNoun}
        </Button>
      )}

      <Button
        className="bg-gradient-to-r from-green-200 to-emerald-200 hover:from-green-300 hover:to-emerald-300 text-black font-bold"
        onClick={() => {
          if (cardType === 'worlds') fileInputRef.current?.click();
          else if (cardType === 'dictionaries') dictionaryImportRef.current?.click();
          else if (cardType === 'entities') entityImportRef.current?.click();
          else if (cardType === 'models') modelImportRef.current?.click();
        }}
      >
        <Import className="mr-2 h-4 w-4" /> Import {cardNoun}
      </Button>

      {isAuthenticated && currentUser?.accountType === "admin" && (
        <Button
          className="bg-gradient-to-r from-purple-200 to-pink-200 hover:from-purple-300 hover:to-pink-300 text-black font-bold"
          onClick={() => setShowAdminPanel(true)}
        >
          <Shield className="mr-2 h-4 w-4" /> Admin Panel
        </Button>
      )}
    </>
  );

  if (showCharacterCustomization) {
    return (
      <CharacterCustomization
        onCharacterCustomized={(customizedData) => {
          setShowCharacterCustomization(false);
          onStartGame(selectedTraits, customizedData, true, selectedLocationId, selectedDictionaries, selectedCharacters);
        }}
        onBack={backFrom('avatar')}
        onAbort={() => {
          setShowCharacterCustomization(false);
          setSelectedTraits([]);
          setSelectedLocationId(null);
          setSelectedCharacters(null);
          setSelectedDictionaries(null);
        }}
      />
    );
  }

  return (
    <div className="pt-[calc(5rem+env(safe-area-inset-top))] relative flex flex-col h-[100dvh] overflow-hidden">
      {downscaleDialog}
      <ThemedToastContainer />

      {/* Top control bar: card-type switcher (left) + action buttons/hamburger (center) + view toggle &
          settings (right). items-center keeps every control on the settings cog's centerline (the cog is
          tallest). The side cells are equal flex-1 so the center section sits at true viewport-center when
          there's room; it only shifts/wraps once the sides can't yield more space. */}
      <div className="fixed z-10 flex items-center gap-2 top-[calc(1rem+env(safe-area-inset-top))] left-[calc(1rem+env(safe-area-inset-left))] right-[calc(1rem+env(safe-area-inset-right))]">
        {/* Card-type switcher: text labels at >=1040px, icon-only below — collapsing it (not the action
            buttons) reclaims the width so the centered buttons keep their labels longer. Hidden on mobile,
            where the bottom tab bar takes over (adding a 4th tab left the top row too cramped in portrait).
            No min-w-0: the cell keeps its real width so it never overflows onto the centered buttons. */}
        <div className="flex-1 hidden md:flex items-center justify-start">
          <ToggleGroup
            type="single"
            value={cardType}
            // A single ToggleGroup clears its value when the active item is clicked again; a card type is
            // always required, so an empty result is ignored rather than stored.
            onValueChange={(v) => { if (v) setCardType(v as typeof cardType); }}
          >
            {CARD_TABS.map(({ value, label, Icon }) => (
              <ToggleGroupItem key={value} value={value} aria-label={label} title={label}>
                <Icon className="h-5 w-5 min-[1100px]:hidden" />
                <span className="hidden min-[1100px]:inline">{label}</span>
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>

        {/* Action buttons — full row on wide viewports, collapsed into a hamburger below 1000px. Auto width so
            it centers between the flex-1 side cells; wraps only as a last resort. When collapsed, the right-cell
            menu (Load Game / Settings) folds into this same popover so there's one menu, not two. */}
        <div className="hidden min-[1000px]:flex items-center gap-4 flex-wrap justify-center">
          {actionButtons}
        </div>
        <div className="flex min-[1000px]:hidden">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                className="bg-gradient-to-r from-purple-200 to-pink-200 hover:from-purple-300 hover:to-pink-300 text-black font-bold"
                aria-label="Menu"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="center" className="flex flex-col gap-2 w-72 [&>button]:w-full [&_svg]:shrink-0">
              {actionButtons}
              <div className="h-px bg-border my-1" />
              <Button variant="ghost" className="justify-start" onClick={() => setShowLoadDialog(true)}>
                <FolderOpen className="mr-2 h-4 w-4" /> Load Game
              </Button>
              <Button variant="ghost" className="justify-start" onClick={() => setShowBackup(true)}>
                <Archive className="mr-2 h-4 w-4" /> Backup &amp; Restore
              </Button>
              <Button variant="ghost" className="justify-start" onClick={() => setShowSettings(true)}>
                <Settings className="mr-2 h-4 w-4" /> Settings
              </Button>
            </PopoverContent>
          </Popover>
        </div>

        {/* Grid/detailed view toggle + settings (cog stays right-most) */}
        <div className="flex-1 flex items-center justify-end gap-2">
          <ToggleGroup
            type="single"
            value={layoutMode}
            // Clicking the active item again would otherwise clear the layout mode, which has no empty state.
            onValueChange={(v) => { if (v) setLayoutMode(v as 'grid' | 'detailed'); }}
          >
            <ToggleGroupItem value="grid" aria-label="Grid view" title="Grid view">
              <LayoutGrid className="h-5 w-5" />
            </ToggleGroupItem>
            <ToggleGroupItem value="detailed" aria-label="Detailed view" title="Detailed view">
              <GalleryThumbnails className="h-5 w-5" />
            </ToggleGroupItem>
          </ToggleGroup>
          {/* Right menu — hidden below 1000px, where its items fold into the center hamburger; the view toggle
              then becomes the right-most control. */}
          <div className="hidden min-[1000px]:block">
            <Popover>
              <PopoverTrigger asChild>
                <button
                  className="p-3 bg-secondary text-secondary-foreground rounded-full shadow-lg hover:bg-secondary/80 transition-colors"
                  aria-label="Menu"
                  title="Menu"
                >
                  <Menu className="h-6 w-6" />
                </button>
              </PopoverTrigger>
              {/* Sized for `Backup & Restore` plus its icon; w-48 left it scrunched. */}
              <PopoverContent align="end" className="w-60 p-1">
                <div className="flex flex-col">
                  <Button variant="ghost" className="w-full justify-start" onClick={() => setShowLoadDialog(true)}>
                    <FolderOpen className="mr-2 h-4 w-4" /> Load Game
                  </Button>
                  <Button variant="ghost" className="w-full justify-start" onClick={() => setShowBackup(true)}>
                    <Archive className="mr-2 h-4 w-4" /> Backup &amp; Restore
                  </Button>
                  <Button variant="ghost" className="w-full justify-start" onClick={() => setShowSettings(true)}>
                    <Settings className="mr-2 h-4 w-4" /> Settings
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </div>

      <SettingsModal
        isOpen={showSettings}
        onOpenChange={(v) => { setShowSettings(v); if (!v) { setSettingsTab(undefined); setSettingsEndpointTab(undefined); } }}
        initialTab={settingsTab ?? devRoute?.tab}
        initialEndpointTab={settingsEndpointTab}
        initialPromptTab={devRoute?.subtab}
        onWorldsRestored={refreshWorlds}
      />
      <AiSetupGate
        open={gate !== null}
        reason={gate?.reason ?? 'firstRun'}
        mode={mode}
        blocker={blocker}
        reachable={reachable}
        recheck={recheck}
        onOpenChange={(v) => { if (!v) setGate(null); }}
        onOpenSettings={() => { setGate(null); setSettingsTab('endpoints'); setShowSettings(true); }}
        onReady={handleGateReady}
      />
      <BackupRestoreDialog open={showBackup} onOpenChange={setShowBackup} />

      {/* Main-menu Load Game: no current world (root view), cold-loads the chosen save into its own world. */}
      <LoadGameDialog open={showLoadDialog} onOpenChange={setShowLoadDialog} onLoad={handleColdLoad} />

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept=".json"
        multiple
        className="hidden"
      />
      <input
        type="file"
        ref={dictionaryImportRef}
        onChange={importDictionaryFile}
        accept=".json,application/json"
        multiple
        className="hidden"
      />
      <input
        type="file"
        ref={entityImportRef}
        onChange={importEntityFile}
        accept="image/webp,image/png,.webp,.png"
        multiple
        className="hidden"
      />
      <input
        type="file"
        ref={modelImportRef}
        onChange={importModelFile}
        accept=".vrm,.glb"
        multiple
        className="hidden"
      />

      {/* Worlds, Entities, Dictionaries, and Models are card grids. */}
      {cardType === 'models' ? (
        <ScrollArea className="flex-1 min-h-0 container mx-auto px-4">
          {!isLoadingModels && models.length === 0 ? (
            <div className="flex items-center justify-center py-16 px-4 select-none">
              <p className="max-w-md text-center text-sm text-muted-foreground">
                No models yet — use <span className="font-semibold">Import Model</span> to add a .vrm.
              </p>
            </div>
          ) : (
            <div className={`grid ${ENTITY_GRID_CLASS} gap-4`}>
              <DndContext
                sensors={worldSensors}
                collisionDetection={closestCenter}
                onDragEnd={handleModelDragEnd}
                modifiers={[restrictToFirstScrollableAncestor]}
                autoScroll={CONTAINED_AUTO_SCROLL}
              >
                <SortableContext items={models.map((m) => m.id)} strategy={rectSortingStrategy}>
                  {models.map((model) => (
                    <SortableWorldCard
                      key={model.id}
                      world={{ id: model.id, name: model.name, thumbnail: model.thumbnail }}
                      layout="grid"
                      aspect="portrait"
                      // A plain .glb carries no VRM metadata, so it has no license and its morph targets
                      // aren't guaranteed — say so on the card rather than letting it pass as a full VRM.
                      badge={model.license?.metaVersion === null ? (
                        <span
                          className="rounded bg-overlay/70 px-1.5 py-0.5 text-[10px] font-semibold text-white"
                          title="Plain glTF: no license information, and morph targets aren't guaranteed."
                        >
                          GLB
                        </span>
                      ) : undefined}
                      onSelect={setPreviewModelId}
                      onDelete={setModelToDelete}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            </div>
          )}
        </ScrollArea>
      ) : cardType === 'entities' ? (
        <ScrollArea className="flex-1 min-h-0 container mx-auto px-4">
          {!isLoadingEntities && entities.length === 0 ? (
            <div className="flex items-center justify-center py-16 px-4 select-none">
              <p className="max-w-md text-center text-sm text-muted-foreground">
                No characters yet — use <span className="font-semibold">New Entity</span> or <span className="font-semibold">Import Entity</span> to add one.
              </p>
            </div>
          ) : (
            <div className={`grid ${ENTITY_GRID_CLASS} gap-4`}>
              <DndContext
                sensors={worldSensors}
                collisionDetection={closestCenter}
                onDragEnd={handleEntityDragEnd}
                modifiers={[restrictToFirstScrollableAncestor]}
                autoScroll={CONTAINED_AUTO_SCROLL}
              >
                <SortableContext items={entities.map((e) => e.id)} strategy={rectSortingStrategy}>
                  {entities.map((entity) => (
                    <SortableWorldCard
                      key={entity.id}
                      world={{ id: entity.id, name: entity.name, thumbnail: entity.image }}
                      layout="grid"
                      aspect="portrait"
                      onSelect={setEditingEntityId}
                      onDelete={setEntityToDelete}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            </div>
          )}
        </ScrollArea>
      ) : cardType === 'dictionaries' ? (
        <ScrollArea className="flex-1 min-h-0 container mx-auto px-4">
          {!isLoadingDictionaries && dictionaries.length === 0 ? (
            <div className="flex items-center justify-center py-16 px-4 select-none">
              <p className="max-w-md text-center text-sm text-muted-foreground">
                No dictionaries yet — use <span className="font-semibold">New Dictionary</span> or <span className="font-semibold">Import Dictionary</span> to add one.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <DndContext
                sensors={worldSensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDictionaryDragEnd}
                modifiers={[restrictToFirstScrollableAncestor]}
                autoScroll={CONTAINED_AUTO_SCROLL}
              >
                <SortableContext items={dictionaries.map((d) => d.id)} strategy={rectSortingStrategy}>
                  {dictionaries.map((dictionary) => (
                    <SortableWorldCard
                      key={dictionary.id}
                      world={dictionary}
                      layout="grid"
                      onSelect={setEditingDictionaryId}
                      onDelete={setDictionaryToDelete}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            </div>
          )}
        </ScrollArea>
      ) : (
      /* Bounded scroll viewport (Radix ScrollArea Root is overflow-hidden) so drag-reorder
         auto-scroll stays inside this frame instead of growing the page in either axis. */
      <ScrollArea className="flex-1 min-h-0 container mx-auto px-4">
        <div className={`grid ${gridColsClass(WORLD_GRID_COLS.base, WORLD_GRID_COLS.sm, layoutMode === 'detailed' ? 4 : WORLD_GRID_COLS.lg)} gap-4`}>
          {isLoadingWorlds ? (
            Array(6).fill(0).map((_, index) => (
              <div key={index} className="relative w-full h-48 rounded-lg overflow-hidden">
                <Skeleton className="w-full h-full" />
                <div className="absolute bottom-0 left-0 right-0 bg-overlay/50 p-2">
                  <Skeleton className="h-6 w-24" />
                </div>
              </div>
            ))
          ) : (
            <DndContext
              sensors={worldSensors}
              collisionDetection={closestCenter}
              onDragEnd={handleWorldDragEnd}
              // Clamp the drag to the ScrollArea viewport and never auto-scroll the page/window,
              // so dragging a tile past an edge scrolls this finite frame rather than growing the page.
              modifiers={[restrictToFirstScrollableAncestor]}
              autoScroll={CONTAINED_AUTO_SCROLL}
            >
              <SortableContext items={worlds.map((w) => w.id)} strategy={rectSortingStrategy}>
                {worlds.map((world) => (
                  <SortableWorldCard
                    key={world.id}
                    world={world}
                    layout={layoutMode}
                    onSelect={handleWorldSelection}
                    onDelete={setWorldToDelete}
                  />
                ))}
              </SortableContext>
            </DndContext>
          )}
        </div>
      </ScrollArea>
      )}

      {/* Mobile card-type switch: an in-flow bottom tab bar (one-tap, always visible) that frees the cramped
          top row. In-flow rather than fixed so it stacks above the footer instead of covering it; it caps the
          scroll frame the same way the footer does. Hidden at md+, where the top switcher returns. */}
      <nav className="md:hidden shrink-0 flex border-t bg-background">
        {CARD_TABS.map(({ value, label, Icon }) => (
          <button
            key={value}
            onClick={() => setCardType(value)}
            aria-label={label}
            aria-current={cardType === value ? 'page' : undefined}
            className={cn(
              'flex-1 flex flex-col items-center gap-0.5 py-2 text-[11px] transition-colors',
              cardType === value ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon className="h-5 w-5" />
            {label}
          </button>
        ))}
      </nav>

      {/* Real footer: profile + version (left), copyright (center), social links (right). In-flow and
          shrink-0 so it caps the flex-1 scroll frame above — the card grid ends at the footer instead of
          scrolling under floating buttons. Full-width (the root is no longer the max-width container — that
          moved to the grid scroll areas), so the profile/social sit at the viewport edges. Equal flex-1
          side cells keep the copyright truly centered. */}
      <footer className="shrink-0 flex items-center gap-2 py-3 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pl-[calc(1rem+env(safe-area-inset-left))] pr-[calc(1rem+env(safe-area-inset-right))]">
        {/* Left: user profile circle + app version (the version moves into the ⋯ menu on mobile). */}
        <div className="flex-1 flex items-center justify-start gap-2">
          {COMMUNITY_ENABLED && (
            <button
              // A picture fills the circle edge to edge; an icon needs the padding around it. Both come
              // out 48px, so the footer doesn't shift when somebody signs in.
              className={cn(
                'relative bg-secondary text-secondary-foreground rounded-full shadow-lg hover:bg-secondary/80 transition-colors',
                isAuthenticated ? 'p-0' : 'p-3'
              )}
              onClick={() => isAuthenticated ? setShowProfileDialog(true) : setShowAuthDialog(true)}
              aria-label={
                isAuthenticated
                  ? unreadWaiting > 0 ? `User Profile (${unreadWaiting} unread)` : "User Profile"
                  : "Login"
              }
            >
              {isAuthenticated ? (
                <UserAvatar
                  username={(currentUser?.username as string | undefined) ?? (currentUser?.name as string | undefined)}
                  avatarUrl={currentUser?.avatarUrl as string | null | undefined}
                  size="lg"
                  className="h-12 w-12 text-lg"
                />
              ) : (
                <User className="h-6 w-6" />
              )}

              {/* Unread badge: messages and bug replies together. Capped at 9+ so a long backlog can't
                  stretch the circle. */}
              {isAuthenticated && unreadWaiting > 0 && (
                <span className={cn(
                  'absolute -top-0.5 -right-0.5 min-w-5 h-5 px-1 flex items-center justify-center rounded-full text-[10px] font-bold',
                  UNREAD_MARK_STYLES[unreadKind ?? 'feedback'].badge
                )}>
                  {unreadWaiting > 9 ? '9+' : unreadWaiting}
                </span>
              )}
            </button>
          )}
          {/* Reading the queue needs an account as much as filing does, so this only appears once signed
              in — the server refuses either way. */}
          {COMMUNITY_ENABLED && isAuthenticated && (
            <button
              className="relative p-3 bg-secondary text-secondary-foreground rounded-full shadow-lg hover:bg-secondary/80 transition-colors"
              onClick={() => setShowFeedback(true)}
              title={unreadBugs > 0 ? `Feedback (${unreadBugs} unread)` : "Feedback"}
              aria-label={unreadBugs > 0 ? `Feedback (${unreadBugs} unread)` : "Feedback"}
            >
              <MessageSquarePlus className="h-6 w-6" />
              {unreadBugs > 0 && (
                <span className={cn(
                  'absolute -top-0.5 -right-0.5 min-w-5 h-5 px-1 flex items-center justify-center rounded-full text-[10px] font-bold',
                  UNREAD_MARK_STYLES.feedback.badge
                )}>
                  {unreadBugs > 9 ? '9+' : unreadBugs}
                </span>
              )}
            </button>
          )}
          {!isMobile && (isDesktop() ? <UpdateVersionControl /> : <WebVersionChangelog />)}
        </div>

        {/* Center: copyright + origin credit (original is MIT — see THIRD-PARTY-NOTICES / legal/). The
            "Based on…" line collapses into the ⋯ menu on mobile; the © stays (it replays the intro). */}
        <div className="text-center text-xs text-muted-foreground/60 whitespace-nowrap leading-tight">
          <button
            type="button"
            onClick={() => onReplayIntro?.()}
            className="cursor-pointer hover:text-muted-foreground transition-colors"
            title="Replay intro"
            aria-label="Replay intro"
          >
            © 2026 Jake James
          </button>
          {!isMobile && (
            <div>
              Based on{' '}
              <a
                href="https://github.com/FieryLionite/formamorph"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline"
              >
                Formamorph by FieryLionite
              </a>
            </div>
          )}
        </div>

        {/* Right: social links inline on desktop; an overflow menu (version + socials + credit) on mobile. */}
        <div className="flex-1 flex items-center justify-end gap-3">
          {isMobile ? (
            <Popover>
              <PopoverTrigger asChild>
                <button
                  className="p-3 bg-secondary text-secondary-foreground rounded-full shadow-lg hover:bg-secondary/80 transition-colors"
                  aria-label="More"
                >
                  <MoreHorizontal className="h-6 w-6" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" side="top" className="w-56 flex flex-col gap-1">
                {isDesktop() ? <UpdateVersionControl /> : <WebVersionChangelog />}
                <a
                  href="https://www.patreon.com/JakeJamesNSFW"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent"
                >
                  <PatreonIcon className="h-4 w-4" /> Patreon
                </a>
                <a
                  href="https://github.com/JakeJamesDev/formamorph"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent"
                >
                  <Github className="h-4 w-4" /> GitHub
                </a>
                <a
                  href="https://github.com/FieryLionite/formamorph"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded px-2 py-1.5 text-xs text-muted-foreground hover:bg-accent"
                >
                  Based on Formamorph by FieryLionite
                </a>
              </PopoverContent>
            </Popover>
          ) : (
            <>
              <a
                href="https://www.patreon.com/JakeJamesNSFW"
                target="_blank"
                rel="noopener noreferrer"
                className="p-3 bg-secondary text-secondary-foreground rounded-full shadow-lg hover:bg-secondary/80 transition-colors"
                aria-label="Patreon"
              >
                <PatreonIcon className="h-6 w-6" />
              </a>
              <a
                href="https://github.com/JakeJamesDev/formamorph"
                target="_blank"
                rel="noopener noreferrer"
                className="p-3 bg-secondary text-secondary-foreground rounded-full shadow-lg hover:bg-secondary/80 transition-colors"
                aria-label="GitHub Repository"
              >
                <Github className="h-6 w-6" />
              </a>
            </>
          )}
        </div>
      </footer>

      <Dialog open={showWorldModal} onOpenChange={setShowWorldModal}>
        <DialogContent className={cn("h-[85dvh] flex flex-col overflow-x-hidden", worldModalCollapsed ? "sm:max-w-[600px]" : "sm:max-w-[1200px]")}>
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <span className="truncate">{selectedWorld?.name}</span>
              <Button
                variant="ghost"
                size="icon"
                className="ml-auto mr-8 shrink-0 hidden md:inline-flex"
                onClick={toggleWorldModalCollapsed}
                title={worldModalCollapsed ? "Expand to two columns" : "Collapse to single column"}
                aria-label={worldModalCollapsed ? "Expand to two columns" : "Collapse to single column"}
              >
                {worldModalCollapsed ? <Columns2 className="h-4 w-4" /> : <RectangleVertical className="h-4 w-4" />}
              </Button>
            </DialogTitle>
          </DialogHeader>

          <div className="mt-4 flex-1 min-h-0 flex flex-col">
            {/* Trust a pristine bundled default (id is unspoofable — imports/downloads always re-mint ids),
                so our own example worlds don't warn. An edited default (`dirty`) forfeits that trust. */}
            {hasStatWithCode(stats) && !(isDefaultWorldId(selectedWorld?.id ?? '') && !selectedWorld?.dirty) && (
              <div className="mb-4 shrink-0 p-3 bg-warning/10 border border-warning/30 rounded-md flex items-start">
                <AlertTriangle className="h-5 w-5 text-warning mr-2 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-warning flex-grow">
                  <p className="font-medium">Warning</p>
                  <p>This world contains stats with custom code execution. Please ensure you trust the source of this world.</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="ml-2 bg-warning/20 border-warning/30 text-warning hover:bg-warning/30"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowCodeModal(true);
                  }}
                >
                  <Code className="h-4 w-4 mr-1" />
                  Examine Code
                </Button>
              </div>
            )}
            <WorldDetailsColumn
              split
              collapsed={worldModalCollapsed}
              description={selectedWorld?.description || ""}
              tags={selectedWorld?.data?.worldOverview?.tags}
              meta={
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <h3 className="text-sm font-semibold text-muted-foreground">Author</h3>
                    <p>
                      <UserName
                        userId={selectedWorld?.sourceAuthorId}
                        username={selectedWorld?.data?.worldOverview?.author as string | undefined}
                      />
                    </p>
                  </div>

                  {/* Origin date, dynamic by how the world arrived: downloaded > imported > created.
                      Default worlds were none of these, so they show a dash. */}
                  {(() => {
                    const id: string = selectedWorld?.id ?? '';
                    const isDefault = isDefaultWorldId(id);
                    const isImported = id.startsWith('uploaded-');
                    const label = selectedWorld?.downloadedAt ? "Downloaded" : isImported ? "Imported" : "Created";
                    const value = isDefault ? undefined : (selectedWorld?.downloadedAt ?? selectedWorld?.createdAt);
                    return (
                      <div>
                        <h3 className="text-sm font-semibold text-muted-foreground">{label}</h3>
                        <p><DateTimeText value={value} /></p>
                      </div>
                    );
                  })()}

                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground">Edited</h3>
                    <p><DateTimeText value={selectedWorld?.editedAt} /></p>
                  </div>
                </div>
              }
              thumbnail={
                <div
                  className="hidden sm:block relative w-full pt-[56.25%] cursor-zoom-in"
                  onClick={() => openImageViewer(selectedWorld?.thumbnail, selectedWorld?.name)}
                  title="Click to enlarge"
                >
                  <img
                    src={selectedWorld?.thumbnail}
                    alt={selectedWorld?.name}
                    className="absolute top-0 left-0 w-full h-full object-cover rounded-lg"
                  />
                </div>
              }
              actions={
                <div className="space-y-2">
                  <div className="flex">
                    <Button
                      className="w-2/3 bg-gradient-to-r from-sky-200 to-cyan-200 hover:from-sky-300 hover:to-cyan-300 text-black font-bold rounded-r-none"
                      onClick={() => {
                        // Pre-check "Enabled by Default" traits for the selection screen.
                        const defaults = traits.filter((t) => t.isDefault).map((t) => t.id);
                        setSelectedTraits(defaults);
                        setShowWorldModal(false);
                        // No traits to choose — skip the selection menu entirely.
                        if (traits.length === 0) {
                          proceedFromTraits(defaults);
                        } else {
                          setShowTraitSelection(true);
                        }
                      }}
                    >
                      <DoorOpen className="mr-2 h-4 w-4" /> Enter World
                    </Button>

                    <Button
                      className="w-1/3 bg-gradient-to-r from-amber-100 to-yellow-100 hover:from-amber-200 hover:to-yellow-200 text-black font-bold rounded-l-none"
                      onClick={() => {
                        // For uploaded worlds, use the worldData from context
                        const currentWorldData = selectedWorld!.data;
                        // Skip the setup steps but honor the author's default trait choices.
                        const defaults = traits.filter((t) => t.isDefault).map((t) => t.id);
                        setSelectedTraits(defaults);
                        onStartGame(defaults, currentWorldData.worldOverview?.use3DModel ? defaultCharacterData : null, true);
                      }}
                    >
                      <ChevronLast className="h-4 w-4 landscape:mr-2" />
                      <span className="hidden landscape:inline">Quick Start</span>
                    </Button>
                  </div>

                  <Button
                    className="w-full bg-gradient-to-r from-orange-100 to-orange-200 hover:from-orange-200 hover:to-orange-300 text-black font-bold"
                    onClick={() => setShowWorldEditor(true)}
                  >
                    <Pencil className="mr-2 h-4 w-4" /> Edit World
                  </Button>

                  <Button
                    className="w-full bg-gradient-to-r from-purple-100 to-purple-200 hover:from-purple-200 hover:to-purple-300 text-black font-bold"
                    onClick={() => handleDuplicateWorld()}
                  >
                    <FilePlus2 className="mr-2 h-4 w-4" /> Duplicate World
                  </Button>

                  {isAuthenticated && (
                    <Button
                      className="w-full bg-gradient-to-r from-red-100 to-red-200 hover:from-purple-200 hover:to-indigo-300 text-black font-bold"
                      onClick={() => selectedWorld && openPublish(worldPublishPayload(selectedWorld.data))}
                    >
                      <Upload className="mr-2 h-4 w-4" /> Publish World
                    </Button>
                  )}
                </div>
              }
            />
          </div>

          {/* Per-world README toggle, anchored bottom-left of the popup — same flag the in-game
              "Don't Show This Again" writes (inverse). */}
          {selectedWorld?.data?.worldOverview?.readme?.trim() && (
            <div className="shrink-0 flex items-center gap-2 pt-2">
              <Checkbox
                id="show-readme"
                checked={showReadme(selectedWorld.id)}
                onCheckedChange={(c) => setShowReadme(selectedWorld.id, c === true)}
              />
              <label htmlFor="show-readme" className="text-sm cursor-pointer">Show Readme on entry</label>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!worldToDelete}
        onOpenChange={(open) => !open && setWorldToDelete(null)}
        title="Delete World"
        description="Are you sure you want to delete this world? This action cannot be undone."
        onConfirm={async () => {
          try {
            await WorldStorageService.deleteWorld(worldToDelete!);
            setWorlds(prev => prev.filter(w => w.id !== worldToDelete));
            setWorldToDelete(null);
          } catch (error) {
            console.error('Error deleting world:', error);
          }
        }}
      />

      <ConfirmDialog
        open={!!dictionaryToDelete}
        onOpenChange={(open) => !open && setDictionaryToDelete(null)}
        title="Delete Dictionary"
        description="Are you sure you want to delete this dictionary? This action cannot be undone."
        onConfirm={async () => {
          try {
            await DictionaryStorageService.deleteDictionary(dictionaryToDelete!);
            setDictionaries(prev => prev.filter(d => d.id !== dictionaryToDelete));
            setDictionaryToDelete(null);
          } catch (error) {
            console.error('Error deleting dictionary:', error);
          }
        }}
      />

      <DictionaryEditorModal
        dictionaryId={editingDictionaryId}
        draft={draftDictionary}
        onClose={() => { setEditingDictionaryId(null); setDraftDictionary(null); refreshDictionaries(); }}
        onPublish={isAuthenticated ? (book) => openPublish(dictionaryPublishPayload(book)) : undefined}
      />

      <ConfirmDialog
        open={!!entityToDelete}
        onOpenChange={(open) => !open && setEntityToDelete(null)}
        title="Delete Character"
        description="Are you sure you want to delete this character? This action cannot be undone."
        onConfirm={async () => {
          try {
            await EntityStorageService.deleteEntity(entityToDelete!);
            setEntities(prev => prev.filter(e => e.id !== entityToDelete));
            setEntityToDelete(null);
          } catch (error) {
            console.error('Error deleting character:', error);
          }
        }}
      />

      <ConfirmDialog
        open={!!modelToDelete}
        onOpenChange={(open) => !open && setModelToDelete(null)}
        title="Delete Model"
        description={
          modelUsage === null
            ? 'Checking which saves use this model…'
            : modelUsage.length === 0
              ? 'Are you sure you want to delete this model? This action cannot be undone.'
              : `${modelUsage.length === 1 ? 'One save uses' : `${modelUsage.length} saves use`} this model — ${listSaves(modelUsage)}. ${modelUsage.length === 1 ? 'It' : 'They'} will fall back to the default model. This action cannot be undone.`
        }
        onConfirm={async () => {
          try {
            await ModelStorageService.deleteModel(modelToDelete!);
            setModels(prev => prev.filter(m => m.id !== modelToDelete));
          } catch (error) {
            // The library refuses to drop its last model; tell the player why rather than failing silently.
            toast.error((error as Error).message);
          } finally {
            setModelToDelete(null);
          }
        }}
      />

      <ModelDetailsModal
        model={models.find((m) => m.id === previewModelId) ?? null}
        onClose={() => setPreviewModelId(null)}
      />

      <EntityEditorModal
        entityId={editingEntityId}
        draft={draftEntity}
        onClose={() => { setEditingEntityId(null); setDraftEntity(null); refreshEntities(); }}
        onPublish={isAuthenticated ? publishEntity : undefined}
      />

      <Dialog open={showCodeModal} onOpenChange={setShowCodeModal}>
        <DialogContent className="sm:max-w-[500px] h-[85dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Custom Code Execution</DialogTitle>
          </DialogHeader>

          <div className="mt-4">
            <p className="text-sm text-muted-foreground mb-4">
              This world contains the following custom code in its stats:
            </p>

            <div className="bg-muted p-4 rounded-md overflow-auto">
              <pre className="text-sm font-mono whitespace-pre-wrap">
                {generateConcatenatedCode(stats)}
              </pre>
            </div>

            <div className="mt-4 flex justify-end">
              <Button onClick={() => setShowCodeModal(false)}>
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dimming scrim behind the enter-world flow popups (they're bare fixed cards, not Radix dialogs, so
          they don't bring their own overlay). z-40 sits under the cards' z-50. */}
      {(showTraitSelection || showLocationSelection || showCharacterSelection || showDictionarySelection) && (
        <div className="fixed inset-0 z-40 bg-black/80" aria-hidden />
      )}

      {showTraitSelection && (
        <TraitSelectionModal
          traits={traits}
          traitGroups={traitGroups}
          stats={stats}
          selectedTraits={selectedTraits}
          onTraitSelect={handleTraitSelection}
          onAbort={() => {
            setShowTraitSelection(false);
            setSelectedTraits([]);
          }}
          onConfirm={() => proceedFromTraits(selectedTraits)}
          onBack={backFrom('traits')}
          confirmLabel={
            startingLocations(locations).length > 1
              ? 'Location'
              : charStepVisible
                ? 'Characters'
                : dictStepVisible
                  ? 'Dictionaries'
                  : selectedWorld?.data.worldOverview?.use3DModel
                    ? 'Avatar'
                    : 'Start'
          }
        />
      )}

      {showLocationSelection && (
        <StartingLocationModal
          locations={startingLocations(locations)}
          onConfirm={proceedFromLocation}
          onBack={backFrom('location')}
          onAbort={() => {
            setShowLocationSelection(false);
            setSelectedTraits([]);
            setSelectedLocationId(null);
          }}
          confirmLabel={
            charStepVisible
              ? 'Characters'
              : dictStepVisible
                ? 'Dictionaries'
                : selectedWorld?.data.worldOverview?.use3DModel
                  ? 'Avatar'
                  : 'Start'
          }
        />
      )}

      {showCharacterSelection && (
        <CharacterSelectionModal
          libraryMeta={entities}
          onConfirm={proceedFromCharacters}
          onBack={backFrom('characters')}
          onAbort={() => {
            setShowCharacterSelection(false);
            setSelectedTraits([]);
            setSelectedLocationId(null);
            setSelectedCharacters(null);
          }}
          confirmLabel={
            dictStepVisible
              ? 'Dictionaries'
              : selectedWorld?.data.worldOverview?.use3DModel
                ? 'Avatar'
                : 'Start'
          }
        />
      )}

      {showDictionarySelection && (
        <DictionarySelectionModal
          worldBooks={worldBooks}
          libraryMeta={dictionaries}
          onConfirm={proceedFromDictionaries}
          onBack={backFrom('dictionaries')}
          onAbort={() => {
            setShowDictionarySelection(false);
            setSelectedTraits([]);
            setSelectedLocationId(null);
          }}
          confirmLabel={selectedWorld?.data.worldOverview?.use3DModel ? 'Avatar' : 'Start'}
        />
      )}

      {/* Community-server dialogs (auth, publish, world browser) — omitted entirely in the hosted build. */}
      {COMMUNITY_ENABLED && (
        <>
          {/* Auth + Profile dialogs (login/register + change password/logout) */}
          <AuthModals
            showAuthDialog={showAuthDialog}
            setShowAuthDialog={setShowAuthDialog}
            showProfileDialog={showProfileDialog}
            setShowProfileDialog={setShowProfileDialog}
            currentUser={currentUser}
            onAuthenticated={() => { setIsAuthenticated(true); setCurrentUser(AuthService.getCurrentUser()); }}
            onAvatarChanged={() => setCurrentUser(AuthService.getCurrentUser())}
            onLogout={handleLogout}
            onUnreadChange={setUnreadMessages}
            onNotificationsRead={handleNotificationsRead}
            onOpenListing={handleOpenListing}
            initialTab={devRoute?.modal === 'profile' ? (devRoute.tab as ProfileTab | undefined) : undefined}
          />

          {/* Publish Modal — form/handlers live in the component */}
          <PublishModal
            open={showPublishModal}
            onOpenChange={setShowPublishModal}
            isAuthenticated={isAuthenticated}
            payload={publishPayload}
          />

          {/* Community Creations browser — see CommunityCreationsBrowser.tsx */}
          <CommunityCreationsBrowser
            open={showCommunityBrowser}
            onOpenChange={setShowCommunityBrowser}
            worlds={worlds}
            setWorlds={setWorlds}
            entities={entities}
            dictionaries={dictionaries}
            refreshEntities={refreshEntities}
            refreshDictionaries={refreshDictionaries}
            isAuthenticated={isAuthenticated}
            currentUser={currentUser}
            openImageViewer={openImageViewer}
            initialKind={devRoute?.modal === 'community' ? (devRoute.tab as CatalogKind | undefined) : undefined}
            openListing={pendingListing}
            onListingOpened={handleListingOpened}
          />
        </>
      )}

      {/* World Editor as a full-screen in-place modal — visually identical to the old top-level view (its own
          back arrow + unsaved-changes guard), but MainMenu stays mounted so it animates open/closed (zoom from
          center, like Community Creations) and only the world grid refreshes on close. `hideClose` + no back
          arrow means the editor's guarded back arrow is the sole exit; Esc/overlay are blocked so they can't
          bypass the dirty prompt. */}
      <Dialog open={showWorldEditor} onOpenChange={(open) => { if (open) setShowWorldEditor(true); }}>
        <DialogContent
          hideClose
          onEscapeKeyDown={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          className="max-w-none w-screen h-dvh sm:max-w-none left-0 top-0 translate-x-0 translate-y-0 rounded-none sm:rounded-none p-0 gap-0 flex flex-col data-[state=open]:!slide-in-from-top-0 data-[state=open]:!slide-in-from-left-0 data-[state=closed]:!slide-out-to-top-0 data-[state=closed]:!slide-out-to-left-0"
        >
          <DialogTitle className="sr-only">World Editor</DialogTitle>
          <WorldEditor embedded backButton onClose={() => { setShowWorldEditor(false); refreshWorlds(); }} />
        </DialogContent>
      </Dialog>

      {/* Full-size pan/zoom image viewer for the selected world */}
      <ImageZoomViewer
        open={imageViewerOpen}
        onOpenChange={setImageViewerOpen}
        alt={viewerImage.alt}
        src={viewerImage.src}
      />

      {/* Admin Panel — user management and broadcasts; each tab owns its own fetching */}
      <FeedbackHubDialog
        open={showFeedback}
        onOpenChange={setShowFeedback}
        initialTab={devRoute?.modal === 'feedbackHub' ? (devRoute.tab as MyFeedbackTabKey | undefined) : undefined}
        onChanged={handleBugsChange}
      />

      <AdminPanelDialog
        open={showAdminPanel}
        onOpenChange={setShowAdminPanel}
        initialTab={devRoute?.modal === 'adminPanel' ? (devRoute.tab as AdminPanelTab | undefined) : undefined}
        initialPoliciesTab={devRoute?.modal === 'adminPanel' ? (devRoute.subtab as PoliciesSubTab | undefined) : undefined}
        initialFeedbackTab={devRoute?.modal === 'adminPanel' ? (devRoute.subtab as FeedbackSubTab | undefined) : undefined}
      />
    </div>
  );
};

export default MainMenu;
