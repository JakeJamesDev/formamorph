import React, { useState } from 'react';
import { ThemeProvider } from "./components/theme-provider";
import { GameDataProvider } from './contexts/GameDataContext';
import { SettingsProvider } from './contexts/SettingsContext';
import { GameplayProvider } from './contexts/GameplayContext';
import GameViewer from './views/GameViewer';
import WorldEditor from './views/WorldEditor';
import MainMenu from './views/MainMenu';

function App() {
  const [currentView, setCurrentView] = useState('mainMenu');
  const [selectedTraits, setSelectedTraits] = useState([]);
  const [initialCharacterData, setInitialCharacterData] = useState(null);

  const handleStartGame = (traits, customCharacterData) => {
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
      <GameDataProvider>
        {currentView === 'mainMenu' && (
          <MainMenu 
            onStartGame={handleStartGame}
            onOpenWorldEditor={handleOpenWorldEditor}
          />
        )}
        {currentView === 'gameViewer' && (
          <GameplayProvider>
          <SettingsProvider>
            <GameViewer 
              initialTraits={selectedTraits} 
              initialCharacterData={initialCharacterData}
              onExitToMenu={handleExitToMenu}
            />
          </SettingsProvider>
          </GameplayProvider>
        )}
        {currentView === 'worldEditor' && (
          <WorldEditor onClose={() => setCurrentView('mainMenu')} />
        )}
      </GameDataProvider>
    </ThemeProvider>
  );
}

export default App;
