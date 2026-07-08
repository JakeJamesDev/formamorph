import { useEffect, useState } from 'react';
import { ThemeProvider } from "./components/theme-provider";
import { useDevRoute, installDevRouter } from './lib/devRouter';
import { type DevView } from './lib/devRoutes';
import { GameDataProvider } from './contexts/GameDataContext';
import { SettingsProvider } from './contexts/SettingsContext';
import { GameplayProvider } from './contexts/GameplayContext';
import { LocalEngineManager } from './components/LocalEngineManager';
import GameViewer from './views/GameViewer';
import WorldEditor from './views/WorldEditor';
import MainMenu from './views/MainMenu';
import type { CharacterData, Dictionary, Entity } from '@/types';


function App() {
  const [currentView, setCurrentView] = useState<DevView>('mainMenu');
  const devRoute = useDevRoute();

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
    setCurrentView('gameViewer');
  };

  const handleExitToMenu = () => {
    setCurrentView('mainMenu');
  };

  const handleOpenWorldEditor = () => {
    setCurrentView('worldEditor');
  };

  return (
    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
      <SettingsProvider>
        <LocalEngineManager />
        <GameDataProvider>
          {currentView === 'mainMenu' && (
            <MainMenu
              onStartGame={handleStartGame}
              onOpenWorldEditor={handleOpenWorldEditor}
            />
          )}
          {currentView === 'gameViewer' && (
            <GameplayProvider>
              <GameViewer
                initialTraits={selectedTraits}
                initialCharacterData={initialCharacterData}
                initialLocationId={initialLocationId}
                initialDictionaries={initialDictionaries}
                initialCharacters={initialCharacters}
                onExitToMenu={handleExitToMenu}
              />
            </GameplayProvider>
          )}
          {currentView === 'worldEditor' && (
            <WorldEditor onClose={() => setCurrentView('mainMenu')} />
          )}
        </GameDataProvider>
      </SettingsProvider>
    </ThemeProvider>
  );
}

export default App;
