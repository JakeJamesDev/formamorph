// Storage is real (in-memory), and the flow and its libraries open IndexedDB on mount.
import 'fake-indexeddb/auto';
import { useEffect, useRef, useState } from 'react';
import { render } from '@testing-library/react';
import { ThemeProvider } from '@/components/theme-provider';
import { TooltipProvider } from '@/components/ui/tooltip';
import type { WorldRecord } from '@/components/WorldDetails';
import { GameDataProvider, useGameData } from '@/contexts/GameDataContext';
import { PlaceholderSessionProvider } from '@/contexts/PlaceholderSessionContext';
import { SettingsProvider } from '@/contexts/SettingsContext';
import { readDefaultPersona } from '@/lib/personaPick';
import { useReadmeVisibility } from '@/lib/useReadmeVisibility';
import DictionaryStorageService from '@/services/DictionaryStorageService';
import EntityStorageService from '@/services/EntityStorageService';
import WorldStorageService from '@/services/WorldStorageService';
import type { DictionaryMetadata, EntityMetadata, World } from '@/types';
import EnterWorldFlow, { type EnterWorldFlowHandle, type StartGame } from '@/views/EnterWorldFlow';

/** What the main menu gives the flow: the stored worlds and libraries, the selected world, and the state it holds. */
function EnterWorldHost({ onStartGame }: { onStartGame: StartGame }) {
  const { loadWorldData } = useGameData();
  const { showReadme, setShowReadme } = useReadmeVisibility();
  const flow = useRef<EnterWorldFlowHandle>(null);
  const [worlds, setWorlds] = useState<WorldRecord[]>([]);
  const [entities, setEntities] = useState<EntityMetadata[]>([]);
  const [dictionaries, setDictionaries] = useState<DictionaryMetadata[]>([]);
  const [selected, setSelected] = useState<WorldRecord | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [introOpen, setIntroOpen] = useState(false);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [defaultPersona] = useState(readDefaultPersona);

  useEffect(() => {
    void (async () => {
      // The worlds come last, so a world on screen has its libraries behind it.
      setEntities(await EntityStorageService.getEntityMetadata());
      setDictionaries(await DictionaryStorageService.getDictionaryMetadata());
      setWorlds(await WorldStorageService.getWorldMetadata() as WorldRecord[]);
    })();
  }, []);

  const select = async (record: WorldRecord) => {
    const data = await WorldStorageService.getWorldData(record.id);
    const { world } = loadWorldData(data as World, true, { stored: true });
    setSelected({ ...record, data: world });
    setDetailsOpen(true);
  };
  const startEntry = () => {
    setDetailsOpen(false);
    flow.current?.start();
  };

  return (
    <>
      {!(avatarOpen && !introOpen) && (
        <>
          {worlds.map((record) => <button key={record.id} type="button" onClick={() => void select(record)}>{record.name}</button>)}
          {detailsOpen && (
            <>
              <button type="button" onClick={startEntry}>Enter World</button>
              <button type="button" onClick={() => flow.current?.quickStart()}>Quick Start</button>
            </>
          )}
        </>
      )}
      <EnterWorldFlow
        ref={flow}
        world={selected}
        libraryEntities={entities}
        libraryDictionaries={dictionaries}
        signedInId={undefined}
        defaultPersona={defaultPersona}
        showReadme={showReadme}
        setShowReadme={setShowReadme}
        introOpen={introOpen}
        setIntroOpen={setIntroOpen}
        avatarOpen={avatarOpen}
        setAvatarOpen={setAvatarOpen}
        onStartGame={onStartGame}
      />
    </>
  );
}

/** Enter World under the app's providers it reads, with the main menu's part reduced to its controls. */
export function renderEnterWorld({ onStartGame = () => {} }: { onStartGame?: StartGame } = {}) {
  return render(
    <ThemeProvider>
      <TooltipProvider>
        <SettingsProvider>
          <GameDataProvider>
            <PlaceholderSessionProvider>
              <EnterWorldHost onStartGame={onStartGame} />
            </PlaceholderSessionProvider>
          </GameDataProvider>
        </SettingsProvider>
      </TooltipProvider>
    </ThemeProvider>,
  );
}
