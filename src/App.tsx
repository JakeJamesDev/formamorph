import { useState } from 'react';
import { ThemeProvider } from "./components/theme-provider";
import { GameDataProvider } from './contexts/GameDataContext';
import { SettingsProvider } from './contexts/SettingsContext';
import { GameplayProvider } from './contexts/GameplayContext';
import GameViewer from './views/GameViewer';
import WorldEditor from './views/WorldEditor';
import MainMenu from './views/MainMenu';
import type { CharacterData } from '@/types';


function App() {
  const [currentView, setCurrentView] = useState<'mainMenu' | 'gameViewer' | 'worldEditor'>('mainMenu');
  const [selectedTraits, setSelectedTraits] = useState<string[]>([]);
  const [initialCharacterData, setInitialCharacterData] = useState<CharacterData | null>(null);

  const handleStartGame = (traits: string[], customCharacterData: CharacterData | null) => {
    setSelectedTraits(traits);
    setInitialCharacterData(customCharacterData);
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
