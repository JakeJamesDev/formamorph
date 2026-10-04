// Storage is real (in-memory): MainMenu's libraries, the world context and the caches all open
// IndexedDB on mount. Must be imported before anything touches `indexedDB`.
import 'fake-indexeddb/auto';
import type { ReactNode } from 'react';
import { render } from '@testing-library/react';
import { SurfaceLayer, SurfaceReporterContext, type SurfaceReporter } from '@/components/ui/surface';
import { ThemeProvider } from '@/components/theme-provider';
import { TooltipProvider } from '@/components/ui/tooltip';
import { SettingsProvider } from '@/contexts/SettingsContext';
import { GameDataProvider } from '@/contexts/GameDataContext';
import { PlaceholderSessionProvider } from '@/contexts/PlaceholderSessionContext';
import { UserProfileProvider } from '@/contexts/UserProfileContext';
import { AgeGateProvider } from '@/contexts/AgeGateContext';
import { PrivacyPolicyProvider } from '@/contexts/PrivacyPolicyContext';
import { AccountDeletionProvider } from '@/contexts/AccountDeletionContext';
import { SignInHost } from '@/components/SignInHost';
import { COMMUNITY_ENABLED } from '@/lib/featureFlags';
import MainMenu from '@/views/MainMenu';

/**
 * Render the real main menu under the real app providers — the same stack `App.tsx` puts up, in the same
 * order, so a surface reached from here behaves as it does in the app.
 *
 * `registry` receives what the menu reports as open; `children` mount inside the providers, beside the menu.
 *
 * Nothing here is stubbed. Anything a case needs to hold still (the events poll, the toast container) is
 * `vi.mock`ed by the calling test file, because mocks hoist per file and cannot live in a helper.
 */
export function renderMainMenu(
  props: Partial<React.ComponentProps<typeof MainMenu>> = {},
  { registry = null, children }: { registry?: SurfaceReporter | null; children?: ReactNode } = {},
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
                  {COMMUNITY_ENABLED && <SignInHost />}
                  {children}
                  <SurfaceReporterContext.Provider value={registry}>
                    <SurfaceLayer id="mainMenu">
                      <MainMenu
                        onStartGame={() => {}}
                        onLoadSaveGame={() => {}}
                        onReplayIntro={() => {}}
                        introActive={false}
                        {...props}
                      />
                    </SurfaceLayer>
                  </SurfaceReporterContext.Provider>
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
