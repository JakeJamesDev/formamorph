import { useCallback, useEffect, useState } from 'react';
import CommunityCreationsBrowser, { type BrowserPresentation } from './CommunityCreationsBrowser';
import { ImageZoomViewer } from '@/components/ImageZoomViewer';
import { useActiveEvents } from '@/lib/useActiveEvents';
import { isContestEvent } from '@/lib/serverEvents';
import { COMMUNITY_ENABLED } from '@/lib/featureFlags';
import WorldStorageService from '@/services/WorldStorageService';
import EntityStorageService from '@/services/EntityStorageService';
import DictionaryStorageService from '@/services/DictionaryStorageService';
import AuthService from '@/services/AuthService';
import type { BrowseTab } from '@/lib/browseTabs';
import type { WorldRecord } from '@/components/WorldDetails';
import type { EntityMetadata, DictionaryMetadata, ServerEvent } from '@/types';

export interface CommunityBrowserHostProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Which shell the browser is raised in. Defaults to the app's full-screen modal. */
  presentation?: BrowserPresentation;
  /** The tab to open on — the dev-router's, or the one an event banner asked for. */
  initialTab?: BrowseTab;
  /** A listing to open the details for, arriving from somewhere else — a notification feed row. */
  openListing?: { id: string; kind: string } | null;
  /** Fired once that listing has been opened, or found to be gone, so the caller can clear its request. */
  onListingOpened?: () => void;
  /** DEV only: open the first listing's details and raise its likers list, for the dev route. */
  openLikersOnMount?: boolean;
}

/**
 * Everything the Community Creations browser needs to run, sourced from the services rather than from
 * whoever mounts it.
 *
 * The browser is the presentational half: it takes the three local libraries, the signed-in account, the
 * running events and an image viewer, and knows nothing about where they came from. This host is the
 * other half, and it is what makes the browser mountable anywhere — the app's main menu opens it as a
 * modal, and a page that is nothing but the browser opens the same component with `presentation="page"`.
 *
 * Its interface is intent, not data: open it, point it at a tab or a listing, choose a shell. Everything
 * a caller used to assemble is read here instead, so a second surface cannot drift from the first.
 *
 * The libraries are read when the browser opens rather than at mount, so a host sitting closed behind the
 * main menu costs nothing. Downloads keep the copy current from there: worlds through the download
 * coordinator's own optimistic writes, entities and dictionaries through the refreshers below.
 */
export const CommunityBrowserHost = ({
  open, onOpenChange, presentation = 'dialog', initialTab, openListing, onListingOpened,
  openLikersOnMount = false,
}: CommunityBrowserHostProps) => {
  // The three local libraries, each driving its tab's download state.
  const [worlds, setWorlds] = useState<WorldRecord[]>([]);
  const [entities, setEntities] = useState<EntityMetadata[]>([]);
  const [dictionaries, setDictionaries] = useState<DictionaryMetadata[]>([]);

  // The signed-in account, which likes, comments, publishing and the moderation controls all read.
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<WorldRecord | null>(null);

  // The shared pan/zoom viewer the details modal's thumbnails open into.
  const [imageViewerOpen, setImageViewerOpen] = useState(false);
  const [viewerImage, setViewerImage] = useState<{ src: string; alt: string }>({ src: '', alt: '' });

  // A tab the browser itself asked for, which wins over the one the caller opened on. Cleared as the
  // browser closes, so the next plain visit lands on the catalog again.
  const [eventTab, setEventTab] = useState<BrowseTab | undefined>(undefined);

  const refreshWorlds = useCallback(async () => {
    try {
      await WorldStorageService.initialize();
      const metadata = await WorldStorageService.getWorldMetadata();
      setWorlds(metadata.map((world) => ({ ...world, isLoading: false })));
    } catch (error) {
      console.error('Error loading worlds:', error);
    }
  }, []);

  const refreshEntities = useCallback(async () => {
    try {
      await EntityStorageService.initialize();
      setEntities(await EntityStorageService.getEntityMetadata());
    } catch (error) {
      console.error('Error loading characters:', error);
    }
  }, []);

  const refreshDictionaries = useCallback(async () => {
    try {
      await DictionaryStorageService.initialize();
      setDictionaries(await DictionaryStorageService.getDictionaryMetadata());
    } catch (error) {
      console.error('Error loading dictionaries:', error);
    }
  }, []);

  /**
   * Re-read who is signed in.
   *
   * The held user answers first so the browser never renders a frame as a stranger, then the server's
   * copy replaces it — a role granted or revoked since the token was stored decides which moderation
   * controls appear. A 401 clears both; any other failure leaves the held user standing.
   */
  const refreshAuth = useCallback(async () => {
    if (!COMMUNITY_ENABLED) return;
    const signedIn = AuthService.isAuthenticated();
    setIsAuthenticated(signedIn);
    if (!signedIn) {
      setCurrentUser(null);
      return;
    }

    const held = AuthService.getCurrentUser();
    setCurrentUser(held as WorldRecord | null);
    try {
      const refreshed = await AuthService.fetchUserProfile();
      if (refreshed) {
        setCurrentUser(refreshed as WorldRecord);
      } else {
        setIsAuthenticated(false);
        setCurrentUser(null);
      }
    } catch (error) {
      console.error('Error refreshing user profile:', error);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    void refreshWorlds();
    void refreshEntities();
    void refreshDictionaries();
    void refreshAuth();
  }, [open, refreshWorlds, refreshEntities, refreshDictionaries, refreshAuth]);

  // Dropped on close so a tab an event asked for doesn't outlive the visit it was asked for in.
  useEffect(() => {
    if (!open) setEventTab(undefined);
  }, [open]);

  const openImageViewer = useCallback((src: string | undefined, alt: string | undefined) => {
    if (!src) return;
    setViewerImage({ src, alt: alt || 'World image' });
    setImageViewerOpen(true);
  }, []);

  // Where an event's content lives. A contest is the browser's own tab; anything else is already here,
  // so the request falls back to whatever tab the caller opened on.
  const openEvent = useCallback((event: ServerEvent) => {
    setEventTab(isContestEvent(event) ? 'contest' : undefined);
  }, []);

  // Only while it is on screen: the app already runs one events poll, and a second permanent one would
  // double the only interval it has.
  const events = useActiveEvents({ enabled: open });

  return (
    <>
      <CommunityCreationsBrowser
        open={open}
        onOpenChange={onOpenChange}
        presentation={presentation}
        worlds={worlds}
        setWorlds={setWorlds}
        entities={entities}
        dictionaries={dictionaries}
        refreshEntities={refreshEntities}
        refreshDictionaries={refreshDictionaries}
        isAuthenticated={isAuthenticated}
        currentUser={currentUser}
        openImageViewer={openImageViewer}
        initialTab={eventTab ?? initialTab}
        openListing={openListing}
        onListingOpened={onListingOpened}
        openLikersOnMount={openLikersOnMount}
        events={events}
        onOpenEvent={openEvent}
      />

      {/* The viewer the details modal's thumbnails open into. Portaled, so it sits above either shell. */}
      <ImageZoomViewer
        open={imageViewerOpen}
        onOpenChange={setImageViewerOpen}
        alt={viewerImage.alt}
        src={viewerImage.src}
      />
    </>
  );
};

export default CommunityBrowserHost;
