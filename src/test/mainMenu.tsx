// Storage is real (in-memory): MainMenu's libraries, the world context and the caches all open
// IndexedDB on mount. Must be imported before anything touches `indexedDB`.
import 'fake-indexeddb/auto';
import { render } from '@testing-library/react';
import { ThemeProvider } from '@/components/theme-provider';
import { TooltipProvider } from '@/components/ui/tooltip';
import { SettingsProvider } from '@/contexts/SettingsContext';
import { GameDataProvider } from '@/contexts/GameDataContext';
import { PlaceholderSessionProvider } from '@/contexts/PlaceholderSessionContext';
import { UserProfileProvider } from '@/contexts/UserProfileContext';
import { AgeGateProvider } from '@/contexts/AgeGateContext';
import { PrivacyPolicyProvider } from '@/contexts/PrivacyPolicyContext';
import { AccountDeletionProvider } from '@/contexts/AccountDeletionContext';
import MainMenu from '@/views/MainMenu';

/**
 * Render the real main menu under the real app providers — the same stack `App.tsx` puts up, in the same
 * order, so a surface reached from here behaves as it does in the app.
 *
 * Nothing here is stubbed. Anything a case needs to hold still (the events poll, the toast container) is
 * `vi.mock`ed by the calling test file, because mocks hoist per file and cannot live in a helper.
 */
export function renderMainMenu(props: Partial<React.ComponentProps<typeof MainMenu>> = {}) {
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
                  <MainMenu
                    onStartGame={() => {}}
                    onLoadSaveGame={() => {}}
                    onReplayIntro={() => {}}
                    introActive={false}
                    {...props}
                  />
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
