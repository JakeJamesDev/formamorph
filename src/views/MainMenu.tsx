import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useGameData } from '../contexts/GameDataContext';
import { toast, ToastContainer  } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { Button } from "@/components/ui/button";
import {ConfirmDialog} from "@/components/ConfirmDialog";
import {RadioGroup,RadioGroupItem } from"@/components/ui/radio-group";
import {Label} from "@/components/ui/label"
import {FilePlus2, DoorOpen, Pencil, Github, AlertTriangle, Code, User, LogIn, LogOut, Key, Upload, Import, Search, Globe, EyeOff, RotateCcw, Settings, ArrowDownWideNarrow, ArrowUpNarrowWide, ArrowLeft, Check, X } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Textarea } from "@/components/ui/textarea";
import { CachedThumbnail } from "@/lib/useCachedThumbnail";
import { toEpoch } from "@/lib/thumbnailCache";
import { getCatalog, replaceCatalog } from "@/lib/worldCatalog";
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
import type { World } from '@/types';

const defaultWorlds = [
  { id: 'rampage', defaultName: 'Giantess Rampage' },
  { id: 'valentines', defaultName: 'Valentines Survival' },
  { id: 'drone', defaultName: 'Reincarnated Drone' }
];

// Normalize a tag for hide-matching: lowercase, strip non-standard symbols (keep letters,
// numbers, spaces, hyphens), collapse whitespace, and trim. Returns '' for junk-only input.
const sanitizeTag = (tag: string): string =>
  String(tag ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

// User-defined world ordering is a UI preference, persisted as an ordered list of ids.
const WORLD_ORDER_KEY = 'FORMAMORPH_worldOrder';
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
function SortableWorldCard({ world, onSelect, onDelete }: {
  world: { id: string; name: string; thumbnail?: string };
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: world.id });
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
          onClick={(e) => {
            e.stopPropagation();
            onDelete(world.id);
          }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        </button>
      </div>
    </div>
  );
}

const MainMenu = ({ onStartGame, onOpenWorldEditor }) => {
  const { traits, stats, loadWorldData } = useGameData();
  const [selectedWorld, setSelectedWorld] = useState(null);
  const [showWorldModal, setShowWorldModal] = useState(false);
  const [showMobileWorldEditorWarning, setShowMobileWorldEditorWarning] = useState(false);
  const [worldToDelete, setWorldToDelete] = useState(null);
  const [showCharacterCustomization, setShowCharacterCustomization] = useState(false);
  const [showTraitSelection, setShowTraitSelection] = useState(false);
  const [selectedTraits, setSelectedTraits] = useState([]);
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const fileInputRef = useRef(null);
  const [worlds, setWorlds] = useState([]);
  const [isLoadingWorlds, setIsLoadingWorlds] = useState(true);
  
  // Authentication states
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
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
  const [userWorlds, setUserWorlds] = useState([]);
  const [selectedWorldToOverride, setSelectedWorldToOverride] = useState(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishError, setPublishError] = useState('');
  
  // Discover dialog states
  const [showDiscoverDialog, setShowDiscoverDialog] = useState(false);
  const [remoteWorlds, setRemoteWorlds] = useState([]);
  const [isLoadingRemoteWorlds, setIsLoadingRemoteWorlds] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [searchByAuthor, setSearchByAuthor] = useState(false);
  const [sortField, setSortField] = useState('updated_at'); // updated_at | created_at | downloads
  const [sortOrder, setSortOrder] = useState('desc'); // asc | desc
  const [currentPage, setCurrentPage] = useState(1);
  const [isSyncingCatalog, setIsSyncingCatalog] = useState(false);
  const [remoteWorldToDelete, setRemoteWorldToDelete] = useState(null);
  const [selectedRemoteWorld, setSelectedRemoteWorld] = useState(null);
  const [showRemoteWorldDetailsModal, setShowRemoteWorldDetailsModal] = useState(false);
  const [downloadedIds, setDownloadedIds] = useState(() => new Set<string>());

  // Comments for the world detail modal
  const [comments, setComments] = useState([]);
  const [commentsTotal, setCommentsTotal] = useState(0);
  const [commentsPage, setCommentsPage] = useState(1);
  const [commentsHasMore, setCommentsHasMore] = useState(false);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [postingComment, setPostingComment] = useState(false);

  // Discover hide preferences (client-side, persisted in localStorage)
  const [hiddenWorldIds, setHiddenWorldIds] = useState(() => {
    try { return JSON.parse(localStorage.getItem('FORMAMORPH_hiddenWorldIds') || '[]'); }
    catch { return []; }
  });
  const [hiddenTags, setHiddenTags] = useState<string[]>(() => {
    try {
      const raw = JSON.parse(localStorage.getItem('FORMAMORPH_hiddenTags') || '[]');
      // Sanitize + dedupe on load so legacy entries match current tags.
      return Array.from(new Set((Array.isArray(raw) ? raw : []).map(sanitizeTag).filter(Boolean)));
    } catch { return []; }
  });

  // Manage users dialog states
  const [showManageUsersDialog, setShowManageUsersDialog] = useState(false);
  const [users, setUsers] = useState([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userCurrentPage, setUserCurrentPage] = useState(1);
  const [userTotalPages, setUserTotalPages] = useState(1);

  // Check authentication status on component mount
  useEffect(() => {
    const checkAuth = async () => {
      const isLoggedIn = AuthService.isAuthenticated();
      console.log('Is logged in:', isLoggedIn);
      setIsAuthenticated(isLoggedIn);
      
      if (isLoggedIn) {
        const user = AuthService.getCurrentUser();
        console.log('Current user from AuthService:', user);
        
        // If we have a user object but no username, create one with the username from the login form
        if (user && !user.username && username) {
          user.username = username;
        }
        
        setCurrentUser(user);
        
        // Refresh user profile
        try {
          const refreshedUser = await AuthService.fetchUserProfile();
          console.log('Refreshed user profile:', refreshedUser);
          
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
          
          // If we failed to refresh but have a user with username, keep using it
          if (user && user.username) {
            console.log('Using existing user data:', user);
          }
        }
      }
    };
    
    checkAuth();
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
  const hasStatWithCode = (statsArray) => {
    return statsArray.some(stat => stat.code && stat.code.trim() !== '');
  };

  // Get all stats with code
  const getStatsWithCode = (statsArray) => {
    return statsArray.filter(stat => stat.code && stat.code.trim() !== '');
  };

  // Generate concatenated code from all stats with code
  const generateConcatenatedCode = (statsArray) => {
    const statsWithCode = getStatsWithCode(statsArray);
    
    return statsWithCode.map(stat => (
      `# ${stat.name || 'Unnamed Stat'}\n${stat.code}`
    )).join('\n\n----\n\n');
  };

  const handleWorldSelection = async (worldId) => {
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

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const parsedWorldData = JSON.parse(e.target.result as string);
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
  
  const handleDuplicateWorld = async () => {
    try {
      if (!selectedWorld) {
        toast.error('No world selected to duplicate');
        return;
      }

      // Get the current world data
      const worldToDuplicate = selectedWorld.data;
      
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
      const blankWorld = {
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
      setAuthError(error.message || 'Login failed');
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
      setAuthError(error.message || 'Registration failed');
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
      setAuthError(error.message || 'Failed to change password');
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
      const worldToPublish = selectedWorld.data;
      
      // Ensure tags are included in the world data
      if (!worldToPublish.worldOverview.tags) {
        worldToPublish.worldOverview.tags = [];
      }
      
      // Publish the world
      const publishedWorld = await WorldStorageService.publishWorld(worldToPublish);
      console.log('Published world:', publishedWorld);
      
      // Update the user worlds list directly
      const updatedWorlds = await WorldStorageService.getUserWorlds();
      console.log('Updated user worlds after publish:', updatedWorlds);
      setUserWorlds(updatedWorlds);
      
      // Close the modal and show success message
      setShowPublishModal(false);
      toast.success('World published successfully!');
    } catch (error) {
      setPublishError(error.message || 'Failed to publish world');
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
      const worldToPublish = selectedWorld.data;
      
      // Ensure tags are included in the world data
      if (!worldToPublish.worldOverview.tags) {
        worldToPublish.worldOverview.tags = [];
      }
      
      // Update the existing world
      const updatedWorld = await WorldStorageService.publishWorld(worldToPublish, selectedWorldToOverride);
      console.log('Updated world:', updatedWorld);
      
      // Update the user worlds list directly
      const updatedWorlds = await WorldStorageService.getUserWorlds();
      console.log('Updated user worlds after override:', updatedWorlds);
      setUserWorlds(updatedWorlds);
      
      // Close the modal and show success message
      setShowPublishModal(false);
      toast.success('World updated successfully!');
    } catch (error) {
      setPublishError(error.message || 'Failed to update world');
    } finally {
      setIsPublishing(false);
    }
  };
  
  // Load user worlds when publish modal is opened
  useEffect(() => {
    if (showPublishModal) {
      fetchUserWorlds();
    }
  }, [showPublishModal, isAuthenticated]);
  
  // Debounced search query
  // Load the world catalog when Discover opens: render the cached copy instantly, then refresh
  // the whole catalog from the server in the background (one request) and re-cache it.
  useEffect(() => {
    if (showDiscoverDialog) {
      loadCatalog();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showDiscoverDialog]);

  // Fetch users when manage users dialog is opened or search/page changes
  useEffect(() => {
    if (showManageUsersDialog) {
      fetchUsers();
    }
  }, [showManageUsersDialog, userCurrentPage]);

  const loadCatalog = async (force = false) => {
    try {
      const cached = await getCatalog();
      if (cached.length && !force) {
        setRemoteWorlds(cached);
      } else {
        setIsLoadingRemoteWorlds(true);
      }
      setIsSyncingCatalog(true);
      // One request returns the entire catalog; replace the cache wholesale (also drops removed worlds).
      const result = await WorldStorageService.fetchRemoteWorlds(1, 1000, '', false, false);
      if (result.success && Array.isArray(result.data)) {
        setRemoteWorlds(result.data);
        await replaceCatalog(result.data);
      } else if (!cached.length) {
        toast.error(result.error || 'Failed to fetch worlds');
      }
    } catch (error) {
      console.error('Error loading world catalog:', error);
    } finally {
      setIsLoadingRemoteWorlds(false);
      setIsSyncingCatalog(false);
    }
  };
  
  // Persist discover hide preferences
  useEffect(() => {
    localStorage.setItem('FORMAMORPH_hiddenWorldIds', JSON.stringify(hiddenWorldIds));
  }, [hiddenWorldIds]);
  useEffect(() => {
    localStorage.setItem('FORMAMORPH_hiddenTags', JSON.stringify(hiddenTags));
  }, [hiddenTags]);

  const hideRemoteWorld = (worldId) => {
    setHiddenWorldIds((prev) => (prev.includes(worldId) ? prev : [...prev, worldId]));
  };
  const hideRemoteTag = (tag) => {
    const t = sanitizeTag(tag);
    if (!t) return;
    setHiddenTags((prev) => (prev.includes(t) ? prev : [...prev, t]));
  };
  const resetHiddenWorlds = () => {
    setHiddenWorldIds([]);
    setHiddenTags([]);
  };
  const unhideWorld = (id) => setHiddenWorldIds((prev) => prev.filter((w) => w !== id));
  const unhideTag = (tag) => setHiddenTags((prev) => prev.filter((t) => t !== tag));
  // Resolve a hidden world id to its name from the catalog (falls back to a short id).
  const hiddenWorldName = (id: string) =>
    remoteWorlds.find((w) => (w._id || w.id) === id)?.name || `${id.slice(0, 8)}…`;

  // Client-side browse pipeline over the cached catalog: hide filters → text search → sort.
  const PAGE_SIZE = 12;
  const filteredRemoteWorlds = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = remoteWorlds.filter((world) => {
      const id = world._id || world.id;
      if (hiddenWorldIds.includes(id)) return false;
      if ((world.tags || []).some((t) => hiddenTags.includes(sanitizeTag(t)))) return false;
      if (q) {
        const hay = searchByAuthor
          ? (world.author?.username || '')
          : `${world.name || ''} ${world.description || ''}`;
        if (!hay.toLowerCase().includes(q)) return false;
      }
      return true;
    });
    const dir = sortOrder === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => {
      const av = sortField === 'downloads' ? (a.downloads || 0) : toEpoch(a[sortField]);
      const bv = sortField === 'downloads' ? (b.downloads || 0) : toEpoch(b[sortField]);
      return (av - bv) * dir;
    });
  }, [remoteWorlds, searchQuery, searchByAuthor, hiddenWorldIds, hiddenTags, sortField, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(filteredRemoteWorlds.length / PAGE_SIZE));
  const pagedRemoteWorlds = filteredRemoteWorlds.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // Reset to page 1 when the result set changes; clamp if hiding shrinks it below the current page.
  useEffect(() => { setCurrentPage(1); }, [searchQuery, searchByAuthor, sortField, sortOrder]);
  useEffect(() => { if (currentPage > totalPages) setCurrentPage(totalPages); }, [currentPage, totalPages]);

  // Numbered page links with first/last anchors + ellipsis (matches the in-game transcript pager).
  const renderDiscoverPaginationItems = () => {
    const items = [];
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
        items.push(
          <PaginationItem key={i}>
            <PaginationLink
              href="#"
              onClick={(e) => { e.preventDefault(); setCurrentPage(i); }}
              isActive={currentPage === i}
            >
              {i}
            </PaginationLink>
          </PaginationItem>,
        );
      } else if (i === currentPage - 2 || i === currentPage + 2) {
        items.push(
          <PaginationItem key={i}>
            <PaginationEllipsis />
          </PaginationItem>,
        );
      }
    }
    return items;
  };

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
      toast.error(error.message || 'Failed to connect to server');
      setUsers([]);
    } finally {
      setIsLoadingUsers(false);
    }
  };
  
  // Handle user status change
  const handleUserStatusChange = async (userId, newStatus) => {
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
      toast.error(error.message || `Failed to ${newStatus === "normal" ? "activate" : "suspend"} user`);
    }
  };
  
  // Handle remote world deletion
  const handleRemoteWorldDelete = async (worldId) => {
    try {
      // Call API to delete the world
      const response = await fetch(`${WorldStorageService.API_URL}/worlds/${worldId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${AuthService.token}`
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete world');
      }
      
      // Remove the world from the list
      setRemoteWorlds(prev => prev.filter(w => (w._id || w.id) !== worldId));
      setRemoteWorldToDelete(null);
      toast.success('World deleted successfully');
    } catch (error) {
      console.error('Error deleting remote world:', error);
      toast.error(error.message || 'Failed to delete world');
    }
  };
  
  // Handle viewing remote world details
  const handleViewRemoteWorldDetails = (world) => {
    setSelectedRemoteWorld(world);
    setShowRemoteWorldDetailsModal(true);
  };
  
  // Handle downloading a remote world
  const handleDownloadWorld = async (world) => {
    try {
      // Get the world ID
      const worldId = world._id || world.id;
      
      // Fetch the world content
      const response = await fetch(`${WorldStorageService.API_URL}/worlds/${worldId}/content`, {
        headers: AuthService.isAuthenticated() ? {
          'Authorization': `Bearer ${AuthService.token}`
        } : {}
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to download world');
      }
      
      const worldData = await response.json();
      
      if (!worldData.success || !worldData.data) {
        throw new Error('Invalid world data received');
      }
      
      // Generate a unique ID for the downloaded world
      const localWorldId = `downloaded-${Date.now()}`;
      
      // Determine the thumbnail URL
      let thumbnailUrl = '';
      if (world.thumbnail_file) {
        thumbnailUrl = `${WorldStorageService.API_URL}/thumbnails/${world.thumbnail_file}`;
      } else if (world.thumbnail) {
        thumbnailUrl = world.thumbnail;
      }
      
      // Store the world locally
      await WorldStorageService.storeWorld({
        id: localWorldId,
        name: world.name || 'Downloaded World',
        description: world.description || 'Downloaded from server',
        thumbnail: thumbnailUrl,
        author: world.author?.username || '',
        data: worldData.data.contentData
      });
      
      // Add the world to the local list
      setWorlds(prev => [...prev, {
        id: localWorldId,
        name: world.name || 'Downloaded World',
        description: world.description || 'Downloaded from server',
        thumbnail: thumbnailUrl,
        author: world.author?.username || '',
        isLoading: false
      }]);
      
      toast.success('World downloaded successfully');
      // Keep the browser open; mark this world as downloaded for button feedback.
      setDownloadedIds((prev) => new Set(prev).add(world._id || world.id));
    } catch (error) {
      console.error('Error downloading world:', error);
      toast.error(error.message || 'Failed to download world');
    }
  };

  // Load comments for the world detail modal (page 1 resets, higher pages append).
  const loadComments = async (worldId: string, page = 1) => {
    setCommentsLoading(true);
    try {
      const res = await WorldStorageService.fetchComments(worldId, page, 20);
      setCommentsTotal(res.total);
      setCommentsHasMore(!!res.pagination?.next);
      setCommentsPage(page);
      setComments((prev) => (page === 1 ? res.data : [...prev, ...res.data]));
    } finally {
      setCommentsLoading(false);
    }
  };

  const handlePostComment = async () => {
    if (!selectedRemoteWorld || !commentText.trim()) return;
    setPostingComment(true);
    try {
      const created = await WorldStorageService.postComment(
        selectedRemoteWorld._id || selectedRemoteWorld.id,
        commentText.trim(),
      );
      setComments((prev) => [created, ...prev]);
      setCommentsTotal((n) => n + 1);
      setCommentText('');
    } catch (error) {
      toast.error(error.message || 'Failed to post comment');
    } finally {
      setPostingComment(false);
    }
  };

  // Fetch comments whenever the detail modal opens for a world.
  useEffect(() => {
    if (showRemoteWorldDetailsModal && selectedRemoteWorld) {
      setComments([]);
      setCommentText('');
      loadComments(selectedRemoteWorld._id || selectedRemoteWorld.id, 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showRemoteWorldDetailsModal, selectedRemoteWorld?._id, selectedRemoteWorld?.id]);
  
  // Get user initial for the avatar button
  const getUserInitial = () => {
    if (!currentUser) return 'U';
    
    // Handle different possible user object structures
    if (typeof currentUser === 'string') {
      return currentUser.charAt(0).toUpperCase();
    }
    
    if (currentUser.username) {
      return currentUser.username.charAt(0).toUpperCase();
    }
    
    if (currentUser.name) {
      return currentUser.name.charAt(0).toUpperCase();
    }
    
    // If we can't find a username property, log the object and return a default
    console.log('Could not find username in user object:', currentUser);
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
        <DialogContent className="sm:max-w-[500px] h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedWorld?.name}</DialogTitle>
          </DialogHeader>
          
          <div className="mt-4">
            {hasStatWithCode(stats) && (
              <div className="mb-4 p-3 bg-amber-100 dark:bg-amber-900 border border-amber-300 dark:border-amber-700 rounded-md flex items-start">
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
                <div className="flex">
                  <Button
                    className="w-2/3 bg-gradient-to-r from-sky-200 to-cyan-200 hover:from-sky-300 hover:to-cyan-300 text-black font-bold rounded-r-none"
                    onClick={() => {
                      setShowWorldModal(false);
                      setShowTraitSelection(true);
                    }}
                  >
                    <DoorOpen className="mr-2 h-4 w-4" /> Enter World
                  </Button>
                  
                  <Button
                    className="w-1/3 bg-gradient-to-r from-amber-100 to-yellow-100 hover:from-amber-200 hover:to-yellow-200 text-black font-bold rounded-l-none"
                    onClick={() => {
                      // For uploaded worlds, use the worldData from context
                      const currentWorldData = selectedWorld.data;
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
            </div>
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
            await WorldStorageService.deleteWorld(worldToDelete);
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
            const currentWorldData = selectedWorld.data;
            if (currentWorldData.worldOverview?.use3DModel) {
              setShowCharacterCustomization(true);
            } else {
              onStartGame(selectedTraits, null, true);
            }
          }}
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
              
              <RadioGroup value={selectedWorldToOverride} onValueChange={setSelectedWorldToOverride}>
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

      {/* Discover Dialog */}
      <Dialog open={showDiscoverDialog} onOpenChange={setShowDiscoverDialog}>
        <DialogContent
          hideClose
          className="max-w-none w-screen h-screen sm:max-w-none left-0 top-0 translate-x-0 translate-y-0 rounded-none sm:rounded-none p-0 gap-0 flex flex-col data-[state=open]:!slide-in-from-top-0 data-[state=open]:!slide-in-from-left-0 data-[state=closed]:!slide-out-to-top-0 data-[state=closed]:!slide-out-to-left-0"
        >
          {/* Frozen header: back button + title + search/filter controls on one row */}
          <div className="shrink-0 border-b px-6 py-4 space-y-4">
            <div className="flex flex-wrap items-center gap-2 sm:gap-4">
              <Button variant="ghost" size="icon" className="shrink-0" onClick={() => setShowDiscoverDialog(false)} aria-label="Back">
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <DialogTitle className="whitespace-nowrap mr-2">Discover Worlds</DialogTitle>
              <div className="relative flex-grow min-w-[200px]">
                <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search worlds..."
                  className="pl-8"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="search-by-author"
                    checked={searchByAuthor}
                    onChange={(e) => {
                      setSearchByAuthor(e.target.checked);
                      setCurrentPage(1);
                    }}
                    className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <label htmlFor="search-by-author" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Search by author
                  </label>
                </div>

                {/* Sort controls */}
                <div className="flex items-center gap-1">
                  <Select
                    value={sortField}
                    onValueChange={(v) => { setSortField(v); setCurrentPage(1); }}
                  >
                    <SelectTrigger className="w-[160px] h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="updated_at">Last Updated</SelectItem>
                      <SelectItem value="created_at">Creation Date</SelectItem>
                      <SelectItem value="downloads">Downloads</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 shrink-0"
                    title={sortOrder === 'desc' ? 'Descending' : 'Ascending'}
                    onClick={() => { setSortOrder((o) => (o === 'desc' ? 'asc' : 'desc')); setCurrentPage(1); }}
                  >
                    {sortOrder === 'desc' ? <ArrowDownWideNarrow className="h-4 w-4" /> : <ArrowUpNarrowWide className="h-4 w-4" />}
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 shrink-0"
                    title="Refresh catalog"
                    disabled={isSyncingCatalog}
                    onClick={() => loadCatalog(true)}
                  >
                    <RotateCcw className={`h-4 w-4 ${isSyncingCatalog ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
              </div>
            </div>
            
            {/* Hidden worlds/tags — removable chips */}
            {(hiddenWorldIds.length > 0 || hiddenTags.length > 0) && (
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="text-gray-500">Hidden:</span>
                {hiddenWorldIds.map((id) => (
                  <span key={`w-${id}`} className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-secondary-foreground">
                    {hiddenWorldName(id)}
                    <button onClick={() => unhideWorld(id)} className="hover:text-destructive" aria-label="Unhide world" title="Unhide">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                {hiddenTags.map((tag) => (
                  <span key={`t-${tag}`} className="inline-flex items-center gap-1 rounded-full bg-blue-100 dark:bg-blue-900 px-2 py-0.5 text-blue-800 dark:text-blue-300">
                    #{tag}
                    <button onClick={() => unhideTag(tag)} className="hover:text-destructive" aria-label="Unhide tag" title="Unhide">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                <Button variant="ghost" size="sm" className="h-6 px-2" onClick={resetHiddenWorlds}>
                  <RotateCcw className="h-3 w-3 mr-1" /> Reset all
                </Button>
              </div>
            )}
          </div>

          {/* Scrollable results */}
          <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4">
            {/* World grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {isLoadingRemoteWorlds ? (
                Array(4).fill(0).map((_, index) => (
                  <div key={index} className="w-full h-48">
                    <Skeleton className="w-full h-full" />
                    <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 p-2">
                      <Skeleton className="h-6 w-24" />
                    </div>
                  </div>
                ))
              ) : filteredRemoteWorlds.length === 0 ? (
                <div className="col-span-2 text-center py-12 text-gray-500">
                  {searchQuery ?
                    "No worlds found matching your criteria." :
                    "No worlds available. Be the first to publish one!"}
                </div>
              ) : (
                pagedRemoteWorlds.map((world) => {
                  // Get the world ID (server uses _id)
                  const worldId = world._id || world.id;
                  
                  // Check if the world is owned by the current user
                  const isOwnedByUser = isAuthenticated && 
                    world.author && 
                    currentUser && 
                    (world.author.id === currentUser.id || 
                     world.author.username === currentUser.username);
                  
                  return (
                    <div
                      key={worldId}
                      className="relative rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 cursor-pointer"
                      onClick={() => handleViewRemoteWorldDetails(world)}
                    >
                      <button
                        onClick={(e) => { e.stopPropagation(); hideRemoteWorld(worldId); }}
                        className="absolute top-1 right-1 z-10 p-1 rounded bg-black/50 text-white hover:bg-black/70"
                        title="Hide this world"
                      >
                        <EyeOff className="h-4 w-4" />
                      </button>
                      <div className="h-32 bg-gray-100 dark:bg-gray-800">
                        {world.thumbnail_file ? (
                          <CachedThumbnail
                            file={world.thumbnail_file}
                            url={`${WorldStorageService.API_URL}/thumbnails/${world.thumbnail_file}`}
                            updatedAt={world.updated_at}
                            alt={world.name}
                            className="w-full h-full object-cover"
                          />
                        ) : world.thumbnail ? (
                          <img
                            src={world.thumbnail}
                            alt={world.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-400">
                            <Globe className="h-12 w-12" />
                          </div>
                        )}
                      </div>
                      
                      <div className="p-4">
                        <h3 className="font-semibold text-lg mb-1">{world.name}</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2 line-clamp-2">
                          {world.description || "No description available."}
                        </p>
                        
                        <div className="flex items-center text-xs text-gray-500 mb-2">
                          <span>By {world.author?.username || "Unknown"}</span>
                          <span className="mx-2">•</span>
                          <span>{world.downloads || 0} downloads</span>
                        </div>
                        
                        {/* Tags */}
                        <div className="flex flex-wrap gap-1 mb-2">
                          {world.tags && world.tags.length > 0 ? (
                            world.tags.map((tag, index) => (
                              <span
                                key={index}
                                onClick={(e) => { e.stopPropagation(); hideRemoteTag(tag); }}
                                title={`Hide all worlds tagged "${tag}"`}
                                className="px-1.5 py-0.5 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300 text-xs rounded-full cursor-pointer hover:line-through"
                              >
                                {tag}
                              </span>
                            ))
                          ) : (
                            <span className="text-gray-400 text-xs italic">No tags</span>
                          )}
                        </div>
                        
                        <div className="flex justify-between items-center">
                          <Button
                            size="sm"
                            onClick={() => handleDownloadWorld(world)}
                            className="bg-gradient-to-r from-sky-200 to-cyan-200 hover:from-sky-300 hover:to-cyan-300 text-black"
                          >
                            <DoorOpen className="mr-1 h-3 w-3" /> Download
                          </Button>
                          
                          {(isOwnedByUser || currentUser?.accountType === "admin") && (
                            <button
                              className="p-1 text-red-500 hover:text-red-700"
                              onClick={() => setRemoteWorldToDelete(worldId)}
                              aria-label="Delete world"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            
          </div>

          {/* Frozen footer: pagination */}
          <div className="shrink-0 border-t px-6 py-3">
            {!isLoadingRemoteWorlds && filteredRemoteWorlds.length > 0 && (
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      href="#"
                      onClick={(e) => { e.preventDefault(); if (currentPage > 1) setCurrentPage(currentPage - 1); }}
                      className={currentPage === 1 ? "pointer-events-none opacity-50" : ""}
                    />
                  </PaginationItem>
                  {renderDiscoverPaginationItems()}
                  <PaginationItem>
                    <PaginationNext
                      href="#"
                      onClick={(e) => { e.preventDefault(); if (currentPage < totalPages) setCurrentPage(currentPage + 1); }}
                      className={currentPage === totalPages ? "pointer-events-none opacity-50" : ""}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            )}
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Remote World Details Modal */}
      <Dialog open={showRemoteWorldDetailsModal} onOpenChange={setShowRemoteWorldDetailsModal}>
        <DialogContent className="sm:max-w-[1200px] h-[85vh] flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle>{selectedRemoteWorld?.name || 'World Details'}</DialogTitle>
          </DialogHeader>
          
          {selectedRemoteWorld && (
            <div className="mt-4 flex-1 min-h-0 flex flex-col md:flex-row gap-6 overflow-y-auto md:overflow-hidden">
              {/* Left column: metadata */}
              <div className="md:w-1/2 md:min-h-0 md:overflow-y-auto md:pr-1 space-y-6">
                {/* World Thumbnail */}
                <div className="relative w-full pt-[56.25%] rounded-lg overflow-hidden">
                  {selectedRemoteWorld.thumbnail_file ? (
                    <CachedThumbnail
                      file={selectedRemoteWorld.thumbnail_file}
                      url={`${WorldStorageService.API_URL}/thumbnails/${selectedRemoteWorld.thumbnail_file}`}
                      updatedAt={selectedRemoteWorld.updated_at}
                      alt={selectedRemoteWorld.name}
                      className="absolute top-0 left-0 w-full h-full object-cover"
                    />
                  ) : selectedRemoteWorld.thumbnail ? (
                    <img
                      src={selectedRemoteWorld.thumbnail}
                      alt={selectedRemoteWorld.name}
                      className="absolute top-0 left-0 w-full h-full object-cover"
                    />
                  ) : (
                    <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center bg-gray-100 dark:bg-gray-800 text-gray-400">
                      <Globe className="h-16 w-16" />
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold">Description</h3>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">
                      {selectedRemoteWorld.description || "No description available."}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h3 className="text-sm font-semibold text-gray-500">Author</h3>
                      <p>{selectedRemoteWorld.author?.username || "Unknown"}</p>
                    </div>

                    <div>
                      <h3 className="text-sm font-semibold text-gray-500">Downloads</h3>
                      <p>{selectedRemoteWorld.downloads || 0}</p>
                    </div>

                    <div>
                      <h3 className="text-sm font-semibold text-gray-500">Created</h3>
                      <p>{selectedRemoteWorld.created_at ? new Date(selectedRemoteWorld.created_at).toLocaleDateString() : "Unknown"}</p>
                    </div>

                    <div>
                      <h3 className="text-sm font-semibold text-gray-500">Updated</h3>
                      <p>{selectedRemoteWorld.updated_at ? new Date(selectedRemoteWorld.updated_at).toLocaleDateString() : "Unknown"}</p>
                    </div>
                  </div>

                  {/* Tags */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-500">Tags</h3>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {selectedRemoteWorld.tags && selectedRemoteWorld.tags.length > 0 ? (
                        selectedRemoteWorld.tags.map((tag, index) => (
                          <span
                            key={index}
                            className="px-2 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300 text-xs rounded-full"
                          >
                            {tag}
                          </span>
                        ))
                      ) : (
                        <span className="text-gray-500 text-sm">No tags</span>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="pt-4">
                    {(() => {
                      const isDownloaded = downloadedIds.has(selectedRemoteWorld._id || selectedRemoteWorld.id);
                      return (
                        <Button
                          className="w-full bg-gradient-to-r from-sky-200 to-cyan-200 hover:from-sky-300 hover:to-cyan-300 text-black font-bold"
                          onClick={() => handleDownloadWorld(selectedRemoteWorld)}
                        >
                          {isDownloaded
                            ? <><Check className="mr-2 h-4 w-4" /> Downloaded — Download again</>
                            : <><DoorOpen className="mr-2 h-4 w-4" /> Download World</>}
                        </Button>
                      );
                    })()}
                  </div>
                </div>
              </div>

              {/* Right column: comments */}
              <div className="md:w-1/2 md:min-h-0 md:overflow-y-auto border-t pt-4 md:border-t-0 md:pt-0 md:border-l md:pl-6 space-y-3">
                <h3 className="text-sm font-semibold text-gray-500">Comments ({commentsTotal})</h3>

                {isAuthenticated ? (
                  <div className="space-y-2">
                    <Textarea
                      placeholder="Leave a comment..."
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      className="min-h-[60px]"
                    />
                    <Button
                      size="sm"
                      disabled={postingComment || !commentText.trim()}
                      onClick={handlePostComment}
                    >
                      {postingComment ? 'Posting...' : 'Post Comment'}
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">Log in to leave a comment.</p>
                )}

                <div className="space-y-3">
                  {comments.map((c) => (
                    <div key={c.id} className="text-sm border-b border-border/50 pb-2 last:border-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">{c.author?.username || 'Unknown'}</span>
                        <span className="text-xs text-gray-500">
                          {c.created_at ? new Date(c.created_at).toLocaleString() : ''}
                        </span>
                      </div>
                      <p className="text-gray-600 dark:text-gray-400 whitespace-pre-wrap mt-1">{c.content}</p>
                    </div>
                  ))}
                  {comments.length === 0 && !commentsLoading && (
                    <p className="text-sm text-gray-500">No comments yet.</p>
                  )}
                  {commentsHasMore && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={commentsLoading}
                      onClick={() => loadComments(selectedRemoteWorld._id || selectedRemoteWorld.id, commentsPage + 1)}
                    >
                      {commentsLoading ? 'Loading...' : 'Load more'}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      
      {/* Confirm Delete Remote World Dialog */}
      <ConfirmDialog
        open={!!remoteWorldToDelete}
        onOpenChange={(open) => !open && setRemoteWorldToDelete(null)}
        title="Delete Published World"
        description="Are you sure you want to delete this published world? This will remove it from the server and it will no longer be available to other users. This action cannot be undone."
        onConfirm={() => handleRemoteWorldDelete(remoteWorldToDelete)}
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
