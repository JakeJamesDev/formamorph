import { useEffect, useState } from 'react';
import { ThemeProvider } from "./components/theme-provider";
import { useDevRoute, installDevRouter, registerDevHook } from './lib/devRouter';
import { installViewportHeightVar, APP_HEIGHT_VAR } from './lib/viewportHeight';
import { type DevView } from './lib/devRoutes';
import { DevFixtureLoader } from './components/DevFixtureLoader';
import { ViewportReadout } from './components/ViewportReadout';
import { GameDataProvider } from './contexts/GameDataContext';
import { UserProfileProvider } from './contexts/UserProfileContext';
import { SettingsProvider } from './contexts/SettingsContext';
import { GameplayProvider } from './contexts/GameplayContext';
import { PlaceholderSessionProvider, usePlaceholderSession } from './contexts/PlaceholderSessionContext';
import { LocalEngineManager } from './components/LocalEngineManager';
import { IntroSequence } from './components/IntroSequence';
import GameViewer from './views/GameViewer';
import MainMenu from './views/MainMenu';
import type { CharacterData, Dictionary, Entity } from '@/types';

/** Set once the first-run welcome intro has played, so it never auto-plays again on this device. */
const INTRO_SEEN_KEY = 'FORMAMORPH_introSeen';

/** The view switch and the enter-world handoff. Inside the providers, so it can drive the world session. */
function AppViews() {
  const [currentView, setCurrentView] = useState<DevView>('mainMenu');
  const devRoute = useDevRoute();
  const { beginSession, endSession } = usePlaceholderSession();

  // First-run welcome intro: cinematic on the first ever launch (kicker + slow reveal), snappy on replay.
  // Suppressed when a dev-router hash is steering the app somewhere specific, so verification isn't blocked.
  const [introPace, setIntroPace] = useState<'cine' | 'snap' | null>(() => {
    if (typeof window === 'undefined') return null;
    if (window.location.hash.includes('dev')) return null;
    try { return localStorage.getItem(INTRO_SEEN_KEY) ? null : 'cine'; } catch { return null; }
  });
  const handleIntroDone = () => {
    setIntroPace(null);
    try { localStorage.setItem(INTRO_SEEN_KEY, '1'); } catch { /* private mode — just don't persist */ }
  };
  // DEV: `#dev?modal=intro` replays the cinematic intro so it can be verified in one jump.
  useEffect(() => {
    if (import.meta.env.DEV && devRoute?.modal === 'intro') setIntroPace('cine');
  }, [devRoute?.modal]);

  // Ask the browser to keep our IndexedDB (worlds, saves, library) exempt from eviction. Hosted/web builds
  // — notably the itch app's HTML wrapper — can otherwise clear non-persisted storage. Best-effort: the
  // desktop build's app://local origin is already durable, and a denied request is harmless.
  useEffect(() => {
    navigator.storage?.persist?.().catch(() => {});
  }, []);

  // DEV dev-router: install `window.__fmDev` and let a `#dev?view=…` hash drive the top-level screen so
  // preview verification can land in one call (see `devRouter.ts`). No-op / tree-shaken in production.
  useEffect(() => installDevRouter(), []);

  // Track the visual viewport into `--app-h` so full-height screens shrink for the on-screen keyboard
  // (see `viewportHeight.ts`). The DEV hook fakes the iOS case — a keyboard the layout viewport doesn't
  // know about — so the layout side is verifiable without a device; clearing it is what Chrome looks like.
  useEffect(() => installViewportHeightVar(), []);
  useEffect(() => registerDevHook('simulateKeyboard', ((px: number) => {
    const style = document.documentElement.style;
    if (px > 0) style.setProperty(APP_HEIGHT_VAR, `${document.documentElement.clientHeight - px}px`);
    else installViewportHeightVar();
  }) as (...args: never[]) => unknown), []);
  useEffect(() => {
    if (import.meta.env.DEV && devRoute?.view) setCurrentView(devRoute.view as DevView);
  }, [devRoute?.view]);
  const [selectedTraits, setSelectedTraits] = useState<string[]>([]);
  const [initialCharacterData, setInitialCharacterData] = useState<CharacterData | null>(null);
  const [initialLocationId, setInitialLocationId] = useState<string | null>(null);
  const [initialDictionaries, setInitialDictionaries] = useState<Dictionary[] | null>(null);
  const [initialCharacters, setInitialCharacters] = useState<Entity[] | null>(null);
  const [initialSaveId, setInitialSaveId] = useState<string | null>(null);

  const handleStartGame = (
    traits: string[],
    customCharacterData: CharacterData | null,
    _isNewGame?: boolean,
    startingLocationId?: string | null,
    dictionaries?: Dictionary[] | null,
    characters?: Entity[] | null,
  ) => {
    setSelectedTraits(traits);
    setInitialCharacterData(customCharacterData);
    setInitialLocationId(startingLocationId ?? null);
    setInitialDictionaries(dictionaries ?? null);
    setInitialCharacters(characters ?? null);
    setInitialSaveId(null); // a fresh game, not a cold-loaded save
    // Quick Start reaches here without passing through the enter-world flow, so it opens the session itself.
    // Already-open is a no-op that keeps the flow's rolls, which is what makes the normal path idempotent.
    beginSession();
    setCurrentView('gameViewer');
  };

  // Cold-load a save from the main menu: its world is loaded into GameData first (by MainMenu), then we
  // enter the game view with the save id so GameViewer restores it on mount instead of starting fresh.
  const handleLoadSaveGame = (saveId: string) => {
    setInitialSaveId(saveId);
    // The save's own rolls arrive with the restore, a beat later. Opening empty is right: priming preserves
    // whatever rolls exist, so the restored values win and are then topped up with any placement the save
    // predates.
    beginSession();
    setCurrentView('gameViewer');
  };

  const handleExitToMenu = () => {
    // Ends the playthrough's rolls too — the next world entry draws its own.
    endSession();
    setCurrentView('mainMenu');
  };

  return (
    <>
      <DevFixtureLoader />
      {import.meta.env.DEV && devRoute?.probe === 'viewport' && <ViewportReadout />}
      {currentView === 'mainMenu' && (
            <MainMenu
              onStartGame={handleStartGame}
              onLoadSaveGame={handleLoadSaveGame}
              onReplayIntro={() => setIntroPace('snap')}
              introActive={introPace !== null}
            />
          )}
          {currentView === 'mainMenu' && introPace && (
            <IntroSequence pace={introPace} onComplete={handleIntroDone} />
          )}
          {currentView === 'gameViewer' && (
            <GameplayProvider>
              <GameViewer
                initialTraits={selectedTraits}
                initialCharacterData={initialCharacterData}
                initialLocationId={initialLocationId}
                initialDictionaries={initialDictionaries}
                initialCharacters={initialCharacters}
                initialSaveId={initialSaveId}
                onExitToMenu={handleExitToMenu}
              />
        </GameplayProvider>
      )}
    </>
  );
}

function App() {
  return (
    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
      <SettingsProvider>
        <LocalEngineManager />
        <GameDataProvider>
          {/* Above the view switch: a playthrough's placeholder rolls are drawn in the enter-world flow,
              which the main menu owns, and read again by the game view. */}
          <PlaceholderSessionProvider>
            {/* One profile dialog for the whole app: names are clicked from inside other dialogs, and a
                nested one would inherit their scroll lock and their width. */}
            <UserProfileProvider>
              <AppViews />
            </UserProfileProvider>
          </PlaceholderSessionProvider>
        </GameDataProvider>
      </SettingsProvider>
    </ThemeProvider>
  );
}

export default App;
