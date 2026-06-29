import React, { useState, useRef, useEffect } from 'react';
import { useGameData } from '../contexts/GameDataContext';
import { toast, ToastContainer  } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {ConfirmDialog} from "@/components/ConfirmDialog";
import {RadioGroup,RadioGroupItem } from"@/components/ui/radio-group";
import {Label} from "@/components/ui/label"
import {FilePlus2, DoorOpen, Pencil, Github, AlertTriangle, Code, User, LogIn, LogOut, Key, Upload, Import, Search, Globe, Settings, LayoutGrid, GalleryThumbnails, Columns2, RectangleVertical } from "lucide-react";
import { ImageZoomViewer } from "@/components/ImageZoomViewer";
import { cn } from "@/lib/utils";
import { GameText } from "@/components/game/GameText";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import CharacterCustomization, { defaultCharacterData } from './CharacterCustomization';
import { SettingsModal } from '../components/modals/SettingsModal';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  arrayMove,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { restrictToFirstScrollableAncestor } from '@dnd-kit/modifiers';
import TraitSelectionModal from './TraitSelectionModal';
import WorldStorageService from '../services/WorldStorageService';
import AuthService from '../services/AuthService';
import type { World, Stat, CharacterData } from '@/types';
import { migrateWorld, APP_VERSION } from '@/lib/version';
import DiscoverWorlds from './DiscoverWorlds';
import { WorldDetailsColumn, DateTimeText, CardTags, type WorldRecord } from "@/components/WorldDetails";

interface MainMenuProps {
  onStartGame: (traits: string[], characterData: CharacterData | null, isNewGame?: boolean) => void;
  onOpenWorldEditor: () => void;
}

const defaultWorlds = [
  { id: 'rampage', defaultName: 'Giantess Rampage' },
  { id: 'valentines', defaultName: 'Valentines Survival' },
  { id: 'drone', defaultName: 'Reincarnated Drone' }
];

// User-defined world ordering is a UI preference, persisted as an ordered list of ids.
const WORLD_ORDER_KEY = 'FORMAMORPH_worldOrder';
const LAYOUT_MODE_KEY = 'FORMAMORPH_layoutMode';
// Persisted preference to force the local world modal's single-column (portrait) layout at any width.
const WORLD_MODAL_COLLAPSED_KEY = 'FORMAMORPH_worldModalCollapsed';

const loadWorldOrder = (): string[] => {
  try { return JSON.parse(localStorage.getItem(WORLD_ORDER_KEY) || '[]'); }
  catch { return []; }
};
// Sort by saved order; ids not in the saved order keep their relative order at the end.
const applyWorldOrder = <T extends { id: string }>(list: T[], order: string[]): T[] => {
  const rank = (id: string) => { const i = order.indexOf(id); return i === -1 ? Infinity : i; };
  return [...list].sort((a, b) => rank(a.id) - rank(b.id));
};

// A draggable world tile. The whole card is the drag handle; a small move distance is
// required to start a drag so a plain click still selects the world.
// Trash icon shared by both card layouts' delete button.
const DeleteIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
  </svg>
);

function SortableWorldCard({ world, onSelect, onDelete, layout }: {
  world: WorldRecord;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  layout: 'grid' | 'detailed';
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: world.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1 : undefined,
  };
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(world.id);
  };

  // Detailed layout mirrors the Discover-menu card renderer (thumbnail on top, info beneath).
  if (layout === 'detailed') {
    return (
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        className="relative flex flex-col rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer bg-background touch-none"
        onClick={() => onSelect(world.id)}
      >
        <div className="h-32 bg-gray-100 dark:bg-gray-800 rounded-t-lg overflow-hidden">
          {world.thumbnail ? (
            <img src={world.thumbnail} alt={world.name} className="w-full h-full object-cover select-none pointer-events-none" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400">
              <Globe className="h-12 w-12" />
            </div>
          )}
        </div>

        <div className="p-4 flex flex-col flex-grow">
          <h3 className="font-semibold text-lg mb-1">{world.name}</h3>
          <div className="text-sm text-gray-600 dark:text-gray-400 mb-2 max-h-20 overflow-hidden">
            <GameText text={world.description || "No description available."} />
          </div>
          <div className="text-xs text-gray-500 mb-2">By {world.author || "Unknown"}</div>
          <div className="mt-auto" onClick={(e) => e.stopPropagation()}>
            <CardTags tags={world.tags || []} />
          </div>
        </div>

        <button
          className="absolute top-1 right-1 z-10 p-1 rounded bg-black/50 text-red-400 hover:text-red-600"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={handleDelete}
          aria-label="Delete world"
        >
          <DeleteIcon />
        </button>
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="relative cursor-pointer rounded-lg overflow-hidden hover:opacity-90 transition-opacity touch-none"
      onClick={() => onSelect(world.id)}
    >
      <img
        src={world.thumbnail}
        alt={world.name}
        className="w-full h-48 object-cover select-none pointer-events-none"
      />
      <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 p-2">
        <h3 className="text-white font-semibold">{world.name}</h3>
        <button
          className="absolute top-2 right-2 p-1 text-red-500 hover:text-red-700"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={handleDelete}
        >
          <DeleteIcon />
        </button>
      </div>
    </div>
  );
}

const MainMenu = ({ onStartGame, onOpenWorldEditor }: MainMenuProps) => {
  const { traits, traitGroups, stats, loadWorldData } = useGameData();
  const [selectedWorld, setSelectedWorld] = useState<WorldRecord | null>(null);
  // Local-world grid layout: "grid" (default compact cards) or "detailed" (Discover-style card + info
  // beneath). Persisted across sessions in localStorage.
  const [layoutMode, setLayoutMode] = useState<'grid' | 'detailed'>(
    () => (localStorage.getItem(LAYOUT_MODE_KEY) === 'detailed' ? 'detailed' : 'grid'),
  );
  const changeLayoutMode = (mode: 'grid' | 'detailed') => {
    setLayoutMode(mode);
    localStorage.setItem(LAYOUT_MODE_KEY, mode);
  };
  // Per-modal "collapse to single column" preference, persisted across sessions.
  const [worldModalCollapsed, setWorldModalCollapsed] = useState(
    () => localStorage.getItem(WORLD_MODAL_COLLAPSED_KEY) === 'true',
  );
  const toggleWorldModalCollapsed = () => {
    setWorldModalCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(WORLD_MODAL_COLLAPSED_KEY, String(next));
      return next;
    });
  };
  const [showWorldModal, setShowWorldModal] = useState(false);
  const [showMobileWorldEditorWarning, setShowMobileWorldEditorWarning] = useState(false);
  const [worldToDelete, setWorldToDelete] = useState<string | null>(null);
  const [showCharacterCustomization, setShowCharacterCustomization] = useState(false);
  const [showTraitSelection, setShowTraitSelection] = useState(false);
  const [selectedTraits, setSelectedTraits] = useState<string[]>([]);
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [worlds, setWorlds] = useState<WorldRecord[]>([]);
  const [isLoadingWorlds, setIsLoadingWorlds] = useState(true);

  // Authentication states
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<WorldRecord | null>(null);
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const [showProfileDialog, setShowProfileDialog] = useState(false);
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'register'
  const [authError, setAuthError] = useState('');

  // Auth form states
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  // Publish modal states
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [userWorlds, setUserWorlds] = useState<WorldRecord[]>([]);
  const [selectedWorldToOverride, setSelectedWorldToOverride] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishError, setPublishError] = useState('');

  // Discover dialog open state (the browser itself lives in <DiscoverWorlds>).
  const [showDiscoverDialog, setShowDiscoverDialog] = useState(false);

  // Shared pan/zoom image viewer, opened by the local world modal and the Discover details modal.
  const [imageViewerOpen, setImageViewerOpen] = useState(false);
  // Source for the shared pan/zoom viewer, set by whichever modal's thumbnail was clicked.
  const [viewerImage, setViewerImage] = useState<{ src: string; alt: string }>({ src: '', alt: '' });
  const openImageViewer = (src: string | undefined, alt: string | undefined) => {
    if (!src) return;
    setViewerImage({ src, alt: alt || 'World image' });
    setImageViewerOpen(true);
  };

  // Manage users dialog states
  const [showManageUsersDialog, setShowManageUsersDialog] = useState(false);
  const [users, setUsers] = useState<WorldRecord[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userCurrentPage, setUserCurrentPage] = useState(1);
  const [userTotalPages, setUserTotalPages] = useState(1);

  // Check authentication status on component mount
  useEffect(() => {
    const checkAuth = async () => {
      const isLoggedIn = AuthService.isAuthenticated();
      setIsAuthenticated(isLoggedIn);

      if (isLoggedIn) {
        const user = AuthService.getCurrentUser();

        // If we have a user object but no username, create one with the username from the login form
        if (user && !user.username && username) {
          user.username = username;
        }

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
    // Run once on mount; `username` is only a login-form fallback, not a re-run trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

        const mapped = worldMetadata.map(world => ({
          ...world,
          isLoading: false,
          defaultName: defaultWorlds.find(dw => dw.id === world.id)?.defaultName || world.name
        }));
        setWorlds(applyWorldOrder(mapped, loadWorldOrder()));

      } catch (error) {
        console.error('Error initializing worlds:', error);
      } finally {
        setIsLoadingWorlds(false);
      }
    };

    initializeWorlds();
  }, []);

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
        loadWorldData(worldData as World, true);
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

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          // Sanitize at the import boundary: migrate any legacy/v1.2 shape to the current version.
          const parsedWorldData = migrateWorld(JSON.parse(e.target?.result as string));
          const worldId = `uploaded-${Date.now()}`;
          const now = new Date().toISOString();

          parsedWorldData.id = worldId;

          await WorldStorageService.storeWorld({
            id: worldId,
            name: parsedWorldData.worldOverview?.name || 'Uploaded World',
            description: parsedWorldData.worldOverview?.description || 'Custom uploaded world',
            thumbnail: parsedWorldData.worldOverview?.thumbnail ?? undefined,
            data: parsedWorldData
          });

          setWorlds(prev => [...prev, {
            id: worldId,
            name: parsedWorldData.worldOverview?.name || 'Uploaded World',
            description: parsedWorldData.worldOverview?.description || 'Custom uploaded world',
            thumbnail: parsedWorldData.worldOverview?.thumbnail,
            tags: parsedWorldData.worldOverview?.tags || [],
            createdAt: now,
            lastAccessed: now,
            isLoading: false
          }]);

          loadWorldData(parsedWorldData, true);
          setSelectedWorld({
            id: worldId,
            name: parsedWorldData.worldOverview?.name || 'Uploaded World',
            description: parsedWorldData.worldOverview?.description || 'Custom uploaded world',
            thumbnail: parsedWorldData.worldOverview?.thumbnail,
            createdAt: now,
            lastAccessed: now,
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

  const handleTraitSelection = (traitId: string) => {
    setSelectedTraits(prev =>
      prev.includes(traitId)
        ? prev.filter(id => id !== traitId)
        : [...prev, traitId]
    );
  };

  // Leave the trait-selection step and start the world (custom-character step first for 3D worlds).
  const proceedFromTraits = (traitIds: string[]) => {
    setShowTraitSelection(false);
    const currentWorldData = selectedWorld!.data;
    if (currentWorldData.worldOverview?.use3DModel) {
      setShowCharacterCustomization(true);
    } else {
      onStartGame(traitIds, null, true);
    }
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
      const worldId = `duplicate-${Date.now()}`;

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
      const worldId = `new-${Date.now()}`;

      // Create a basic blank world structure
      const blankWorld: World = {
        id: worldId,
        worldOverview: {
          name: 'New World',
          description: 'A blank world ready for editing',
          thumbnail: 'https://via.placeholder.com/400x300/2a2a2a/ffffff?text=New+World',
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
          { id: crypto.randomUUID(), name: 'World', parentId: null, order: 0 },
          { id: crypto.randomUUID(), name: 'Player', parentId: null, order: 1 },
        ],
        locations: [],
        entities: [],
        statUpdates: [] // This field is required by WorldStorageService
      };

      // Store the world
      await WorldStorageService.storeWorld({
        id: worldId,
        name: 'New World',
        description: 'A blank world ready for editing',
        thumbnail: 'https://via.placeholder.com/400x300/2a2a2a/ffffff?text=New+World',
        data: blankWorld
      });

      // Add the world to the local list
      setWorlds(prev => [...prev, {
        id: worldId,
        name: 'New World',
        description: 'A blank world ready for editing',
        thumbnail: 'https://via.placeholder.com/400x300/2a2a2a/ffffff?text=New+World',
        tags: [],
        isLoading: false
      }]);

      // Load the world data into context
      loadWorldData(blankWorld, true);

      // Open the world editor
      if (window.innerWidth < 1024) {
        setShowMobileWorldEditorWarning(true);
      } else {
        onOpenWorldEditor();
      }

      toast.success('New world created! You can now start editing.');
    } catch (error) {
      console.error('Error creating new world:', error);
      toast.error('Failed to create new world');
    }
  };

  // Handle login
  const handleLogin = async () => {
    setAuthError('');

    if (!username || !password) {
      setAuthError('Username and password are required');
      return;
    }

    try {
      await AuthService.login(username, password);
      setIsAuthenticated(true);
      setCurrentUser(AuthService.getCurrentUser());
      setShowAuthDialog(false);
      resetAuthForms();
      toast.success('Logged in successfully');
    } catch (error) {
      setAuthError((error as Error).message || 'Login failed');
    }
  };

  // Handle registration
  const handleRegister = async () => {
    setAuthError('');

    // Validate username and password according to server requirements
    if (!username) {
      setAuthError('Username is required');
      return;
    }

    if (username.length < 3 || username.length > 20) {
      setAuthError('Username must be between 3 and 20 characters');
      return;
    }

    if (!password) {
      setAuthError('Password is required');
      return;
    }

    if (password.length < 6) {
      setAuthError('Password must be at least 6 characters long');
      return;
    }

    if (password !== confirmPassword) {
      setAuthError('Passwords do not match');
      return;
    }

    try {
      await AuthService.register(username, password);
      setIsAuthenticated(true);
      setCurrentUser(AuthService.getCurrentUser());
      setShowAuthDialog(false);
      resetAuthForms();
      toast.success('Registered successfully');
    } catch (error) {
      setAuthError((error as Error).message || 'Registration failed');
    }
  };

  // Handle password change
  const handleChangePassword = async () => {
    setAuthError('');

    if (!currentPassword || !newPassword) {
      setAuthError('Both current and new passwords are required');
      return;
    }

    try {
      await AuthService.changePassword(currentPassword, newPassword);
      setShowProfileDialog(false);
      resetAuthForms();
      toast.success('Password changed successfully');
    } catch (error) {
      setAuthError((error as Error).message || 'Failed to change password');
    }
  };

  // Handle logout
  const handleLogout = () => {
    AuthService.logout();
    setIsAuthenticated(false);
    setCurrentUser(null);
    setShowProfileDialog(false);
    toast.success('Logged out successfully');
  };

  // Reset auth forms
  const resetAuthForms = () => {
    setUsername('');
    setPassword('');
    setConfirmPassword('');
    setCurrentPassword('');
    setNewPassword('');
    setAuthError('');
  };

  // Fetch user's published worlds
  const fetchUserWorlds = async () => {
    if (!isAuthenticated) return;

    try {
      const worlds = await WorldStorageService.getUserWorlds();
      setUserWorlds(worlds);

      // Set default selection to "publish as new"
      setSelectedWorldToOverride('new');
    } catch (error) {
      console.error('Error fetching user worlds:', error);
      setPublishError('Failed to load your published worlds');
    }
  };

  // Handle publishing as a new world
  const handlePublishAsNew = async () => {
    setPublishError('');
    setIsPublishing(true);

    try {
      // Get the current world data
      const worldToPublish = selectedWorld!.data;

      // Ensure tags are included in the world data
      if (!worldToPublish.worldOverview.tags) {
        worldToPublish.worldOverview.tags = [];
      }

      // Publish the world
      await WorldStorageService.publishWorld(worldToPublish);

      // Update the user worlds list directly
      const updatedWorlds = await WorldStorageService.getUserWorlds();
      setUserWorlds(updatedWorlds);

      // Close the modal and show success message
      setShowPublishModal(false);
      toast.success('World published successfully!');
    } catch (error) {
      setPublishError((error as Error).message || 'Failed to publish world');
    } finally {
      setIsPublishing(false);
    }
  };

  // Handle overriding an existing world
  const handleOverrideWorld = async () => {
    if (!selectedWorldToOverride) return;

    // If "new" is selected, call handlePublishAsNew instead
    if (selectedWorldToOverride === 'new') {
      return handlePublishAsNew();
    }

    setPublishError('');
    setIsPublishing(true);

    try {
      // Get the current world data
      const worldToPublish = selectedWorld!.data;

      // Ensure tags are included in the world data
      if (!worldToPublish.worldOverview.tags) {
        worldToPublish.worldOverview.tags = [];
      }

      // Update the existing world
      await WorldStorageService.publishWorld(worldToPublish, selectedWorldToOverride);

      // Update the user worlds list directly
      const updatedWorlds = await WorldStorageService.getUserWorlds();
      setUserWorlds(updatedWorlds);

      // Close the modal and show success message
      setShowPublishModal(false);
      toast.success('World updated successfully!');
    } catch (error) {
      setPublishError((error as Error).message || 'Failed to update world');
    } finally {
      setIsPublishing(false);
    }
  };

  // Load user worlds when publish modal is opened
  useEffect(() => {
    if (showPublishModal) {
      fetchUserWorlds();
    }
    // Fetch only when the publish modal opens or auth changes — not on fetchUserWorlds identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showPublishModal, isAuthenticated]);

  // Fetch users when manage users dialog is opened or search/page changes
  useEffect(() => {
    if (showManageUsersDialog) {
      fetchUsers();
    }
    // Fetch only when the dialog opens or the page changes — not on fetchUsers identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showManageUsersDialog, userCurrentPage]);

  // Fetch users from the server
  const fetchUsers = async () => {
    if (!showManageUsersDialog) return;

    setIsLoadingUsers(true);

    try {
      // Fetch users from the API
      const response = await fetch(`${WorldStorageService.API_URL}/users?page=${userCurrentPage}&limit=10&search=${userSearchQuery}`, {
        headers: {
          'Authorization': `Bearer ${AuthService.token}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch users');
      }

      const result = await response.json();

      if (result.success) {
        setUsers(result.data);

        // Calculate total pages
        const total = result.total || 0;
        const pages = Math.ceil(total / 10);
        setUserTotalPages(pages > 0 ? pages : 1);
      } else {
        console.error('Error fetching users:', result.error);
        toast.error(result.error || 'Failed to fetch users');
        setUsers([]);
      }
    } catch (error) {
      console.error('Error in fetchUsers:', error);
      toast.error((error as Error).message || 'Failed to connect to server');
      setUsers([]);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  // Handle user status change
  const handleUserStatusChange = async (userId: string, newStatus: string) => {
    try {
      // Call API to update user status - use the same endpoint for both actions
      const endpoint = `${WorldStorageService.API_URL}/users/${userId}/status`;

      const response = await fetch(endpoint, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${AuthService.token}`
        },
        body: JSON.stringify({ status: newStatus })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to ${newStatus === "normal" ? "activate" : "suspend"} user`);
      }

      // Update the user in the list
      setUsers(prev => prev.map(user =>
        user._id === userId ? { ...user, status: newStatus } : user
      ));

      toast.success(`User ${newStatus === "normal" ? "activated" : "suspended"} successfully`);
    } catch (error) {
      console.error('Error updating user status:', error);
      toast.error((error as Error).message || `Failed to ${newStatus === "normal" ? "activate" : "suspend"} user`);
    }
  };

  // Get user initial for the avatar button
  const getUserInitial = () => {
    if (!currentUser) return 'U';

    // Handle different possible user object structures
    if (typeof currentUser === 'string') {
      return (currentUser as string).charAt(0).toUpperCase();
    }

    if (currentUser.username) {
      return currentUser.username.charAt(0).toUpperCase();
    }

    if (currentUser.name) {
      return currentUser.name.charAt(0).toUpperCase();
    }

    // No recognizable username property — fall back to a default initial.
    return 'U';
  };

  const worldSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  // Reorder the worlds grid and persist the new id order.
  const handleWorldDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setWorlds((prev) => {
      const oldIndex = prev.findIndex((w) => w.id === active.id);
      const newIndex = prev.findIndex((w) => w.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return prev;
      const next = arrayMove(prev, oldIndex, newIndex);
      localStorage.setItem(WORLD_ORDER_KEY, JSON.stringify(next.map((w) => w.id)));
      return next;
    });
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
    <div className="container mx-auto px-4 py-6 relative flex flex-col h-screen overflow-hidden">
      <ToastContainer theme="dark" />

      {/* App version (derived from package.json) */}
      <span className="fixed bottom-2 left-2 z-10 text-xs text-muted-foreground/60 select-none pointer-events-none">
        v{APP_VERSION}
      </span>

      {/* Top-left controls: local-world layout selector (styled like the settings tabs) */}
      <div className="fixed top-4 left-4 z-10">
        <Tabs value={layoutMode} onValueChange={(v) => changeLayoutMode(v as 'grid' | 'detailed')}>
          <TabsList>
            <TabsTrigger value="grid" aria-label="Grid view" title="Grid view">
              <LayoutGrid className="h-5 w-5" />
            </TabsTrigger>
            <TabsTrigger value="detailed" aria-label="Detailed view" title="Detailed view">
              <GalleryThumbnails className="h-5 w-5" />
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Top-right controls: settings + user avatar */}
      <div className="fixed top-4 right-4 z-10 flex items-center gap-2">
        <button
          className="p-3 bg-gray-800 text-white rounded-full shadow-lg hover:bg-gray-700 transition-colors"
          onClick={() => setShowSettings(true)}
          aria-label="Settings"
        >
          <Settings className="h-6 w-6" />
        </button>
        <button
          className="p-3 bg-gray-800 text-white rounded-full shadow-lg hover:bg-gray-700 transition-colors"
          onClick={() => isAuthenticated ? setShowProfileDialog(true) : setShowAuthDialog(true)}
          aria-label={isAuthenticated ? "User Profile" : "Login"}
        >
          {isAuthenticated ? (
            <div className="w-6 h-6 flex items-center justify-center font-semibold">
              {getUserInitial()}
            </div>
          ) : (
            <LogIn className="h-6 w-6" />
          )}
        </button>
      </div>

      <SettingsModal isOpen={showSettings} onOpenChange={setShowSettings} />
      {/* Action buttons */}
      <div className="flex justify-center mb-6 gap-4 shrink-0 flex-wrap">
        <Button
          className="bg-gradient-to-r from-indigo-200 to-blue-200 hover:from-indigo-300 hover:to-blue-300 text-black font-bold"
          onClick={() => setShowDiscoverDialog(true)}
        >
          <Globe className="mr-2 h-4 w-4" /> Discover Worlds
        </Button>

        <Button
          className="bg-gradient-to-r from-amber-200 to-yellow-200 hover:from-amber-300 hover:to-yellow-300 text-black font-bold"
          onClick={() => handleCreateNewWorld()}
        >
          <FilePlus2  className="mr-2 h-4 w-4" /> New World
        </Button>

  <Button
    className="bg-gradient-to-r from-green-200 to-emerald-200 hover:from-green-300 hover:to-emerald-300 text-black font-bold"
    onClick={() => fileInputRef.current?.click()}
  >
    <Import className="mr-2 h-4 w-4" /> Import World
  </Button>

  <Button
    className="bg-gradient-to-r from-purple-200 to-pink-200 hover:from-purple-300 hover:to-pink-300 text-black font-bold"
    onClick={() => isAuthenticated ? handleLogout() : setShowAuthDialog(true)}
  >
    {isAuthenticated ? (
      <><LogOut className="mr-2 h-4 w-4" /> Sign Out</>
    ) : (
      <><LogIn className="mr-2 h-4 w-4" /> Login</>
    )}
  </Button>

  {isAuthenticated && currentUser?.accountType === "admin" && (
          <Button
            className="bg-gradient-to-r from-purple-200 to-pink-200 hover:from-purple-300 hover:to-pink-300 text-black font-bold"
            onClick={() => setShowManageUsersDialog(true)}
          >
            <User className="mr-2 h-4 w-4" /> Manage Users
          </Button>
        )}
      </div>

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept=".json"
        className="hidden"
      />

      {/* Bounded scroll viewport (Radix ScrollArea Root is overflow-hidden) so drag-reorder
          auto-scroll stays inside this frame instead of growing the page in either axis. */}
      <ScrollArea className="flex-1 min-h-0">
        <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 ${layoutMode === 'detailed' ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}>
          {isLoadingWorlds ? (
            Array(6).fill(0).map((_, index) => (
              <div key={index} className="relative w-full h-48 rounded-lg overflow-hidden">
                <Skeleton className="w-full h-full" />
                <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 p-2">
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
              autoScroll={{
                canScroll: (el) =>
                  el !== document.scrollingElement &&
                  el !== document.body &&
                  el !== document.documentElement,
              }}
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

      <Dialog open={showWorldModal} onOpenChange={setShowWorldModal}>
        <DialogContent className={cn("h-[85vh] flex flex-col overflow-x-hidden", worldModalCollapsed ? "sm:max-w-[600px]" : "sm:max-w-[1200px]")}>
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
            {hasStatWithCode(stats) && (
              <div className="mb-4 shrink-0 p-3 bg-amber-100 dark:bg-amber-900 border border-amber-300 dark:border-amber-700 rounded-md flex items-start">
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 mr-2 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-amber-800 dark:text-amber-300 flex-grow">
                  <p className="font-medium">Warning</p>
                  <p>This world contains stats with custom code execution. Please ensure you trust the source of this world.</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="ml-2 bg-amber-200 dark:bg-amber-800 border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300 hover:bg-amber-300 dark:hover:bg-amber-700"
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
                    <h3 className="text-sm font-semibold text-gray-500">Author</h3>
                    <p>{selectedWorld?.data?.worldOverview?.author || "Unknown"}</p>
                  </div>

                  {/* Origin date, dynamic by how the world arrived: downloaded > imported > created.
                      Default worlds were none of these, so they show a dash. */}
                  {(() => {
                    const id: string = selectedWorld?.id ?? '';
                    const isDefault = defaultWorlds.some(dw => dw.id === id);
                    const isImported = id.startsWith('uploaded-');
                    const label = selectedWorld?.downloadedAt ? "Downloaded" : isImported ? "Imported" : "Created";
                    const value = isDefault ? undefined : (selectedWorld?.downloadedAt ?? selectedWorld?.createdAt);
                    return (
                      <div>
                        <h3 className="text-sm font-semibold text-gray-500">{label}</h3>
                        <p><DateTimeText value={value} /></p>
                      </div>
                    );
                  })()}

                  <div>
                    <h3 className="text-sm font-semibold text-gray-500">Edited</h3>
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
                        onStartGame(selectedTraits, currentWorldData.worldOverview?.use3DModel ? defaultCharacterData : null, true);
                      }}
                    >
                      Skip Customize
                    </Button>
                  </div>

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

                  <Button
                    className="w-full bg-gradient-to-r from-purple-100 to-purple-200 hover:from-purple-200 hover:to-purple-300 text-black font-bold"
                    onClick={() => handleDuplicateWorld()}
                  >
                    <FilePlus2 className="mr-2 h-4 w-4" /> Duplicate World
                  </Button>

                  {isAuthenticated && (
                    <Button
                      className="w-full bg-gradient-to-r from-red-100 to-red-200 hover:from-purple-200 hover:to-indigo-300 text-black font-bold"
                      onClick={() => setShowPublishModal(true)}
                    >
                      <Upload className="mr-2 h-4 w-4" /> Publish World
                    </Button>
                  )}
                </div>
              }
            />
          </div>
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

      <Dialog open={showCodeModal} onOpenChange={setShowCodeModal}>
        <DialogContent className="sm:max-w-[500px] h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Custom Code Execution</DialogTitle>
          </DialogHeader>

          <div className="mt-4">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              This world contains the following custom code in its stats:
            </p>

            <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-md overflow-auto">
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
          traitGroups={traitGroups}
          stats={stats}
          selectedTraits={selectedTraits}
          onTraitSelect={handleTraitSelection}
          onAbort={() => {
            setShowTraitSelection(false);
            setSelectedTraits([]);
          }}
          onConfirm={() => proceedFromTraits(selectedTraits)}
        />
      )}

      {/* Auth Dialog */}
      <Dialog open={showAuthDialog} onOpenChange={(open) => {
        setShowAuthDialog(open);
        if (!open) resetAuthForms();
      }}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{authMode === 'login' ? 'Login' : 'Register'}</DialogTitle>
            <DialogDescription>
              {authMode === 'login'
                ? 'Enter your credentials to access your account.'
                : 'Create a new account to save and share your worlds.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {authError && (
              <div className="text-sm text-red-500 p-2 bg-red-50 dark:bg-red-900/20 rounded-md">
                {authError}
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="username" className="text-sm font-medium">Username</label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium">Password</label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
              />
            </div>

            {authMode === 'register' && (
              <div className="space-y-2">
                <label htmlFor="confirmPassword" className="text-sm font-medium">Confirm Password</label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm your password"
                />
              </div>
            )}
          </div>

          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
              className="sm:order-1"
            >
              {authMode === 'login' ? 'Create Account' : 'Back to Login'}
            </Button>

            <Button
              onClick={authMode === 'login' ? handleLogin : handleRegister}
              className="sm:order-2"
            >
              {authMode === 'login' ? 'Login' : 'Register'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Profile Dialog */}
      <Dialog open={showProfileDialog} onOpenChange={(open) => {
        setShowProfileDialog(open);
        if (!open) resetAuthForms();
      }}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>User Profile</DialogTitle>
          </DialogHeader>

          <div className="py-4">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center text-white text-2xl font-bold">
                {getUserInitial()}
              </div>
              <div>
                <h3 className="text-lg font-semibold">
                  {currentUser?.username || 'User'}
                </h3>
                <p className="text-sm text-gray-500">Member since {new Date(currentUser?.createdAt || Date.now()).toLocaleDateString()}</p>
              </div>
            </div>

            {currentUser?.status === "suspended" && (
              <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-md flex items-start">
                <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 mr-2 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-red-800 dark:text-red-300">
                  <p className="font-medium">Account Suspended</p>
                  <p>Your account has been suspended. Please contact an administrator for assistance.</p>
                </div>
              </div>
            )}

            <div className="space-y-4 border-t pt-4">
              <h4 className="font-medium flex items-center gap-2">
                <Key className="h-4 w-4" /> Change Password
              </h4>

              {authError && (
                <div className="text-sm text-red-500 p-2 bg-red-50 dark:bg-red-900/20 rounded-md">
                  {authError}
                </div>
              )}

              <div className="space-y-2">
                <label htmlFor="currentPassword" className="text-sm font-medium">Current Password</label>
                <Input
                  id="currentPassword"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="newPassword" className="text-sm font-medium">New Password</label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                />
              </div>

              <Button onClick={handleChangePassword} className="w-full">
                Update Password
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button variant="destructive" onClick={handleLogout} className="w-full">
              <LogOut className="mr-2 h-4 w-4" /> Logout
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Publish Modal */}
      <Dialog open={showPublishModal} onOpenChange={setShowPublishModal}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Publish World</DialogTitle>
            <DialogDescription>
              Publish your world to share it with other players.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            {publishError && (
              <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-md text-sm text-red-800 dark:text-red-300">
                {publishError}
              </div>
            )}

            <div className="space-y-4">
              <h3 className="text-sm font-medium">Select Publish Option</h3>

              <RadioGroup value={selectedWorldToOverride ?? undefined} onValueChange={setSelectedWorldToOverride}>
                {/* Publish as new option */}
                <div className="flex items-start space-x-2 p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800">
                  <RadioGroupItem value="new" id="publish-new" />
                  <div className="grid gap-1">
                    <Label htmlFor="publish-new">Publish as new world</Label>
                  </div>
                </div>

                {/* Existing worlds */}
                {userWorlds.length > 0 && (
                  <>
                    <div className="mt-4 mb-2">
                      <h4 className="text-sm font-medium">Or update existing world:</h4>
                    </div>

                    {userWorlds.map(world => {
                      // Get the ID (server uses _id)
                      const worldId = world._id || world.id;

                      // Create a unique ID for the radio item
                      const radioId = `world-${worldId}`;

                      // Extract the first 5 characters of the ID for display
                      const shortId = worldId ? worldId.substring(0, 5) : '';

                      // Get download count
                      const downloads = world.downloads || 0;

                      return (
                        <div key={worldId} className="flex items-start space-x-2 p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800">
                          <RadioGroupItem value={worldId} id={radioId} />
                          <div className="grid gap-1">
                            <Label htmlFor={radioId}>
                              {world.name} ({shortId}, {downloads} downloads)
                            </Label>
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}
              </RadioGroup>
            </div>
          </div>

          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setShowPublishModal(false)} disabled={isPublishing}>
              Cancel
            </Button>

            <Button
              onClick={selectedWorldToOverride === 'new' ? handlePublishAsNew : handleOverrideWorld}
              disabled={isPublishing}
            >
              {isPublishing ? 'Publishing...' : 'Publish'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* World browser — see DiscoverWorlds.tsx */}
      <DiscoverWorlds
        open={showDiscoverDialog}
        onOpenChange={setShowDiscoverDialog}
        worlds={worlds}
        setWorlds={setWorlds}
        isAuthenticated={isAuthenticated}
        currentUser={currentUser}
        openImageViewer={openImageViewer}
      />

      {/* Full-size pan/zoom image viewer for the selected world */}
      <ImageZoomViewer
        open={imageViewerOpen}
        onOpenChange={setImageViewerOpen}
        alt={viewerImage.alt}
        src={viewerImage.src}
      />

      {/* Manage Users Dialog */}
      <Dialog open={showManageUsersDialog} onOpenChange={setShowManageUsersDialog}>
        <DialogContent className="sm:max-w-[800px] h-[85vh] overflow-y-auto flex flex-col items-start">
          <DialogHeader>
            <DialogTitle>Manage Users</DialogTitle>
            <DialogDescription>
              View and manage user accounts.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 w-full">
            {/* Search controls */}
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div className="relative flex-grow">
                <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search users..."
                  className="pl-8"
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      setUserCurrentPage(1);
                      fetchUsers();
                    }
                  }}
                />
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setUserCurrentPage(1);
                  fetchUsers();
                }}
              >
                Search
              </Button>
            </div>

            {/* Users table */}
            <div className="w-full overflow-hidden border rounded-lg">
              <table className="w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Username
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Email
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Account Type
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Status
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                  {isLoadingUsers ? (
                    Array(5).fill(0).map((_, index) => (
                      <tr key={index}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Skeleton className="h-4 w-24" />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Skeleton className="h-4 w-32" />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Skeleton className="h-4 w-16" />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Skeleton className="h-4 w-20" />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Skeleton className="h-8 w-20" />
                        </td>
                      </tr>
                    ))
                  ) : users.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                        No users found.
                      </td>
                    </tr>
                  ) : (
                    users.map((user) => {
                      // Get the user ID (server uses _id)
                      const userId = user._id || user.id;

                      // Determine status badge color
                      let statusBadgeClass = "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
                      if (user.status === "suspended") {
                        statusBadgeClass = "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
                      } else if (user.status === "pending") {
                        statusBadgeClass = "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300";
                      }

                      return (
                        <tr key={userId}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                              {user.username}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              {user.email || "N/A"}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              {user.accountType || "user"}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusBadgeClass}`}>
                              {user.status || "active"}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <div className="flex gap-2">
                              {user.status !== "normal" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300"
                                  onClick={() => handleUserStatusChange(userId, "normal")}
                                >
                                  Activate
                                </Button>
                              )}

                              {user.status !== "suspended" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                                  onClick={() => handleUserStatusChange(userId, "suspended")}
                                >
                                  Suspend
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {!isLoadingUsers && users.length > 0 && (
              <div className="flex justify-center gap-2 mt-6">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const newPage = Math.max(userCurrentPage - 1, 1);
                    setUserCurrentPage(newPage);
                  }}
                  disabled={userCurrentPage <= 1}
                >
                  Previous
                </Button>

                <span className="px-4 py-2 text-sm">
                  Page {userCurrentPage} of {userTotalPages}
                </span>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const newPage = Math.min(userCurrentPage + 1, userTotalPages);
                    setUserCurrentPage(newPage);
                  }}
                  disabled={userCurrentPage >= userTotalPages}
                >
                  Next
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

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
