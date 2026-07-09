import { useEffect, useState } from 'react';
import { ThemeProvider } from "./components/theme-provider";
import { useDevRoute, installDevRouter } from './lib/devRouter';
import { type DevView } from './lib/devRoutes';
import { DevFixtureLoader } from './components/DevFixtureLoader';
import { GameDataProvider } from './contexts/GameDataContext';
import { SettingsProvider } from './contexts/SettingsContext';
import { GameplayProvider } from './contexts/GameplayContext';
import { LocalEngineManager } from './components/LocalEngineManager';
import { IntroSequence } from './components/IntroSequence';
import GameViewer from './views/GameViewer';
import MainMenu from './views/MainMenu';
import type { CharacterData, Dictionary, Entity } from '@/types';

/** Set once the first-run welcome intro has played, so it never auto-plays again on this device. */
const INTRO_SEEN_KEY = 'FORMAMORPH_introSeen';

function App() {
  const [currentView, setCurrentView] = useState<DevView>('mainMenu');
  const devRoute = useDevRoute();

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

  // DEV dev-router: install `window.__fmDev` and let a `#dev?view=…` hash drive the top-level screen so
  // preview verification can land in one call (see `devRouter.ts`). No-op / tree-shaken in production.
  useEffect(() => installDevRouter(), []);
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
    setCurrentView('gameViewer');
  };

  // Cold-load a save from the main menu: its world is loaded into GameData first (by MainMenu), then we
  // enter the game view with the save id so GameViewer restores it on mount instead of starting fresh.
  const handleLoadSaveGame = (saveId: string) => {
    setInitialSaveId(saveId);
    setCurrentView('gameViewer');
  };

  const handleExitToMenu = () => {
    setCurrentView('mainMenu');
  };

  return (
    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
      <SettingsProvider>
        <LocalEngineManager />
        <GameDataProvider>
          <DevFixtureLoader />
          {currentView === 'mainMenu' && (
            <MainMenu
              onStartGame={handleStartGame}
              onLoadSaveGame={handleLoadSaveGame}
              onReplayIntro={() => setIntroPace('snap')}
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
        </GameDataProvider>
      </SettingsProvider>
    </ThemeProvider>
  );
}

export default App;
