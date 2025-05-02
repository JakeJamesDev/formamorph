import React, { useState, useRef, useEffect } from 'react';
import { useGameData } from '../contexts/GameDataContext';
import { toast, ToastContainer  } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {ConfirmDialog} from "@/components/ConfirmDialog";
import {RadioGroup,RadioGroupItem } from"@/components/ui/radio-group";
import {Label} from "@/components/ui/label"
import {FilePlus2, DoorOpen, Pencil, Github, AlertTriangle, Code, User, LogIn, LogOut, Key, Upload, Search, Globe } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import CharacterCustomization, { defaultCharacterData } from './CharacterCustomization';
import TraitSelectionModal from './TraitSelectionModal';
import WorldStorageService from '../services/WorldStorageService';
import AuthService from '../services/AuthService';

const defaultWorlds = [
  { id: 'slime', defaultName: 'Slime' },
  { id: 'sugarscape', defaultName: 'Sugarscape' },
  { id: 'veilwood', defaultName: 'Veilwood' },
  { id: 'rampage', defaultName: 'Rampage' },
  { id: 'valentines', defaultName: 'Valentines Survival' },
  { id: 'drone', defaultName: 'Reincarnated Drone' }
];

const MainMenu = ({ onStartGame, onOpenWorldEditor }) => {
  const { traits, stats, loadWorldData, worldData } = useGameData();
  const [selectedWorld, setSelectedWorld] = useState(null);
  const [showWorldModal, setShowWorldModal] = useState(false);
  const [showMobileWorldEditorWarning, setShowMobileWorldEditorWarning] = useState(false);
  const [worldToDelete, setWorldToDelete] = useState(null);
  const [showCharacterCustomization, setShowCharacterCustomization] = useState(false);
  const [showTraitSelection, setShowTraitSelection] = useState(false);
  const [selectedTraits, setSelectedTraits] = useState([]);
  const [showCodeModal, setShowCodeModal] = useState(false);
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
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [remoteWorldToDelete, setRemoteWorldToDelete] = useState(null);
  const [selectedRemoteWorld, setSelectedRemoteWorld] = useState(null);
  const [showRemoteWorldDetailsModal, setShowRemoteWorldDetailsModal] = useState(false);
  
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
  
  const handleDuplicateWorld = async () => {
    try {
      if (!selectedWorld) {
        toast.error('No world selected to duplicate');
        return;
      }

      // Get the current world data
      const worldToDuplicate = selectedWorld.data || worldData;
      
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
          author: ''
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
      const worldToPublish = selectedWorld.data || worldData;
      
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
      const worldToPublish = selectedWorld.data || worldData;
      
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
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  
  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 500); // 500ms debounce delay
    
    return () => clearTimeout(timer);
  }, [searchQuery]);
  
  // Fetch remote worlds when discover dialog is opened or search/filter changes
  useEffect(() => {
    if (showDiscoverDialog) {
      fetchRemoteWorlds();
    }
  }, [showDiscoverDialog, debouncedSearchQuery, searchByAuthor, currentPage]);
  
  // Fetch users when manage users dialog is opened or search/page changes
  useEffect(() => {
    if (showManageUsersDialog) {
      fetchUsers();
    }
  }, [showManageUsersDialog, userCurrentPage]);
  
  // Fetch remote worlds from the server
  const fetchRemoteWorlds = async () => {
    if (!showDiscoverDialog) return;
    
    setIsLoadingRemoteWorlds(true);
    
    try {
      const result = await WorldStorageService.fetchRemoteWorlds(
        currentPage, 
        10, // limit
        debouncedSearchQuery,
        false, // No longer using showOwnedOnly
        searchByAuthor
      );
      
      if (result.success) {
        setRemoteWorlds(result.data);
        
        // Calculate total pages
        const total = result.total || 0;
        const pages = Math.ceil(total / 10);
        setTotalPages(pages > 0 ? pages : 1);
      } else {
        console.error('Error fetching remote worlds:', result.error);
        toast.error(result.error || 'Failed to fetch worlds');
        setRemoteWorlds([]);
      }
    } catch (error) {
      console.error('Error in fetchRemoteWorlds:', error);
      toast.error('Failed to connect to server');
      setRemoteWorlds([]);
    } finally {
      setIsLoadingRemoteWorlds(false);
    }
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
      setShowDiscoverDialog(false);
    } catch (error) {
      console.error('Error downloading world:', error);
      toast.error(error.message || 'Failed to download world');
    }
  };
  
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
      <ToastContainer theme="dark" />
      
      {/* User Avatar Button */}
      <button
        className="fixed top-4 right-4 p-3 bg-gray-800 text-white rounded-full shadow-lg hover:bg-gray-700 transition-colors z-10"
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
      {/* Action buttons */}
      <div className="flex justify-center mb-6 gap-4">
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
    <Upload className="mr-2 h-4 w-4" /> Upload World
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
          </>
        )}
      </div>

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
                      const currentWorldData = selectedWorld.data || worldData;
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
            const currentWorldData = selectedWorld.data || worldData;
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
        <DialogContent className="max-w-[95vw] sm:max-w-[95vw] h-[85vh] overflow-y-auto flex flex-col items-start">
          <DialogHeader>
            <DialogTitle>Discover Worlds</DialogTitle>
            <DialogDescription>
              Browse and download worlds created by the community.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            {/* Search and filter controls */}
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div className="relative flex-grow">
                <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search worlds..."
                  className="pl-8"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              
              <div className="flex flex-col sm:flex-row gap-2">
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
              </div>
            </div>
            
            {/* World grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 mb-6">
              {isLoadingRemoteWorlds ? (
                Array(4).fill(0).map((_, index) => (
                  <div key={index} className="w-full h-48">
                    <Skeleton className="w-full h-full" />
                    <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 p-2">
                      <Skeleton className="h-6 w-24" />
                    </div>
                  </div>
                ))
              ) : remoteWorlds.length === 0 ? (
                <div className="col-span-2 text-center py-12 text-gray-500">
                  {searchQuery ? 
                    "No worlds found matching your criteria." : 
                    "No worlds available. Be the first to publish one!"}
                </div>
              ) : (
                remoteWorlds.map((world) => {
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
                      <div className="h-32 bg-gray-100 dark:bg-gray-800">
                        {world.thumbnail_file ? (
                          <img
                            src={`${WorldStorageService.API_URL}/thumbnails/${world.thumbnail_file}`}
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
                                className="px-1.5 py-0.5 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300 text-xs rounded-full"
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
            
            {/* Pagination */}
            {!isLoadingRemoteWorlds && remoteWorlds.length > 0 && (
              <div className="flex justify-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage <= 1}
                >
                  Previous
                </Button>
                
                <span className="px-4 py-2 text-sm">
                  Page {currentPage} of {totalPages}
                </span>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage >= totalPages}
                >
                  Next
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Remote World Details Modal */}
      <Dialog open={showRemoteWorldDetailsModal} onOpenChange={setShowRemoteWorldDetailsModal}>
        <DialogContent className="sm:max-w-[600px] h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedRemoteWorld?.name || 'World Details'}</DialogTitle>
          </DialogHeader>
          
          {selectedRemoteWorld && (
            <div className="mt-4 space-y-6">
              {/* World Thumbnail */}
              <div className="relative w-full pt-[56.25%] rounded-lg overflow-hidden">
                {selectedRemoteWorld.thumbnail_file ? (
                  <img
                    src={`${WorldStorageService.API_URL}/thumbnails/${selectedRemoteWorld.thumbnail_file}`}
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
              
              {/* World Info */}
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
                  <Button
                    className="w-full bg-gradient-to-r from-sky-200 to-cyan-200 hover:from-sky-300 hover:to-cyan-300 text-black font-bold"
                    onClick={() => {
                      handleDownloadWorld(selectedRemoteWorld);
                      setShowRemoteWorldDetailsModal(false);
                    }}
                  >
                    <DoorOpen className="mr-2 h-4 w-4" /> Download World
                  </Button>
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
        message="Are you sure you want to delete this published world? This will remove it from the server and it will no longer be available to other users. This action cannot be undone."
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
                      <td colSpan="5" className="px-6 py-4 text-center text-gray-500">
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
