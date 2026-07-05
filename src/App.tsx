import { useState } from 'react';
import { ThemeProvider } from "./components/theme-provider";
import { GameDataProvider } from './contexts/GameDataContext';
import { SettingsProvider } from './contexts/SettingsContext';
import { GameplayProvider } from './contexts/GameplayContext';
import GameViewer from './views/GameViewer';
import WorldEditor from './views/WorldEditor';
import MainMenu from './views/MainMenu';
import type { CharacterData, Dictionary } from '@/types';


function App() {
  const [currentView, setCurrentView] = useState<'mainMenu' | 'gameViewer' | 'worldEditor'>('mainMenu');
  const [selectedTraits, setSelectedTraits] = useState<string[]>([]);
  const [initialCharacterData, setInitialCharacterData] = useState<CharacterData | null>(null);
  const [initialLocationId, setInitialLocationId] = useState<string | null>(null);
  const [initialDictionaries, setInitialDictionaries] = useState<Dictionary[] | null>(null);

  const handleStartGame = (
    traits: string[],
    customCharacterData: CharacterData | null,
    _isNewGame?: boolean,
    startingLocationId?: string | null,
    dictionaries?: Dictionary[] | null,
  ) => {
    setSelectedTraits(traits);
    setInitialCharacterData(customCharacterData);
    setInitialLocationId(startingLocationId ?? null);
    setInitialDictionaries(dictionaries ?? null);
    setCurrentView('gameViewer');
  };

  const handleExitToMenu = () => {
    setCurrentView('mainMenu');
  };

  const handleOpenWorldEditor = () => {
    setCurrentView('worldEditor');
  };

  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <SettingsProvider>
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
