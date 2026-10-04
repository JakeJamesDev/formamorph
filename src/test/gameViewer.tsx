// Storage is real (in-memory): the providers and the game view open IndexedDB on mount. Must be imported
// before anything touches `indexedDB`.
import 'fake-indexeddb/auto';
import { useEffect, useState, type ReactNode } from 'react';
import { render } from '@testing-library/react';
import { ThemeProvider } from '@/components/theme-provider';
import { TooltipProvider } from '@/components/ui/tooltip';
import { SurfaceLayer, SurfaceReporterContext, type SurfaceReporter } from '@/components/ui/surface';
import { SettingsProvider } from '@/contexts/SettingsContext';
import { GameDataProvider, useGameData } from '@/contexts/GameDataContext';
import { PlaceholderSessionProvider } from '@/contexts/PlaceholderSessionContext';
import { UserProfileProvider } from '@/contexts/UserProfileContext';
import { AgeGateProvider } from '@/contexts/AgeGateContext';
import { PrivacyPolicyProvider } from '@/contexts/PrivacyPolicyContext';
import { AccountDeletionProvider } from '@/contexts/AccountDeletionContext';
import { GameplayProvider } from '@/contexts/GameplayContext';
import GameViewer from '@/views/GameViewer';
import type { World } from '@/types';

/** Loads the world into GameData first, the way the main menu does before it enters the game. */
// eslint-disable-next-line react-refresh/only-export-components -- test-only module; nothing is hot-reloaded
function WithWorld({ world, children }: { world: World; children: ReactNode }) {
  const { loadWorldData } = useGameData();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    loadWorldData(world);
    setReady(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- once, as an entry does
  return ready ? children : null;
}

/**
 * Render the real game view under the real app providers, in `App.tsx`'s order, on a loaded world.
 * The calling file mocks what jsdom cannot run: `@/views/VRMViewer`, `kokoro-js`, and the toast module.
 */
export function renderGameViewer(
  world: World,
  { onExitToMenu = () => {}, registry = null, children }: {
    onExitToMenu?: () => void;
    registry?: SurfaceReporter | null;
    children?: ReactNode;
  } = {},
) {
  return render(
    <ThemeProvider>
      <TooltipProvider>
        <SettingsProvider>
          <GameDataProvider>
            <PlaceholderSessionProvider>
              <UserProfileProvider>
                <AgeGateProvider>
                  <AccountDeletionProvider>
                    <PrivacyPolicyProvider>
                      {children}
                      <WithWorld world={world}>
                        <SurfaceReporterContext.Provider value={registry}>
                          <SurfaceLayer id="gameViewer">
                            <GameplayProvider>
                              <GameViewer initialCharacterData={null} onExitToMenu={onExitToMenu} />
                            </GameplayProvider>
                          </SurfaceLayer>
                        </SurfaceReporterContext.Provider>
                      </WithWorld>
                    </PrivacyPolicyProvider>
                  </AccountDeletionProvider>
                </AgeGateProvider>
              </UserProfileProvider>
            </PlaceholderSessionProvider>
          </GameDataProvider>
        </SettingsProvider>
      </TooltipProvider>
    </ThemeProvider>,
  );
}
